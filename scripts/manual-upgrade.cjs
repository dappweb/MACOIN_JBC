const { ethers } = require("hardhat");

const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

async function main() {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    console.log("Deployer:", deployer.address);

    // 1. Deploy the new implementation directly
    console.log("Deploying new implementation...");
    const JinbaoProtocolV4 = await ethers.getContractFactory("JinbaoProtocolV4");
    const implementation = await JinbaoProtocolV4.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();
    console.log("New Implementation deployed at:", implementationAddress);

    // 2. Upgrade the proxy to the new implementation
    console.log("Upgrading proxy...");
    
    // Explicitly use UUPS ABI to ensure upgradeTo is available
    const UUPS_ABI = [
        "function upgradeTo(address newImplementation) external",
        "function upgradeToAndCall(address newImplementation, bytes memory data) external payable",
        "function owner() view returns (address)",
        "function VERSION_DEBUG() view returns (uint256)"
    ];
    
    const proxy = new ethers.Contract(PROXY_ADDRESS, UUPS_ABI, deployer);
    
    console.log("Calling upgradeToAndCall...");
    // Use upgradeToAndCall because upgradeTo seems missing
    const tx = await proxy.upgradeToAndCall(implementationAddress, "0x");
    console.log("Upgrade transaction sent:", tx.hash);
    
    await tx.wait();
    console.log("Upgrade confirmed!");

    // 3. Verify
    console.log("Verifying version...");
    try {
        const version = await proxy.VERSION_DEBUG();
        console.log("VERSION_DEBUG:", version.toString());
    } catch (e) {
        console.log("VERSION_DEBUG check failed:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
