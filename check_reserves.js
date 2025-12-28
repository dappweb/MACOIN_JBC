
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkReserves() {
    try {
        // 连接到本地 Hardhat 节点
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        
        // 获取部署地址
        const deploymentPath = path.join(__dirname, "ignition/deployments/chain-31337/deployed_addresses.json");
        if (!fs.existsSync(deploymentPath)) {
            console.log("Deployment file not found. Assuming default or manual check needed.");
            return;
        }
        
        const deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        const protocolAddress = deployments["JinbaoProtocolModule#JinbaoProtocol"];
        
        if (!protocolAddress) {
            console.log("Protocol address not found.");
            return;
        }

        console.log("Protocol Address:", protocolAddress);

        // 简化的 ABI，只包含我们要查的变量
        const abi = [
            "function swapReserveMC() view returns (uint256)",
            "function swapReserveJBC() view returns (uint256)"
        ];

        const contract = new ethers.Contract(protocolAddress, abi, provider);

        const reserveMC = await contract.swapReserveMC();
        const reserveJBC = await contract.swapReserveJBC();

        console.log("Reserve MC:", ethers.formatEther(reserveMC));
        console.log("Reserve JBC:", ethers.formatEther(reserveJBC));
        
        if (reserveMC == 0n || reserveJBC == 0n) {
             console.log("Reserves are empty or zero. Price ratio defaults to 1:1.");
        } else {
             const price = Number(ethers.formatEther(reserveMC)) / Number(ethers.formatEther(reserveJBC));
             console.log("Current Price (1 JBC in MC):", price);
             console.log("Ratio:", price === 1 ? "1:1" : "Not 1:1");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

checkReserves();
