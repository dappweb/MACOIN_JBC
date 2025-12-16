const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting deployment to MC Chain...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MC\n");

  if (balance < hre.ethers.parseEther("5")) {
    console.warn("⚠️  Warning: Low balance! You may need at least 5 MC for deployment.\n");
  }

  // Get wallet addresses from environment variables
  const marketingWallet = process.env.MARKETING_WALLET || deployer.address;
  const treasuryWallet = process.env.TREASURY_WALLET || deployer.address;
  const lpWallet = process.env.LP_WALLET || deployer.address;
  const buybackWallet = process.env.BUYBACK_WALLET || deployer.address;

  console.log("🏦 Wallet Configuration:");
  console.log("   Marketing Wallet:", marketingWallet);
  console.log("   Treasury Wallet:", treasuryWallet);
  console.log("   LP Wallet:", lpWallet);
  console.log("   Buyback Wallet:", buybackWallet);
  console.log("");

  // Step 1: Deploy MockMC Token (for testing)
  console.log("📦 Step 1/3: Deploying MockMC Token...");
  const MockMC = await hre.ethers.getContractFactory("MockMC");
  const mcToken = await MockMC.deploy();
  await mcToken.waitForDeployment();
  const mcAddress = await mcToken.getAddress();
  console.log("✅ MockMC deployed to:", mcAddress);
  console.log("");

  // Step 2: Deploy JBC Token
  console.log("📦 Step 2/3: Deploying JBC Token...");
  const JBC = await hre.ethers.getContractFactory("JBC");
  const jbcToken = await JBC.deploy("Jinbao Coin", "JBC");
  await jbcToken.waitForDeployment();
  const jbcAddress = await jbcToken.getAddress();
  console.log("✅ JBC deployed to:", jbcAddress);
  console.log("");

  // Step 3: Deploy JinbaoProtocol
  console.log("📦 Step 3/3: Deploying JinbaoProtocol...");
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
  const protocolAddress = await protocol.getAddress();
  console.log("✅ JinbaoProtocol deployed to:", protocolAddress);
  console.log("");

  // Transfer JBC ownership to Protocol
  console.log("🔄 Transferring JBC ownership to Protocol...");
  const tx = await jbcToken.transferOwnership(protocolAddress);
  await tx.wait();
  console.log("✅ JBC ownership transferred\n");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
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
      lp: lpWallet,
      buyback: buybackWallet
    }
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `deployment-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  // Also save as latest
  const latestPath = path.join(deploymentsDir, `latest-${hre.network.name}.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("📄 Deployment info saved to:", filename);
  console.log("");

  // Display summary
  console.log("=" .repeat(70));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=" .repeat(70));
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("   MockMC Token:", mcAddress);
  console.log("   JBC Token:", jbcAddress);
  console.log("   Protocol:", protocolAddress);
  console.log("");
  console.log("🔧 Next Steps:");
  console.log("   1. Update Web3Context.tsx with these addresses");
  console.log("   2. Verify contracts on block explorer:");
  console.log(`      npx hardhat verify --network mc ${mcAddress}`);
  console.log(`      npx hardhat verify --network mc ${jbcAddress} "Jinbao Coin" "JBC"`);
  console.log(`      npx hardhat verify --network mc ${protocolAddress} ${mcAddress} ${jbcAddress} ${marketingWallet} ${treasuryWallet} ${lpWallet} ${buybackWallet}`);
  console.log("   3. Test the deployment:");
  console.log("      npm run dev");
  console.log("");
  console.log("⚠️  IMPORTANT: Save these addresses securely!");
  console.log("=" .repeat(70));
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
