require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    console.log('🏠 [Homepage Scenario Test] Testing complete homepage level display scenario...\n');

    try {
        // MC Chain RPC (same as config.ts)
        const provider = new ethers.JsonRpcProvider('https://chain.mcerscan.com/');
        
        const protocolAddress = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
        
        // Full ABI for testing (same as Web3Context.tsx)
        const abi = [
            "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)"
        ];
        
        const protocol = new ethers.Contract(protocolAddress, abi, provider);
        
        // Test with the deployer address (user with 13 team members)
        const userAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
        
        console.log('📊 [Test Setup]');
        console.log(`Protocol Address: ${protocolAddress}`);
        console.log(`User Address: ${userAddress}`);
        console.log(`RPC: https://chain.mcerscan.com/`);
        
        // Step 1: Test contract connection
        console.log('\n🔗 [Step 1: Contract Connection]');
        try {
            const blockNumber = await provider.getBlockNumber();
            console.log(`✅ Connected to MC Chain, block: ${blockNumber}`);
        } catch (e) {
            console.log('❌ Network connection failed:', e.message);
            return;
        }
        
        // Step 2: Fetch user data (same as StatsPanel.tsx)
        console.log('\n📋 [Step 2: Fetch User Data]');
        const userInfo = await protocol.userInfo(userAddress);
        console.log('✅ Contract call successful!');
        
        const referrer = userInfo[0];
        const activeDirects = Number(userInfo[1]);
        const teamCount = Number(userInfo[2]);
        const totalRevenue = userInfo[3];
        const currentCap = userInfo[4];
        const isActive = userInfo[5];
        
        console.log(`Referrer: ${referrer}`);
        console.log(`Active Directs: ${activeDirects}`);
        console.log(`Team Count: ${teamCount}`);
        console.log(`Total Revenue: ${ethers.formatEther(totalRevenue)} MC`);
        console.log(`Current Cap: ${ethers.formatEther(currentCap)} MC`);
        console.log(`Is Active: ${isActive}`);
        
        // Step 3: Calculate level (exact same logic as StatsPanel.tsx)
        console.log('\n🏆 [Step 3: Level Calculation]');
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
        
        // Step 4: Show level breakdown
        console.log('\n📊 [Step 4: Level Standards]');
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
        
        // Step 5: Simulate StatsPanel state update
        console.log('\n🔄 [Step 5: StatsPanel State Simulation]');
        
        // Mock initial stats (from constants.ts)
        const mockStats = {
            balanceMC: 5420.50,
            balanceJBC: 125.00,
            totalRevenue: 8500.00,
            currentLevel: 'V2',  // This is the mock level
            teamCount: 42,       // This is the mock team count
            activeInvestment: 1000,
            pendingRewards: 45.2,
        };
        
        console.log('Initial Mock Stats:');
        console.log(`  Mock Level: ${mockStats.currentLevel}`);
        console.log(`  Mock Team Count: ${mockStats.teamCount}`);
        
        // Simulate the setDisplayStats update (same as StatsPanel.tsx)
        const updatedStats = {
            ...mockStats,
            teamCount: Number(userInfo[2]),  // Real team count from contract
            currentLevel: level,             // Real calculated level
        };
        
        console.log('\nUpdated Stats (after contract data):');
        console.log(`  Real Level: ${updatedStats.currentLevel}`);
        console.log(`  Real Team Count: ${updatedStats.teamCount}`);
        
        // Step 6: Check what should be displayed
        console.log('\n👀 [Step 6: Expected Homepage Display]');
        console.log('The homepage should show:');
        console.log(`  当前等级: ${updatedStats.currentLevel}`);
        console.log(`  团队人数: ${updatedStats.teamCount}`);
        
        // Calculate reward percentage
        const levelRewards = {
            'V0': 0, 'V1': 5, 'V2': 10, 'V3': 15, 'V4': 20,
            'V5': 25, 'V6': 30, 'V7': 35, 'V8': 40, 'V9': 45
        };
        
        console.log(`  奖励率: ${levelRewards[updatedStats.currentLevel]}%`);
        
        // Step 7: Troubleshooting
        console.log('\n🔍 [Step 7: Troubleshooting]');
        
        if (updatedStats.currentLevel === 'V2' && updatedStats.teamCount === 13) {
            console.log('✅ Level calculation is correct!');
            console.log('✅ Contract data is being fetched properly');
            
            console.log('\n🚨 [Possible Issues]');
            console.log('If user still sees V0, check:');
            console.log('1. Is wallet connected to MC Chain?');
            console.log('2. Is the user address the same as test address?');
            console.log('3. Are there any JavaScript errors in browser console?');
            console.log('4. Is the useEffect in StatsPanel running?');
            console.log('5. Is isConnected && account && protocolContract true?');
            
        } else {
            console.log('❌ Something is wrong with the calculation');
        }
        
        // Step 8: User instructions
        console.log('\n📱 [Step 8: User Instructions]');
        console.log('User should:');
        console.log('1. Connect wallet to MC Chain (Chain ID: 88813)');
        console.log('2. Ensure wallet address has team members');
        console.log('3. Refresh the homepage');
        console.log('4. Check browser console for errors');
        console.log('5. Wait 5-10 seconds for data to load');
        
        console.log('\n✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Homepage scenario test failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });