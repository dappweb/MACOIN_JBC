const { ethers } = require("ethers");
require('dotenv').config();

const ADDRESSES = {
    PROTOCOL: process.env.PROXY_ADDRESS || "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const PROTOCOL_ABI = [
    "function setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled) external",
    "function liquidityEnabled() view returns (bool)",
    "function redeemEnabled() view returns (bool)",
    "function owner() view returns (address)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, wallet);

    console.log("Testing setOperationalStatus...");
    const owner = await contract.owner();
    console.log("Owner:", owner);
    
    const liqStatus = await contract.liquidityEnabled();
    console.log("Current Liquidity Status:", liqStatus);

    try {
        const tx = await contract.setOperationalStatus(true, true, { gasLimit: 200000 });
        console.log("Tx Hash:", tx.hash);
        await tx.wait();
        console.log("Status update successful!");
        
        const newLiqStatus = await contract.liquidityEnabled();
        console.log("New Liquidity Status:", newLiqStatus);
    } catch (error) {
        console.error("Status update failed:", error);
    }
}

main();
