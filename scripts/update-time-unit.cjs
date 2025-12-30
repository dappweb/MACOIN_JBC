const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🕒 更新时间单位到测试环境 (分钟)...");
  
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MC");

  // 合约地址
  const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  // 获取合约工厂
  const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
  
  console.log("📋 准备升级合约...");
  console.log("当前合约地址:", PROTOCOL_ADDRESS);
  
  try {
    // 升级合约
    const upgraded = await upgrades.upgradeProxy(PROTOCOL_ADDRESS, JinbaoProtocolNative);
    await upgraded.waitForDeployment();
    
    console.log("✅ 合约升级成功!");
    console.log("合约地址:", await upgraded.getAddress());
    
    // 验证时间单位
    const secondsInUnit = await upgraded.SECONDS_IN_UNIT();
    console.log("🕒 SECONDS_IN_UNIT:", secondsInUnit.toString());
    
    if (secondsInUnit.toString() === "60") {
      console.log("✅ 时间单位已更新为测试环境 (60秒 = 1分钟)");
    } else {
      console.log("❌ 时间单位未正确更新，当前值:", secondsInUnit.toString());
    }
    
    // 显示质押周期信息
    console.log("\n📊 质押周期信息:");
    console.log("- 7分钟质押: 1.33% 每分钟");
    console.log("- 15分钟质押: 1.67% 每分钟");
    console.log("- 30分钟质押: 2.00% 每分钟");
    
    console.log("\n🎯 测试建议:");
    console.log("1. 购买门票 (100/300/500/1000 MC)");
    console.log("2. 提供流动性质押 (选择 7/15/30 分钟)");
    console.log("3. 等待几分钟后领取奖励");
    console.log("4. 验证收益计算是否正确");
    
  } catch (error) {
    console.error("❌ 升级失败:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });