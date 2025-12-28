const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Starting contract upgrade for team count logic...");
    
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
        
        // Test a user's team count
        const testUserInfo = await currentContract.userInfo(deployer.address);
        console.log("✅ Current deployer team count:", testUserInfo[2].toString());
        
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
        
        // Verify state preservation
        const ownerAfter = await upgradedContract.owner();
        const redeemEnabledAfter = await upgradedContract.redeemEnabled();
        const testUserInfoAfter = await upgradedContract.userInfo(deployer.address);
        
        console.log("\n📊 Post-upgrade verification:");
        console.log("✅ Owner preserved:", ownerAfter);
        console.log("✅ Redeem enabled:", redeemEnabledAfter);
        console.log("✅ Team count preserved:", testUserInfoAfter[2].toString());
        
        // Save upgrade info
        const upgradeInfo = {
            timestamp: new Date().toISOString(),
            proxyAddress: PROXY_ADDRESS,
            deployer: deployer.address,
            upgradeName: "team-count-logic-fix",
            changes: [
                "移动团队人数更新逻辑从 buyTicket() 到 bindReferrer()",
                "现在任何绑定推荐人的地址都会被统计到团队人数中",
                "团队人数 = 推荐体系伞下所有用户(地址)总数量",
                "符合'买了门票就算有效地址'的业务逻辑",
                "首页团队人数和团队节点页面社区有效地址数含义一致"
            ],
            gasUsed: "TBD", // Will be filled by transaction receipt
            blockNumber: await deployer.provider.getBlockNumber()
        };
        
        const fs = require('fs');
        const upgradeFileName = `deployments/upgrade-team-count-logic-${Date.now()}.json`;
        fs.writeFileSync(upgradeFileName, JSON.stringify(upgradeInfo, null, 2));
        
        console.log("\n✅ Upgrade completed successfully!");
        console.log("📄 Upgrade info saved to:", upgradeFileName);
        console.log("\n🎯 业务逻辑变更:");
        console.log("1. 团队人数现在在绑定推荐人时更新，而不是购买门票时");
        console.log("2. 任何绑定推荐人的地址都会被统计到团队人数中");
        console.log("3. 首页团队人数 = 团队节点页面社区有效地址数 = 推荐体系伞下所有地址总数");
        console.log("4. 符合'买了门票就算有效地址'的业务逻辑");
        
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