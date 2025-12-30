const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 开始升级 JinbaoProtocol 到 V2...");
  
  // 获取当前部署的合约地址
  const CURRENT_PROXY_ADDRESS = "0xD437e63c2A76e0237249eC6070Bef9A2484C4302"; // Test分支合约地址
  
  console.log("📋 当前合约地址:", CURRENT_PROXY_ADDRESS);
  
  // 获取升级后的合约工厂
  const JinbaoProtocolV2 = await ethers.getContractFactory("JinbaoProtocolV2");
  
  console.log("⏳ 正在升级合约...");
  
  try {
    // 执行升级
    const upgraded = await upgrades.upgradeProxy(CURRENT_PROXY_ADDRESS, JinbaoProtocolV2);
    await upgraded.waitForDeployment();
    
    const upgradedAddress = await upgraded.getAddress();
    console.log("✅ 合约升级成功!");
    console.log("📍 代理合约地址:", upgradedAddress);
    
    // 验证升级
    console.log("🔍 验证升级结果...");
    const version = await upgraded.getVersion();
    console.log("📦 合约版本:", version);
    
    // 检查基本配置
    const directPercent = await upgraded.directRewardPercent();
    const levelPercent = await upgraded.levelRewardPercent();
    const secondsInUnit = await upgraded.SECONDS_IN_UNIT();
    
    console.log("⚙️ 合约配置:");
    console.log("  - 直推奖励比例:", Number(directPercent), "%");
    console.log("  - 层级奖励比例:", Number(levelPercent), "%");
    console.log("  - 时间单位:", Number(secondsInUnit), "秒");
    
    // 检查代币地址
    const mcToken = await upgraded.mcToken();
    const jbcToken = await upgraded.jbcToken();
    console.log("  - MC Token:", mcToken);
    console.log("  - JBC Token:", jbcToken);
    
    console.log("\n🎉 升级完成! 主要修复:");
    console.log("  ✅ 修复了直推奖励事件不触发的问题");
    console.log("  ✅ 修复了层级奖励事件不触发的问题");
    console.log("  ✅ 增强了奖励分发的可靠性");
    console.log("  ✅ 添加了调试事件用于问题排查");
    console.log("  ✅ 支持新的6参数ReferralRewardPaid事件格式");
    
    console.log("\n📝 升级后需要做的事情:");
    console.log("  1. 更新前端合约地址配置 (如果有变化)");
    console.log("  2. 测试购买门票功能，验证奖励事件正常触发");
    console.log("  3. 检查收益明细页面是否正常显示直推和层级奖励");
    console.log("  4. 监控合约运行状态");
    
  } catch (error) {
    console.error("❌ 升级失败:", error);
    
    if (error.message.includes("not the owner")) {
      console.log("\n💡 解决方案:");
      console.log("  请确保使用合约owner账户执行升级");
      console.log("  当前owner可以通过以下命令查询:");
      console.log("  npx hardhat run scripts/check-owner.js --network mc");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });