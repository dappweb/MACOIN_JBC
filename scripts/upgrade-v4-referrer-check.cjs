const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🔧 升级合约: 添加购票必须绑定推荐人检查...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("升级账户:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "MC\n");

  const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

  try {
    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("当前实现合约:", currentImpl);

    console.log("\n📦 部署新实现合约...");
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolNative);
    await upgraded.waitForDeployment();
    
    const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("新实现合约:", newImpl);

    if (currentImpl !== newImpl) {
      console.log("\n✅ 合约升级成功!");
    }

    // 测试验证
    console.log("\n🔍 验证: 未绑定推荐人购票应失败...");
    const protocol = await ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    
    try {
      await protocol.buyTicket.staticCall({ value: ethers.parseEther("100") });
      console.log("❌ 购票成功了，修复无效!");
    } catch (error) {
      if (error.message.includes("Must bind referrer first")) {
        console.log("✅ 正确拒绝: Must bind referrer first");
      } else {
        console.log("拒绝原因:", error.message.substring(0, 100));
      }
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("升级完成!");
    console.log("代理地址:", PROXY_ADDRESS);
    console.log("新实现:", newImpl);
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
