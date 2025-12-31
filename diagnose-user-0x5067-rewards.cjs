const { ethers } = require('ethers');

// 配置
const RPC_URL = 'https://chain.mcerscan.com/';
const CONTRACT_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';

// 合约 ABI (简化版，包含需要的函数)
const CONTRACT_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, bool isActive, uint256 refundFeeAmount, uint256 maxTicketAmount, uint256 currentCap)",
    "function userTicket(address) view returns (uint256 amount, uint256 startTime, uint256 duration, bool isActive)",
    "function getUserRewards(address user) view returns (uint256 staticRewards, uint256 dynamicRewards, uint256 levelRewards, uint256 differentialRewards)",
    "function calculateLevel(uint256 teamCount) view returns (uint256 level, uint256 percent)",
    "function pendingRewards(address user) view returns (uint256)",
    "function claimableRewards(address user) view returns (uint256)",
    "function getRewardHistory(address user, uint256 rewardType) view returns (uint256[] memory amounts, uint256[] memory timestamps)",
    "function rewardDistribution(address user, uint256 rewardType) view returns (uint256 amount, uint256 timestamp, bool claimed)"
];

async function diagnoseUserRewards() {
    const userAddress = '0x5067d182d5f15511f0c71194a25cc67b05c20b02';
    
    console.log('='.repeat(80));
    console.log(`🔍 用户奖励类型诊断报告`);
    console.log(`📍 用户地址: ${userAddress}`);
    console.log(`🌐 网络: MC Chain (88813)`);
    console.log(`📋 合约地址: ${CONTRACT_ADDRESS}`);
    console.log(`⏰ 检查时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('='.repeat(80));

    try {
        // 连接到区块链
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        // 1. 获取用户基本信息
        console.log('\n📊 1. 用户基本信息');
        console.log('-'.repeat(50));
        
        const userInfo = await contract.userInfo(userAddress);
        const userTicket = await contract.userTicket(userAddress);
        
        console.log(`👤 推荐人: ${userInfo.referrer}`);
        console.log(`👥 活跃直推: ${userInfo.activeDirects.toString()}`);
        console.log(`🏢 团队人数: ${userInfo.teamCount.toString()}`);
        console.log(`💰 总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`🎯 当前上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        console.log(`✅ 活跃状态: ${userInfo.isActive ? '是' : '否'}`);
        console.log(`🎫 门票金额: ${ethers.formatEther(userTicket.amount)} MC`);
        console.log(`🎫 门票状态: ${userTicket.isActive ? '活跃' : '非活跃'}`);

        // 2. 计算用户等级
        console.log('\n🏆 2. 用户等级信息');
        console.log('-'.repeat(50));
        
        let level = 0;
        let levelPercent = 0;
        try {
            const levelInfo = await contract.calculateLevel(userInfo.teamCount);
            level = Number(levelInfo[0]);
            levelPercent = Number(levelInfo[1]);
            console.log(`📊 用户等级: V${level}`);
            console.log(`📈 级差收益率: ${levelPercent}%`);
        } catch (error) {
            console.log(`⚠️  等级计算失败: ${error.message}`);
            // 手动计算等级
            const teamCount = Number(userInfo.teamCount);
            if (teamCount >= 100000) { level = 9; levelPercent = 45; }
            else if (teamCount >= 30000) { level = 8; levelPercent = 40; }
            else if (teamCount >= 10000) { level = 7; levelPercent = 35; }
            else if (teamCount >= 3000) { level = 6; levelPercent = 30; }
            else if (teamCount >= 1000) { level = 5; levelPercent = 25; }
            else if (teamCount >= 300) { level = 4; levelPercent = 20; }
            else if (teamCount >= 100) { level = 3; levelPercent = 15; }
            else if (teamCount >= 30) { level = 2; levelPercent = 10; }
            else if (teamCount >= 10) { level = 1; levelPercent = 5; }
            else { level = 0; levelPercent = 0; }
            
            console.log(`📊 用户等级 (手动计算): V${level}`);
            console.log(`📈 级差收益率 (手动计算): ${levelPercent}%`);
        }

        // 3. 检查四种奖励类型
        console.log('\n🎁 3. 四种奖励类型检查');
        console.log('-'.repeat(50));

        try {
            const rewards = await contract.getUserRewards(userAddress);
            console.log(`💎 静态奖励: ${ethers.formatEther(rewards.staticRewards)} MC`);
            console.log(`⚡ 动态奖励: ${ethers.formatEther(rewards.dynamicRewards)} MC`);
            console.log(`🏆 等级奖励: ${ethers.formatEther(rewards.levelRewards)} MC`);
            console.log(`📊 级差奖励: ${ethers.formatEther(rewards.differentialRewards)} MC`);
            
            // 分析奖励有效性
            console.log('\n🔍 奖励有效性分析:');
            
            // 静态奖励分析
            const staticValid = rewards.staticRewards > 0n && userTicket.isActive;
            console.log(`💎 静态奖励有效性: ${staticValid ? '✅ 有效' : '❌ 无效'}`);
            if (!staticValid) {
                if (rewards.staticRewards === 0n) console.log(`   - 原因: 静态奖励为0`);
                if (!userTicket.isActive) console.log(`   - 原因: 门票未激活`);
            }
            
            // 动态奖励分析 (已弃用)
            console.log(`⚡ 动态奖励有效性: ❌ 已弃用 (系统不再使用动态奖励)`);
            
            // 等级奖励分析
            const levelValid = rewards.levelRewards > 0n && userInfo.isActive && level > 0;
            console.log(`🏆 等级奖励有效性: ${levelValid ? '✅ 有效' : '❌ 无效'}`);
            if (!levelValid) {
                if (rewards.levelRewards === 0n) console.log(`   - 原因: 等级奖励为0`);
                if (!userInfo.isActive) console.log(`   - 原因: 用户未激活`);
                if (level === 0) console.log(`   - 原因: 用户等级为V0`);
            }
            
            // 级差奖励分析
            const differentialValid = rewards.differentialRewards > 0n && userInfo.isActive && level > 0;
            console.log(`📊 级差奖励有效性: ${differentialValid ? '✅ 有效' : '❌ 无效'}`);
            if (!differentialValid) {
                if (rewards.differentialRewards === 0n) console.log(`   - 原因: 级差奖励为0`);
                if (!userInfo.isActive) console.log(`   - 原因: 用户未激活`);
                if (level === 0) console.log(`   - 原因: 用户等级为V0，无级差收益`);
            }
            
        } catch (error) {
            console.log(`❌ 获取奖励信息失败: ${error.message}`);
            console.log(`🔧 尝试使用其他方法检查...`);
        }

        // 4. 检查待领取奖励
        console.log('\n💰 4. 待领取奖励检查');
        console.log('-'.repeat(50));
        
        try {
            const pendingRewards = await contract.pendingRewards(userAddress);
            console.log(`⏳ 待领取奖励: ${ethers.formatEther(pendingRewards)} MC`);
            
            if (pendingRewards > 0n) {
                console.log(`✅ 用户有待领取的奖励`);
                console.log(`💡 建议: 用户可以调用 claimRewards() 函数领取奖励`);
            } else {
                console.log(`ℹ️  当前没有待领取的奖励`);
            }
        } catch (error) {
            console.log(`⚠️  检查待领取奖励失败: ${error.message}`);
        }

        // 5. 检查可领取奖励
        try {
            const claimableRewards = await contract.claimableRewards(userAddress);
            console.log(`💎 可领取奖励: ${ethers.formatEther(claimableRewards)} MC`);
        } catch (error) {
            console.log(`⚠️  检查可领取奖励失败: ${error.message}`);
        }

        // 6. 奖励历史记录检查
        console.log('\n📈 5. 奖励历史记录');
        console.log('-'.repeat(50));
        
        const rewardTypes = [
            { type: 0, name: '静态奖励' },
            { type: 1, name: '动态奖励' },
            { type: 2, name: '等级奖励' },
            { type: 3, name: '级差奖励' }
        ];

        for (const reward of rewardTypes) {
            try {
                const history = await contract.getRewardHistory(userAddress, reward.type);
                console.log(`${reward.name}: ${history.amounts.length} 条记录`);
                
                if (history.amounts.length > 0) {
                    const totalAmount = history.amounts.reduce((sum, amount) => sum + amount, 0n);
                    console.log(`  - 总金额: ${ethers.formatEther(totalAmount)} MC`);
                    console.log(`  - 最新记录: ${new Date(Number(history.timestamps[history.timestamps.length - 1]) * 1000).toLocaleString('zh-CN')}`);
                }
            } catch (error) {
                console.log(`${reward.name}: 无法获取历史记录 (${error.message})`);
            }
        }

        // 7. 综合分析和建议
        console.log('\n📋 6. 综合分析和建议');
        console.log('-'.repeat(50));
        
        console.log(`🎯 用户状态总结:`);
        console.log(`  - 用户等级: V${level} (${levelPercent}% 级差收益率)`);
        console.log(`  - 激活状态: ${userInfo.isActive ? '✅ 已激活' : '❌ 未激活'}`);
        console.log(`  - 门票状态: ${userTicket.isActive ? '✅ 活跃' : '❌ 非活跃'}`);
        console.log(`  - 团队规模: ${userInfo.teamCount.toString()} 人`);
        
        console.log(`\n💡 奖励机制建议:`);
        if (!userInfo.isActive) {
            console.log(`  ⚠️  用户未激活，无法获得等级奖励和级差奖励`);
        }
        if (!userTicket.isActive) {
            console.log(`  ⚠️  门票未激活，无法获得静态奖励`);
        }
        if (level === 0) {
            console.log(`  📈 用户需要发展团队至少10人才能获得V1等级和级差奖励`);
        }
        if (level > 0) {
            console.log(`  ✅ 用户已达到V${level}等级，可以获得${levelPercent}%的级差奖励`);
        }
        
        console.log(`\n🔄 当前奖励机制说明:`);
        console.log(`  💎 静态奖励: 基于门票激活和质押时间`);
        console.log(`  ⚡ 动态奖励: 已弃用，系统不再分发`);
        console.log(`  🏆 等级奖励: 基于用户等级和推荐关系`);
        console.log(`  📊 级差奖励: 基于团队业绩和用户等级 (主要奖励机制)`);

    } catch (error) {
        console.error(`❌ 诊断过程中发生错误:`, error);
        console.log(`\n🔧 错误详情:`);
        console.log(`  - 错误类型: ${error.name}`);
        console.log(`  - 错误信息: ${error.message}`);
        if (error.code) console.log(`  - 错误代码: ${error.code}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ 诊断完成 - ${new Date().toLocaleString('zh-CN')}`);
    console.log('='.repeat(80));
}

// 运行诊断
diagnoseUserRewards().catch(console.error);