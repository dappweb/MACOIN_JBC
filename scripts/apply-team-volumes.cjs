const fs = require('fs');
const { ethers } = require('hardhat');
const path = require('path');

async function main() {
    const snapshotPath = path.join(__dirname, '../team_volumes_snapshot.json');
    if (!fs.existsSync(snapshotPath)) {
        console.error("Snapshot file not found. Run recalc-team-volumes.cjs first.");
        return;
    }

    const updates = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    console.log(`Loaded ${updates.length} updates.`);

    const deploymentPath = path.join(__dirname, '../deployments/latest-mc.json');
    if (!fs.existsSync(deploymentPath)) {
        console.error("Deployment file not found:", deploymentPath);
        return;
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const protocolAddress = deployment.JinbaoProtocol;
    
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const protocol = JinbaoProtocol.attach(protocolAddress);

    // Batch process
    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const users = batch.map(u => u.user);
        const volumes = batch.map(u => u.volume);
        const counts = batch.map(u => u.count);

        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}... (${users.length} users)`);
        
        try {
            const tx = await protocol.batchUpdateUserStats(users, counts, volumes);
            console.log(`Tx sent: ${tx.hash}`);
            await tx.wait();
            console.log("Batch confirmed.");
        } catch (e) {
            console.error("Batch failed:", e);
        }
    }
    
    console.log("All updates completed.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
