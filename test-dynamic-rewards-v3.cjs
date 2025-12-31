const { ethers } = require('hardhat');

async function main() {
    console.log('🧪 Testing Dynamic Rewards V3 Implementation');
    console.log('='.repeat(50));

    // 获取合约实例
    const contractAddress = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';
    const JinbaoProtocol = await ethers.getContractFactory('JinbaoProtocolV3');
    const contract = JinbaoProtocol.attach(contractAddress);

    // 测试用户地址
    const testUser = '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82';

    try {
        console.log('📋 Testing V3 Contract Functions');
        console.log('-'.repeat(30));

        // 1. 检查合约版本
        try {
            const version = await contract.getVersionV3();
            console.log('✅ Contract Version:', version);
        } catch (err) {
            console.log('❌ V3 functions not available - contract may not be upgraded yet');
            console.log('   Error:', err.message);
            return;
        }

        // 2. 获取用户动态奖励概览
        console.log('\n📊 User Dynamic Rewards Overview');
        console.log('-'.repeat(30));
        
        const dynamicRewards = await contract.getUserDynamicRewards(testUser);
        console.log('Total Earned:', ethers.formatEther(dynamicRewards.totalEarned), 'MC');
        console.log('Total Claimed:', ethers.formatEther(dynamicRewards.totalClaimed), 'MC');
        console.log('Pending Amount:', ethers.formatEther(dynamicRewards.pendingAmount), 'MC');
        console.log('Claimable Amount:', ethers.formatEther(dynamicRewards.claimableAmount), 'MC');

        // 3. 获取用户动态奖励详细列表
        console.log('\n📝 User Dynamic Rewards List');
        console.log('-'.repeat(30));
        
        const rewardsList = await contract.getUserDynamicRewardsList(testUser);
        console.log('Total Rewards Count:', rewardsList.length);
        
        if (rewardsList.length > 0) {
            console.log('\nReward Details:');
            rewardsList.forEach((reward, index) => {
                const sourceTypes = ['Unknown', 'Direct', 'Level', 'Differential'];
                console.log(`  ${index + 1}. Amount: ${ethers.formatEther(reward.amount)} MC`);
                console.log(`     Source: ${sourceTypes[reward.sourceType] || 'Unknown'}`);
                console.log(`     From: ${reward.fromUser}`);
                console.log(`     Claimed: ${reward.claimed}`);
                console.log(`     Unlock Time: ${new Date(Number(reward.unlockTime) * 1000).toLocaleString()}`);
                console.log('');
            });
        } else {
            console.log('No dynamic rewards found for this user');
        }

        // 4. 检查用户基本信息
        console.log('\n👤 User Basic Info');
        console.log('-'.repeat(30));
        
        const userInfo = await contract.userInfo(testUser);
        console.log('Team Count:', userInfo.teamCount.toString());
        console.log('Active Directs:', userInfo.activeDirects.toString());
        console.log('Total Revenue:', ethers.formatEther(userInfo.totalRevenue), 'MC');
        console.log('Is Active:', userInfo.isActive);

        // 5. 检查门票信息
        console.log('\n🎫 User Ticket Info');
        console.log('-'.repeat(30));
        
        const ticket = await contract.userTicket(testUser);
        console.log('Ticket Amount:', ethers.formatEther(ticket.amount), 'MC');
        console.log('Purchase Time:', new Date(Number(ticket.purchaseTime) * 1000).toLocaleString());
        console.log('Exited:', ticket.exited);

        console.log('\n✅ Dynamic Rewards V3 Test Completed Successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });