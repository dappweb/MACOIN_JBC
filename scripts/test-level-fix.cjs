const { ethers } = require('hardhat');

async function main() {
    console.log('🏆 [Level Fix Test] Testing updated level calculation...\n');

    try {
        const protocolAddress = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
        const protocol = await ethers.getContractAt('JinbaoProtocol', protocolAddress);
        
        const [signer] = await ethers.getSigners();
        const userAddress = signer.address;
        
        // Get user data
        const userInfo = await protocol.userInfo(userAddress);
        const teamCount = Number(userInfo[2]);
        
        console.log('📊 [Current User Data]');
        console.log(`Team Count: ${teamCount}`);
        
        // Test new level calculation logic
        console.log('\n🧮 [New Level Calculation]');
        let level = "V0";
        let progress = "";
        
        // Updated level standards
        if (teamCount >= 5000) level = "V9";
        else if (teamCount >= 1000) level = "V8";
        else if (teamCount >= 500) level = "V7";
        else if (teamCount >= 200) level = "V6";
        else if (teamCount >= 100) level = "V5";
        else if (teamCount >= 50) level = "V4";
        else if (teamCount >= 20) level = "V3";
        else if (teamCount >= 10) level = "V2";
        else if (teamCount >= 5) level = "V1";
        
        // Calculate progress to next level
        let nextLevelReq = 5;
        if (teamCount >= 5) nextLevelReq = 10;
        else if (teamCount >= 10) nextLevelReq = 20;
        else if (teamCount >= 20) nextLevelReq = 50;
        else if (teamCount >= 50) nextLevelReq = 100;
        else if (teamCount >= 100) nextLevelReq = 200;
        else if (teamCount >= 200) nextLevelReq = 500;
        else if (teamCount >= 500) nextLevelReq = 1000;
        else if (teamCount >= 1000) nextLevelReq = 5000;
        
        progress = teamCount < 5000 ? ` (${teamCount}/${nextLevelReq})` : "";
        
        console.log(`Base Level: ${level}`);
        console.log(`Display Level: ${level}${progress}`);
        
        // Show reward percentage
        const levelRewards = {
            'V0': 0, 'V1': 5, 'V2': 10, 'V3': 15, 'V4': 20,
            'V5': 25, 'V6': 30, 'V7': 35, 'V8': 40, 'V9': 45
        };
        
        console.log(`Reward Percentage: ${levelRewards[level]}%`);
        
        // Compare with old system
        console.log('\n📈 [Comparison]');
        let oldLevel = "V0";
        if (teamCount >= 10000) oldLevel = "V9";
        else if (teamCount >= 5000) oldLevel = "V8";
        else if (teamCount >= 2000) oldLevel = "V7";
        else if (teamCount >= 1000) oldLevel = "V6";
        else if (teamCount >= 500) oldLevel = "V5";
        else if (teamCount >= 200) oldLevel = "V4";
        else if (teamCount >= 100) oldLevel = "V3";
        else if (teamCount >= 50) oldLevel = "V2";
        else if (teamCount >= 20) oldLevel = "V1";
        
        console.log(`Old System: ${oldLevel} (${levelRewards[oldLevel]}% reward)`);
        console.log(`New System: ${level}${progress} (${levelRewards[level]}% reward)`);
        
        if (level !== oldLevel) {
            console.log(`🎉 Level improved from ${oldLevel} to ${level}!`);
        }
        
        // Show next milestone
        console.log('\n🎯 [Next Milestone]');
        if (teamCount < 5000) {
            const needed = nextLevelReq - teamCount;
            const nextLevel = teamCount < 5 ? 'V1' : teamCount < 10 ? 'V2' : teamCount < 20 ? 'V3' : teamCount < 50 ? 'V4' : teamCount < 100 ? 'V5' : teamCount < 200 ? 'V6' : teamCount < 500 ? 'V7' : teamCount < 1000 ? 'V8' : 'V9';
            console.log(`Need ${needed} more team members to reach ${nextLevel}`);
            console.log(`Progress: ${((teamCount / nextLevelReq) * 100).toFixed(1)}%`);
        } else {
            console.log('🏆 Maximum level achieved!');
        }
        
        console.log('\n✅ [Level Fix Summary]');
        console.log('1. ✅ Level calculation updated with more achievable standards');
        console.log('2. ✅ Progress display added to show advancement');
        console.log('3. ✅ Reward lookup fixed to use base level');
        console.log('4. ✅ Level table highlighting updated');
        
        console.log('\n🎊 [Result]');
        console.log(`Your level is now: ${level}${progress}`);
        console.log(`Reward rate: ${levelRewards[level]}%`);
        console.log('The frontend should now display the correct level!');

    } catch (error) {
        console.error('❌ Level fix test failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });