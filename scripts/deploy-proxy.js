const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting JinbaoProtocol proxy deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MC\n");

  // 使用现有的MC和JBC地址
  const MC_ADDRESS = process.env.MC_ADDRESS || "0x..."; // 替换为实际MC地址
  const JBC_ADDRESS = process.env.JBC_ADDRESS || "0x..."; // 替换为实际JBC地址
  
  if (!MC_ADDRESS || MC_ADDRESS === "0x..." || !JBC_ADDRESS || JBC_ADDRESS === "0x...") {
    throw new Error("❌ Please set MC_ADDRESS and JBC_ADDRESS environment variables");
  }

  // 获取钱包地址
  const marketingWallet = process.env.MARKETING_WALLET || deployer.address;
  const treasuryWallet = process.env.TREASURY_WALLET || deployer.address;
  const lpWallet = process.env.LP_WALLET || deployer.address;
  const buybackWallet = process.env.BUYBACK_WALLET || deployer.address;

  console.log("🏦 Configuration:");
  console.log("   MC Token:", MC_ADDRESS);
  console.log("   JBC Token:", JBC_ADDRESS);
  console.log("   Marketing Wallet:", marketingWallet);
  console.log("   Treasury Wallet:", treasuryWallet);
  console.log("   LP Wallet:", lpWallet);
  console.log("   Buyback Wallet:", buybackWallet);
  console.log("");

  // 部署代理合约
  console.log("📦 Deploying JinbaoProtocol proxy...");
  const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocol");
  
  const protocol = await upgrades.deployProxy(JinbaoProtocol, [
    MC_ADDRESS,
    JBC_ADDRESS,
    marketingWallet,
    treasuryWallet,
    lpWallet,
    buybackWallet
  ], {
    initializer: 'initialize'
  });

  await protocol.waitForDeployment();
  
  const proxyAddress = await protocol.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log("✅ JinbaoProtocol proxy deployed!");
  console.log("📍 Proxy address:", proxyAddress);
  console.log("📍 Implementation address:", implAddress);
  console.log("");

  // 保存部署信息
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MC: MC_ADDRESS,
      JBC: JBC_ADDRESS,
      JinbaoProtocolProxy: proxyAddress,
      JinbaoProtocolImpl: implAddress
    },
    wallets: {
      marketing: marketingWallet,
      treasury: treasuryWallet,
      lp: lpWallet,
      buyback: buybackWallet
    },
    upgradeInfo: {
      type: "UUPS",
      canUpgrade: true,
      upgradeFunction: "_authorizeUpgrade"
    }
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `proxy-deployment-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  // 保存为最新版本
  const latestPath = path.join(deploymentsDir, `latest-proxy-${hre.network.name}.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("📄 Deployment info saved to:", filename);
  console.log("");

  // 显示总结
  console.log("=" .repeat(70));
  console.log("🎉 PROXY DEPLOYMENT SUCCESSFUL!");
  console.log("=" .repeat(70));
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("   MC Token (existing):", MC_ADDRESS);
  console.log("   JBC Token (existing):", JBC_ADDRESS);
  console.log("   Protocol Proxy:", proxyAddress);
  console.log("   Protocol Implementation:", implAddress);
  console.log("");
  console.log("🔧 Next Steps:");
  console.log("   1. Update Web3Context.tsx with proxy address:", proxyAddress);
  console.log("   2. Verify contracts on block explorer:");
  console.log(`      npx hardhat verify --network mc ${implAddress}`);
  console.log("   3. Test the deployment:");
  console.log("      npm run dev");
  console.log("   4. To upgrade in future:");
  console.log(`      PROXY_ADDRESS=${proxyAddress} npx hardhat run scripts/upgrade-protocol.js --network mc`);
  console.log("");
  console.log("✅ All user data will be preserved in future upgrades!");
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