const { ethers } = require("hardhat");

async function main() {
  console.log("🕒 部署测试环境合约 (分钟单位)...");
  
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MC");

  // 合约地址
  const JBC_TOKEN = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";
  const MARKETING_WALLET = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
  const TREASURY_WALLET = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
  const LP_INJECTION_WALLET = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
  const BUYBACK_WALLET = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
  
  try {
    // 直接部署新合约实例来测试
    console.log("📋 部署新的测试合约实例...");
    
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const protocol = await JinbaoProtocol.deploy();
    await protocol.waitForDeployment();
    
    const protocolAddress = await protocol.getAddress();
    console.log("✅ 合约部署成功!");
    console.log("合约地址:", protocolAddress);
    
    // 初始化合约
    console.log("🔧 初始化合约...");
    const initTx = await protocol.initialize(
      JBC_TOKEN,
      MARKETING_WALLET,
      TREASURY_WALLET,
      LP_INJECTION_WALLET,
      BUYBACK_WALLET
    );
    await initTx.wait();
    console.log("✅ 合约初始化完成!");
    
    // 验证时间单位
    const secondsInUnit = await protocol.SECONDS_IN_UNIT();
    console.log("🕒 SECONDS_IN_UNIT:", secondsInUnit.toString());
    
    if (secondsInUnit.toString() === "60") {
      console.log("✅ 时间单位已设置为测试环境 (60秒 = 1分钟)");
    } else {
      console.log("❌ 时间单位不正确，当前值:", secondsInUnit.toString());
    }
    
    // 显示质押周期信息
    console.log("\n📊 质押周期信息:");
    console.log("- 7分钟质押: 1.33% 每分钟");
    console.log("- 15分钟质押: 1.67% 每分钟");
    console.log("- 30分钟质押: 2.00% 每分钟");
    
    console.log("\n🎯 测试建议:");
    console.log("1. 更新前端合约地址为:", protocolAddress);
    console.log("2. 购买门票 (100/300/500/1000 MC)");
    console.log("3. 提供流动性质押 (选择 7/15/30 分钟)");
    console.log("4. 等待几分钟后领取奖励");
    console.log("5. 验证收益计算是否正确");
    
    console.log("\n📝 合约信息:");
    console.log("JBC Token:", JBC_TOKEN);
    console.log("Protocol:", protocolAddress);
    console.log("Marketing Wallet:", MARKETING_WALLET);
    
  } catch (error) {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });