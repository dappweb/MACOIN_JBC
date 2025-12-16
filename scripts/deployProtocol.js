const hre = require("hardhat");

async function main(mcAddress, jbcAddress) {
  console.log("📦 Deploying JinbaoProtocol...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Get wallet addresses from environment or use deployer
  const marketingWallet = process.env.MARKETING_WALLET || deployer.address;
  const treasuryWallet = process.env.TREASURY_WALLET || deployer.address;
  const lpWallet = process.env.LP_WALLET || deployer.address;
  const buybackWallet = process.env.BUYBACK_WALLET || deployer.address;

  console.log("\nWallet Configuration:");
  console.log("  Marketing:", marketingWallet);
  console.log("  Treasury:", treasuryWallet);
  console.log("  LP:", lpWallet);
  console.log("  Buyback:", buybackWallet);
  console.log("");

  const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocol");
  const protocol = await JinbaoProtocol.deploy(
    mcAddress,
    jbcAddress,
    marketingWallet,
    treasuryWallet,
    lpWallet,
    buybackWallet
  );
  await protocol.waitForDeployment();

  const address = await protocol.getAddress();
  console.log("✅ JinbaoProtocol deployed to:", address);

  return address;
}

if (require.main === module) {
  const mcAddress = process.argv[2];
  const jbcAddress = process.argv[3];

  if (!mcAddress || !jbcAddress) {
    console.error("❌ Usage: npx hardhat run scripts/deployProtocol.js --network mc <MC_ADDRESS> <JBC_ADDRESS>");
    process.exit(1);
  }

  main(mcAddress, jbcAddress)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
