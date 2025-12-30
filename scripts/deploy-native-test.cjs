const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 部署原生MC测试环境合约 (分钟单位)...");
  
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
    console.log("📋 部署新的原生MC测试合约...");
    
    // 获取合约工厂
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    
    // 使用 upgrades.deployProxy 部署可升级代理
    const protocol = await upgrades.deployProxy(JinbaoProtocolNative, [
      JBC_TOKEN,
      MARKETING_WALLET,
      TREASURY_WALLET,
      LP_INJECTION_WALLET,
      BUYBACK_WALLET
    ], {
      kind: 'uups',
      initializer: 'initialize'
    });
    
    await protocol.waitForDeployment();
    
    const protocolAddress = await protocol.getAddress();
    console.log("✅ 原生MC合约部署成功!");
    console.log("代理地址:", protocolAddress);
    
    // 验证时间单位
    const secondsInUnit = await protocol.SECONDS_IN_UNIT();
    console.log("🕒 SECONDS_IN_UNIT:", secondsInUnit.toString());
    
    if (secondsInUnit.toString() === "60") {
      console.log("✅ 时间单位已设置为测试环境 (60秒 = 1分钟)");
      console.log("\n📊 质押周期信息:");
      console.log("- 7分钟质押: 1.33% 每分钟 (约 9.33% 总收益)");
      console.log("- 15分钟质押: 1.67% 每分钟 (约 25% 总收益)");
      console.log("- 30分钟质押: 2.00% 每分钟 (约 60% 总收益)");
    } else {
      console.log("❌ 时间单位不正确，当前值:", secondsInUnit.toString());
    }
    
    // 检查其他参数
    console.log("\n🔧 合约参数:");
    const ticketFlexDuration = await protocol.ticketFlexibilityDuration();
    const flexHours = Number(ticketFlexDuration) / 3600;
    console.log("门票灵活期:", flexHours, "小时");
    
    const liquidityEnabled = await protocol.liquidityEnabled();
    console.log("流动性功能:", liquidityEnabled ? "✅ 启用" : "❌ 禁用");
    
    const redeemEnabled = await protocol.redeemEnabled();
    console.log("赎回功能:", redeemEnabled ? "✅ 启用" : "❌ 禁用");
    
    console.log("\n🎯 测试建议:");
    console.log("1. 更新前端合约地址为:", protocolAddress);
    console.log("2. 购买门票 (100/300/500/1000 MC) - 使用原生MC");
    console.log("3. 提供流动性质押 (选择 7/15/30 分钟) - 使用原生MC");
    console.log("4. 等待几分钟后领取奖励");
    console.log("5. 验证收益计算是否正确");
    
    console.log("\n📝 合约信息:");
    console.log("JBC Token:", JBC_TOKEN);
    console.log("Protocol (Native MC):", protocolAddress);
    console.log("Marketing Wallet:", MARKETING_WALLET);
    
    console.log("\n⚠️ 重要提醒:");
    console.log("- 这是新部署的合约，与旧合约数据不兼容");
    console.log("- 需要更新前端配置文件中的合约地址");
    console.log("- 旧合约的用户数据不会迁移到新合约");
    
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