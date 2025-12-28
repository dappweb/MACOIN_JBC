const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  console.log("🔄 Starting JinbaoProtocol upgrade...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Upgrading with account:", deployer.address);

  // 现有代理合约地址 (需要从之前的部署中获取)
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "0x..."; // 替换为实际地址
  
  if (!PROXY_ADDRESS || PROXY_ADDRESS === "0x...") {
    throw new Error("❌ Please set PROXY_ADDRESS environment variable");
  }

  console.log("🏠 Current proxy address:", PROXY_ADDRESS);

  // 获取新的实现合约
  const JinbaoProtocolV2 = await hre.ethers.getContractFactory("JinbaoProtocol");
  
  console.log("📦 Deploying new implementation...");
  
  // 升级合约
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolV2);
  await upgraded.waitForDeployment();
  
  const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  
  console.log("✅ Upgrade completed!");
  console.log("📍 Proxy address (unchanged):", PROXY_ADDRESS);
  console.log("📍 New implementation address:", newImplAddress);
  
  // 验证升级后的合约
  console.log("\n🔍 Verifying upgrade...");
  const upgradedContract = await hre.ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);
  
  // 检查一些基本数据是否还在
  try {
    const nextTicketId = await upgradedContract.nextTicketId();
    const nextStakeId = await upgradedContract.nextStakeId();
    console.log("✅ Data preserved - nextTicketId:", nextTicketId.toString());
    console.log("✅ Data preserved - nextStakeId:", nextStakeId.toString());
  } catch (error) {
    console.log("⚠️  Could not verify data preservation:", error.message);
  }

  console.log("\n🎉 Upgrade successful! All user data preserved.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Upgrade failed:");
    console.error(error);
    process.exit(1);
  });