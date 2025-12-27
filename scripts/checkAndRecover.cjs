const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Using Account:", deployer.address);

    // Native Balance
    const nativeBal = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Native MC Balance (Gas):", hre.ethers.formatEther(nativeBal));

    // Load Addresses
    const latestPath = path.join(__dirname, "../deployments/latest-mc.json");
    const oldPath = path.join(__dirname, "../deployments/latest-mc.json.bak");

    if (!fs.existsSync(latestPath)) { console.error("No latest deployment"); return; }
    
    const latest = JSON.parse(fs.readFileSync(latestPath, "utf8"));
    const JBC_TOKEN = latest.jbcToken;
    const NEW_PROTOCOL = latest.protocolProxy;
    
    let OLD_PROTOCOL = null;
    if (fs.existsSync(oldPath)) {
        const old = JSON.parse(fs.readFileSync(oldPath, "utf8"));
        OLD_PROTOCOL = old.protocolProxy;
    }

    // Contracts
    const jbc = await hre.ethers.getContractAt("IERC20", JBC_TOKEN);
    const oldProtocol = OLD_PROTOCOL ? await hre.ethers.getContractAt("JinbaoProtocol", OLD_PROTOCOL) : null;

    // Check Token Balances
    const deployerJBC = await jbc.balanceOf(deployer.address);
    console.log("Deployer JBC Balance:", hre.ethers.formatEther(deployerJBC));

    if (OLD_PROTOCOL) {
        const oldProtoJBC = await jbc.balanceOf(OLD_PROTOCOL);
        console.log(`Old Protocol (${OLD_PROTOCOL}) JBC Balance:`, hre.ethers.formatEther(oldProtoJBC));
        
        // Attempt Recovery if needed
        if (deployerJBC == 0n && oldProtoJBC > 0n) {
            console.log("⚠️ Deployer has 0 JBC, but Old Protocol has funds.");
            console.log("Attempting to withdraw from Old Protocol...");
            
            if (nativeBal < hre.ethers.parseEther("0.001")) {
                 console.error("❌ Insufficient Gas to withdraw! Please recharge native MC.");
                 return;
            }

            try {
                const tx = await oldProtocol.adminWithdrawJBC(oldProtoJBC, deployer.address);
                console.log("Withdraw Tx:", tx.hash);
                await tx.wait();
                console.log("✅ Withdrawn successfully!");
            } catch (e) {
                console.error("❌ Withdraw failed:", e.message);
            }
        }
    } else {
        console.log("No backup deployment file found to check old protocol.");
    }

    // Check New Protocol JBC
    const newProtoJBC = await jbc.balanceOf(NEW_PROTOCOL);
    console.log(`New Protocol (${NEW_PROTOCOL}) JBC Balance:`, hre.ethers.formatEther(newProtoJBC));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
