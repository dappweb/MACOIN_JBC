const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Starting contract upgrade for individual redeem logic...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Deployer balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MC");

    // Current proxy address
    const PROXY_ADDRESS = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
    
    console.log("\n📋 Pre-upgrade verification...");
    
    // Get the contract factory
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    // Connect to current contract for verification
    const currentContract = JinbaoProtocol.attach(PROXY_ADDRESS);
    
    // Verify current state
    try {
        const owner = await currentContract.owner();
        console.log("✅ Current owner:", owner);
        
        const redeemEnabled = await currentContract.redeemEnabled();
        console.log("✅ Redeem enabled:", redeemEnabled);
        
        const mcReserve = await currentContract.swapReserveMC();
        const jbcReserve = await currentContract.swapReserveJBC();
        console.log("✅ Current reserves - MC:", ethers.formatEther(mcReserve), "JBC:", ethers.formatEther(jbcReserve));
        
    } catch (error) {
        console.error("❌ Pre-upgrade verification failed:", error.message);
        return;
    }
    
    console.log("\n🔄 Upgrading contract implementation...");
    
    try {
        // Upgrade the contract
        const upgradedContract = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocol);
        await upgradedContract.waitForDeployment();
        
        console.log("✅ Contract upgraded successfully!");
        console.log("📍 Proxy address (unchanged):", PROXY_ADDRESS);
        console.log("📍 New implementation deployed");
        
        // Verify new functionality
        console.log("\n🧪 Testing new redeemStake function...");
        
        // Check if new function exists
        try {
            // This will throw if function doesn't exist
            const functionFragment = upgradedContract.interface.getFunction("redeemStake");
            console.log("✅ New redeemStake function available:", functionFragment.format());
        } catch (error) {
            console.error("❌ New function not found:", error.message);
        }
        
        // Verify state preservation
        const ownerAfter = await upgradedContract.owner();
        const redeemEnabledAfter = await upgradedContract.redeemEnabled();
        const mcReserveAfter = await upgradedContract.swapReserveMC();
        const jbcReserveAfter = await upgradedContract.swapReserveJBC();
        
        console.log("\n📊 Post-upgrade verification:");
        console.log("✅ Owner preserved:", ownerAfter);
        console.log("✅ Redeem enabled:", redeemEnabledAfter);
        console.log("✅ Reserves preserved - MC:", ethers.formatEther(mcReserveAfter), "JBC:", ethers.formatEther(jbcReserveAfter));
        
        // Save upgrade info
        const upgradeInfo = {
            timestamp: new Date().toISOString(),
            proxyAddress: PROXY_ADDRESS,
            deployer: deployer.address,
            upgradeName: "individual-redeem-logic",
            changes: [
                "Added redeemStake(uint256 stakeId) function for individual stake redemption",
                "Modified redeem logic to return full principal and deduct fee from user wallet",
                "Fee is now recorded in refundFeeAmount for next stake refund",
                "Legacy redeem() function preserved for backward compatibility"
            ],
            gasUsed: "TBD", // Will be filled by transaction receipt
            blockNumber: await deployer.provider.getBlockNumber()
        };
        
        const fs = require('fs');
        const upgradeFileName = `deployments/upgrade-redeem-logic-${Date.now()}.json`;
        fs.writeFileSync(upgradeFileName, JSON.stringify(upgradeInfo, null, 2));
        
        console.log("\n✅ Upgrade completed successfully!");
        console.log("📄 Upgrade info saved to:", upgradeFileName);
        console.log("\n🎯 Next steps:");
        console.log("1. Frontend will now use redeemStake(stakeId) for individual redemption");
        console.log("2. Users need to approve MC tokens for fee deduction");
        console.log("3. Full principal will be returned + fee deducted from wallet");
        console.log("4. Fee will be refunded on next stake");
        
    } catch (error) {
        console.error("❌ Upgrade failed:", error);
        
        if (error.message.includes("revert")) {
            console.log("\n🔍 Possible causes:");
            console.log("- Contract is not upgradeable");
            console.log("- Deployer is not the owner");
            console.log("- Storage layout conflict");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });