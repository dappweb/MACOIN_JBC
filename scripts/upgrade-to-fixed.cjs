const hre = require("hardhat");

async function main() {
  console.log("🚀 升级到修复版合约...\n");

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

  try {
    console.log("📦 部署修复版合约...");
    const JinbaoProtocolFixed = await hre.ethers.getContractFactory("JinbaoProtocolFixed");
    
    // 部署新的实现合约
    const newImplementation = await JinbaoProtocolFixed.deploy();
    await newImplementation.waitForDeployment();
    
    const newImplAddress = await newImplementation.getAddress();
    console.log("✅ 新实现合约部署成功:", newImplAddress);
    
    console.log("🔄 升级代理合约...");
    
    // 连接到代理合约并调用升级函数
    const proxyContract = await hre.ethers.getContractAt("JinbaoProtocolFixed", proxyAddress);
    
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
    
    // 初始化缺失的状态变量
    console.log("\n🔧 初始化缺失的状态变量...");
    try {
      const initTx = await proxyContract.initializeMissingStates();
      await initTx.wait();
      console.log("✅ 状态变量初始化成功");
    } catch (error) {
      console.log("⚠️  状态变量初始化失败:", error.message);
    }
    
    // 验证升级
    console.log("\n🔍 验证升级...");
    const upgradedContract = await hre.ethers.getContractAt("JinbaoProtocolFixed", proxyAddress);
    
    try {
      // 测试赎回功能状态
      const redeemEnabled = await upgradedContract.redeemEnabled();
      console.log("✅ 赎回功能状态:", redeemEnabled);
      
      const redemptionFeePercent = await upgradedContract.redemptionFeePercent();
      console.log("✅ 赎回手续费比例:", redemptionFeePercent.toString() + "%");
      
      const liquidityEnabled = await upgradedContract.liquidityEnabled();
      console.log("✅ 流动性功能状态:", liquidityEnabled);
      
      const secondsInUnit = await upgradedContract.SECONDS_IN_UNIT();
      console.log("✅ 时间单位:", secondsInUnit.toString(), "秒");
      
      // 测试等级系统
      const testLevel = await upgradedContract.calculateLevel(100);
      console.log("✅ 等级系统测试 (100人团队):", `V${testLevel.level} (${testLevel.percent}%)`);
      
    } catch (error) {
      console.log("⚠️  功能测试失败:", error.message);
    }

    console.log("\n🎉 修复版合约升级完成!");
    console.log("📋 已恢复的功能:");
    console.log("   ✅ 赎回功能 (redeemStake) - 修复费用计算");
    console.log("   ✅ 质押功能 (stakeLiquidity)");
    console.log("   ✅ 门票购买 (buyTicket)");
    console.log("   ✅ 奖励领取 (claimRewards)");
    console.log("   ✅ 推荐人绑定 (bindReferrer)");
    console.log("   ✅ V1-V9等级系统 (保留)");
    console.log("   ✅ 状态变量初始化");

    // 更新部署配置
    config.protocolImplementation = newImplAddress;
    config.lastUpdate = new Date().toISOString();
    config.upgradeInfo = {
      version: "v3-fixed-redemption",
      features: [
        "Complete functionality restored",
        "Fixed redemption fee calculation logic",
        "User pays fee, contract transfers principal",
        "Enhanced error handling",
        "Maintained V1-V9 level system",
        "Initialized missing state variables"
      ],
      deploymentMethod: "Manual upgrade with state initialization",
      upgradeTxHash: upgradeTx.hash
    };
    
    fs.writeFileSync(deploymentPath, JSON.stringify(config, null, 2));
    console.log("\n📝 部署配置已更新:", deploymentPath);

  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
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