const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 Starting Buy Flow Test...");

    const [owner, ...users] = await ethers.getSigners();
    
    // 1. Deploy Tokens
    const Token = await ethers.getContractFactory("MockMC");
    const mc = await Token.deploy(); // MockMC usually has mint in constructor or external
    await mc.waitForDeployment();
    
    // Deploy JBC (Assuming it's also ERC20-like or use MockMC as placeholder)
    const JBC = await ethers.getContractFactory("MockMC");
    const jbc = await JBC.deploy();
    await jbc.waitForDeployment();

    console.log("Tokens Deployed");

    // 2. Deploy Protocol
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const protocol = await upgrades.deployProxy(JinbaoProtocol, [
        await mc.getAddress(),
        await jbc.getAddress(),
        owner.address, // marketing
        owner.address, // treasury
        owner.address, // lpInjection
        owner.address  // buyback
    ], { initializer: 'initialize' });
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();
    console.log(`Protocol Deployed at ${protocolAddress}`);

    // Save address for recalc script
    const deploymentPath = path.join(__dirname, '../deployments/latest-mc.json');
    // Ensure dir exists
    const dir = path.dirname(deploymentPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const deployment = { JinbaoProtocol: protocolAddress };
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log(`Saved deployment to ${deploymentPath}`);

    // 3. Setup
    // Enable liquidity/redeem
    await protocol.setOperationalStatus(true, true);
    
    // Mint tokens to users and approve
    // MockMC usually mints to msg.sender. Let's check if we can transfer or mint.
    // If MockMC is simple ERC20, owner has all supply.
    const TICKET_AMOUNT = ethers.parseEther("100");
    const INITIAL_BALANCE = ethers.parseEther("10000");

    for (let i = 0; i < 15; i++) {
        // Transfer from owner to user
        await mc.transfer(users[i].address, INITIAL_BALANCE);
        await mc.connect(users[i]).approve(await protocol.getAddress(), ethers.MaxUint256);
    }

    // 4. Build Chain: User 0 -> User 1 -> ... -> User 10
    console.log("Building Referral Chain...");
    
    // User 0 buys ticket (root)
    console.log("User 0 buying ticket (Root)...");
    await protocol.connect(users[0]).buyTicket(TICKET_AMOUNT);
    
    for (let i = 1; i <= 10; i++) {
        // Bind to previous user
        await protocol.connect(users[i]).bindReferrer(users[i-1].address);
        
        // Buy ticket
        // This should trigger updates up the chain
        process.stdout.write(`User ${i} buying... `);
        const tx = await protocol.connect(users[i]).buyTicket(TICKET_AMOUNT);
        const receipt = await tx.wait();
        console.log(`Gas: ${receipt.gasUsed.toString()}`);
    }

    // 5. Verify Data
    console.log("\nVerifying Data...");
    
    // Check User 0 (Root)
    // Should have 10 people in team (1..10)
    // Should have 10 * 100 MC volume
    const info0 = await protocol.userInfo(users[0].address);
    console.log(`User 0 Team Count: ${info0.teamCount} (Expected: 10)`);
    console.log(`User 0 Team Volume: ${ethers.formatEther(info0.teamTotalVolume)} (Expected: 1000.0)`);

    // Check User 9 (Direct upline of 10)
    // Should have 1 person in team (10)
    // Should have 100 MC volume
    const info9 = await protocol.userInfo(users[9].address);
    console.log(`User 9 Team Count: ${info9.teamCount} (Expected: 1)`);
    console.log(`User 9 Team Volume: ${ethers.formatEther(info9.teamTotalVolume)} (Expected: 100.0)`);

    if (info0.teamCount == 10 && info0.teamTotalVolume == ethers.parseEther("1000")) {
        console.log("✅ Test Passed: Chain updates are working!");
    } else {
        console.error("❌ Test Failed: Data mismatch");
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
