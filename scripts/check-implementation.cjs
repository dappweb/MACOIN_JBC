const { ethers, upgrades } = require("hardhat");
require('dotenv').config();

const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "0x515871E9eADbF976b546113BbD48964383f86E61";

async function main() {
    console.log(`Checking implementation for Proxy: ${PROXY_ADDRESS}`);
    try {
        const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
        console.log(`Implementation Address: ${implAddress}`);
        
        // Check if we can interact with it
        const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
        const protocol = JinbaoProtocol.attach(PROXY_ADDRESS);
        
        const owner = await protocol.owner();
        console.log(`Owner: ${owner}`);
        
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
