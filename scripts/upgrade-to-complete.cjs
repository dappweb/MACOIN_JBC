const hre = require("hardhat");

async function main() {
  console.log("🚀 升级到完整功能合约...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC");

  // 读取当前部署配置
  const fs = require('fs');
  const deploymentPath = './deployments/latest-mc.json';
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("❌ 未找到部署配置文件");
  }
  
  const config = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const proxyAddress = config.protocolProxy;
  
  console.log("🏠 代理合约地址:", proxyAddress);
  console.log("📋 当前版本:", config.upgradeInfo?.version || "unknown");

  try {
    console.log("📦 部署完整功能合约...");
    const JinbaoProtocolComplete = await hre.ethers.getContractFactory("JinbaoProtocolComplete");
    
    // 部署新的实现合约
    const newImplementation = await JinbaoProtocolComplete.deploy();
    await newImplementation.waitForDeployment();
    
    const newImplAddress = await newImplementation.getAddress();
    console.log("✅ 新实现合约部署成功:", newImplAddress);
    
    console.log("🔄 升级代理合约...");
    
    // 连接到代理合约并调用升级函数
    const proxyContract = await hre.ethers.getContractAt("JinbaoProtocolComplete", proxyAddress);
    
    // 调用升级函数（UUPS模式）
    const upgradeTx = await proxyContract.upgradeToAndCall(newImplAddress, "0x", {
      gasLimit: 500000
    });
    
    console.log("⏳ 等待升级交易确认...");
    await upgradeTx.wait();
    
    console.log("\n✅ 升级成功!");
    console.log("📍 代理地址:", proxyAddress);
    console.log("📍 新实现地址:", newImplAddress);
    console.log("📍 升级交易:", upgradeTx.hash);
    
    // 验证升级
    console.log("\n🔍 验证升级...");
    const upgradedContract = await hre.ethers.getContractAt("JinbaoProtocolComplete", proxyAddress);
    
    try {
      // 测试基本功能
      const owner = await upgradedContract.owner();
      console.log("✅ 合约所有者:", owner);
      
      // 测试赎回功能状态
      const redeemEnabled = await upgradedContract.redeemEnabled();
      console.log("✅ 赎回功能状态:", redeemEnabled);
      
      const redemptionFeePercent = await upgradedContract.redemptionFeePercent();
      console.log("✅ 赎回手续费比例:", redemptionFeePercent.toString() + "%");
      
      const liquidityEnabled = await upgradedContract.liquidityEnabled();
      console.log("✅ 流动性功能状态:", liquidityEnabled);
      
      // 测试等级系统
      const testLevel = await upgradedContract.calculateLevel(100);
      console.log("✅ 等级系统测试 (100人团队):", `V${testLevel.level} (${testLevel.percent}%)`);
      
    } catch (error) {
      console.log("⚠️  功能测试失败:", error.message);
    }

    console.log("\n🎉 完整功能合约升级完成!");
    console.log("📋 已恢复的功能:");
    console.log("   ✅ 赎回功能 (redeemStake, redeem)");
    console.log("   ✅ 质押功能 (stakeLiquidity)");
    console.log("   ✅ 门票购买 (buyTicket)");
    console.log("   ✅ 奖励领取 (claimRewards)");
    console.log("   ✅ 推荐人绑定 (bindReferrer)");
    console.log("   ✅ V1-V9等级系统 (保留)");
    console.log("   ✅ 修复的赎回费用计算");

    // 更新部署配置
    config.protocolImplementation = newImplAddress;
    config.lastUpdate = new Date().toISOString();
    config.upgradeInfo = {
      version: "v3-complete-fixed",
      features: [
        "Complete functionality restored",
        "Fixed redemption fee calculation",
        "Enhanced error handling",
        "Maintained V1-V9 level system",
        "Improved user experience"
      ],
      deploymentMethod: "Manual upgrade to complete contract",
      upgradeTxHash: upgradeTx.hash
    };
    
    fs.writeFileSync(deploymentPath, JSON.stringify(config, null, 2));
    console.log("\n📝 部署配置已更新:", deploymentPath);

  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
    
    if (error.message.includes("code size")) {
      console.log("\n💡 合约可能仍然太大，需要进一步优化");
    } else if (error.message.includes("Ownable")) {
      console.log("\n💡 可能需要使用合约所有者账户进行升级");
    }
    
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ 升级脚本完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 升级失败:", error);
    process.exit(1);
  });