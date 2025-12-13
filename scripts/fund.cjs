const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Funding protocol with account:", deployer.address);

  // Addresses from the previous deployment
  const MC_ADDRESS = "0xF38EaC9cDB449F52DEFf11707c97Fe7e7b005eBE";
  const JBC_ADDRESS = "0x4C592F7B83D32b3236EE7Edff8204A92DA274707";
  const PROTOCOL_ADDRESS = "0x490B6c6Cb9FEC80fD17FBd2D71f095aE01f67Ec0";

  // Attach to contracts
  const JBC = await hre.ethers.getContractFactory("JBC");
  const jbc = JBC.attach(JBC_ADDRESS);

  const MockMC = await hre.ethers.getContractFactory("MockMC");
  const mc = MockMC.attach(MC_ADDRESS);

  const fundAmount = hre.ethers.parseEther("1000000");

  // Get current fee data for better gas estimation
  const feeData = await hre.ethers.provider.getFeeData();
  
  // Use slightly higher gas price to ensure it goes through
  const txOverrides = {
    // gasPrice: feeData.gasPrice * 120n / 100n, // Increase by 20% if needed, but EIP-1559 uses maxFeePerGas
  };

  console.log("1. Sending 1,000,000 JBC to Protocol...");
  try {
      const tx1 = await jbc.transfer(PROTOCOL_ADDRESS, fundAmount);
      console.log(`   Tx Hash: ${tx1.hash}`);
      await tx1.wait();
      console.log("   ✅ JBC Transfer confirmed");
  } catch (error) {
      console.error("   ❌ JBC Transfer failed:", error.message);
  }

  console.log("2. Sending 1,000,000 MC to Protocol...");
  try {
      const tx2 = await mc.transfer(PROTOCOL_ADDRESS, fundAmount);
      console.log(`   Tx Hash: ${tx2.hash}`);
      await tx2.wait();
      console.log("   ✅ MC Transfer confirmed");
  } catch (error) {
      console.error("   ❌ MC Transfer failed:", error.message);
  }

  console.log("Funding Complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
