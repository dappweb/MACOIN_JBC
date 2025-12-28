const { ethers } = require('hardhat');

async function main() {
    console.log('🏆 [Level System Analysis] Analyzing current level system...\n');

    try {
        const protocolAddress = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
        const protocol = await ethers.getContractAt('JinbaoProtocol', protocolAddress);
        
        const [signer] = await ethers.getSigners();
        const userAddress = signer.address;
        
        // Get current user data
        const userInfo = await protocol.userInfo(userAddress);
        const teamCount = Number(userInfo[2]);
        const activeDirects = Number(userInfo[1]);
        
        console.log('📊 [Current User Status]');
        console.log(`Team Count: ${teamCount}`);
        console.log(`Active Directs: ${activeDirects}`);
        console.log(`Current Level: V0 (needs 20 team members for V1)`);
        
        // Current level standards
        console.log('\n📋 [Current Level Standards]');
        const currentLevels = [
            { level: 'V0', min: 0, max: 19, reward: 0 },
            { level: 'V1', min: 20, max: 49, reward: 5 },
            { level: 'V2', min: 50, max: 99, reward: 10 },
            { level: 'V3', min: 100, max: 199, reward: 15 },
            { level: 'V4', min: 200, max: 499, reward: 20 },
            { level: 'V5', min: 500, max: 999, reward: 25 },
            { level: 'V6', min: 1000, max: 1999, reward: 30 },
            { level: 'V7', min: 2000, max: 4999, reward: 35 },
            { level: 'V8', min: 5000, max: 9999, reward: 40 },
            { level: 'V9', min: 10000, max: Infinity, reward: 45 }
        ];
        
        currentLevels.forEach(level => {
            const isCurrent = teamCount >= level.min && teamCount <= level.max;
            const status = isCurrent ? '👉 [CURRENT]' : '';
            console.log(`${level.level}: ${level.min}-${level.max === Infinity ? '∞' : level.max} members (${level.reward}% reward) ${status}`);
        });
        
        // Suggested more reasonable level standards
        console.log('\n💡 [Suggested Improved Level Standards]');
        const suggestedLevels = [
            { level: 'V0', min: 0, max: 4, reward: 0 },
            { level: 'V1', min: 5, max: 9, reward: 5 },
            { level: 'V2', min: 10, max: 19, reward: 10 },
            { level: 'V3', min: 20, max: 49, reward: 15 },
            { level: 'V4', min: 50, max: 99, reward: 20 },
            { level: 'V5', min: 100, max: 199, reward: 25 },
            { level: 'V6', min: 200, max: 499, reward: 30 },
            { level: 'V7', min: 500, max: 999, reward: 35 },
            { level: 'V8', min: 1000, max: 4999, reward: 40 },
            { level: 'V9', min: 5000, max: Infinity, reward: 45 }
        ];
        
        suggestedLevels.forEach(level => {
            const isCurrent = teamCount >= level.min && teamCount <= level.max;
            const status = isCurrent ? '👉 [WOULD BE CURRENT]' : '';
            console.log(`${level.level}: ${level.min}-${level.max === Infinity ? '∞' : level.max} members (${level.reward}% reward) ${status}`);
        });
        
        // Calculate what level user would be with suggested standards
        let suggestedLevel = "V0";
        for (const level of suggestedLevels) {
            if (teamCount >= level.min && teamCount <= level.max) {
                suggestedLevel = level.level;
                break;
            }
        }
        
        console.log('\n🎯 [Analysis Results]');
        console.log(`With current standards: V0 (${teamCount}/20 to V1)`);
        console.log(`With suggested standards: ${suggestedLevel}`);
        console.log(`Progress to next level: ${teamCount >= 20 ? 'Already qualified for V1!' : `Need ${20 - teamCount} more team members`}`);
        
        // Alternative: Show progress more clearly
        console.log('\n📈 [Progress Display Suggestions]');
        console.log('Option 1: Show progress to next level');
        console.log(`  "V0 (${teamCount}/20 to V1)" instead of just "V0"`);
        console.log('');
        console.log('Option 2: Use a more granular system');
        console.log(`  "Apprentice Level ${Math.min(Math.floor(teamCount / 2), 9)}" for 0-19 members`);
        console.log('');
        console.log('Option 3: Adjust level requirements to be more achievable');
        console.log('  Make V1 start at 5-10 members instead of 20');
        
        // Check if user should have more team members
        console.log('\n🔍 [Team Building Analysis]');
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        console.log(`Direct Referrals: ${directReferrals.length}`);
        console.log(`Team Count: ${teamCount}`);
        
        if (directReferrals.length > 0 && teamCount < directReferrals.length * 2) {
            console.log('⚠️  Team count seems low compared to direct referrals');
            console.log('This might indicate:');
            console.log('1. Team count calculation needs updating');
            console.log('2. Some referrals haven\'t been properly counted');
            console.log('3. Historical data synchronization issues');
        }
        
        console.log('\n🛠️  [Recommended Actions]');
        console.log('1. Consider adjusting level requirements to be more achievable');
        console.log('2. Show progress to next level in UI (e.g., "V0 (13/20 to V1)")');
        console.log('3. Add motivational messaging for users close to next level');
        console.log('4. Consider adding intermediate rewards or badges');
        
        // Generate code for improved level calculation
        console.log('\n💻 [Code Suggestion for TeamLevel.tsx]');
        console.log('Replace the level calculation with:');
        console.log('```typescript');
        console.log('// More achievable level standards');
        console.log('let level = "V0";');
        console.log('let progress = "";');
        console.log('if (effectiveCount >= 5000) level = "V9";');
        console.log('else if (effectiveCount >= 1000) level = "V8";');
        console.log('else if (effectiveCount >= 500) level = "V7";');
        console.log('else if (effectiveCount >= 200) level = "V6";');
        console.log('else if (effectiveCount >= 100) level = "V5";');
        console.log('else if (effectiveCount >= 50) level = "V4";');
        console.log('else if (effectiveCount >= 20) level = "V3";');
        console.log('else if (effectiveCount >= 10) level = "V2";');
        console.log('else if (effectiveCount >= 5) level = "V1";');
        console.log('');
        console.log('// Add progress display');
        console.log('const nextLevelReq = effectiveCount < 5 ? 5 : effectiveCount < 10 ? 10 : effectiveCount < 20 ? 20 : effectiveCount < 50 ? 50 : effectiveCount < 100 ? 100 : effectiveCount < 200 ? 200 : effectiveCount < 500 ? 500 : effectiveCount < 1000 ? 1000 : 5000;');
        console.log('progress = effectiveCount < 5000 ? `(${effectiveCount}/${nextLevelReq})` : "";');
        console.log('```');

    } catch (error) {
        console.error('❌ Analysis failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });