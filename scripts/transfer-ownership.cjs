const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🔄 Starting ownership transfer...");
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 Current signer:", deployer.address);
    
    // Contract addresses
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    
    // Get contract instance
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const protocol = JinbaoProtocol.attach(PROTOCOL_ADDRESS);
    
    // Check current owner
    const currentOwner = await protocol.owner();
    console.log("🏠 Current owner:", currentOwner);
    console.log("🔍 Is deployer the owner?", currentOwner.toLowerCase() === deployer.address.toLowerCase());
    
    // NEW_OWNER_ADDRESS - Replace with the address you want to transfer to
    const NEW_OWNER_ADDRESS = "0xYourNewOwnerAddressHere";
    
    if (NEW_OWNER_ADDRESS === "0xYourNewOwnerAddressHere") {
        console.log("⚠️  Please set NEW_OWNER_ADDRESS in the script");
        return;
    }
    
    console.log("🔄 Transferring ownership to:", NEW_OWNER_ADDRESS);
    
    try {
        const tx = await protocol.transferOwnership(NEW_OWNER_ADDRESS);
        console.log("📝 Transaction hash:", tx.hash);
        
        await tx.wait();
        console.log("✅ Ownership transferred successfully!");
        
        // Verify new owner
        const newOwner = await protocol.owner();
        console.log("🏠 New owner:", newOwner);
        
    } catch (error) {
        console.error("❌ Transfer failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });