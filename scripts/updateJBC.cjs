const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const JBC_ADDRESS = process.env.JBC_TOKEN_ADDRESS || "0xA743cB357a9f59D349efB7985072779a094658dD";
    
    // Read latest deployment
    const deploymentPath = path.join(__dirname, "../deployments/latest-mc.json");
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("Latest deployment file not found!");
    }
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const NEW_PROTOCOL = deploymentData.protocolProxy;

    if (!NEW_PROTOCOL) {
        throw new Error("Protocol proxy address not found in deployment file!");
    }

    console.log(`Target Protocol Address: ${NEW_PROTOCOL}`);
    console.log(`Target JBC Address: ${JBC_ADDRESS}`);

    const jbc = await ethers.getContractAt("JBC", JBC_ADDRESS);
    
    // Check current protocol
    const current = await jbc.protocolAddress();
    console.log(`Current Protocol in JBC: ${current}`);

    if (current.toLowerCase() !== NEW_PROTOCOL.toLowerCase()) {
        console.log("Updating JBC protocol address...");
        const tx = await jbc.setProtocol(NEW_PROTOCOL);
        console.log("Tx sent:", tx.hash);
        await tx.wait();
        console.log("✅ JBC Protocol address updated successfully");
    } else {
        console.log("✅ JBC Protocol address is already up to date");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
