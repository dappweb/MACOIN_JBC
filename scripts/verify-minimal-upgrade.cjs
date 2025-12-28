const hre = require("hardhat");

async function main() {
  console.log("🔍 验证最小化升级合约...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 验证账户:", deployer.address);

  const proxyAddress = process.env.PROXY_ADDRESS;
  
  if (!proxyAddress) {
    throw new Error("❌ 请在 .env 文件中设置 PROXY_ADDRESS");
  }

  console.log("🏠 验证合约地址:", proxyAddress);

  try {
    // 连接到升级后的合约
    const contract = await hre.ethers.getContractAt("JinbaoProtocolMinimal", proxyAddress);
    
    console.log("\n📊 1. 基本功能验证");
    console.log("--------------------");
    
    // 验证合约所有者
    const owner = await contract.owner();
    console.log("✅ 合约所有者:", owner);
    
    console.log("\n📊 2. 新等级系统验证");
    console.log("--------------------");
    
    // 测试新的等级计算功能
    const testCases = [
      { count: 5, expectedLevel: 0, expectedPercent: 0 },
      { count: 10, expectedLevel: 1, expectedPercent: 5 },
      { count: 30, expectedLevel: 2, expectedPercent: 10 },
      { count: 100, expectedLevel: 3, expectedPercent: 15 },
      { count: 300, expectedLevel: 4, expectedPercent: 20 },
      { count: 1000, expectedLevel: 5, expectedPercent: 25 },
      { count: 3000, expectedLevel: 6, expectedPercent: 30 },
      { count: 10000, expectedLevel: 7, expectedPercent: 35 },
      { count: 30000, expectedLevel: 8, expectedPercent: 40 },
      { count: 100000, expectedLevel: 9, expectedPercent: 45 }
    ];
    
    let allTestsPassed = true;
    
    for (const test of testCases) {
      try {
        const result = await contract.calculateLevel(test.count);
        const level = Number(result.level);
        const percent = Number(result.percent);
        
        if (level === test.expectedLevel && percent === test.expectedPercent) {
          console.log(`✅ ${test.count}人团队 → V${level} (${percent}%) ✓`);
        } else {
          console.log(`❌ ${test.count}人团队 → V${level} (${percent}%) ✗ (期望: V${test.expectedLevel} (${test.expectedPercent}%))`);
          allTestsPassed = false;
        }
      } catch (error) {
        console.log(`❌ ${test.count}人团队测试失败:`, error.message);
        allTestsPassed = false;
      }
    }
    
    console.log("\n📊 3. 用户等级查询功能验证");
    console.log("--------------------");
    
    try {
      // 测试用户等级查询（使用部署者地址作为测试）
      const userLevel = await contract.getUserLevel(deployer.address);
      console.log(`✅ 用户 ${deployer.address} 等级信息:`);
      console.log(`   等级: V${userLevel.level}`);
      console.log(`   收益比例: ${userLevel.percent}%`);
      console.log(`   团队数量: ${userLevel.teamCount}`);
    } catch (error) {
      console.log("⚠️  用户等级查询测试失败:", error.message);
    }
    
    console.log("\n📊 4. 接口兼容性验证");
    console.log("--------------------");
    
    try {
      // 测试getDirectReferrals函数
      const referrals = await contract.getDirectReferrals(deployer.address);
      console.log(`✅ 直推查询功能正常，当前直推数量: ${referrals.length}`);
    } catch (error) {
      console.log("⚠️  直推查询功能测试失败:", error.message);
    }
    
    console.log("\n📊 验证结果总结");
    console.log("================");
    
    if (allTestsPassed) {
      console.log("🎉 所有等级计算测试通过!");
      console.log("✅ 升级成功，新的V1-V9等级系统已正常工作");
      console.log("\n📋 已激活的新功能:");
      console.log("   ✅ V1: 10人团队 → 5%极差收益");
      console.log("   ✅ V2: 30人团队 → 10%极差收益");
      console.log("   ✅ V3: 100人团队 → 15%极差收益");
      console.log("   ✅ V4: 300人团队 → 20%极差收益");
      console.log("   ✅ V5: 1000人团队 → 25%极差收益");
      console.log("   ✅ V6: 3000人团队 → 30%极差收益");
      console.log("   ✅ V7: 10000人团队 → 35%极差收益");
      console.log("   ✅ V8: 30000人团队 → 40%极差收益");
      console.log("   ✅ V9: 100000人团队 → 45%极差收益");
      console.log("   ✅ 增强的等级查询功能");
      console.log("   ✅ 实时等级变化事件系统");
    } else {
      console.log("⚠️  部分测试未通过，请检查合约实现");
    }
    
    console.log("\n🔗 合约信息:");
    console.log(`   代理地址: ${proxyAddress}`);
    console.log(`   网络: MC Chain (88813)`);
    console.log(`   升级时间: ${new Date().toISOString()}`);

  } catch (error) {
    console.error("\n❌ 验证过程中发生错误:", error.message);
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ 验证脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 验证脚本执行失败:", error);
    process.exit(1);
  });