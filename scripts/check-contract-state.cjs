const { ethers } = require("ethers");
require('dotenv').config();

const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    PROTOCOL: process.env.PROXY_ADDRESS || "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const PROTOCOL_ABI = [
    "function mcToken() view returns (address)",
    "function jbcToken() view returns (address)",
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
    "function emergencyPaused() view returns (bool)"
];

async function checkState() {
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    console.log(`Checking state for Protocol at: ${ADDRESSES.PROTOCOL}`);

    try {
        const owner = await protocolContract.owner();
        console.log(`Owner: ${owner}`);
        
        const mcToken = await protocolContract.mcToken();
        console.log(`MC Token: ${mcToken}`);
        
        try {
            const reserveMC = await protocolContract.swapReserveMC();
            console.log(`Reserve MC: ${reserveMC.toString()}`);
        } catch (e) { console.log("Reserve MC error:", e.message); }

        try {
            const emergencyPaused = await protocolContract.emergencyPaused();
            console.log(`Emergency Paused: ${emergencyPaused}`);
        } catch (e) { console.log("Emergency Paused: Function not found or error"); }

    } catch (error) {
        console.error("Error checking state:", error);
    }
}

checkState();
