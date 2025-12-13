const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    console.error("❌ Error: No deployer account found!");
    console.error("   Please ensure your .env file exists and contains a valid PRIVATE_KEY.");
    console.error("   Check hardhat.config.cjs to verify network configuration.");
    process.exit(1);
  }

  console.log("Deploying contracts with the account:", deployer.address);

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

  console.log("Deployment Complete!");
  console.log("----------------------------------------------------");
  console.log(`MC Token:         ${mcAddress}`);
  console.log(`JBC Token:        ${jbcAddress}`);
  console.log(`Jinbao Protocol:  ${protocolAddress}`);
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
