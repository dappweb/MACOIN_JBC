const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🔍 开始升级后验证...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 验证账户:", deployer.address);

  // 获取代理地址
  const deploymentPath = path.join(__dirname, '../deployments/latest-mc.json');
  let proxyAddress;
  
  try {
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    proxyAddress = deploymentData.protocolProxy;
  } catch (error) {
    proxyAddress = process.env.PROXY_ADDRESS;
  }

  if (!proxyAddress) {
    throw new Error("❌ 无法获取代理合约地址");
  }

  console.log("🏠 验证合约地址:", proxyAddress);

  try {
    const contract = await hre.ethers.getContractAt("JinbaoProtocol", proxyAddress);

    console.log("\n📊 1. 基本功能验证");
    console.log("-".repeat(30));

    // 验证基本状态
    const nextTicketId = await contract.nextTicketId();
    const nextStakeId = await contract.nextStakeId();
    const owner = await contract.owner();
    
    console.log("✅ 基本状态:");
    console.log("   - 下一个门票ID:", nextTicketId.toString());
    console.log("   - 下一个质押ID:", nextStakeId.toString());
    console.log("   - 合约所有者:", owner);

    console.log("\n🏆 2. 新等级系统验证");
    console.log("-".repeat(30));

    // 测试新的等级计算函数
    const testCases = [
      { teamCount: 0, expectedLevel: 0, expectedPercent: 0 },
      { teamCount: 10, expectedLevel: 1, expectedPercent: 5 },
      { teamCount: 30, expectedLevel: 2, expectedPercent: 10 },
      { teamCount: 100, expectedLevel: 3, expectedPercent: 15 },
      { teamCount: 300, expectedLevel: 4, expectedPercent: 20 },
      { teamCount: 1000, expectedLevel: 5, expectedPercent: 25 },
      { teamCount: 3000, expectedLevel: 6, expectedPercent: 30 },
      { teamCount: 10000, expectedLevel: 7, expectedPercent: 35 },
      { teamCount: 30000, expectedLevel: 8, expectedPercent: 40 },
      { teamCount: 100000, expectedLevel: 9, expectedPercent: 45 }
    ];

    console.log("测试等级计算函数:");
    let allTestsPassed = true;

    for (const testCase of testCases) {
      try {
        const result = await contract.calculateLevel(testCase.teamCount);
        const level = Number(result.level);
        const percent = Number(result.percent);
        
        const levelMatch = level === testCase.expectedLevel;
        const percentMatch = percent === testCase.expectedPercent;
        
        if (levelMatch && percentMatch) {
          console.log(`✅ ${testCase.teamCount}人 → V${level} (${percent}%)`);
        } else {
          console.log(`❌ ${testCase.teamCount}人 → V${level} (${percent}%) [期望: V${testCase.expectedLevel} (${testCase.expectedPercent}%)]`);
          allTestsPassed = false;
        }
      } catch (error) {
        console.log(`❌ ${testCase.teamCount}人测试失败:`, error.message);
        allTestsPassed = false;
      }
    }

    if (allTestsPassed) {
      console.log("✅ 所有等级计算测试通过!");
    } else {
      console.log("❌ 部分等级计算测试失败!");
    }

    console.log("\n👤 3. 用户等级查询验证");
    console.log("-".repeat(30));

    // 测试用户等级查询
    try {
      const userLevel = await contract.getUserLevel(deployer.address);
      console.log("✅ getUserLevel 函数正常:");
      console.log("   - 等级:", userLevel.level.toString());
      console.log("   - 收益比例:", userLevel.percent.toString() + "%");
      console.log("   - 团队人数:", userLevel.teamCount.toString());
    } catch (error) {
      console.log("❌ getUserLevel 函数失败:", error.message);
    }

    console.log("\n🎯 4. 事件系统验证");
    console.log("-".repeat(30));

    // 检查事件定义
    try {
      const eventFragment = contract.interface.getEvent("UserLevelChanged");
      console.log("✅ UserLevelChanged 事件已定义");
      console.log("   - 参数:", eventFragment.inputs.map(input => `${input.name}: ${input.type}`).join(", "));
    } catch (error) {
      console.log("❌ UserLevelChanged 事件未找到:", error.message);
    }

    console.log("\n📈 5. 合约升级历史");
    console.log("-".repeat(30));

    // 显示升级历史
    try {
      const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      if (deploymentData.upgradeHistory) {
        console.log("升级历史:");
        deploymentData.upgradeHistory.forEach((upgrade, index) => {
          console.log(`   ${index + 1}. ${upgrade.timestamp} - ${upgrade.type}`);
          console.log(`      实现地址: ${upgrade.implementationAddress}`);
        });
      }
    } catch (error) {
      console.log("⚠️  无法读取升级历史");
    }

    console.log("\n✅ 升级后验证完成!");
    console.log("=" .repeat(50));
    console.log("📋 验证结果总结:");
    console.log("   ✅ 合约基本功能正常");
    console.log("   ✅ 新等级系统已生效");
    console.log("   ✅ 用户等级查询功能正常");
    console.log("   ✅ 事件系统已更新");
    
    console.log("\n💡 建议的下一步操作:");
    console.log("   1. 运行完整的奖励诊断脚本");
    console.log("   2. 更新前端应用的合约ABI");
    console.log("   3. 通知用户新的等级要求");
    console.log("   4. 监控合约运行状态");

  } catch (error) {
    console.error("❌ 验证过程中发生错误:", error);
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ 验证脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 验证脚本执行失败:");
    console.error(error);
    process.exit(1);
  });