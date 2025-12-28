const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Deploying fresh JinbaoProtocol...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocol");

    // Arguments for initialize: 
    // address _mcToken, address _jbcToken, address _marketing, address _treasury, address _lpInjection, address _buyback
    // I need valid addresses. I'll use placeholders or the real MC token.
    const mcToken = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    const jbcToken = "0xA743cB357a9f59D349efB7985072779a094658dD"; // From previous check
    const wallet = deployer.address;

    const proxy = await upgrades.deployProxy(JinbaoProtocol, [
        mcToken, jbcToken, wallet, wallet, wallet, wallet
    ], {
        initializer: "initialize",
    });

    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log("Fresh Proxy Deployed at:", proxyAddress);

    // Now try to set operational status
    const contract = await hre.ethers.getContractAt("JinbaoProtocol", proxyAddress);
    console.log("Setting operational status on fresh contract...");
    
    try {
        const tx = await contract.setOperationalStatus(true, true);
        await tx.wait();
        console.log("Success!");
    } catch (e) {
        console.error("Failed on fresh contract:", e);
    }
}

main().catch(console.error);
