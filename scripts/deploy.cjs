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
    explorer: "https://sepolia.infura.io/v3/1a10a13df2cc454ead9480743d1c09e1",
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
  const deployOverrides = networkName === "sepolia" ? {
    gasLimit: 4_500_000,
    maxFeePerGas: hre.ethers.parseUnits("30", "gwei"),
    maxPriorityFeePerGas: hre.ethers.parseUnits("2", "gwei")
  } : {};
  const txOverrides = networkName === "sepolia" ? {
    gasLimit: 100000,
    maxFeePerGas: hre.ethers.parseUnits("30", "gwei"),
    maxPriorityFeePerGas: hre.ethers.parseUnits("2", "gwei")
  } : {};

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
  // Use existing address to avoid changing token address
  const mcAddress = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
  // Attach to existing contract
  const MockMC = await hre.ethers.getContractFactory("MockMC");
  // Check if we can attach (this might fail if artifacts don't match, but usually MockMC is standard ERC20)
  // Or just use the address directly for protocol deployment without attaching object if we don't need to call it.
  // We need to call transfer later? Yes.
  // const mc = MockMC.attach(mcAddress); 
  // Warning: If we are on hardhat local network, this address likely DOES NOT EXIST unless we are forking.
  // If user provided these addresses, they are likely for a TESTNET (MC Chain?), not Hardhat Local.
  // If running on Hardhat Local without forking, this will fail.
  // Assuming user implies we are deploying to the network where these exist (e.g. 'mc' network).
  // But previous command was '--network hardhat'.
  // I will use the address provided.
  console.log("Using provided MC Address:", mcAddress);

  // 2. Deploy JBC Token
  console.log("Deploying JBC...");
  // Use existing address to avoid changing token address
  const jbcAddress = "0xA743cB357a9f59D349efB7985072779a094658dD";
  // Attach to existing contract
  // const JBC = await hre.ethers.getContractFactory("JBC");
  // const jbc = JBC.attach(jbcAddress);
  console.log("Using provided JBC Address:", jbcAddress);

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
    buybackWallet,
    deployOverrides
  );
  const protocolDeployTx = protocol.deploymentTransaction();
  if (protocolDeployTx) {
    console.log("JinbaoProtocol tx hash:", protocolDeployTx.hash);
  }
  await protocol.waitForDeployment();
  const protocolAddress = await protocol.getAddress();
  console.log("JinbaoProtocol deployed to:", protocolAddress);

  // 4. Setup Permissions & Initial Funding
  console.log("Setting up permissions...");

  // Note: Cannot call setProtocol on JBC if we don't have the private key of the deployer of JBC 
  // OR if we are on a network where we don't own the contract.
  // If JBC is existing, we likely can't call setProtocol unless we are the owner.
  // Skipping setProtocol call for existing tokens unless we can attach and call.
  
  /*
  // Set Protocol address in JBC (to exempt from tax)
  try {
    if (typeof jbc.setProtocol === "function") {
      await jbc.setProtocol(protocolAddress);
      console.log("JBC: Protocol address set.");
    } else {
      console.log("JBC.setProtocol not available on this JBC contract - skipping.");
    }
  } catch (err) {
    console.warn("Warning: Failed to call jbc.setProtocol (non-fatal):", err.message || err);
  }
  */

  // Fund Protocol with Tokens for Rewards
  // Mint/Transfer initial supply to protocol
  // JBC: 100M minted to deployer. Let's send 1M to protocol.
  const fundAmount = hre.ethers.parseEther("1000000");

  /*
  try {
      console.log("Transferring JBC to Protocol...");
      const tx1 = await jbc.transfer(protocolAddress, fundAmount, txOverrides);
      await tx1.wait();
      console.log(`Transferred 1,000,000 JBC to Protocol`);
  } catch (error) {
      console.log("Skipping JBC transfer (might be already done or nonce issue):", error.message);
  }

  try {
      console.log("Transferring MC to Protocol...");
      const tx2 = await mc.transfer(protocolAddress, fundAmount, txOverrides);
      await tx2.wait();
      console.log(`Transferred 1,000,000 MC to Protocol`);
  } catch (error) {
      console.log("Skipping MC transfer (might be already done or nonce issue):", error.message);
  }
  */

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
