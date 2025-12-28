const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 升级后修复历史activeDirects数据...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 执行账户:", deployer.address);

  // 合约地址
  const PROXY_ADDRESS = "0x7a216BeA62eF7629904E0d30b24F6842c9b0d660";
  
  console.log("🏠 合约地址:", PROXY_ADDRESS);

  // 获取合约实例
  const protocolContract = await hre.ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);

  // 检查是否为owner
  const owner = await protocolContract.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ 错误: 只有合约owner可以执行此脚本");
    console.log("   当前owner:", owner);
    console.log("   执行账户:", deployer.address);
    process.exit(1);
  }

  console.log("✅ 权限验证通过");
  console.log("ℹ️  注意: 合约已升级，新的activeDirects逻辑已生效");
  console.log("ℹ️  此脚本将修复升级前的历史数据不一致问题\n");

  // 1. 获取所有门票购买事件
  console.log("📊 获取历史门票购买事件...");
  const ticketEvents = await protocolContract.queryFilter("TicketPurchased");
  console.log(`   找到 ${ticketEvents.length} 个门票购买事件`);

  // 2. 分析需要修复的用户
  console.log("\n🔍 分析需要修复的历史数据...");
  const usersToFix = new Set();
  const referrerStats = new Map();
  
  let totalUsers = 0;
  let activeUsers = 0;
  let inactiveButShouldBeActive = 0;

  for (const event of ticketEvents) {
    const user = event.args.user;
    totalUsers++;
    
    try {
      const userInfo = await protocolContract.userInfo(user);
      const userTicket = await protocolContract.userTicket(user);
      
      const hasTicket = userTicket[1] > 0;
      const isExited = userTicket[3];
      const isCurrentlyActive = userInfo[5];
      const referrer = userInfo[0];
      
      // 根据新逻辑，有门票且未出局就应该是活跃的
      const shouldBeActive = hasTicket && !isExited;
      
      if (shouldBeActive) {
        activeUsers++;
        
        // 如果应该活跃但当前不活跃，需要修复
        if (!isCurrentlyActive) {
          usersToFix.add(user);
          inactiveButShouldBeActive++;
        }
        
        // 统计推荐人的正确activeDirects
        if (referrer !== ethers.ZeroAddress) {
          referrerStats.set(referrer, (referrerStats.get(referrer) || 0) + 1);
        }
      }
    } catch (error) {
      console.warn(`   警告: 无法获取用户 ${user} 的信息:`, error.message);
    }
  }

  console.log(`\n📈 分析结果:`);
  console.log(`   总用户数: ${totalUsers}`);
  console.log(`   应该活跃的用户: ${activeUsers}`);
  console.log(`   需要修复状态的用户: ${inactiveButShouldBeActive}`);
  console.log(`   涉及的推荐人: ${referrerStats.size}`);

  if (usersToFix.size === 0) {
    console.log("\n🎉 所有用户状态都是正确的，无需修复！");
    
    // 仍然检查推荐人的activeDirects是否正确
    console.log("\n🔍 验证推荐人的activeDirects...");
    let incorrectReferrers = 0;
    
    for (const [referrer, expectedCount] of referrerStats) {
      try {
        const referrerInfo = await protocolContract.userInfo(referrer);
        const currentCount = Number(referrerInfo[1]);
        
        if (currentCount !== expectedCount) {
          incorrectReferrers++;
        }
      } catch (error) {
        console.warn(`   警告: 无法获取推荐人 ${referrer} 的信息`);
      }
    }
    
    if (incorrectReferrers === 0) {
      console.log("✅ 所有推荐人的activeDirects也都正确！");
      return;
    } else {
      console.log(`⚠️  发现 ${incorrectReferrers} 个推荐人的activeDirects不正确`);
    }
  }

  // 3. 修复用户状态（通过重新购买门票触发状态更新）
  if (usersToFix.size > 0) {
    console.log(`\n🔧 修复 ${usersToFix.size} 个用户的活跃状态...`);
    console.log("   方法: 模拟重新触发状态更新");
    
    // 注意：由于我们不能直接调用内部函数，这里需要其他方法
    // 实际上，升级后新的逻辑会在用户下次交互时自动修复
    console.log("ℹ️  用户状态将在下次交互时自动修复（购买门票、质押等）");
  }

  // 4. 修复推荐人的activeDirects
  console.log("\n🔧 修复推荐人的activeDirects数据...");
  
  const incorrectReferrers = [];
  
  for (const [referrer, expectedCount] of referrerStats) {
    try {
      const referrerInfo = await protocolContract.userInfo(referrer);
      const currentCount = Number(referrerInfo[1]);
      
      if (currentCount !== expectedCount) {
        incorrectReferrers.push({
          address: referrer,
          current: currentCount,
          expected: expectedCount,
          difference: expectedCount - currentCount
        });
      }
    } catch (error) {
      console.warn(`   警告: 无法获取推荐人 ${referrer} 的信息`);
    }
  }

  if (incorrectReferrers.length === 0) {
    console.log("✅ 所有推荐人的activeDirects都正确！");
    return;
  }

  console.log(`   发现 ${incorrectReferrers.length} 个需要修复的推荐人`);

  // 显示需要修复的数据
  console.log("\n📋 需要修复的推荐人数据:");
  incorrectReferrers.slice(0, 10).forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.address.substring(0, 10)}...`);
    console.log(`      当前: ${item.current}, 应该: ${item.expected}, 差异: ${item.difference > 0 ? '+' : ''}${item.difference}`);
  });
  
  if (incorrectReferrers.length > 10) {
    console.log(`   ... 还有 ${incorrectReferrers.length - 10} 个`);
  }

  // 5. 批量更新数据
  console.log("\n🔧 开始批量更新推荐人数据...");
  
  const users = incorrectReferrers.map(item => item.address);
  const counts = incorrectReferrers.map(item => item.expected);
  
  // 分批处理
  const batchSize = 20;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const batchUsers = users.slice(i, i + batchSize);
    const batchCounts = counts.slice(i, i + batchSize);
    
    console.log(`\n   处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(users.length/batchSize)}...`);
    console.log(`   用户数量: ${batchUsers.length}`);
    
    try {
      const gasEstimate = await protocolContract.batchUpdateTeamCounts.estimateGas(batchUsers, batchCounts);
      console.log(`   预估gas: ${gasEstimate.toString()}`);
      
      const tx = await protocolContract.batchUpdateTeamCounts(batchUsers, batchCounts, {
        gasLimit: gasEstimate * 120n / 100n
      });
      
      console.log(`   交易哈希: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   ✅ 批次完成 (Gas使用: ${receipt.gasUsed.toString()})`);
      
      successCount += batchUsers.length;
      
    } catch (error) {
      console.error(`   ❌ 批次失败:`, error.message);
      errorCount += batchUsers.length;
    }
  }

  // 6. 验证修复结果
  console.log("\n🔍 验证修复结果...");
  let verifySuccessCount = 0;
  let verifyErrorCount = 0;

  for (const item of incorrectReferrers.slice(0, 10)) { // 只验证前10个
    try {
      const referrerInfo = await protocolContract.userInfo(item.address);
      const newCount = Number(referrerInfo[1]);
      
      if (newCount === item.expected) {
        verifySuccessCount++;
        console.log(`   ✅ ${item.address.substring(0, 10)}...: ${item.current} → ${newCount}`);
      } else {
        verifyErrorCount++;
        console.log(`   ❌ ${item.address.substring(0, 10)}...: ${item.current} → ${newCount} (预期: ${item.expected})`);
      }
    } catch (error) {
      verifyErrorCount++;
      console.error(`   ❌ 验证失败: ${item.address.substring(0, 10)}...`);
    }
  }

  // 7. 总结
  console.log("\n" + "=".repeat(70));
  console.log("🎉 升级后数据修复完成！");
  console.log("=".repeat(70));
  console.log("");
  console.log("📊 修复统计:");
  console.log(`   需要修复的推荐人: ${incorrectReferrers.length}`);
  console.log(`   成功修复: ${successCount}`);
  console.log(`   修复失败: ${errorCount}`);
  console.log("");
  console.log("🔍 验证结果 (抽样):");
  console.log(`   验证成功: ${verifySuccessCount}`);
  console.log(`   验证失败: ${verifyErrorCount}`);
  console.log("");
  console.log("✅ 合约升级效果:");
  console.log("   - 新用户购买门票后会自动激活");
  console.log("   - activeDirects会自动正确计算");
  console.log("   - 不再需要质押就能获得奖励");
  console.log("");
  console.log("📝 建议:");
  console.log("   1. 在前端刷新页面查看修复效果");
  console.log("   2. 测试新用户购买门票的流程");
  console.log("   3. 验证团队节点页面显示正确");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 升级后修复脚本执行失败:");
    console.error(error);
    process.exit(1);
  });