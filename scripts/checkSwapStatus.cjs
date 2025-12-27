const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Load deployment info
    const deploymentPath = path.join(__dirname, "../deployments/latest-mc.json");
    if (!fs.existsSync(deploymentPath)) {
        console.error("Deployment file not found!");
        return;
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    console.log("Checking Swap Pool Status...");
    console.log("Protocol Proxy:", deployment.protocolProxy);
    console.log("MC Token:", deployment.mcToken);
    console.log("JBC Token:", deployment.jbcToken);

    // Get contract instances
    const Protocol = await hre.ethers.getContractFactory("JinbaoProtocol");
    const protocol = Protocol.attach(deployment.protocolProxy);

    const ERC20 = await hre.ethers.getContractFactory("JBC"); // Assuming JBC is standard ERC20 compatible for ABI
    const mcToken = ERC20.attach(deployment.mcToken);
    const jbcToken = ERC20.attach(deployment.jbcToken);

    // Check Reserves
    try {
        const reserveMC = await protocol.swapReserveMC();
        const reserveJBC = await protocol.swapReserveJBC();

        console.log("\n--- Internal Reserves (in Protocol) ---");
        console.log("Reserve MC :", hre.ethers.formatEther(reserveMC));
        console.log("Reserve JBC:", hre.ethers.formatEther(reserveJBC));

        // Check Actual Balances
        const balanceMC = await mcToken.balanceOf(deployment.protocolProxy);
        const balanceJBC = await jbcToken.balanceOf(deployment.protocolProxy);

        console.log("\n--- Actual Contract Balances ---");
        console.log("Balance MC :", hre.ethers.formatEther(balanceMC));
        console.log("Balance JBC:", hre.ethers.formatEther(balanceJBC));

        if (reserveMC == 0n && reserveJBC == 0n) {
            console.log("\nResult: Swap Pool is EMPTY (Not Initialized).");
        } else {
            console.log("\nResult: Swap Pool HAS Liquidity.");
        }

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
