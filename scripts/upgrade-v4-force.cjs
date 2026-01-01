const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🔧 强制升级合约...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("升级账户:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "MC\n");

  const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

  try {
    // 获取当前实现地址
    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("当前实现合约:", currentImpl);

    // 先导入现有代理
    console.log("\n📦 导入现有代理...");
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    
    try {
      await upgrades.forceImport(PROXY_ADDRESS, JinbaoProtocolNative, { kind: 'uups' });
      console.log("✅ 代理导入成功");
    } catch (e) {
      console.log("代理已存在或导入完成:", e.message.substring(0, 50));
    }

    // 执行升级
    console.log("\n🚀 执行升级...");
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolNative);
    await upgraded.waitForDeployment();
    
    const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("新实现合约:", newImpl);

    if (currentImpl !== newImpl) {
      console.log("\n✅ 合约升级成功!");
    } else {
      console.log("\n⚠️ 实现地址未改变");
    }

    // 测试验证
    console.log("\n🔍 验证修复...");
    const protocol = await ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    
    try {
      await protocol.buyTicket.staticCall({ value: ethers.parseEther("100") });
      console.log("❌ 购票成功了，修复无效!");
    } catch (error) {
      if (error.message.includes("Must bind referrer first")) {
        console.log("✅ 正确拒绝: Must bind referrer first");
      } else {
        console.log("拒绝原因:", error.message.substring(0, 150));
      }
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("代理地址:", PROXY_ADDRESS);
    console.log("实现地址:", newImpl);
    console.log("═══════════════════════════════════════════");

  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
