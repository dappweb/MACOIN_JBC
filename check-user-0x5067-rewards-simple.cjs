const { ethers } = require('ethers');

// 配置
const RPC_URL = 'https://chain.mcerscan.com/';
const CONTRACT_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';

// 合约 ABI (只包含确实存在的函数)
const CONTRACT_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, bool isActive, uint256 refundFeeAmount, uint256 maxTicketAmount, uint256 currentCap)",
    "function userTicket(address) view returns (uint256 amount, uint256 startTime, uint256 duration, bool isActive)",
    "function calculateLevel(uint256 teamCount) view returns (uint256 level, uint256 percent)",
    "function claimableRewards(address user) view returns (uint256)",
    "function userRewards(address user, uint256 rewardType) view returns (uint256)",
    "function rewardHistory(address user, uint256 index) view returns (uint256 amount, uint256 rewardType, uint256 timestamp, bool claimed)"
];

async function checkUserRewards() {
    const userAddress = '0x5067d182d5f15511f0c71194a25cc67b05c20b02';
    
    console.log('='.repeat(80));
    console.log(`🔍 用户 0x5067 四种奖励类型检查报告`);
    console.log(`📍 用户地址: ${userAddress}`);
    console.log(`⏰ 检查时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('='.repeat(80));

    try {
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
        
        // 手动计算等级 (基于团队人数)
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
        
        console.log(`📊 用户等级: V${level}`);
        console.log(`📈 级差收益率: ${levelPercent}%`);

        // 3. 检查四种奖励类型
        console.log('\n🎁 3. 四种奖励类型检查');
        console.log('-'.repeat(50));

        const rewardTypes = [
            { type: 0, name: '静态奖励', icon: '💎' },
            { type: 1, name: '动态奖励', icon: '⚡' },
            { type: 2, name: '等级奖励', icon: '🏆' },
            { type: 3, name: '级差奖励', icon: '📊' }
        ];

        let totalRewards = 0n;
        const rewardResults = {};

        for (const reward of rewardTypes) {
            try {
                const amount = await contract.userRewards(userAddress, reward.type);
                const amountFormatted = ethers.formatEther(amount);
                console.log(`${reward.icon} ${reward.name}: ${amountFormatted} MC`);
                
                rewardResults[reward.type] = {
                    name: reward.name,
                    amount: amount,
                    formatted: amountFormatted,
                    valid: amount > 0n
                };
                
                totalRewards += amount;
            } catch (error) {
                console.log(`${reward.icon} ${reward.name}: 无法获取 (${error.message.split('(')[0]})`);
                rewardResults[reward.type] = {
                    name: reward.name,
                    amount: 0n,
                    formatted: '0.0',
                    valid: false,
                    error: true
                };
            }
        }

        console.log(`\n💰 总奖励: ${ethers.formatEther(totalRewards)} MC`);

        // 4. 奖励有效性分析
        console.log('\n🔍 4. 奖励有效性分析');
        console.log('-'.repeat(50));

        // 静态奖励分析
        const staticReward = rewardResults[0];
        if (staticReward && !staticReward.error) {
            const staticValid = staticReward.valid && userTicket.isActive;
            console.log(`💎 静态奖励有效性: ${staticValid ? '✅ 有效' : '❌ 无效'}`);
            if (!staticValid) {
                if (!staticReward.valid) console.log(`   - 原因: 静态奖励为0`);
                if (!userTicket.isActive) console.log(`   - 原因: 门票未激活`);
            }
        } else {
            console.log(`💎 静态奖励有效性: ❓ 无法检查`);
        }

        // 动态奖励分析 (已弃用)
        console.log(`⚡ 动态奖励有效性: ❌ 已弃用 (系统不再使用动态奖励)`);

        // 等级奖励分析
        const levelReward = rewardResults[2];
        if (levelReward && !levelReward.error) {
            const levelValid = levelReward.valid && userInfo.isActive && level > 0;
            console.log(`🏆 等级奖励有效性: ${levelValid ? '✅ 有效' : '❌ 无效'}`);
            if (!levelValid) {
                if (!levelReward.valid) console.log(`   - 原因: 等级奖励为0`);
                if (!userInfo.isActive) console.log(`   - 原因: 用户未激活`);
                if (level === 0) console.log(`   - 原因: 用户等级为V0`);
            }
        } else {
            console.log(`🏆 等级奖励有效性: ❓ 无法检查`);
        }

        // 级差奖励分析
        const differentialReward = rewardResults[3];
        if (differentialReward && !differentialReward.error) {
            const differentialValid = differentialReward.valid && userInfo.isActive && level > 0;
            console.log(`📊 级差奖励有效性: ${differentialValid ? '✅ 有效' : '❌ 无效'}`);
            if (!differentialValid) {
                if (!differentialReward.valid) console.log(`   - 原因: 级差奖励为0`);
                if (!userInfo.isActive) console.log(`   - 原因: 用户未激活`);
                if (level === 0) console.log(`   - 原因: 用户等级为V0，无级差收益`);
            }
        } else {
            console.log(`📊 级差奖励有效性: ❓ 无法检查`);
        }

        // 5. 检查可领取奖励
        console.log('\n💰 5. 可领取奖励检查');
        console.log('-'.repeat(50));
        
        try {
            const claimableRewards = await contract.claimableRewards(userAddress);
            console.log(`💎 可领取奖励: ${ethers.formatEther(claimableRewards)} MC`);
            
            if (claimableRewards > 0n) {
                console.log(`✅ 用户有可领取的奖励`);
                console.log(`💡 建议: 用户可以调用 claimRewards() 函数领取奖励`);
            } else {
                console.log(`ℹ️  当前没有可领取的奖励`);
            }
        } catch (error) {
            console.log(`⚠️  检查可领取奖励失败: ${error.message.split('(')[0]}`);
        }

        // 6. 综合分析和建议
        console.log('\n📋 6. 综合分析和建议');
        console.log('-'.repeat(50));
        
        console.log(`🎯 用户状态总结:`);
        console.log(`  - 用户等级: V${level} (${levelPercent}% 级差收益率)`);
        console.log(`  - 激活状态: ${userInfo.isActive ? '✅ 已激活' : '❌ 未激活'}`);
        console.log(`  - 门票状态: ${userTicket.isActive ? '✅ 活跃' : '❌ 非活跃'}`);
        console.log(`  - 团队规模: ${userInfo.teamCount.toString()} 人`);
        console.log(`  - 已获得收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`  - 收益上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        
        // 计算收益进度
        const progress = userInfo.currentCap > 0n ? 
            (Number(userInfo.totalRevenue) / Number(userInfo.currentCap) * 100).toFixed(1) : '0';
        console.log(`  - 收益进度: ${progress}%`);

        console.log(`\n💡 奖励机制建议:`);
        if (!userInfo.isActive) {
            console.log(`  ⚠️  用户未激活，无法获得等级奖励和级差奖励`);
        }
        if (!userTicket.isActive) {
            console.log(`  ⚠️  门票未激活，无法获得静态奖励`);
            console.log(`  💡 建议: 用户需要购买并激活门票才能获得静态奖励`);
        }
        if (level === 0) {
            console.log(`  📈 用户需要发展团队至少10人才能获得V1等级和级差奖励`);
        }
        if (level > 0) {
            console.log(`  ✅ 用户已达到V${level}等级，可以获得${levelPercent}%的级差奖励`);
        }
        
        // 检查是否接近收益上限
        if (userInfo.currentCap > 0n) {
            const remaining = userInfo.currentCap - userInfo.totalRevenue;
            const remainingFormatted = ethers.formatEther(remaining);
            if (remaining <= ethers.parseEther('10')) {
                console.log(`  ⚠️  用户接近收益上限，剩余额度仅 ${remainingFormatted} MC`);
            } else {
                console.log(`  💰 用户还有 ${remainingFormatted} MC 的收益空间`);
            }
        }
        
        console.log(`\n🔄 当前奖励机制说明:`);
        console.log(`  💎 静态奖励: 基于门票激活和质押时间 (需要激活门票)`);
        console.log(`  ⚡ 动态奖励: 已弃用，系统不再分发`);
        console.log(`  🏆 等级奖励: 基于用户等级和推荐关系 (需要V1+等级)`);
        console.log(`  📊 级差奖励: 基于团队业绩和用户等级 (主要奖励机制，需要V1+等级)`);

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
checkUserRewards().catch(console.error);