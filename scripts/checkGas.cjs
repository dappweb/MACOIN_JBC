const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Checking Native Gas Balance for:", deployer.address);
    
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Native Balance (Wei):", balance.toString());
    console.log("Native Balance (Ether/MC):", hre.ethers.formatEther(balance));
    
    // Estimate Gas Price
    const feeData = await hre.ethers.provider.getFeeData();
    console.log("Gas Price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");
}

main().catch(console.error);
