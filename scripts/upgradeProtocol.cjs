const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  
  // 1. Get the existing Proxy Address from the latest deployment file
  const deploymentFile = path.join(__dirname, `../deployments/latest-${networkName}.json`);
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ No deployment file found for ${networkName}. Cannot upgrade.`);
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentFile));
  const PROXY_ADDRESS = deploymentData.protocolProxy;

  if (!PROXY_ADDRESS) {
    console.error("❌ No Proxy address found in deployment file.");
    process.exit(1);
  }

  console.log(`🚀 Starting Upgrade for Proxy: ${PROXY_ADDRESS}`);
  console.log(`📡 Network: ${networkName}`);

  // 2. Get the new contract factory
  // Note: If you renamed the contract, use the new name here
  const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");

  // 3. Validate and Upgrade
  // This validates that the new contract is compatible with the old storage layout
  console.log("🔍 Validating and Upgrading...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocol, {
    kind: 'uups'
  });

  await upgraded.waitForDeployment();
  
  // 4. Get new Implementation Address
  const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);

  console.log("✅ Upgrade Successful!");
  console.log(`🏢 Proxy Address (Unchanged): ${PROXY_ADDRESS}`);
  console.log(`📝 New Implementation Address: ${newImplAddress}`);

  // 5. Update Deployment File
  deploymentData.protocolImplementation = newImplAddress;
  deploymentData.lastUpgrade = new Date().toISOString();
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log(`📄 Updated deployment info in ${deploymentFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
