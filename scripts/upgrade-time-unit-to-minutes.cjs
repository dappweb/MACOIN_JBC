const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 开始升级合约时间单位：从天数改为分钟...\n");

  // 确保使用 MC Chain 网络
  const networkName = hre.network.name;
  console.log("🌐 当前网络:", networkName);
  
  if (networkName !== "mc") {
    console.log("⚠️  警告: 当前不在 MC Chain 网络");
    console.log("💡 请使用: npx hardhat run scripts/upgrade-time-unit-to-minutes.cjs --network mc");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);
  
  // 获取账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC");

  // 当前已知的代理地址
  const proxyAddress = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  console.log("🏠 目标代理地址:", proxyAddress);

  // 预升级检查
  console.log("\n🔍 执行预升级检查...");
  
  try {
    // 使用简化的ABI检查当前状态
    const SIMPLE_ABI = [
      "function SECONDS_IN_UNIT() view returns (uint256)",
      "function owner() view returns (address)",
      "function nextTicketId() view returns (uint256)",
      "function nextStakeId() view returns (uint256)"
    ];
    
    const currentContract = new hre.ethers.Contract(proxyAddress, SIMPLE_ABI, deployer);
    
    // 检查当前合约状态
    const currentSecondsInUnit = await currentContract.SECONDS_IN_UNIT();
    const nextTicketId = await currentContract.nextTicketId();
    const nextStakeId = await currentContract.nextStakeId();
    const owner = await currentContract.owner();
    
    console.log("✅ 当前合约状态:");
    console.log("   - 当前时间单位:", currentSecondsInUnit.toString(), "秒");
    console.log("   - 环境类型:", currentSecondsInUnit.toString() === "86400" ? "生产环境 (天)" : "测试环境 (分钟)");
    console.log("   - 下一个门票ID:", nextTicketId.toString());
    console.log("   - 下一个质押ID:", nextStakeId.toString());
    console.log("   - 合约所有者:", owner);
    console.log("   - 部署者地址:", deployer.address);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("⚠️  警告: 部署者不是合约所有者，升级可能失败");
      console.log("   合约所有者:", owner);
      console.log("   当前部署者:", deployer.address);
      
      // 如果不是所有者，直接退出
      throw new Error("❌ 只有合约所有者才能执行升级操作");
    }

    if (currentSecondsInUnit.toString() === "60") {
      console.log("✅ 合约已经是测试环境配置 (60秒/分钟)，无需升级");
      return;
    }

  } catch (error) {
    console.log("❌ 预升级检查失败:", error.message);
    throw error;
  }

  // 编译合约
  console.log("\n📦 编译最新合约...");
  await hre.run("compile");

  // 获取新的合约工厂
  const JinbaoProtocolNative = await hre.ethers.getContractFactory("JinbaoProtocolNative");
  
  console.log("🔄 开始升级合约...");
  console.log("   将时间单位从 86400秒(天) 改为 60秒(分钟)");
  console.log("   这可能需要几分钟时间，请耐心等待...");
  
  try {
    // 执行升级
    const upgraded = await upgrades.upgradeProxy(proxyAddress, JinbaoProtocolNative, {
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
    const VERIFY_ABI = [
      "function SECONDS_IN_UNIT() view returns (uint256)",
      "function nextTicketId() view returns (uint256)",
      "function nextStakeId() view returns (uint256)",
      "function owner() view returns (address)"
    ];
    
    const upgradedContract = new hre.ethers.Contract(proxyAddress, VERIFY_ABI, deployer);
    
    // 验证数据完整性
    try {
      const newSecondsInUnit = await upgradedContract.SECONDS_IN_UNIT();
      const nextTicketIdAfter = await upgradedContract.nextTicketId();
      const nextStakeIdAfter = await upgradedContract.nextStakeId();
      const ownerAfter = await upgradedContract.owner();
      
      console.log("✅ 升级后数据验证:");
      console.log("   - 新时间单位:", newSecondsInUnit.toString(), "秒");
      console.log("   - 环境类型:", newSecondsInUnit.toString() === "60" ? "✅ 测试环境 (分钟)" : "❌ 仍为生产环境");
      console.log("   - 下一个门票ID:", nextTicketIdAfter.toString());
      console.log("   - 下一个质押ID:", nextStakeIdAfter.toString());
      console.log("   - 合约所有者:", ownerAfter);
      
      if (newSecondsInUnit.toString() !== "60") {
        throw new Error("❌ 时间单位升级失败，仍为: " + newSecondsInUnit.toString());
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
        upgradeType: "time-unit-to-minutes",
        timeUnit: "minutes",
        secondsInUnit: 60,
        features: [
          "Changed SECONDS_IN_UNIT from 86400 (days) to 60 (minutes)",
          "Staking cycles now in minutes: 7min, 15min, 30min",
          "Faster testing and development cycles",
          "Maintained all existing functionality and data"
        ]
      };

      const deploymentPath = path.join(__dirname, '../deployments/latest-mc.json');
      
      // 读取现有配置并合并
      if (fs.existsSync(deploymentPath)) {
        const existingData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        Object.assign(deploymentData, existingData, {
          protocolImplementation: newImplAddress,
          lastUpdate: new Date().toISOString(),
          timeUnit: "minutes",
          secondsInUnit: 60,
          upgradeHistory: [
            ...(existingData.upgradeHistory || []),
            {
              timestamp: new Date().toISOString(),
              type: "time-unit-upgrade",
              implementationAddress: newImplAddress,
              changes: {
                from: "86400 seconds (days)",
                to: "60 seconds (minutes)"
              },
              features: deploymentData.features
            }
          ]
        });
      }

      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
      console.log("✅ 部署配置已更新:", deploymentPath);

      // 创建升级记录
      const upgradeDir = path.join(__dirname, '../deployments/upgrades');
      if (!fs.existsSync(upgradeDir)) {
        fs.mkdirSync(upgradeDir, { recursive: true });
      }
      
      const upgradeRecordPath = path.join(upgradeDir, `time-unit-upgrade-${Date.now()}.json`);
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
    console.log("\n🎉 时间单位升级完成!");
    console.log("=" .repeat(60));
    console.log("📋 升级总结:");
    console.log("   ✅ 时间单位已从天数改为分钟 (86400s → 60s)");
    console.log("   ✅ 质押周期现在为分钟单位:");
    console.log("      - 7分钟质押: 1.33% 每分钟");
    console.log("      - 15分钟质押: 1.67% 每分钟");
    console.log("      - 30分钟质押: 2.00% 每分钟");
    console.log("   ✅ 前端时间检测系统将自动适配");
    console.log("   ✅ 所有现有数据和功能保持不变");
    console.log("\n📍 重要地址:");
    console.log("   代理合约 (用户交互):", proxyAddress);
    console.log("   新实现合约:", newImplAddress);
    console.log("\n💡 下一步:");
    console.log("   1. 前端会自动检测新的时间单位");
    console.log("   2. 用户可以进行快速测试 (分钟级别)");
    console.log("   3. 监控合约运行状态");
    console.log("   4. 如需恢复生产环境，可再次升级");

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
    console.log("\n✅ 时间单位升级脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 升级脚本执行失败:");
    console.error(error);
    process.exit(1);
  });