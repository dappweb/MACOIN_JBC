const fs = require('fs');
const { ethers } = require('hardhat');
const path = require('path');

async function main() {
    console.log("Starting team volume recalculation...");

    // 1. Get Contract Address
    const deploymentPath = path.join(__dirname, '../deployments/latest-mc.json');
    if (!fs.existsSync(deploymentPath)) {
        console.error("Deployment file not found:", deploymentPath);
        // Fallback or exit
        return;
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const protocolAddress = deployment.JinbaoProtocol;
    console.log("Protocol Address:", protocolAddress);

    // 2. Connect to Contract
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const protocol = JinbaoProtocol.attach(protocolAddress);

    // 3. Fetch Events
    console.log("Fetching events...");
    // Assuming deployment block is reasonably recent, or start from 0
    // If query fails due to range, might need to batch query
    const startBlock = 0; 
    
    const boundFilter = protocol.filters.BoundReferrer();
    const purchaseFilter = protocol.filters.TicketPurchased();

    // Helper for large range queries
    async function queryAllEvents(filter) {
        let allEvents = [];
        const currentBlock = await ethers.provider.getBlockNumber();
        const batchSize = 10000;
        
        for (let i = startBlock; i <= currentBlock; i += batchSize) {
            const end = Math.min(i + batchSize - 1, currentBlock);
            try {
                const events = await protocol.queryFilter(filter, i, end);
                allEvents = allEvents.concat(events);
                process.stdout.write(`\rFetching blocks ${i} to ${end}... Found ${allEvents.length} events so far`);
            } catch (e) {
                console.error(`Error fetching blocks ${i}-${end}:`, e.message);
            }
        }
        console.log(""); // New line
        return allEvents;
    }

    console.log("Querying BoundReferrer events...");
    const boundEvents = await queryAllEvents(boundFilter);
    
    console.log("Querying TicketPurchased events...");
    const purchaseEvents = await queryAllEvents(purchaseFilter);

    console.log(`Total Found: ${boundEvents.length} BoundReferrer, ${purchaseEvents.length} TicketPurchased`);

    // 4. Build Referrer Tree
    const referrerMap = {}; // user -> referrer
    for (const event of boundEvents) {
        const user = event.args[0];
        const referrer = event.args[1];
        referrerMap[user] = referrer;
    }

    // 5. Calculate Volumes and Counts
    const userVolumes = {}; // user -> totalVolume (BigInt)
    const userCounts = {}; // user -> teamCount (number)
    const hasPurchased = {}; // user -> bool

    for (const event of purchaseEvents) {
        const user = event.args[0];
        const amount = event.args[1];
        
        const isFirstPurchase = !hasPurchased[user];
        if (isFirstPurchase) {
            hasPurchased[user] = true;
        }
        
        let current = referrerMap[user];
        let depth = 0;

        while (current && current !== ethers.ZeroAddress && depth < 30) {
            if (!userVolumes[current]) userVolumes[current] = 0n;
            if (!userCounts[current]) userCounts[current] = 0;

            userVolumes[current] += amount;
            
            if (isFirstPurchase) {
                userCounts[current] += 1;
            }
            
            current = referrerMap[current];
            depth++;
        }
    }

    // 6. Output Results
    console.log("\nCalculated Team Stats (Top 20 by Volume):");
    const updates = [];
    const allUsers = new Set([...Object.keys(userVolumes), ...Object.keys(userCounts)]);
    
    for (const user of allUsers) {
        const volume = userVolumes[user] || 0n;
        const count = userCounts[user] || 0;
        
        if (volume > 0n || count > 0) {
            updates.push({ 
                user, 
                volume: volume.toString(),
                count: count
            });
        }
    }
    
    // Sort by volume desc
    updates.sort((a, b) => {
        const diff = BigInt(b.volume) - BigInt(a.volume);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });

    updates.slice(0, 20).forEach(u => {
        console.log(`${u.user}: ${ethers.formatEther(u.volume)} MC, Count: ${u.count}`);
    });

    // 7. Save to file
    const outputPath = path.join(__dirname, '../team_volumes_snapshot.json');
    fs.writeFileSync(outputPath, JSON.stringify(updates, null, 2));
    console.log(`\nSnapshot saved to ${outputPath}`);
    
    console.log(`Total users to update: ${updates.length}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
