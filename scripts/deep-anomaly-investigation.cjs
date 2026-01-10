const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const JBC_ADDRESS = "0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function getDirectReferrals(address) view returns (address[])",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
    "function owner() view returns (address)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 stakeId, uint256 cycleDays)",
    "event RewardsClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount)",
    "event Redeemed(address indexed user, uint256 returnAmount, uint256 yieldAmount)",
];

const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
];

// 存储发现的异常
const anomalies = [];

function addAnomaly(category, severity, description, details) {
    anomalies.push({
        category,
        severity, // 'critical', 'high', 'medium', 'low'
        description,
        details,
        timestamp: new Date().toISOString()
    });
}

async function deepInvestigation() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const jbcToken = new ethers.Contract(JBC_ADDRESS, JBC_ABI, provider);

    console.log("🔍 深度异常调研报告\n");
    console.log("=".repeat(80));
    console.log(`调研时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    // ============================================
    // 1. 收集所有用户地址
    // ============================================
    console.log("📊 第一阶段: 收集用户数据...\n");
    
    const ticketEvents = await protocol.queryFilter(protocol.filters.TicketPurchased());
    const uniqueUsers = [...new Set(ticketEvents.map(e => e.args.user))];
    console.log(`  发现 ${uniqueUsers.length} 个购买过门票的用户\n`);

    // ============================================
    // 2. 检查推荐链异常
    // ============================================
    console.log("🔗 第二阶段: 检查推荐链异常...\n");
    
    const userDataMap = new Map();
    let processedCount = 0;
    
    for (const user of uniqueUsers) {
        try {
            const info = await protocol.userInfo(user);
            const ticket = await protocol.userTicket(user);
            userDataMap.set(user.toLowerCase(), {
                address: user,
                referrer: info.referrer,
                teamCount: Number(info.teamCount),
                totalRevenue: info.totalRevenue,
                currentCap: info.currentCap,
                isActive: info.isActive,
                ticketAmount: ticket.amount,
                ticketExited: ticket.exited
            });
            processedCount++;
            if (processedCount % 50 === 0) {
                console.log(`  已处理 ${processedCount}/${uniqueUsers.length} 用户...`);
            }
        } catch (e) {
            // Skip failed queries
        }
    }
    console.log(`  完成用户数据收集: ${userDataMap.size} 个用户\n`);

    // 2.1 检查团队人数倒挂
    console.log("  检查团队人数异常...");
    let teamCountAnomalies = 0;
    
    for (const [userAddr, userData] of userDataMap) {
        const referrerAddr = userData.referrer?.toLowerCase();
        if (referrerAddr && referrerAddr !== ethers.ZeroAddress.toLowerCase()) {
            const referrerData = userDataMap.get(referrerAddr);
            if (referrerData) {
                // 检查: 被推荐人的团队人数是否大于推荐人
                if (userData.teamCount > referrerData.teamCount) {
                    teamCountAnomalies++;
                    addAnomaly(
                        '推荐链异常',
                        'critical',
                        '团队人数倒挂: 被推荐人团队 > 推荐人团队',
                        {
                            user: userData.address,
                            userTeamCount: userData.teamCount,
                            referrer: referrerData.address,
                            referrerTeamCount: referrerData.teamCount,
                            difference: userData.teamCount - referrerData.teamCount
                        }
                    );
                }
            }
        }
    }
    console.log(`    团队人数倒挂异常: ${teamCountAnomalies} 个\n`);

    // 2.2 检查自己推荐自己
    console.log("  检查自推荐异常...");
    let selfReferralCount = 0;
    for (const [userAddr, userData] of userDataMap) {
        if (userData.referrer?.toLowerCase() === userAddr) {
            selfReferralCount++;
            addAnomaly(
                '推荐链异常',
                'critical',
                '自己推荐自己',
                { user: userData.address }
            );
        }
    }
    console.log(`    自推荐异常: ${selfReferralCount} 个\n`);

    // 2.3 检查推荐链循环
    console.log("  检查推荐链循环...");
    let circularRefCount = 0;
    for (const [userAddr, userData] of userDataMap) {
        const visited = new Set();
        let current = userAddr;
        let depth = 0;
        
        while (current && current !== ethers.ZeroAddress.toLowerCase() && depth < 100) {
            if (visited.has(current)) {
                circularRefCount++;
                addAnomaly(
                    '推荐链异常',
                    'critical',
                    '推荐链存在循环',
                    { 
                        startUser: userData.address,
                        loopAt: current,
                        depth
                    }
                );
                break;
            }
            visited.add(current);
            const nextData = userDataMap.get(current);
            current = nextData?.referrer?.toLowerCase();
            depth++;
        }
    }
    console.log(`    推荐链循环异常: ${circularRefCount} 个\n`);

    // ============================================
    // 3. 检查收益异常
    // ============================================
    console.log("💰 第三阶段: 检查收益异常...\n");

    // 3.1 检查收益超过上限
    console.log("  检查收益超限...");
    let revenueOverCapCount = 0;
    for (const [userAddr, userData] of userDataMap) {
        if (userData.totalRevenue > userData.currentCap && userData.currentCap > 0n) {
            revenueOverCapCount++;
            addAnomaly(
                '收益异常',
                'high',
                '收益超过上限',
                {
                    user: userData.address,
                    totalRevenue: ethers.formatEther(userData.totalRevenue),
                    currentCap: ethers.formatEther(userData.currentCap),
                    overage: ethers.formatEther(userData.totalRevenue - userData.currentCap)
                }
            );
        }
    }
    console.log(`    收益超限异常: ${revenueOverCapCount} 个\n`);

    // 3.2 检查门票金额与收益上限不匹配 (正常上限 = 门票 * 3)
    console.log("  检查门票与上限比例...");
    let capMismatchCount = 0;
    for (const [userAddr, userData] of userDataMap) {
        if (userData.ticketAmount > 0n && !userData.ticketExited) {
            const expectedCap = userData.ticketAmount * 3n;
            const actualCap = userData.currentCap;
            // 允许10%的误差
            const tolerance = expectedCap / 10n;
            if (actualCap > expectedCap + tolerance || actualCap < expectedCap - tolerance) {
                // 只记录差异较大的
                if (actualCap !== 0n) {
                    capMismatchCount++;
                    addAnomaly(
                        '收益异常',
                        'medium',
                        '门票金额与收益上限不匹配',
                        {
                            user: userData.address,
                            ticketAmount: ethers.formatEther(userData.ticketAmount),
                            expectedCap: ethers.formatEther(expectedCap),
                            actualCap: ethers.formatEther(actualCap)
                        }
                    );
                }
            }
        }
    }
    console.log(`    门票与上限不匹配: ${capMismatchCount} 个\n`);

    // ============================================
    // 4. 检查激活状态异常
    // ============================================
    console.log("🔄 第四阶段: 检查激活状态异常...\n");

    // 4.1 有门票但未激活
    console.log("  检查有门票但未激活...");
    let ticketNotActiveCount = 0;
    for (const [userAddr, userData] of userDataMap) {
        if (userData.ticketAmount > 0n && !userData.ticketExited && !userData.isActive) {
            ticketNotActiveCount++;
            addAnomaly(
                '状态异常',
                'medium',
                '有门票但账户未激活',
                {
                    user: userData.address,
                    ticketAmount: ethers.formatEther(userData.ticketAmount),
                    isActive: userData.isActive
                }
            );
        }
    }
    console.log(`    有门票但未激活: ${ticketNotActiveCount} 个\n`);

    // 4.2 无门票但已激活
    console.log("  检查无门票但已激活...");
    let activeNoTicketCount = 0;
    for (const [userAddr, userData] of userDataMap) {
        if ((userData.ticketAmount === 0n || userData.ticketExited) && userData.isActive) {
            activeNoTicketCount++;
            addAnomaly(
                '状态异常',
                'low',
                '无有效门票但账户已激活',
                {
                    user: userData.address,
                    ticketAmount: ethers.formatEther(userData.ticketAmount),
                    ticketExited: userData.ticketExited,
                    isActive: userData.isActive
                }
            );
        }
    }
    console.log(`    无门票但已激活: ${activeNoTicketCount} 个\n`);

    // ============================================
    // 5. 检查质押异常
    // ============================================
    console.log("📈 第五阶段: 检查质押异常...\n");

    let stakeAnomalyCount = 0;
    let totalStakeChecked = 0;
    
    // 抽样检查质押数据
    const sampleUsers = uniqueUsers.slice(0, Math.min(100, uniqueUsers.length));
    
    for (const user of sampleUsers) {
        try {
            let stakeIndex = 0;
            while (stakeIndex < 10) { // 最多检查10个质押
                try {
                    const stake = await protocol.userStakes(user, stakeIndex);
                    totalStakeChecked++;
                    
                    // 检查异常周期
                    const cycleDays = Number(stake.cycleDays);
                    if (![7, 15, 30].includes(cycleDays) && cycleDays !== 0) {
                        stakeAnomalyCount++;
                        addAnomaly(
                            '质押异常',
                            'medium',
                            '非标准质押周期',
                            {
                                user,
                                stakeIndex,
                                cycleDays,
                                amount: ethers.formatEther(stake.amount)
                            }
                        );
                    }
                    
                    // 检查已领取超过应得
                    if (stake.active) {
                        const maxReward = stake.amount * BigInt(cycleDays) * 2n / 100n; // 最高2%每天
                        if (stake.paid > maxReward) {
                            stakeAnomalyCount++;
                            addAnomaly(
                                '质押异常',
                                'high',
                                '已领取收益超过最大应得',
                                {
                                    user,
                                    stakeIndex,
                                    amount: ethers.formatEther(stake.amount),
                                    paid: ethers.formatEther(stake.paid),
                                    maxPossible: ethers.formatEther(maxReward)
                                }
                            );
                        }
                    }
                    
                    stakeIndex++;
                } catch {
                    break;
                }
            }
        } catch (e) {
            // Skip
        }
    }
    console.log(`    检查了 ${totalStakeChecked} 个质押记录`);
    console.log(`    质押异常: ${stakeAnomalyCount} 个\n`);

    // ============================================
    // 6. 检查资金池异常
    // ============================================
    console.log("🏦 第六阶段: 检查资金池状态...\n");

    const mcReserve = await protocol.swapReserveMC();
    const jbcReserve = await protocol.swapReserveJBC();
    const contractMcBalance = await provider.getBalance(PROTOCOL_ADDRESS);
    const contractJbcBalance = await jbcToken.balanceOf(PROTOCOL_ADDRESS);

    console.log(`  Swap池 MC储备: ${ethers.formatEther(mcReserve)} MC`);
    console.log(`  Swap池 JBC储备: ${ethers.formatEther(jbcReserve)} JBC`);
    console.log(`  合约 MC余额: ${ethers.formatEther(contractMcBalance)} MC`);
    console.log(`  合约 JBC余额: ${ethers.formatEther(contractJbcBalance)} JBC\n`);

    // 检查储备与余额是否匹配
    if (mcReserve > contractMcBalance) {
        addAnomaly(
            '资金池异常',
            'critical',
            'Swap MC储备超过合约实际余额',
            {
                mcReserve: ethers.formatEther(mcReserve),
                contractBalance: ethers.formatEther(contractMcBalance),
                deficit: ethers.formatEther(mcReserve - contractMcBalance)
            }
        );
    }

    if (jbcReserve > contractJbcBalance) {
        addAnomaly(
            '资金池异常',
            'critical',
            'Swap JBC储备超过合约实际余额',
            {
                jbcReserve: ethers.formatEther(jbcReserve),
                contractBalance: ethers.formatEther(contractJbcBalance),
                deficit: ethers.formatEther(jbcReserve - contractJbcBalance)
            }
        );
    }

    // ============================================
    // 7. 检查大额异常交易
    // ============================================
    console.log("🔔 第七阶段: 检查大额/异常交易...\n");

    // 获取所有奖励事件
    const rewardEvents = await protocol.queryFilter(protocol.filters.ReferralRewardPaid());
    console.log(`  分析 ${rewardEvents.length} 笔奖励交易...`);

    // 找出单笔大额奖励 (>500 MC)
    let largeRewardCount = 0;
    for (const event of rewardEvents) {
        const mcAmount = event.args.mcAmount;
        if (mcAmount > ethers.parseEther('500')) {
            largeRewardCount++;
            if (largeRewardCount <= 10) { // 只记录前10个
                addAnomaly(
                    '大额交易',
                    'low',
                    '单笔大额奖励 (>500 MC)',
                    {
                        user: event.args.user,
                        from: event.args.from,
                        mcAmount: ethers.formatEther(mcAmount),
                        rewardType: event.args.rewardType,
                        blockNumber: event.blockNumber
                    }
                );
            }
        }
    }
    console.log(`    大额奖励 (>500 MC): ${largeRewardCount} 笔\n`);

    // ============================================
    // 8. 检查等级与团队人数是否匹配
    // ============================================
    console.log("🏅 第八阶段: 检查等级与团队人数...\n");

    const levelRequirements = [
        { level: 0, minTeam: 0 },
        { level: 1, minTeam: 10 },
        { level: 2, minTeam: 30 },
        { level: 3, minTeam: 100 },
        { level: 4, minTeam: 300 },
        { level: 5, minTeam: 1000 },
        { level: 6, minTeam: 3000 },
        { level: 7, minTeam: 10000 },
        { level: 8, minTeam: 30000 },
        { level: 9, minTeam: 100000 },
    ];

    let levelMismatchCount = 0;
    const sampleForLevel = uniqueUsers.slice(0, Math.min(50, uniqueUsers.length));
    
    for (const user of sampleForLevel) {
        try {
            const levelInfo = await protocol.getUserLevel(user);
            const userData = userDataMap.get(user.toLowerCase());
            
            if (userData) {
                const actualLevel = Number(levelInfo.level);
                const teamCount = userData.teamCount;
                
                // 计算应该的等级
                let expectedLevel = 0;
                for (const req of levelRequirements) {
                    if (teamCount >= req.minTeam) {
                        expectedLevel = req.level;
                    }
                }
                
                if (actualLevel !== expectedLevel) {
                    levelMismatchCount++;
                    addAnomaly(
                        '等级异常',
                        'medium',
                        '等级与团队人数不匹配',
                        {
                            user,
                            teamCount,
                            actualLevel,
                            expectedLevel
                        }
                    );
                }
            }
        } catch (e) {
            // Skip
        }
    }
    console.log(`    等级不匹配: ${levelMismatchCount} 个\n`);

    // ============================================
    // 输出报告
    // ============================================
    console.log("\n" + "=".repeat(80));
    console.log("📋 异常调研报告汇总");
    console.log("=".repeat(80) + "\n");

    // 按严重程度分类统计
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    const highAnomalies = anomalies.filter(a => a.severity === 'high');
    const mediumAnomalies = anomalies.filter(a => a.severity === 'medium');
    const lowAnomalies = anomalies.filter(a => a.severity === 'low');

    console.log("📊 异常统计:");
    console.log(`  🔴 严重 (Critical): ${criticalAnomalies.length} 个`);
    console.log(`  🟠 高危 (High): ${highAnomalies.length} 个`);
    console.log(`  🟡 中等 (Medium): ${mediumAnomalies.length} 个`);
    console.log(`  🟢 低危 (Low): ${lowAnomalies.length} 个`);
    console.log(`  总计: ${anomalies.length} 个异常\n`);

    // 输出严重和高危异常详情
    if (criticalAnomalies.length > 0) {
        console.log("\n🔴 严重异常详情:");
        console.log("-".repeat(80));
        for (const a of criticalAnomalies.slice(0, 20)) {
            console.log(`\n  [${a.category}] ${a.description}`);
            console.log(`  详情: ${JSON.stringify(a.details, null, 2).split('\n').map(l => '    ' + l).join('\n')}`);
        }
        if (criticalAnomalies.length > 20) {
            console.log(`\n  ... 还有 ${criticalAnomalies.length - 20} 个严重异常`);
        }
    }

    if (highAnomalies.length > 0) {
        console.log("\n🟠 高危异常详情:");
        console.log("-".repeat(80));
        for (const a of highAnomalies.slice(0, 10)) {
            console.log(`\n  [${a.category}] ${a.description}`);
            console.log(`  详情: ${JSON.stringify(a.details, null, 2).split('\n').map(l => '    ' + l).join('\n')}`);
        }
        if (highAnomalies.length > 10) {
            console.log(`\n  ... 还有 ${highAnomalies.length - 10} 个高危异常`);
        }
    }

    // 按类别统计
    console.log("\n\n📂 按类别统计:");
    console.log("-".repeat(80));
    const categories = {};
    for (const a of anomalies) {
        categories[a.category] = (categories[a.category] || 0) + 1;
    }
    for (const [cat, count] of Object.entries(categories)) {
        console.log(`  ${cat}: ${count} 个`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 深度调研完成");
    console.log("=".repeat(80));

    // 返回异常数据供进一步分析
    return anomalies;
}

deepInvestigation().catch(console.error);


