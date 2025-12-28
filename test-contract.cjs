const hre = require("hardhat");

async function main() {
  console.log("Testing contract loading...");
  
  try {
    const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocol");
    console.log("✅ Contract factory loaded successfully");
    
    const PROXY_ADDRESS = "0x7a216BeA62eF7629904E0d30b24F6842c9b0d660";
    const contract = await hre.ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);
    console.log("✅ Contract instance created successfully");
    
    // Try to call a simple view function
    const nextTicketId = await contract.nextTicketId();
    console.log("✅ Contract call successful, nextTicketId:", nextTicketId.toString());
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main().catch(console.error);