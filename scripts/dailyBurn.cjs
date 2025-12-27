/**
 * Daily Burn Keeper Script
 * 
 * This script automatically calls the dailyBurn() function on the JinbaoProtocol contract.
 * It is designed to be run by a scheduler (cron, GitHub Actions, Gelato).
 * 
 * Usage:
 *   npx hardhat run scripts/dailyBurn.cjs --network mc
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Minimal ABI
const PROTOCOL_ABI = [
    "function dailyBurn() external",
    "function lastBurnTime() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)"
];

async function main() {
    console.log("=".repeat(60));
    console.log("Daily Burn Keeper Script");
    console.log("Timestamp:", new Date().toISOString());
    console.log("=".repeat(60));

    // 1. Setup Signer
    const [deployer] = await ethers.getSigners();
    console.log("Executor address:", deployer.address);
    
    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Executor balance:", ethers.formatEther(balance), "Native Token");
    
    if (balance === 0n) {
        console.error("❌ Error: Executor has 0 balance. Cannot send transaction.");
        process.exit(1);
    }

    // 2. Resolve Contract Address
    const network = await ethers.provider.getNetwork();
    const networkName = network.name === 'unknown' ? 'mc' : network.name; // Fallback for custom chains
    console.log("Network:", networkName, "(Chain ID:", network.chainId.toString() + ")");

    let protocolAddress;
    try {
        // Try latest-{network}.json first
        const latestDeploymentPath = path.join(__dirname, `../deployments/latest-${networkName}.json`);
        if (fs.existsSync(latestDeploymentPath)) {
            const data = JSON.parse(fs.readFileSync(latestDeploymentPath, 'utf8'));
            protocolAddress = data.protocolProxy || data.protocol;
            console.log(`✅ Loaded address from ${path.basename(latestDeploymentPath)}`);
        } else {
            // Try legacy path
            const legacyPath = path.join(__dirname, `../deployments/${networkName}/JinbaoProtocol.json`);
            if (fs.existsSync(legacyPath)) {
                const data = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
                protocolAddress = data.address;
                console.log(`✅ Loaded address from legacy path`);
            }
        }
    } catch (e) {
        console.warn("⚠️ Error loading deployment file:", e.message);
    }

    if (!protocolAddress) {
        // Fallback for MC Chain
        if (network.chainId === 88813n) {
            protocolAddress = "0x16fb6908f1b22048F4688B4D42A7d0729034F45D"; // From latest-mc.json check
            console.log("⚠️ Using hardcoded fallback address for MC Chain");
        } else {
            console.error("❌ Error: Could not resolve protocol address.");
            process.exit(1);
        }
    }
    console.log("Protocol Contract:", protocolAddress);

    // 3. Connect and Check Logic
    const protocol = new ethers.Contract(protocolAddress, PROTOCOL_ABI, deployer);

    try {
        const lastBurnTime = await protocol.lastBurnTime();
        const reserveJBC = await protocol.swapReserveJBC();
        
        const lastBurnDate = new Date(Number(lastBurnTime) * 1000);
        const now = Date.now() / 1000;
        const diffSeconds = now - Number(lastBurnTime);
        const diffHours = diffSeconds / 3600;

        console.log("\n--- Contract State ---");
        console.log("Last Burn Time:", lastBurnDate.toISOString());
        console.log("Time Since Last Burn:", diffHours.toFixed(2), "hours");
        console.log("JBC Reserve:", ethers.formatEther(reserveJBC), "JBC");

        // 4. Decision Logic
        if (diffHours < 24) {
            const waitHours = (24 - diffHours).toFixed(2);
            console.log(`\n⏳ Too early. Must wait ~${waitHours} more hours.`);
            return;
        }

        if (reserveJBC === 0n) {
            console.log("\n⚠️ No JBC to burn (Reserve is 0).");
            return;
        }

        // 5. Execute
        console.log("\n🔥 Conditions met. Executing dailyBurn()...");
        
        // Manual gas limit estimation usually safer for automated scripts
        let gasLimit;
        try {
            gasLimit = await protocol.dailyBurn.estimateGas();
            // Add 20% buffer
            gasLimit = (gasLimit * 120n) / 100n; 
        } catch (e) {
            console.warn("Gas estimation failed, using default:", e.message);
            gasLimit = 500000n;
        }

        const tx = await protocol.dailyBurn({ gasLimit });
        console.log("Tx Sent:", tx.hash);
        
        console.log("Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
        
    } catch (err) {
        console.error("\n❌ Execution Failed:");
        if (err.message.includes("Early")) {
            console.error("Reason: Early (Contract Revert)");
        } else {
            console.error(err);
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
