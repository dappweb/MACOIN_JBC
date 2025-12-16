const hre = require("hardhat");

async function main() {
  console.log("📦 Deploying JBC Token...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const JBC = await hre.ethers.getContractFactory("JBC");
  const jbcToken = await JBC.deploy("Jinbao Coin", "JBC");
  await jbcToken.waitForDeployment();

  const address = await jbcToken.getAddress();
  console.log("✅ JBC deployed to:", address);

  return address;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
