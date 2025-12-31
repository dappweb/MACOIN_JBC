const { ethers } = require('ethers');

// 配置
const RPC_URL = 'https://chain.mcerscan.com/';
const CONTRACT_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';

// 合约 ABI (基于现有的诊断服务)
const CONTRACT_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, bool isActive, uint256 refundFeeAmount, uint256 maxTicketAmount, uint256 currentCap)",
    "function userTicket(address) view returns (uint256 amount, uint256 startTime, uint256 duration, bool isActive)",
    "function getUserLevel(address user) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function owner() view returns (address)",
    "event RewardClaimed(address indexed user, uint256 amount, uint256 rewardType, uint256 timestamp)",
    "event DifferentialRewardDistributed(address indexed user, uint256 amount, uint256 level, uint256 timestamp)",
    "event ReferralRewardPaid(address indexed user, address indexed referrer, uint256 amount, uint256 level)",
    "event RewardPaid(address indexed user, uint256 amount, uint256 rewardType)"
];

async function diagnoseUser0x5067() {
    const userAddress = '0x5067d182d5f15511f0c71194a25cc67b05c20b02';
    
    console.log('='.repeat(80));
    console.log(`🔍 用户 0x5067 四种奖励类型全面诊断`);
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

        // 2. 获取用户等级信息
        console.log('\n🏆 2. 用户等级信息');
        console.log('-'.repeat(50));
        
        let level = 0;
        let levelPercent = 0;
        let teamCount = Number(userInfo.teamCount);
        
        try {
            const userLevel = await contract.getUserLevel(userAddress);
            level = Number(userLevel.level);
            levelPercent = Number(userLevel.percent);
            teamCount = Number(userLevel.teamCount);
            console.log(`📊 用户等级: V${level}`);
            console.log(`📈 级差收益率: ${levelPercent}%`);
            console.log(`👥 团队人数: ${teamCount}`);
        } catch (error) {
            console.log(`⚠️  等级查询失败: ${error.message.split('(')[0]}`);
            // 手动计算等级
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

        // 3. 查询奖励事件 (四种奖励类型)
        console.log('\n🎁 3. 四种奖励类型事件查询');
        console.log('-'.repeat(50));

        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 100000); // 查询最近100000个区块
        
        console.log(`🔍 查询区块范围: ${fromBlock} - ${currentBlock}`);

        // 并行查询所有奖励事件
        const eventQueries = await Promise.allSettled([
            // 1. 静态奖励 (RewardClaimed with rewardType 0)
            contract.queryFilter(
                contract.filters.RewardClaimed(userAddress),
                fromBlock
            ),
            // 2. 级差奖励 (DifferentialRewardDistributed)
            contract.queryFilter(
                contract.filters.DifferentialRewardDistributed(userAddress),
                fromBlock
            ),
            // 3. 直推奖励 (ReferralRewardPaid)
            contract.queryFilter(
                contract.filters.ReferralRewardPaid(userAddress),
                fromBlock
            ),
            // 4. 等级奖励 (RewardPaid)
            contract.queryFilter(
                contract.filters.RewardPaid(userAddress),
                fromBlock
            )
        ]);

        const rewardTypes = [
            { name: '静态奖励', icon: '💎', events: eventQueries[0].status === 'fulfilled' ? eventQueries[0].value : [] },
            { name: '级差奖励', icon: '📊', events: eventQueries[1].status === 'fulfilled' ? eventQueries[1].value : [] },
            { name: '直推奖励', icon: '🤝', events: eventQueries[2].status === 'fulfilled' ? eventQueries[2].value : [] },
            { name: '等级奖励', icon: '🏆', events: eventQueries[3].status === 'fulfilled' ? eventQueries[3].value : [] }
        ];

        let totalEvents = 0;
        let totalRewardAmount = 0n;

        rewardTypes.forEach((rewardType, index) => {
            const events = rewardType.events;
            totalEvents += events.length;
            
            console.log(`${rewardType.icon} ${rewardType.name}:`);
            console.log(`  - 事件数量: ${events.length}`);
            
            if (events.length > 0) {
                let typeTotal = 0n;
                events.forEach(event => {
                    const amount = event.args && event.args.amount ? event.args.amount : 0n;
                    typeTotal += amount;
                });
                
                const formattedAmount = ethers.formatEther(typeTotal);
                console.log(`  - 总金额: ${formattedAmount} MC`);
                console.log(`  - 最新事件: 区块 ${events[events.length - 1].blockNumber}`);
                
                totalRewardAmount += typeTotal;
            } else {
                console.log(`  - 总金额: 0.0 MC`);
                console.log(`  - 状态: 无记录`);
            }
            
            if (eventQueries[index].status === 'rejected') {
                console.log(`  - 查询错误: ${eventQueries[index].reason.message.split('(')[0]}`);
            }
        });

        console.log(`\n📈 事件统计总计:`);
        console.log(`  - 总事件数: ${totalEvents}`);
        console.log(`  - 总奖励金额: ${ethers.formatEther(totalRewardAmount)} MC`);

        // 4. 四种奖励类型有效性分析
        console.log('\n🔍 4. 四种奖励类型有效性分析');
        console.log('-'.repeat(50));

        // 静态奖励分析
        const staticEvents = rewardTypes[0].events;
        const staticValid = staticEvents.length > 0 && userTicket.isActive;
        console.log(`💎 静态奖励有效性: ${staticValid ? '✅ 有效' : '❌ 无效'}`);
        if (!staticValid) {
            if (staticEvents.length === 0) console.log(`   - 原因: 没有静态奖励事件记录`);
            if (!userTicket.isActive) console.log(`   - 原因: 门票未激活`);
        }
        console.log(`   - 事件记录: ${staticEvents.length} 条`);
        console.log(`   - 门票状态: ${userTicket.isActive ? '已激活' : '未激活'}`);

        // 动态奖励分析 (已弃用)
        console.log(`⚡ 动态奖励有效性: ❌ 已弃用`);
        console.log(`   - 说明: 系统不再使用动态奖励机制`);
        console.log(`   - 替代方案: 使用级差奖励机制`);

        // 直推奖励分析
        const directEvents = rewardTypes[2].events;
        const directValid = directEvents.length > 0 && userInfo.isActive;
        console.log(`🤝 直推奖励有效性: ${directValid ? '✅ 有效' : '❌ 无效'}`);
        if (!directValid) {
            if (directEvents.length === 0) console.log(`   - 原因: 没有直推奖励事件记录`);
            if (!userInfo.isActive) console.log(`   - 原因: 用户未激活`);
        }
        console.log(`   - 事件记录: ${directEvents.length} 条`);
        console.log(`   - 活跃直推: ${userInfo.activeDirects.toString()} 人`);

        // 级差奖励分析
        const differentialEvents = rewardTypes[1].events;
        const differentialValid = differentialEvents.length > 0 && userInfo.isActive && level > 0;
        console.log(`📊 级差奖励有效性: ${differentialValid ? '✅ 有效' : '❌ 无效'}`);
        if (!differentialValid) {
            if (differentialEvents.length === 0) console.log(`   - 原因: 没有级差奖励事件记录`);
            if (!userInfo.isActive) console.log(`   - 原因: 用户未激活`);
            if (level === 0) console.log(`   - 原因: 用户等级为V0，无级差收益`);
        }
        console.log(`   - 事件记录: ${differentialEvents.length} 条`);
        console.log(`   - 用户等级: V${level} (${levelPercent}%)`);

        // 等级奖励分析
        const levelEvents = rewardTypes[3].events;
        const levelValid = levelEvents.length > 0 && userInfo.isActive && level > 0;
        console.log(`🏆 等级奖励有效性: ${levelValid ? '✅ 有效' : '❌ 无效'}`);
        if (!levelValid) {
            if (levelEvents.length === 0) console.log(`   - 原因: 没有等级奖励事件记录`);
            if (!userInfo.isActive) console.log(`   - 原因: 用户未激活`);
            if (level === 0) console.log(`   - 原因: 用户等级为V0`);
        }
        console.log(`   - 事件记录: ${levelEvents.length} 条`);
        console.log(`   - 团队规模: ${teamCount} 人`);

        // 5. 综合分析和建议
        console.log('\n📋 5. 综合分析和建议');
        console.log('-'.repeat(50));
        
        console.log(`🎯 用户状态总结:`);
        console.log(`  - 用户等级: V${level} (${levelPercent}% 级差收益率)`);
        console.log(`  - 激活状态: ${userInfo.isActive ? '✅ 已激活' : '❌ 未激活'}`);
        console.log(`  - 门票状态: ${userTicket.isActive ? '✅ 活跃' : '❌ 非活跃'}`);
        console.log(`  - 团队规模: ${teamCount} 人`);
        console.log(`  - 活跃直推: ${userInfo.activeDirects.toString()} 人`);
        console.log(`  - 已获得收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`  - 收益上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        
        // 计算收益进度
        const progress = userInfo.currentCap > 0n ? 
            (Number(userInfo.totalRevenue) / Number(userInfo.currentCap) * 100).toFixed(1) : '0';
        console.log(`  - 收益进度: ${progress}%`);

        console.log(`\n💡 四种奖励类型状态:`);
        const validRewards = [];
        const invalidRewards = [];
        
        if (staticValid) validRewards.push('静态奖励');
        else invalidRewards.push('静态奖励');
        
        invalidRewards.push('动态奖励 (已弃用)');
        
        if (directValid) validRewards.push('直推奖励');
        else invalidRewards.push('直推奖励');
        
        if (differentialValid) validRewards.push('级差奖励');
        else invalidRewards.push('级差奖励');
        
        if (levelValid) validRewards.push('等级奖励');
        else invalidRewards.push('等级奖励');

        console.log(`  ✅ 有效奖励类型: ${validRewards.length > 0 ? validRewards.join(', ') : '无'}`);
        console.log(`  ❌ 无效奖励类型: ${invalidRewards.join(', ')}`);

        console.log(`\n🔧 改进建议:`);
        if (!userTicket.isActive) {
            console.log(`  📝 购买并激活门票以获得静态奖励`);
        }
        if (level === 0) {
            console.log(`  📈 发展团队至少10人以获得V1等级和级差奖励`);
        }
        if (userInfo.activeDirects === 0n) {
            console.log(`  🤝 邀请直推用户以获得直推奖励`);
        }
        if (validRewards.length === 0) {
            console.log(`  ⚠️  当前没有有效的奖励类型，建议激活门票并发展团队`);
        }

        console.log(`\n🔄 奖励机制说明:`);
        console.log(`  💎 静态奖励: 基于门票激活和质押时间，需要有效门票`);
        console.log(`  ⚡ 动态奖励: 已弃用，系统不再分发此类奖励`);
        console.log(`  🤝 直推奖励: 基于直接推荐的用户活动，需要活跃直推`);
        console.log(`  📊 级差奖励: 基于团队业绩和用户等级，主要奖励机制`);
        console.log(`  🏆 等级奖励: 基于用户等级和团队表现，需要V1+等级`);

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
diagnoseUser0x5067().catch(console.error);