const { ethers } = require("hardhat");

async function main() {
    const JBC_ADDRESS = "0xA743cB357a9f59D349efB7985072779a094658dD";
    const jbc = await ethers.getContractAt("JBC", JBC_ADDRESS);
    
    const owner = await jbc.owner();
    console.log(`JBC Owner: ${owner}`);
    
    const [signer] = await ethers.getSigners();
    console.log(`Current Signer: ${signer.address}`);

    if (owner.toLowerCase() === signer.address.toLowerCase()) {
        console.log("✅ Signer IS the owner.");
    } else {
        console.log("❌ Signer is NOT the owner.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
