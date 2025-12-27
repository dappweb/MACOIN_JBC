const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = hre.network.name;

  console.log(`\n🚀 Starting Upgradeable Deployment`);
  console.log(`======================================================================`);
  console.log(`📡 Network: ${networkName}`);
  console.log(`📍 Deployer: ${deployer.address}`);
  console.log(`======================================================================`);

  // Load existing token addresses if available, or deploy mocks
  let MC_ADDRESS = process.env.MC_TOKEN_ADDRESS;
  let JBC_ADDRESS = process.env.JBC_TOKEN_ADDRESS;

  // If addresses not in env, check if we can reuse from previous deployment
  if (!MC_ADDRESS || !JBC_ADDRESS) {
      // Try to find previous deployment file
      const deploymentFile = path.join(__dirname, `../deployments/latest-${networkName}.json`);
      if (fs.existsSync(deploymentFile)) {
          const data = JSON.parse(fs.readFileSync(deploymentFile));
          if (!MC_ADDRESS) MC_ADDRESS = data.mcToken;
          if (!JBC_ADDRESS) JBC_ADDRESS = data.jbcToken;
          console.log("♻️  Reusing token addresses from previous deployment");
      }
  }

  // If still no addresses and on local/testnet, deploy mocks
  if (!MC_ADDRESS) {
      console.log("\n📦 Deploying MockMC...");
      const MockMC = await ethers.getContractFactory("MockMC");
      const mc = await MockMC.deploy();
      await mc.waitForDeployment();
      MC_ADDRESS = await mc.getAddress();
      console.log(`✅ MockMC deployed to: ${MC_ADDRESS}`);
  } else {
      console.log(`ℹ️  Using MC Token: ${MC_ADDRESS}`);
  }

  if (!JBC_ADDRESS) {
      console.log("\n📦 Deploying JBC...");
      const JBC = await ethers.getContractFactory("JBC");
      const jbc = await JBC.deploy(deployer.address); // Owner is deployer
      await jbc.waitForDeployment();
      JBC_ADDRESS = await jbc.getAddress();
      console.log(`✅ JBC deployed to: ${JBC_ADDRESS}`);
  } else {
      console.log(`ℹ️  Using JBC Token: ${JBC_ADDRESS}`);
  }

  // Wallets
  const marketingWallet = process.env.MARKETING_WALLET || deployer.address;
  const treasuryWallet = process.env.TREASURY_WALLET || deployer.address;
  const lpInjectionWallet = process.env.LP_WALLET || deployer.address;
  const buybackWallet = process.env.BUYBACK_WALLET || deployer.address;

  console.log("\nWallet Configuration:");
  console.log("  Marketing:", marketingWallet);
  console.log("  Treasury:", treasuryWallet);
  console.log("  LP:", lpInjectionWallet);
  console.log("  Buyback:", buybackWallet);

  console.log("\n📦 Deploying JinbaoProtocol (Upgradeable Proxy)...");
  
  const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
  
  // Deploy Proxy
  const protocol = await upgrades.deployProxy(JinbaoProtocol, [
      MC_ADDRESS,
      JBC_ADDRESS,
      marketingWallet,
      treasuryWallet,
      lpInjectionWallet,
      buybackWallet
  ], { 
      initializer: 'initialize',
      kind: 'uups' 
  });

  await protocol.waitForDeployment();
  const protocolAddress = await protocol.getAddress();
  
  console.log(`✅ JinbaoProtocol Proxy deployed to: ${protocolAddress}`);
  
  // Implementation Address (for verification)
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(protocolAddress);
  console.log(`📝 Implementation Contract: ${implementationAddress}`);

  // Setup Initial Liquidity (Optional, similar to original script)
  console.log("\n💧 Setting up Liquidity...");
  const mcToken = await ethers.getContractAt("IERC20", MC_ADDRESS);
  const jbcToken = await ethers.getContractAt("IERC20", JBC_ADDRESS);

  const initMC = ethers.parseEther("1000");
  const initJBC = ethers.parseEther("10000");

  // Check balances
  const balMC = await mcToken.balanceOf(deployer.address);
  const balJBC = await jbcToken.balanceOf(deployer.address);

  if (balMC >= initMC && balJBC >= initJBC) {
      console.log("Approving tokens...");
      await (await mcToken.approve(protocolAddress, initMC)).wait();
      await (await jbcToken.approve(protocolAddress, initJBC)).wait();
      
      console.log("Adding liquidity...");
      // Need to use the contract instance attached to proxy address
      const protocolProxy = await ethers.getContractAt("JinbaoProtocol", protocolAddress);
      await (await protocolProxy.addLiquidity(initMC, initJBC)).wait();
      console.log("✅ Liquidity added successfully");
  } else {
      console.log("⚠️  Insufficient balance for liquidity, skipping.");
  }

  // Save Deployment Info
  const deploymentInfo = {
      network: networkName,
      mcToken: MC_ADDRESS,
      jbcToken: JBC_ADDRESS,
      protocolProxy: protocolAddress,
      protocolImplementation: implementationAddress,
      timestamp: new Date().toISOString()
  };

  const filename = `deployment-upgradeable-${networkName}-${Date.now()}.json`;
  fs.writeFileSync(path.join(__dirname, `../deployments/${filename}`), JSON.stringify(deploymentInfo, null, 2));
  
  // Update latest
  fs.writeFileSync(path.join(__dirname, `../deployments/latest-${networkName}.json`), JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n📄 Deployment saved to deployments/${filename}`);

  // Update Frontend Constants
  updateFrontendConstants(MC_ADDRESS, JBC_ADDRESS, protocolAddress);
}

function updateFrontendConstants(mc, jbc, protocol) {
    const configPath = path.join(__dirname, "../Web3Context.tsx"); // Or wherever you store addresses
    let content = fs.readFileSync(configPath, "utf8");

    // Regex to find the object
    const regex = /export const CONTRACT_ADDRESSES = {[\s\S]*?};/;
    const newConfig = `export const CONTRACT_ADDRESSES = {
  MC_TOKEN: "${mc}",
  JBC_TOKEN: "${jbc}",
  PROTOCOL: "${protocol}"
};`;

    content = content.replace(regex, newConfig);
    fs.writeFileSync(configPath, content);
    console.log("🔄 Updated Web3Context.tsx with new Proxy address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
