const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Network configurations
const NETWORK_CONFIGS = {
  mc: {
    name: "MC Chain",
    chainId: 88813,
    explorer: "https://mcerscan.com",
    currency: "MC"
  },
  sepolia: {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io",
    currency: "SepoliaETH"
  },
  bscTestnet: {
    name: "BSC Testnet",
    chainId: 97,
    explorer: "https://testnet.bscscan.com",
    currency: "tBNB"
  },
  hardhat: {
    name: "Hardhat Local",
    chainId: 31337,
    explorer: "N/A",
    currency: "ETH"
  }
};

async function main() {
  const networkName = hre.network.name;
  const networkConfig = NETWORK_CONFIGS[networkName] || { name: networkName, chainId: "Unknown" };

  console.log("🚀 Starting Deployment");
  console.log("=".repeat(70));
  console.log(`📡 Network: ${networkConfig.name} (${networkName})`);
  console.log(`🔗 Chain ID: ${networkConfig.chainId}`);
  console.log(`🌐 Explorer: ${networkConfig.explorer}`);
  console.log("=".repeat(70));
  console.log("");

  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    console.error("❌ Error: No deployer account found!");
    console.error("   Please ensure your .env file exists and contains a valid PRIVATE_KEY.");
    console.error("   Check hardhat.config.cjs to verify network configuration.");
    process.exit(1);
  }

  console.log("📍 Deploying with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), networkConfig.currency);
  console.log("");

  // 1. Deploy Mock MC Token (for testing environment)
  // In production, you would use the address of the existing token
  console.log("Deploying MockMC...");
  const MockMC = await hre.ethers.getContractFactory("MockMC");
  const mc = await MockMC.deploy();
  await mc.waitForDeployment();
  const mcAddress = await mc.getAddress();
  console.log("MockMC deployed to:", mcAddress);

  // 2. Deploy JBC Token
  console.log("Deploying JBC...");
  const JBC = await hre.ethers.getContractFactory("JBC");
  const jbc = await JBC.deploy(deployer.address);
  await jbc.waitForDeployment();
  const jbcAddress = await jbc.getAddress();
  console.log("JBC deployed to:", jbcAddress);

  // 3. Deploy Protocol
  // Define wallet addresses (using deployer for all for simplicity in testnet)
  const marketingWallet = deployer.address;
  const treasuryWallet = deployer.address;
  const lpInjectionWallet = deployer.address;
  const buybackWallet = deployer.address;

  console.log("Deploying JinbaoProtocol...");
  const Protocol = await hre.ethers.getContractFactory("JinbaoProtocol");
  const protocol = await Protocol.deploy(
    mcAddress,
    jbcAddress,
    marketingWallet,
    treasuryWallet,
    lpInjectionWallet,
    buybackWallet
  );
  await protocol.waitForDeployment();
  const protocolAddress = await protocol.getAddress();
  console.log("JinbaoProtocol deployed to:", protocolAddress);

  // 4. Setup Permissions & Initial Funding
  console.log("Setting up permissions...");
  
  // Set Protocol address in JBC (to exempt from tax)
  await jbc.setProtocol(protocolAddress);
  console.log("JBC: Protocol address set.");

  // Fund Protocol with Tokens for Rewards
  // Mint/Transfer initial supply to protocol
  // JBC: 100M minted to deployer. Let's send 1M to protocol.
  const fundAmount = hre.ethers.parseEther("1000000");
  
  // Add manual gas override for Sepolia
  const txOptions = {
    gasLimit: 100000,
    // maxFeePerGas: ... (optional, let wallet handle or ethers estimate)
  };

  try {
      console.log("Transferring JBC to Protocol...");
      const tx1 = await jbc.transfer(protocolAddress, fundAmount);
      await tx1.wait();
      console.log(`Transferred 1,000,000 JBC to Protocol`);
  } catch (error) {
      console.log("Skipping JBC transfer (might be already done or nonce issue):", error.message);
  }

  try {
      console.log("Transferring MC to Protocol...");
      const tx2 = await mc.transfer(protocolAddress, fundAmount);
      await tx2.wait();
      console.log(`Transferred 1,000,000 MC to Protocol`);
  } catch (error) {
      console.log("Skipping MC transfer (might be already done or nonce issue):", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    network: networkName,
    networkName: networkConfig.name,
    chainId: networkConfig.chainId,
    explorer: networkConfig.explorer,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MockMC: mcAddress,
      JBC: jbcAddress,
      JinbaoProtocol: protocolAddress
    },
    wallets: {
      marketing: marketingWallet,
      treasury: treasuryWallet,
      lpInjection: lpInjectionWallet,
      buyback: buybackWallet
    }
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Save deployment info with timestamp
  const filename = `deployment-${networkName}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  // Also save as latest for this network
  const latestPath = path.join(deploymentsDir, `latest-${networkName}.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("Deployment Complete!");
  console.log("=".repeat(70));
  console.log("📋 Contract Addresses:");
  console.log(`   MC Token:         ${mcAddress}`);
  console.log(`   JBC Token:        ${jbcAddress}`);
  console.log(`   Jinbao Protocol:  ${protocolAddress}`);
  console.log("");
  console.log("🔗 Verification Commands:");
  console.log(`   MC Token:`);
  console.log(`   npx hardhat verify --network ${networkName} ${mcAddress}`);
  console.log("");
  console.log(`   JBC Token:`);
  console.log(`   npx hardhat verify --network ${networkName} ${jbcAddress} ${deployer.address}`);
  console.log("");
  console.log(`   Protocol:`);
  console.log(`   npx hardhat verify --network ${networkName} ${protocolAddress} ${mcAddress} ${jbcAddress} ${marketingWallet} ${treasuryWallet} ${lpInjectionWallet} ${buybackWallet}`);
  console.log("");
  console.log("📄 Deployment info saved to:", filename);
  console.log("🌐 Block Explorer:", networkConfig.explorer);
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
