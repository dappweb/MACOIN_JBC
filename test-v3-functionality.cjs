const { ethers } = require('hardhat');

async function testV3Functionality() {
    console.log('🧪 测试V3功能...\n');
    
    try {
        // 连接到升级后的合约
        const contractAddress = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';
        const contract = await ethers.getContractAt('JinbaoProtocolV3Standalone', contractAddress);
        
        console.log('📍 合约地址:', contractAddress);
        
        // 1. 测试版本信息
        console.log('\n1. 📋 版本信息测试');
        try {
            const version = await contract.getVersionV3();
            console.log('   ✅ V3版本:', version);
        } catch (error) {
            console.log('   ❌ 版本获取失败:', error.message);
        }
        
        // 2. 测试动态奖励查询
        console.log('\n2. 💰 动态奖励功能测试');
        const testUsers = [
            '0x4C10831CBcF9884ba72051b5287b6c87E4F74A48', // 部署账户
            '0x0000000000000000000000000000000000000001', // 测试地址
            '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82'  // 之前诊断的用户
        ];
        
        for (const user of testUsers) {
            try {
                const rewards = await contract.getUserDynamicRewards(user);
                console.log(`   👤 用户 ${user.slice(0,8)}...:`);
                console.log(`      总获得: ${ethers.formatEther(rewards.totalEarned)} MC`);
                console.log(`      已提取: ${ethers.formatEther(rewards.totalClaimed)} MC`);
                console.log(`      待解锁: ${ethers.formatEther(rewards.pendingAmount)} MC`);
                console.log(`      可提取: ${ethers.formatEther(rewards.claimableAmount)} MC`);
            } catch (error) {
                console.log(`   ❌ 用户 ${user.slice(0,8)}... 查询失败:`, error.message);
            }
        }
        
        // 3. 测试V2功能兼容性
        console.log('\n3. 🔄 V2功能兼容性测试');
        try {
            const paused = await contract.paused();
            console.log('   ✅ 暂停状态:', paused);
            
            // 测试用户信息查询
            const userInfo = await contract.userInfo(testUsers[0]);
            console.log('   ✅ 用户信息查询正常');
            console.log(`      总门票: ${userInfo.totalTickets}`);
            console.log(`      总质押: ${ethers.formatEther(userInfo.totalStaked)} MC`);
            console.log(`      是否激活: ${userInfo.isActive}`);
            
        } catch (error) {
            console.log('   ❌ V2功能测试失败:', error.message);
        }
        
        // 4. 测试合约状态
        console.log('\n4. 📊 合约状态检查');
        try {
            const balance = await ethers.provider.getBalance(contractAddress);
            console.log('   ✅ 合约余额:', ethers.formatEther(balance), 'MC');
            
            const owner = await contract.owner();
            console.log('   ✅ 合约所有者:', owner);
            
        } catch (error) {
            console.log('   ❌ 合约状态检查失败:', error.message);
        }
        
        // 5. 测试事件查询
        console.log('\n5. 📝 事件查询测试');
        try {
            const filter = contract.filters.DynamicRewardSystemInitialized();
            const events = await contract.queryFilter(filter, -100); // 最近100个区块
            
            if (events.length > 0) {
                console.log(`   ✅ 找到 ${events.length} 个初始化事件`);
                const latestEvent = events[events.length - 1];
                console.log(`      最新事件区块: ${latestEvent.blockNumber}`);
                console.log(`      交易哈希: ${latestEvent.transactionHash}`);
            } else {
                console.log('   ⚠️ 未找到初始化事件');
            }
        } catch (error) {
            console.log('   ❌ 事件查询失败:', error.message);
        }
        
        console.log('\n🎉 V3功能测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('错误详情:', error);
    }
}

// 运行测试
if (require.main === module) {
    testV3Functionality()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('测试脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = { testV3Functionality };