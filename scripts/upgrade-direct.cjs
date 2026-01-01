const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🔧 直接部署新实现并升级...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("升级账户:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "MC\n");

  const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

  try {
    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("当前实现合约:", currentImpl);

    // 直接部署新实现
    console.log("\n📦 部署新实现合约...");
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    const newImpl = await JinbaoProtocolNative.deploy();
    await newImpl.waitForDeployment();
    const newImplAddress = await newImpl.getAddress();
    console.log("新实现合约已部署:", newImplAddress);

    // 通过代理升级到新实现
    console.log("\n🚀 升级代理到新实现...");
    const proxy = await ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    const upgradeTx = await proxy.upgradeToAndCall(newImplAddress, "0x");
    await upgradeTx.wait();
    console.log("✅ 升级完成!");

    // 验证
    const finalImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("最终实现合约:", finalImpl);

    // 测试 getUserDynamicRewards
    console.log("\n🔍 测试 getUserDynamicRewards 函数...");
    try {
      const result = await proxy.getUserDynamicRewards(deployer.address);
      console.log("✅ getUserDynamicRewards 调用成功:");
      console.log("  totalEarned:", ethers.formatEther(result.totalEarned));
      console.log("  totalClaimed:", ethers.formatEther(result.totalClaimed));
      console.log("  pendingAmount:", ethers.formatEther(result.pendingAmount));
      console.log("  claimableAmount:", ethers.formatEther(result.claimableAmount));
    } catch (e) {
      console.log("❌ getUserDynamicRewards 调用失败:", e.message.substring(0, 100));
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("代理地址:", PROXY_ADDRESS);
    console.log("新实现:", finalImpl);
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
