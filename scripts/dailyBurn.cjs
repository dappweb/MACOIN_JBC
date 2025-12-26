/**
 * Daily Burn Keeper Script
 * 
 * This script automatically calls the dailyBurn() function on the JinbaoProtocol contract.
 * It can be scheduled via cron job or other task schedulers to run periodically.
 * 
 * Usage:
 *   npx hardhat run scripts/dailyBurn.cjs --network mc
 * 
 * Recommended cron schedule (run every 6 hours to ensure daily execution):
 *   0 */6 * * * cd / path / to / project && npx hardhat run scripts / dailyBurn.cjs--network mc >> /var/log / dailyBurn.log 2 >& 1
    */

const { ethers } = require("hardhat");

// Contract ABI - only need dailyBurn function and lastBurnTime view
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

    // Get signer
    const [deployer] = await ethers.getSigners();
    console.log("Executor address:", deployer.address);

    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

    // Load contract address from deployments
    let protocolAddress;
    try {
        // Try to load from deployments folder
        const deployments = require("../deployments/mc/JinbaoProtocol.json");
        protocolAddress = deployments.address;
    } catch (e) {
        // Fallback to hardcoded address (MC Chain deployment)
        protocolAddress = "0xe4D97D48A2EE5Fb2aBAe282100d09BCc4C81a475";
        console.log("Warning: Using fallback protocol address");
    }

    console.log("Protocol Contract:", protocolAddress);

    // Connect to contract
    const protocol = new ethers.Contract(protocolAddress, PROTOCOL_ABI, deployer);

    // Check current state
    try {
        const lastBurnTime = await protocol.lastBurnTime();
        const reserveJBC = await protocol.swapReserveJBC();

        const lastBurnDate = new Date(Number(lastBurnTime) * 1000);
        const now = Date.now() / 1000;
        const hoursSinceLastBurn = (now - Number(lastBurnTime)) / 3600;

        console.log("\n--- Current State ---");
        console.log("Last Burn Time:", lastBurnDate.toISOString());
        console.log("Hours Since Last Burn:", hoursSinceLastBurn.toFixed(2));
        console.log("JBC Reserve:", ethers.formatEther(reserveJBC), "JBC");
        console.log("Burn Amount (1%):", ethers.formatEther(reserveJBC / 100n), "JBC");

        // Check if we can burn (need 24 hours since last burn)
        if (hoursSinceLastBurn < 24) {
            const hoursRemaining = (24 - hoursSinceLastBurn).toFixed(2);
            console.log("\n⏳ Too early to burn. Hours remaining:", hoursRemaining);
            console.log("Skipping execution.");
            return;
        }

        // Check if there's JBC to burn
        if (reserveJBC === 0n) {
            console.log("\n⚠️ No JBC in reserve. Nothing to burn.");
            return;
        }

        // Execute daily burn
        console.log("\n🔥 Executing daily burn...");
        const tx = await protocol.dailyBurn();
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Verify new state
        const newReserveJBC = await protocol.swapReserveJBC();
        const burned = reserveJBC - newReserveJBC;

        console.log("\n✅ Daily burn executed successfully!");
        console.log("JBC Burned:", ethers.formatEther(burned), "JBC");
        console.log("New JBC Reserve:", ethers.formatEther(newReserveJBC), "JBC");

    } catch (error) {
        // Handle revert errors gracefully
        if (error.message.includes("Early")) {
            console.log("\n⏳ Contract reverted: Too early to burn (24h not passed)");
        } else if (error.message.includes("No res")) {
            console.log("\n⚠️ Contract reverted: No JBC in reserve");
        } else {
            console.error("\n❌ Error executing daily burn:");
            console.error(error.message || error);
        }
        process.exitCode = 1;
    }

    console.log("\n" + "=".repeat(60));
    console.log("Script completed");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
