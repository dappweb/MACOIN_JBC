const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🔧 升级 JinbaoProtocolNative 合约...\n");
  console.log("修复: 添加 liquidityEnabled 检查到 stakeLiquidity 函数\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("升级账户:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "MC\n");

  // 当前代理合约地址
  const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

  try {
    // 获取当前实现地址
    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("当前实现合约:", currentImpl);

    // 部署新版本
    console.log("\n📦 部署新实现合约...");
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolNative);
    await upgraded.waitForDeployment();
    
    // 获取新实现地址
    const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("新实现合约:", newImpl);

    if (currentImpl === newImpl) {
      console.log("\n⚠️ 实现地址未改变，可能没有代码变更");
    } else {
      console.log("\n✅ 合约升级成功!");
    }

    // 验证修复
    console.log("\n🔍 验证 liquidityEnabled 状态...");
    const protocol = await ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    const liquidityEnabled = await protocol.liquidityEnabled();
    console.log("liquidityEnabled:", liquidityEnabled);

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
