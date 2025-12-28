const hre = require("hardhat");

async function main() {
  console.log("Testing simple contract loading...");
  
  try {
    const Test = await hre.ethers.getContractFactory("Test");
    console.log("✅ Test contract factory loaded successfully");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main().catch(console.error);