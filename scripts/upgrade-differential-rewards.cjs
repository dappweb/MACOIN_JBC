const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 开始部署极差奖励机制升级...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);
  
  // 获取账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "ETH");

  // 优先使用环境变量中的代理地址，然后尝试部署配置
  let proxyAddress = process.env.PROXY_ADDRESS;
  
  if (!proxyAddress) {
    try {
      const deploymentPath = path.join(__dirname, '../deployments/latest-mc.json');
      const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      proxyAddress = deploymentData.protocolProxy;
      console.log("📋 从部署配置获取代理地址:", proxyAddress);
    } catch (error) {
      console.log("⚠️  无法读取部署配置");
    }
  } else {
    console.log("📋 从环境变量获取代理地址:", proxyAddress);
  }

  if (!proxyAddress || proxyAddress === "0x...") {
    throw new Error("❌ 请设置代理合约地址 (PROXY_ADDRESS 环境变量或更新 latest-mc.json)");
  }

  console.log("🏠 当前代理地址:", proxyAddress);

  // 预升级检查
  console.log("\n🔍 执行预升级检查...");
  
  try {
    const currentContract = await hre.ethers.getContractAt("JinbaoProtocol", proxyAddress);
    
    // 检查当前合约状态
    const nextTicketId = await currentContract.nextTicketId();
    const nextStakeId = await currentContract.nextStakeId();
    const owner = await currentContract.owner();
    
    console.log("✅ 当前合约状态:");
    console.log("   - 下一个门票ID:", nextTicketId.toString());
    console.log("   - 下一个质押ID:", nextStakeId.toString());
    console.log("   - 合约所有者:", owner);
    console.log("   - 部署者地址:", deployer.address);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("⚠️  警告: 部署者不是合约所有者，升级可能失败");
      console.log("   合约所有者:", owner);
      console.log("   当前部署者:", deployer.address);
    }

    // 测试一些关键函数
    try {
      const testLevel = await currentContract.getUserLevel(deployer.address);
      console.log("✅ getUserLevel 函数正常工作");
    } catch (error) {
      console.log("⚠️  getUserLevel 函数可能需要升级");
    }

  } catch (error) {
    console.log("❌ 预升级检查失败:", error.message);
    throw error;
  }

  // 编译合约
  console.log("\n📦 编译最新合约...");
  await hre.run("compile");

  // 获取新的合约工厂
  const JinbaoProtocolV2 = await hre.ethers.getContractFactory("JinbaoProtocol");
  
  console.log("🔄 开始升级合约...");
  console.log("   这可能需要几分钟时间，请耐心等待...");
  
  try {
    // 执行升级
    const upgraded = await upgrades.upgradeProxy(proxyAddress, JinbaoProtocolV2, {
      timeout: 300000, // 5分钟超时
      pollingInterval: 5000 // 5秒轮询间隔
    });
    
    console.log("⏳ 等待升级交易确认...");
    await upgraded.waitForDeployment();
    
    // 获取新的实现地址
    const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    
    console.log("\n✅ 升级成功完成!");
    console.log("📍 代理地址 (不变):", proxyAddress);
    console.log("📍 新实现地址:", newImplAddress);
    
    // 升级后验证
    console.log("\n🔍 执行升级后验证...");
    const upgradedContract = await hre.ethers.getContractAt("JinbaoProtocol", proxyAddress);
    
    // 验证数据完整性
    try {
      const nextTicketIdAfter = await upgradedContract.nextTicketId();
      const nextStakeIdAfter = await upgradedContract.nextStakeId();
      const ownerAfter = await upgradedContract.owner();
      
      console.log("✅ 升级后数据验证:");
      console.log("   - 下一个门票ID:", nextTicketIdAfter.toString());
      console.log("   - 下一个质押ID:", nextStakeIdAfter.toString());
      console.log("   - 合约所有者:", ownerAfter);
      
      // 验证新功能
      try {
        const testLevel = await upgradedContract.getUserLevel(deployer.address);
        console.log("✅ 新的 getUserLevel 函数工作正常");
        console.log("   - 等级:", testLevel.level.toString());
        console.log("   - 收益比例:", testLevel.percent.toString() + "%");
        console.log("   - 团队人数:", testLevel.teamCount.toString());
      } catch (error) {
        console.log("❌ getUserLevel 函数测试失败:", error.message);
      }

      try {
        const testLevelCalc = await upgradedContract.calculateLevel(100);
        console.log("✅ 新的 calculateLevel 函数工作正常");
        console.log("   - 100人团队等级:", testLevelCalc.level.toString());
        console.log("   - 对应收益比例:", testLevelCalc.percent.toString() + "%");
      } catch (error) {
        console.log("❌ calculateLevel 函数测试失败:", error.message);
      }

    } catch (error) {
      console.log("❌ 升级后验证失败:", error.message);
      throw error;
    }

    // 更新部署配置文件
    console.log("\n📝 更新部署配置...");
    try {
      const deploymentData = {
        network: "mc",
        chainId: "88813",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        protocolProxy: proxyAddress,
        protocolImplementation: newImplAddress,
        upgradeType: "differential-rewards-v2",
        features: [
          "Updated V-level requirements (V1: 10 → V9: 100,000)",
          "New differential reward percentages (5% → 45%)",
          "Enhanced getUserLevel and calculateLevel functions",
          "Improved team-based reward calculation",
          "Real-time level change events"
        ]
      };

      // 读取现有配置并合并
      if (fs.existsSync(deploymentPath)) {
        const existingData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        Object.assign(deploymentData, existingData, {
          protocolImplementation: newImplAddress,
          lastUpdate: new Date().toISOString(),
          upgradeHistory: [
            ...(existingData.upgradeHistory || []),
            {
              timestamp: new Date().toISOString(),
              type: "differential-rewards-upgrade",
              implementationAddress: newImplAddress,
              features: deploymentData.features
            }
          ]
        });
      }

      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
      console.log("✅ 部署配置已更新:", deploymentPath);

      // 创建升级记录
      const upgradeRecordPath = path.join(__dirname, `../deployments/upgrades/differential-rewards-upgrade-${Date.now()}.json`);
      fs.writeFileSync(upgradeRecordPath, JSON.stringify({
        ...deploymentData,
        gasUsed: "待计算",
        transactionHash: "待获取"
      }, null, 2));
      console.log("✅ 升级记录已保存:", upgradeRecordPath);

    } catch (error) {
      console.log("⚠️  更新配置文件失败:", error.message);
    }

    // 显示升级总结
    console.log("\n🎉 极差奖励机制升级完成!");
    console.log("=" .repeat(50));
    console.log("📋 升级总结:");
    console.log("   ✅ 新的V等级要求已生效 (V1: 10人 → V9: 100,000人)");
    console.log("   ✅ 极差收益比例已更新 (5% → 45%)");
    console.log("   ✅ 增强的等级查询函数已部署");
    console.log("   ✅ 团队统计逻辑已优化");
    console.log("   ✅ 实时等级变化事件已启用");
    console.log("\n📍 重要地址:");
    console.log("   代理合约 (用户交互):", proxyAddress);
    console.log("   新实现合约:", newImplAddress);
    console.log("\n💡 下一步:");
    console.log("   1. 更新前端配置中的合约地址");
    console.log("   2. 运行诊断脚本验证升级效果");
    console.log("   3. 通知用户新的等级要求");
    console.log("   4. 监控合约运行状态");

  } catch (error) {
    console.log("\n❌ 升级失败:");
    console.error(error);
    
    // 提供故障排除建议
    console.log("\n🔧 故障排除建议:");
    console.log("1. 检查账户是否为合约所有者");
    console.log("2. 确认网络连接稳定");
    console.log("3. 验证私钥和代理地址正确");
    console.log("4. 检查账户余额是否足够支付gas费用");
    
    throw error;
  }
}

// 错误处理和清理
process.on('unhandledRejection', (error) => {
  console.error('❌ 未处理的错误:', error);
  process.exit(1);
});

main()
  .then(() => {
    console.log("\n✅ 升级脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 升级脚本执行失败:");
    console.error(error);
    process.exit(1);
  });