const { ethers } = require("ethers");
require('dotenv').config();

const ADDRESSES = {
    PROTOCOL: process.env.PROXY_ADDRESS || "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const PROTOCOL_ABI = [
    "function mcToken() view returns (address)",
    "function jbcToken() view returns (address)",
    "function owner() view returns (address)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const contract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    console.log("Protocol Address:", ADDRESSES.PROTOCOL);
    
    try {
        const mcToken = await contract.mcToken();
        console.log("MC Token in Contract:", mcToken);
        
        const jbcToken = await contract.jbcToken();
        console.log("JBC Token in Contract:", jbcToken);

        const owner = await contract.owner();
        console.log("Owner:", owner);

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
