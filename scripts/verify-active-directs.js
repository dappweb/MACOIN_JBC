const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 验证activeDirects数据一致性...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 执行账户:", deployer.address);

  // 合约地址
  const PROXY_ADDRESS = "0x7a216BeA62eF7629904E0d30b24F6842c9b0d660";
  
  console.log("🏠 合约地址:", PROXY_ADDRESS);

  // 获取合约实例
  const protocolContract = await hre.ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);

  // 1. 获取所有门票购买事件
  console.log("📊 获取所有门票购买事件...");
  const ticketEvents = await protocolContract.queryFilter("TicketPurchased");
  console.log(`   找到 ${ticketEvents.length} 个门票购买事件`);

  // 2. 统计每个推荐人的预期有效推荐数
  console.log("\n🔍 分析推荐关系...");
  const referrerStats = new Map();
  const allUsers = new Set();
  
  for (const event of ticketEvents) {
    const user = event.args.user;
    allUsers.add(user);
  }

  console.log(`   分析 ${allUsers.size} 个唯一用户...`);

  let totalActiveUsers = 0;
  let usersWithReferrer = 0;

  for (const user of allUsers) {
    try {
      const userInfo = await protocolContract.userInfo(user);
      const userTicket = await protocolContract.userTicket(user);
      
      const hasTicket = userTicket[1] > 0;
      const isExited = userTicket[3];
      const referrer = userInfo[0];
      
      // 有门票且未出局的用户算作有效
      if (hasTicket && !isExited) {
        totalActiveUsers++;
        
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
  console.log(`   总用户数: ${allUsers.size}`);
  console.log(`   有效用户数: ${totalActiveUsers}`);
  console.log(`   有推荐人的有效用户: ${usersWithReferrer}`);
  console.log(`   有推荐的推荐人数: ${referrerStats.size}`);

  // 3. 验证每个推荐人的activeDirects
  console.log("\n🔍 验证推荐人数据一致性...");
  
  const results = {
    correct: [],
    incorrect: [],
    errors: []
  };

  for (const [referrer, expectedCount] of referrerStats) {
    try {
      const referrerInfo = await protocolContract.userInfo(referrer);
      const currentCount = Number(referrerInfo[1]);
      
      const result = {
        address: referrer,
        expected: expectedCount,
        actual: currentCount,
        difference: expectedCount - currentCount
      };

      if (currentCount === expectedCount) {
        results.correct.push(result);
      } else {
        results.incorrect.push(result);
      }
    } catch (error) {
      results.errors.push({
        address: referrer,
        error: error.message
      });
    }
  }

  // 4. 显示验证结果
  console.log(`\n📊 验证结果统计:`);
  console.log(`   ✅ 数据正确: ${results.correct.length}`);
  console.log(`   ❌ 数据错误: ${results.incorrect.length}`);
  console.log(`   ⚠️  查询错误: ${results.errors.length}`);

  if (results.incorrect.length > 0) {
    console.log(`\n❌ 数据不一致的推荐人 (${results.incorrect.length}个):`);
    results.incorrect.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.address}`);
      console.log(`      实际: ${item.actual}, 预期: ${item.expected}, 差异: ${item.difference > 0 ? '+' : ''}${item.difference}`);
    });
  }

  if (results.errors.length > 0) {
    console.log(`\n⚠️  查询错误的推荐人 (${results.errors.length}个):`);
    results.errors.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.address}: ${item.error}`);
    });
  }

  // 5. 随机抽样验证
  console.log(`\n🎲 随机抽样验证 (最多10个推荐人):`);
  const sampleSize = Math.min(10, results.correct.length);
  const samples = results.correct.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

  for (const sample of samples) {
    try {
      // 获取直推列表
      const directReferrals = await protocolContract.getDirectReferrals(sample.address);
      
      // 计算有效直推数
      let validCount = 0;
      for (const user of directReferrals) {
        const userTicket = await protocolContract.userTicket(user);
        if (userTicket[1] > 0 && !userTicket[3]) {
          validCount++;
        }
      }

      const status = validCount === sample.actual ? "✅" : "❌";
      console.log(`   ${status} ${sample.address.substring(0, 10)}...`);
      console.log(`      直推总数: ${directReferrals.length}, 有效数: ${validCount}, 记录数: ${sample.actual}`);
      
    } catch (error) {
      console.log(`   ❌ ${sample.address.substring(0, 10)}...: 查询失败`);
    }
  }

  // 6. 检查特定用户（如果提供）
  const checkUsers = process.env.CHECK_USERS ? process.env.CHECK_USERS.split(',') : [];
  if (checkUsers.length > 0) {
    console.log(`\n🔍 检查指定用户 (${checkUsers.length}个):`);
    
    for (const userAddress of checkUsers) {
      try {
        const userInfo = await protocolContract.userInfo(userAddress.trim());
        const userTicket = await protocolContract.userTicket(userAddress.trim());
        const directReferrals = await protocolContract.getDirectReferrals(userAddress.trim());
        
        console.log(`\n   用户: ${userAddress.trim()}`);
        console.log(`   activeDirects: ${userInfo[1].toString()}`);
        console.log(`   teamCount: ${userInfo[2].toString()}`);
        console.log(`   isActive: ${userInfo[5]}`);
        console.log(`   hasTicket: ${userTicket[1] > 0}`);
        console.log(`   ticketExited: ${userTicket[3]}`);
        console.log(`   directReferrals: ${directReferrals.length}`);
        
        // 计算有效直推
        let validDirects = 0;
        for (const referral of directReferrals) {
          const referralTicket = await protocolContract.userTicket(referral);
          if (referralTicket[1] > 0 && !referralTicket[3]) {
            validDirects++;
          }
        }
        console.log(`   有效直推: ${validDirects}`);
        console.log(`   数据一致性: ${Number(userInfo[1]) === validDirects ? '✅ 正确' : '❌ 错误'}`);
        
      } catch (error) {
        console.log(`   ❌ 查询失败: ${error.message}`);
      }
    }
  }

  // 7. 总结和建议
  console.log("\n" + "=".repeat(70));
  console.log("📋 验证总结");
  console.log("=".repeat(70));
  
  const totalReferrers = results.correct.length + results.incorrect.length;
  const accuracyRate = totalReferrers > 0 ? (results.correct.length / totalReferrers * 100).toFixed(2) : 0;
  
  console.log(`数据准确率: ${accuracyRate}% (${results.correct.length}/${totalReferrers})`);
  
  if (results.incorrect.length === 0) {
    console.log("🎉 所有activeDirects数据都是正确的！");
  } else {
    console.log(`⚠️  发现 ${results.incorrect.length} 个数据不一致的推荐人`);
    console.log("");
    console.log("🔧 修复建议:");
    console.log("   运行修复脚本: npx hardhat run scripts/fix-active-directs.js --network mc");
  }
  
  console.log("");
  console.log("📝 使用说明:");
  console.log("   检查特定用户: CHECK_USERS=0x123...,0x456... npx hardhat run scripts/verify-active-directs.js --network mc");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 验证脚本执行失败:");
    console.error(error);
    process.exit(1);
  });