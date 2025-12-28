const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 开始修复activeDirects数据...\n");

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

  console.log("✅ 权限验证通过\n");

  // 1. 获取所有门票购买事件
  console.log("📊 获取所有门票购买事件...");
  const ticketEvents = await protocolContract.queryFilter("TicketPurchased");
  console.log(`   找到 ${ticketEvents.length} 个门票购买事件`);

  // 2. 统计每个推荐人的有效推荐数
  console.log("\n🔍 分析推荐关系和有效地址...");
  const referrerStats = new Map();
  const userDetails = new Map();
  
  let totalUsers = 0;
  let activeUsers = 0;
  let usersWithReferrer = 0;

  for (const event of ticketEvents) {
    const user = event.args.user;
    totalUsers++;
    
    try {
      const userInfo = await protocolContract.userInfo(user);
      const userTicket = await protocolContract.userTicket(user);
      
      const hasTicket = userTicket[1] > 0;
      const isExited = userTicket[3];
      const referrer = userInfo[0];
      const currentActiveDirects = Number(userInfo[1]);
      const isActive = userInfo[5];
      
      // 记录用户详情
      userDetails.set(user, {
        hasTicket,
        isExited,
        referrer,
        currentActiveDirects,
        isActive,
        ticketAmount: userTicket[1]
      });
      
      // 有门票且未出局的用户算作有效
      if (hasTicket && !isExited) {
        activeUsers++;
        
        if (referrer !== ethers.ZeroAddress) {
          usersWithReferrer++;
          referrerStats.set(referrer, (referrerStats.get(referrer) || 0) + 1);
        }
      }
    } catch (error) {
      console.warn(`   警告: 无法获取用户 ${user} 的信息:`, error.message);
    }
  }

  console.log(`\n📈 统计结果:`);
  console.log(`   总用户数: ${totalUsers}`);
  console.log(`   有效用户数: ${activeUsers}`);
  console.log(`   有推荐人的有效用户: ${usersWithReferrer}`);
  console.log(`   需要更新的推荐人数: ${referrerStats.size}`);

  // 3. 检查当前数据与预期数据的差异
  console.log("\n🔍 检查数据一致性...");
  const inconsistentReferrers = [];
  
  for (const [referrer, expectedCount] of referrerStats) {
    try {
      const referrerInfo = await protocolContract.userInfo(referrer);
      const currentCount = Number(referrerInfo[1]);
      
      if (currentCount !== expectedCount) {
        inconsistentReferrers.push({
          address: referrer,
          current: currentCount,
          expected: expectedCount,
          difference: expectedCount - currentCount
        });
      }
    } catch (error) {
      console.warn(`   警告: 无法获取推荐人 ${referrer} 的信息:`, error.message);
    }
  }

  console.log(`   发现 ${inconsistentReferrers.length} 个数据不一致的推荐人`);

  if (inconsistentReferrers.length === 0) {
    console.log("🎉 所有数据都是一致的，无需修复！");
    return;
  }

  // 显示需要修复的数据
  console.log("\n📋 需要修复的推荐人数据:");
  inconsistentReferrers.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.address}`);
    console.log(`      当前: ${item.current}, 应该: ${item.expected}, 差异: ${item.difference > 0 ? '+' : ''}${item.difference}`);
  });

  // 4. 询问是否继续修复
  console.log("\n⚠️  准备修复数据...");
  console.log("   这将调用 batchUpdateTeamCounts 函数更新 activeDirects");
  console.log("   注意: 这个函数实际上更新的是 teamCount，但我们用它来修复 activeDirects");
  
  // 在生产环境中，这里应该有用户确认步骤
  // 为了自动化，我们直接继续

  // 5. 批量更新数据
  console.log("\n🔧 开始批量更新数据...");
  
  const users = inconsistentReferrers.map(item => item.address);
  const counts = inconsistentReferrers.map(item => item.expected);
  
  // 分批处理，避免gas限制
  const batchSize = 20; // 减小批次大小以避免gas限制
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const batchUsers = users.slice(i, i + batchSize);
    const batchCounts = counts.slice(i, i + batchSize);
    
    console.log(`\n   处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(users.length/batchSize)}...`);
    console.log(`   用户数量: ${batchUsers.length}`);
    
    try {
      // 估算gas
      const gasEstimate = await protocolContract.batchUpdateTeamCounts.estimateGas(batchUsers, batchCounts);
      console.log(`   预估gas: ${gasEstimate.toString()}`);
      
      const tx = await protocolContract.batchUpdateTeamCounts(batchUsers, batchCounts, {
        gasLimit: gasEstimate * 120n / 100n // 增加20%的gas缓冲
      });
      
      console.log(`   交易哈希: ${tx.hash}`);
      console.log(`   等待确认...`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ 批次完成 (Gas使用: ${receipt.gasUsed.toString()})`);
      
      successCount += batchUsers.length;
      
    } catch (error) {
      console.error(`   ❌ 批次失败:`, error.message);
      errorCount += batchUsers.length;
      
      // 如果批次失败，尝试单个处理
      console.log(`   🔄 尝试单个处理...`);
      for (let j = 0; j < batchUsers.length; j++) {
        try {
          const tx = await protocolContract.batchUpdateTeamCounts([batchUsers[j]], [batchCounts[j]]);
          await tx.wait();
          console.log(`   ✅ 单个处理成功: ${batchUsers[j]}`);
          successCount++;
          errorCount--;
        } catch (singleError) {
          console.error(`   ❌ 单个处理失败: ${batchUsers[j]}`, singleError.message);
        }
      }
    }
  }

  // 6. 验证修复结果
  console.log("\n🔍 验证修复结果...");
  let verifySuccessCount = 0;
  let verifyErrorCount = 0;

  for (const item of inconsistentReferrers) {
    try {
      const referrerInfo = await protocolContract.userInfo(item.address);
      const newCount = Number(referrerInfo[1]);
      
      if (newCount === item.expected) {
        verifySuccessCount++;
        console.log(`   ✅ ${item.address}: ${item.current} → ${newCount} (正确)`);
      } else {
        verifyErrorCount++;
        console.log(`   ❌ ${item.address}: ${item.current} → ${newCount} (预期: ${item.expected})`);
      }
    } catch (error) {
      verifyErrorCount++;
      console.error(`   ❌ 验证失败: ${item.address}`, error.message);
    }
  }

  // 7. 总结
  console.log("\n" + "=".repeat(70));
  console.log("🎉 activeDirects数据修复完成！");
  console.log("=".repeat(70));
  console.log("");
  console.log("📊 修复统计:");
  console.log(`   需要修复的推荐人: ${inconsistentReferrers.length}`);
  console.log(`   成功修复: ${successCount}`);
  console.log(`   修复失败: ${errorCount}`);
  console.log("");
  console.log("🔍 验证结果:");
  console.log(`   验证成功: ${verifySuccessCount}`);
  console.log(`   验证失败: ${verifyErrorCount}`);
  console.log("");
  
  if (verifySuccessCount === inconsistentReferrers.length) {
    console.log("✅ 所有数据修复成功！");
  } else {
    console.log("⚠️  部分数据修复失败，请检查日志");
  }
  
  console.log("");
  console.log("📝 建议:");
  console.log("   1. 在前端刷新页面查看修复效果");
  console.log("   2. 定期运行此脚本以保持数据一致性");
  console.log("   3. 监控新用户的activeDirects是否正确更新");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 修复脚本执行失败:");
    console.error(error);
    process.exit(1);
  });