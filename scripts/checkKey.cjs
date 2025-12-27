const { ethers } = require("ethers");

async function main() {
    const key = "265f377ca582e2870b4b4216f0b98dfe7feea0028ae4899fb9957f5c354c5211";
    const wallet = new ethers.Wallet(key);
    console.log(`Address: ${wallet.address}`);
    
    const target = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
    if (wallet.address.toLowerCase() === target.toLowerCase()) {
        console.log("✅ MATCHES original deployer!");
    } else {
        console.log("❌ Does NOT match original deployer.");
    }
}

main();
