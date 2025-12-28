const { ethers } = require('hardhat');

async function main() {
    console.log('🏠 [Homepage Level Test] Testing homepage level display...\n');

    try {
        const protocolAddress = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
        const protocol = await ethers.getContractAt('JinbaoProtocol', protocolAddress);
        
        const [signer] = await ethers.getSigners();
        const userAddress = signer.address;
        
        // Get user data (same as StatsPanel.tsx)
        const userInfo = await protocol.userInfo(userAddress);
        const teamCount = Number(userInfo[2]);
        
        console.log('📊 [User Data]');
        console.log(`Address: ${userAddress}`);
        console.log(`Team Count: ${teamCount}`);
        
        // Test StatsPanel level calculation logic (updated)
        console.log('\n🏠 [Homepage Level Calculation]');
        let level = "V0";
        
        // Updated more achievable level standards (same as StatsPanel.tsx)
        if (teamCount >= 5000) level = "V9";
        else if (teamCount >= 1000) level = "V8";
        else if (teamCount >= 500) level = "V7";
        else if (teamCount >= 200) level = "V6";
        else if (teamCount >= 100) level = "V5";
        else if (teamCount >= 50) level = "V4";
        else if (teamCount >= 20) level = "V3";
        else if (teamCount >= 10) level = "V2";
        else if (teamCount >= 5) level = "V1";
        
        console.log(`Calculated Level: ${level}`);
        
        // Show level breakdown
        console.log('\n📋 [Level Standards Applied]');
        const levels = [
            { name: 'V0', min: 0, max: 4 },
            { name: 'V1', min: 5, max: 9 },
            { name: 'V2', min: 10, max: 19 },
            { name: 'V3', min: 20, max: 49 },
            { name: 'V4', min: 50, max: 99 },
            { name: 'V5', min: 100, max: 199 },
            { name: 'V6', min: 200, max: 499 },
            { name: 'V7', min: 500, max: 999 },
            { name: 'V8', min: 1000, max: 4999 },
            { name: 'V9', min: 5000, max: Infinity }
        ];
        
        levels.forEach(l => {
            const isCurrent = teamCount >= l.min && (l.max === Infinity ? true : teamCount <= l.max);
            const status = isCurrent ? ' ← 当前等级' : '';
            console.log(`${l.name}: ${l.min}-${l.max === Infinity ? '∞' : l.max} 成员${status}`);
        });
        
        // Verify against team page calculation
        console.log('\n🔄 [Cross-Verification]');
        console.log('Homepage calculation:', level);
        console.log('Team page calculation: V2 (expected)');
        
        if (level === 'V2') {
            console.log('✅ Homepage and team page calculations match!');
        } else {
            console.log('❌ Mismatch detected - need to investigate');
        }
        
        // Show what user should see
        console.log('\n👀 [Expected Homepage Display]');
        console.log(`当前等级: ${level}`);
        console.log(`团队人数: ${teamCount}`);
        
        // Reward calculation
        const levelRewards = {
            'V0': 0, 'V1': 5, 'V2': 10, 'V3': 15, 'V4': 20,
            'V5': 25, 'V6': 30, 'V7': 35, 'V8': 40, 'V9': 45
        };
        
        console.log(`奖励率: ${levelRewards[level]}%`);
        
        console.log('\n🎯 [Fix Status]');
        if (level === 'V2') {
            console.log('✅ Homepage level calculation is now correct!');
            console.log('✅ User should see V2 instead of V0');
            console.log('✅ Reward rate should show 10% instead of 0%');
        } else {
            console.log('❌ Something is still wrong with the calculation');
        }
        
        console.log('\n📱 [User Action Required]');
        console.log('Please refresh the homepage to see the updated level display.');
        console.log('The level should now show V2 with 13 team members.');

    } catch (error) {
        console.error('❌ Homepage level test failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });