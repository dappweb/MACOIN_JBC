const hre = require("hardhat");

async function main() {
  console.log("📦 Deploying MockMC Token...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const MockMC = await hre.ethers.getContractFactory("MockMC");
  const mcToken = await MockMC.deploy();
  await mcToken.waitForDeployment();

  const address = await mcToken.getAddress();
  console.log("✅ MockMC deployed to:", address);

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
