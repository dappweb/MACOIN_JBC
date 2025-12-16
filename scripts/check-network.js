const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking MC Chain network connection...\n");

  try {
    const [deployer] = await hre.ethers.getSigners();
    const network = await hre.ethers.provider.getNetwork();
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const blockNumber = await hre.ethers.provider.getBlockNumber();

    console.log("✅ Network Information:");
    console.log("   Network Name:", hre.network.name);
    console.log("   Chain ID:", network.chainId.toString());
    console.log("   Current Block:", blockNumber);
    console.log("");

    console.log("✅ Account Information:");
    console.log("   Address:", deployer.address);
    console.log("   Balance:", hre.ethers.formatEther(balance), "MC");
    console.log("");

    if (balance < hre.ethers.parseEther("5")) {
      console.warn("⚠️  WARNING: Low balance!");
      console.warn("   You may need at least 5 MC for contract deployment.");
      console.warn("   Please fund your wallet before deploying.");
      console.log("");
    } else {
      console.log("✅ Balance is sufficient for deployment!");
      console.log("");
    }

    console.log("✅ Network connection successful!");
    console.log("   You can proceed with deployment.");

  } catch (error) {
    console.error("❌ Network check failed:");
    console.error(error.message);
    console.log("");
    console.log("Troubleshooting:");
    console.log("1. Check your internet connection");
    console.log("2. Verify RPC URL in hardhat.config.cjs");
    console.log("3. Ensure PRIVATE_KEY is set in .env file");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
