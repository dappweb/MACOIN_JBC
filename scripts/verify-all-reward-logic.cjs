/**
 * 全面验证所有用户奖励是否符合推荐逻辑
 * 
 * 检查项目：
 * 1. 直推奖励 (REWARD_DIRECT=2): 25% 门票金额，仅发给活跃推荐人
 * 2. 层级奖励 (REWARD_LEVEL=3): 每层1%，最多15层，根据有效直推解锁层数
 * 3. 极差奖励 (REWARD_DIFFERENTIAL=4): 根据V等级差额计算
 * 4. 推荐关系完整性：是否存在无推荐人却收到推荐奖励等异常
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function calculateLevel(uint256 teamCount) view returns (uint256 level, uint256 percent)",
    "function getLevelRewardLayers(uint256 activeDirects) view returns (uint256)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function owner() view returns (address)",

    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
    "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)",
    "event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
];

// V等级表
function getLevel(teamCount) {
    const tc = Number(teamCount);
    if (tc >= 100000) return { level: 9, percent: 45 };
    if (tc >= 30000) return { level: 8, percent: 40 };
    if (tc >= 10000) return { level: 7, percent: 35 };
    if (tc >= 3000) return { level: 6, percent: 30 };
    if (tc >= 1000) return { level: 5, percent: 25 };
    if (tc >= 300) return { level: 4, percent: 20 };
    if (tc >= 100) return { level: 3, percent: 15 };
    if (tc >= 30) return { level: 2, percent: 10 };
    if (tc >= 10) return { level: 1, percent: 5 };
    return { level: 0, percent: 0 };
}

// 层级奖励解锁层数
function getLevelRewardLayers(activeDirects) {
    const ad = Number(activeDirects);
    if (ad >= 3) return 15;
    if (ad >= 2) return 10;
    if (ad >= 1) return 5;
    return 0;
}

function shortAddr(addr) {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatMC(wei) {
    return parseFloat(ethers.formatEther(wei)).toFixed(4);
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log("=".repeat(80));
    console.log("全面验证所有用户奖励是否符合推荐逻辑");
    console.log("=".repeat(80));
    console.log(`合约: ${PROTOCOL_ADDRESS}`);
    console.log(`时间: ${new Date().toISOString()}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // ========== 第1步：收集所有用户 ==========
    console.log("【第1步】收集所有用户地址...");
    const users = new Set();
    
    // 新合约事件
    const [newTicketEvents, newBoundEvents] = await Promise.all([
        protocol.queryFilter(protocol.filters.TicketPurchased(), 0).catch(() => []),
        protocol.queryFilter(protocol.filters.BoundReferrer(), 0).catch(() => []),
    ]);

    newTicketEvents.forEach(e => {
        if (e.args?.user) users.add(e.args.user);
    });
    newBoundEvents.forEach(e => {
        if (e.args?.user) users.add(e.args.user);
        if (e.args?.referrer && e.args.referrer !== ethers.ZeroAddress)
            users.add(e.args.referrer);
    });
    console.log(`  新合约: TicketPurchased=${newTicketEvents.length}, BoundReferrer=${newBoundEvents.length}`);

    // 旧合约事件
    const [oldTicketEvents, oldBoundEvents] = await Promise.all([
        oldProtocol.queryFilter(oldProtocol.filters.TicketPurchased(), 0).catch(() => []),
        oldProtocol.queryFilter(oldProtocol.filters.BoundReferrer(), 0).catch(() => []),
    ]);

    oldTicketEvents.forEach(e => {
        if (e.args?.user) users.add(e.args.user);
    });
    oldBoundEvents.forEach(e => {
        if (e.args?.user) users.add(e.args.user);
        if (e.args?.referrer && e.args.referrer !== ethers.ZeroAddress)
            users.add(e.args.referrer);
    });
    console.log(`  旧合约: TicketPurchased=${oldTicketEvents.length}, BoundReferrer=${oldBoundEvents.length}`);

    const userList = Array.from(users).filter(a => a !== ethers.ZeroAddress);
    console.log(`  总用户数: ${userList.length}\n`);

    // ========== 第2步：获取所有用户链上信息 ==========
    console.log("【第2步】批量获取用户链上信息...");
    const userDataMap = {};
    const BATCH = 5;
    for (let i = 0; i < userList.length; i += BATCH) {
        const batch = userList.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (addr) => {
            try {
                const [info, ticket, level, directs] = await Promise.all([
                    protocol.userInfo(addr),
                    protocol.userTicket(addr),
                    protocol.getUserLevel(addr),
                    protocol.getDirectReferrals(addr),
                ]);
                return {
                    addr,
                    referrer: info.referrer,
                    activeDirects: Number(info.activeDirects),
                    teamCount: Number(info.teamCount),
                    totalRevenue: info.totalRevenue,
                    currentCap: info.currentCap,
                    isActive: info.isActive,
                    maxTicketAmount: info.maxTicketAmount,
                    ticketId: Number(ticket.ticketId),
                    ticketAmount: ticket.amount,
                    ticketExited: ticket.exited,
                    level: Number(level.level),
                    percent: Number(level.percent),
                    directReferrals: directs.map(d => d),
                };
            } catch (e) {
                return { addr, error: e.message };
            }
        }));
        results.forEach(r => { userDataMap[r.addr.toLowerCase ? r.addr.toLowerCase() : r.addr] = r; });
        if (i + BATCH < userList.length) await sleep(200);
        process.stdout.write(`\r  已处理 ${Math.min(i + BATCH, userList.length)}/${userList.length} 用户`);
    }
    console.log("\n");

    // 构建推荐关系映射
    const referrerMap = {}; // user -> referrer
    const childrenMap = {}; // referrer -> [users]
    for (const [addr, data] of Object.entries(userDataMap)) {
        if (data.error) continue;
        const ref = data.referrer;
        if (ref && ref !== ethers.ZeroAddress) {
            referrerMap[addr] = ref.toLowerCase();
            const refLower = ref.toLowerCase();
            if (!childrenMap[refLower]) childrenMap[refLower] = [];
            childrenMap[refLower].push(addr);
        }
    }

    // ========== 第3步：获取所有奖励事件 ==========
    console.log("【第3步】获取所有奖励事件...");
    
    // ReferralRewardPaid events (包含所有类型: DIRECT=2, LEVEL=3, DIFFERENTIAL=4)
    const referralRewardEvents = await protocol.queryFilter(
        protocol.filters.ReferralRewardPaid(), 0
    ).catch(() => []);
    console.log(`  ReferralRewardPaid 事件: ${referralRewardEvents.length}`);

    // TicketPurchased events (用于对比直推奖励)
    const ticketEvents = [...newTicketEvents];
    // 构建 ticketId -> {buyer, amount, blockNumber}
    const ticketMap = {};
    ticketEvents.forEach(e => {
        if (e.args) {
            const tid = Number(e.args.ticketId);
            ticketMap[tid] = {
                buyer: e.args.user,
                amount: e.args.amount,
                blockNumber: e.blockNumber,
                txHash: e.transactionHash,
            };
        }
    });

    // DifferentialRewardRecorded events
    const diffRecordedEvents = await protocol.queryFilter(
        protocol.filters.DifferentialRewardRecorded(), 0
    ).catch(() => []);
    console.log(`  DifferentialRewardRecorded 事件: ${diffRecordedEvents.length}`);

    // LiquidityStaked events
    const stakeEvents = await protocol.queryFilter(
        protocol.filters.LiquidityStaked(), 0
    ).catch(() => []);
    console.log(`  LiquidityStaked 事件: ${stakeEvents.length}`);

    // 构建 stakeId -> {user, amount, cycleDays}
    const stakeMap = {};
    stakeEvents.forEach(e => {
        if (e.args) {
            const sid = Number(e.args.stakeId);
            stakeMap[sid] = {
                user: e.args.user,
                amount: e.args.amount,
                cycleDays: Number(e.args.cycleDays),
                blockNumber: e.blockNumber,
            };
        }
    });

    console.log(`  TicketPurchased 记录: ${Object.keys(ticketMap).length}`);
    console.log(`  LiquidityStaked 记录: ${Object.keys(stakeMap).length}\n`);

    // ========== 第4步：分类奖励事件并验证 ==========
    console.log("【第4步】验证所有奖励是否符合推荐逻辑...\n");

    const anomalies = [];

    // 分类事件
    const directRewardEvents = [];
    const levelRewardEvents = [];
    const diffRewardEvents = [];

    referralRewardEvents.forEach(e => {
        if (!e.args) return;
        const rewardType = Number(e.args.rewardType);
        const ev = {
            receiver: e.args.user,        // 奖励接收者（上线）
            from: e.args[1],              // 来源用户（下线）
            mcAmount: e.args.mcAmount,
            jbcAmount: e.args.jbcAmount,
            rewardType,
            ticketId: Number(e.args.ticketId),
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
        };
        if (rewardType === 2) directRewardEvents.push(ev);
        else if (rewardType === 3) levelRewardEvents.push(ev);
        else if (rewardType === 4) diffRewardEvents.push(ev);
    });

    console.log(`  直推奖励事件: ${directRewardEvents.length}`);
    console.log(`  层级奖励事件: ${levelRewardEvents.length}`);
    console.log(`  极差奖励事件: ${diffRewardEvents.length}\n`);

    // ======= 4.1 验证直推奖励 =======
    console.log("--- 4.1 验证直推奖励 (REWARD_DIRECT=2) ---");
    console.log("  规则: 门票金额的25%，发给买票者的直接推荐人，推荐人必须活跃\n");

    let directOk = 0, directAnom = 0;
    for (const ev of directRewardEvents) {
        const receiverLower = ev.receiver.toLowerCase();
        const fromLower = ev.from.toLowerCase();
        const ticket = ticketMap[ev.ticketId];
        const issues = [];

        // 检查1: 接收者是否是来源用户的直接推荐人
        const fromData = userDataMap[fromLower];
        if (fromData && !fromData.error) {
            const actualReferrer = fromData.referrer?.toLowerCase();
            if (actualReferrer !== receiverLower) {
                issues.push(`接收者(${shortAddr(ev.receiver)})不是来源用户(${shortAddr(ev.from)})的直接推荐人(实际推荐人: ${shortAddr(fromData.referrer)})`);
            }
        }

        // 检查2: 金额是否为门票的25%（允许5%误差，因为收入上限截断）
        if (ticket) {
            const expectedMC = ticket.amount * 25n / 100n;
            if (ev.mcAmount > expectedMC) {
                const diff = ev.mcAmount - expectedMC;
                const diffPercent = Number(diff * 10000n / expectedMC) / 100;
                issues.push(`直推奖励金额(${formatMC(ev.mcAmount)} MC)超过门票25%(${formatMC(expectedMC)} MC)，超出${diffPercent}%`);
            }
            // 金额可以小于25%（由于收入上限截断），这是正常的
        }

        // 检查3: 直推奖励应该只有MC，没有JBC
        if (ev.jbcAmount > 0n) {
            issues.push(`直推奖励包含JBC(${formatMC(ev.jbcAmount)})，直推奖励应纯MC发放`);
        }

        if (issues.length > 0) {
            directAnom++;
            anomalies.push({
                type: "直推奖励",
                receiver: ev.receiver,
                from: ev.from,
                ticketId: ev.ticketId,
                mcAmount: formatMC(ev.mcAmount),
                block: ev.blockNumber,
                txHash: ev.txHash,
                issues,
            });
        } else {
            directOk++;
        }
    }
    console.log(`  ✅ 符合逻辑: ${directOk}笔`);
    console.log(`  ❌ 异常: ${directAnom}笔\n`);

    // ======= 4.2 验证买票时是否所有应得直推奖励都发放了 =======
    console.log("--- 4.2 验证每笔门票的直推奖励发放情况 ---");
    console.log("  规则: 每笔买票，若推荐人活跃，应发放25%直推奖励\n");

    // 为每张票查找对应的直推奖励
    const ticketDirectRewardMap = {};
    directRewardEvents.forEach(ev => {
        if (!ticketDirectRewardMap[ev.ticketId]) ticketDirectRewardMap[ev.ticketId] = [];
        ticketDirectRewardMap[ev.ticketId].push(ev);
    });

    let missingDirectCount = 0;
    const missingDirectRewards = [];
    for (const [tidStr, ticket] of Object.entries(ticketMap)) {
        const tid = Number(tidStr);
        const buyerLower = ticket.buyer.toLowerCase();
        const buyerData = userDataMap[buyerLower];
        if (!buyerData || buyerData.error) continue;

        const referrerAddr = buyerData.referrer;
        if (!referrerAddr || referrerAddr === ethers.ZeroAddress) continue; // 没有推荐人，不需发直推奖

        const rewards = ticketDirectRewardMap[tid] || [];

        if (rewards.length === 0) {
            // 没有直推奖励事件 - 可能推荐人当时不活跃
            // 需要检查推荐人当前状态（注：这无法完全还原历史状态）
            const refData = userDataMap[referrerAddr.toLowerCase()];
            missingDirectCount++;
            missingDirectRewards.push({
                ticketId: tid,
                buyer: ticket.buyer,
                referrer: referrerAddr,
                ticketAmount: formatMC(ticket.amount),
                expectedReward: formatMC(ticket.amount * 25n / 100n),
                referrerCurrentlyActive: refData?.isActive ?? "unknown",
                reason: refData?.isActive
                    ? "推荐人当前活跃但未收到直推奖励（可能购票时不活跃，或收入已到上限）"
                    : "推荐人当前不活跃（购票时可能也不活跃，奖励转入市场基金）",
            });
        }
    }
    console.log(`  缺失直推奖励的门票: ${missingDirectCount}张\n`);

    // ======= 4.3 验证层级奖励 =======
    console.log("--- 4.3 验证层级奖励 (REWARD_LEVEL=3) ---");
    console.log("  规则: 每层1%门票金额, 沿推荐链向上最多15层");
    console.log("  有效直推>=1→5层, >=2→10层, >=3→15层\n");

    // 按 ticketId 分组层级奖励
    const ticketLevelRewardMap = {};
    levelRewardEvents.forEach(ev => {
        if (!ticketLevelRewardMap[ev.ticketId]) ticketLevelRewardMap[ev.ticketId] = [];
        ticketLevelRewardMap[ev.ticketId].push(ev);
    });

    let levelOk = 0, levelAnom = 0;
    const levelAnomalies = [];

    for (const [tidStr, rewards] of Object.entries(ticketLevelRewardMap)) {
        const tid = Number(tidStr);
        const ticket = ticketMap[tid];
        if (!ticket) continue;

        const buyerLower = ticket.buyer.toLowerCase();
        const perLayerReward = ticket.amount / 100n; // 1%

        // 模拟沿推荐链向上走
        let current = buyerLower;
        const expectedReceivers = [];
        let layerCount = 0;
        let iterations = 0;

        while (layerCount < 15 && iterations < 20) {
            iterations++;
            const ref = referrerMap[current];
            if (!ref) break;

            const refData = userDataMap[ref];
            if (!refData || refData.error) { current = ref; continue; }

            // 不活跃的上线：跳过（不消耗层数）
            if (!refData.isActive) {
                current = ref;
                continue;
            }

            // 活跃上线：消耗一层
            layerCount++;
            const maxLayers = getLevelRewardLayers(refData.activeDirects);
            if (maxLayers >= layerCount) {
                expectedReceivers.push({ addr: ref, layer: layerCount, maxLayers });
            }
            current = ref;
        }

        // 检查实际接收者
        const actualReceivers = rewards.map(r => r.receiver.toLowerCase());
        const issues = [];

        // 检查每笔奖励金额（应约为1%）
        for (const r of rewards) {
            if (r.mcAmount > perLayerReward + perLayerReward / 10n) { // 允许10%误差
                issues.push(`层级奖励金额(${formatMC(r.mcAmount)})超过1%预期(${formatMC(perLayerReward)}) -> ${shortAddr(r.receiver)}`);
            }
        }

        // 检查收到奖励的人是否在推荐链上
        for (const r of rewards) {
            const rLower = r.receiver.toLowerCase();
            // 验证接收者在推荐链上
            let onChain = false;
            let cur = buyerLower;
            for (let j = 0; j < 20; j++) {
                const ref = referrerMap[cur];
                if (!ref) break;
                if (ref === rLower) { onChain = true; break; }
                cur = ref;
            }
            if (!onChain) {
                issues.push(`接收者(${shortAddr(r.receiver)})不在买票者(${shortAddr(ticket.buyer)})的推荐链上`);
            }
        }

        // 检查是否JBC应该为0（层级奖励纯MC发放）
        for (const r of rewards) {
            if (r.jbcAmount > 0n) {
                issues.push(`层级奖励包含JBC(${formatMC(r.jbcAmount)}) -> ${shortAddr(r.receiver)}, 应纯MC发放`);
            }
        }

        if (issues.length > 0) {
            levelAnom++;
            levelAnomalies.push({
                type: "层级奖励",
                ticketId: tid,
                buyer: ticket.buyer,
                ticketAmount: formatMC(ticket.amount),
                actualRewardsCount: rewards.length,
                expectedReceiversCount: expectedReceivers.length,
                issues,
            });
        } else {
            levelOk++;
        }
    }
    console.log(`  ✅ 符合逻辑: ${levelOk}张票`);
    console.log(`  ❌ 异常: ${levelAnom}张票\n`);
    anomalies.push(...levelAnomalies);

    // ======= 4.4 验证极差奖励 =======
    console.log("--- 4.4 验证极差奖励 (REWARD_DIFFERENTIAL=4) ---");
    console.log("  规则: 质押时沿推荐链向上，活跃上线V等级差额 × min(质押额,上线门票额)\n");

    // 按 stakeId 分组极差奖励记录
    const stakeDiffRecordMap = {};
    diffRecordedEvents.forEach(e => {
        if (!e.args) return;
        const sid = Number(e.args.stakeId);
        if (!stakeDiffRecordMap[sid]) stakeDiffRecordMap[sid] = [];
        stakeDiffRecordMap[sid].push({
            stakeId: sid,
            upline: e.args.upline,
            amount: e.args.amount,
            blockNumber: e.blockNumber,
        });
    });

    // 已发放的极差奖励
    const stakeDiffReleasedMap = {};
    diffRewardEvents.forEach(ev => {
        const rLower = ev.receiver.toLowerCase();
        if (!stakeDiffReleasedMap[rLower]) stakeDiffReleasedMap[rLower] = [];
        stakeDiffReleasedMap[rLower].push(ev);
    });

    let diffOk = 0, diffAnom = 0;
    const diffAnomalies = [];

    for (const [sidStr, records] of Object.entries(stakeDiffRecordMap)) {
        const sid = Number(sidStr);
        const stake = stakeMap[sid];
        if (!stake) continue;

        const stakerLower = stake.user.toLowerCase();
        const issues = [];

        for (const rec of records) {
            const uplineLower = rec.upline.toLowerCase();
            const uplineData = userDataMap[uplineLower];

            // 检查1: 上线是否在推荐链上
            let onChain = false;
            let cur = stakerLower;
            for (let j = 0; j < 20; j++) {
                const ref = referrerMap[cur];
                if (!ref) break;
                if (ref === uplineLower) { onChain = true; break; }
                cur = ref;
            }
            if (!onChain) {
                issues.push(`极差奖励接收者(${shortAddr(rec.upline)})不在质押者(${shortAddr(stake.user)})的推荐链上`);
            }

            // 检查2: 金额上限 = min(质押额, 上线门票额) × 等级百分比
            if (uplineData && !uplineData.error) {
                const uplineTicketAmt = uplineData.ticketAmount || 0n;
                const baseAmount = stake.amount < uplineTicketAmt ? stake.amount : uplineTicketAmt;
                const maxPossibleReward = baseAmount * BigInt(uplineData.percent) / 100n;

                if (rec.amount > maxPossibleReward && maxPossibleReward > 0n) {
                    const exceedPct = Number((rec.amount - maxPossibleReward) * 10000n / maxPossibleReward) / 100;
                    // 允许20%容差（因为等级在质押后可能变化）
                    if (exceedPct > 20) {
                        issues.push(`极差奖励(${formatMC(rec.amount)})超过最大可能(${formatMC(maxPossibleReward)}), 超出${exceedPct}%, 上线V${uplineData.level}(${uplineData.percent}%), 上线门票${formatMC(uplineTicketAmt)}`);
                    }
                }
            }
        }

        if (issues.length > 0) {
            diffAnom++;
            diffAnomalies.push({
                type: "极差奖励",
                stakeId: sid,
                staker: stake.user,
                stakeAmount: formatMC(stake.amount),
                cycleDays: stake.cycleDays,
                recordsCount: records.length,
                issues,
            });
        } else {
            diffOk++;
        }
    }
    console.log(`  ✅ 符合逻辑: ${diffOk}笔质押`);
    console.log(`  ❌ 异常: ${diffAnom}笔质押\n`);
    anomalies.push(...diffAnomalies);

    // ======= 4.5 验证推荐关系一致性 =======
    console.log("--- 4.5 验证推荐关系一致性 ---");
    console.log("  检查: 链上referrer与推荐事件是否一致\n");

    const refAnomalies = [];

    // 构建事件记录的绑定关系
    const boundFromEvents = {}; // user -> referrer (from events)
    newBoundEvents.forEach(e => {
        if (e.args?.user && e.args?.referrer) {
            boundFromEvents[e.args.user.toLowerCase()] = e.args.referrer.toLowerCase();
        }
    });
    oldBoundEvents.forEach(e => {
        if (e.args?.user && e.args?.referrer) {
            // 如果新合约没有记录，用旧合约的
            const uLower = e.args.user.toLowerCase();
            if (!boundFromEvents[uLower]) {
                boundFromEvents[uLower] = e.args.referrer.toLowerCase();
            }
        }
    });

    for (const [addr, data] of Object.entries(userDataMap)) {
        if (data.error) continue;
        const onChainRef = data.referrer?.toLowerCase();
        if (!onChainRef || onChainRef === ethers.ZeroAddress.toLowerCase()) continue;

        // 检查: 有推荐人但推荐人不在用户列表中
        if (!userDataMap[onChainRef]) {
            refAnomalies.push({
                type: "推荐关系",
                user: data.addr,
                issues: [`推荐人(${shortAddr(data.referrer)})不在已知用户列表中`],
            });
        }

        // 检查: 推荐人的directReferrals是否包含此用户
        const refData = userDataMap[onChainRef];
        if (refData && !refData.error) {
            const directs = refData.directReferrals?.map(d => d.toLowerCase()) || [];
            if (!directs.includes(addr.toLowerCase())) {
                refAnomalies.push({
                    type: "推荐关系",
                    user: data.addr,
                    issues: [`用户的推荐人是${shortAddr(data.referrer)}, 但该推荐人的directReferrals列表不包含此用户`],
                });
            }
        }

        // 检查: 自我推荐
        if (onChainRef === addr.toLowerCase()) {
            refAnomalies.push({
                type: "推荐关系",
                user: data.addr,
                issues: ["自我推荐（推荐人是自己）"],
            });
        }
    }

    // 检查循环引用
    console.log("  检查循环推荐...");
    for (const [addr, data] of Object.entries(userDataMap)) {
        if (data.error) continue;
        const seen = new Set();
        let cur = addr.toLowerCase();
        let depth = 0;
        while (depth < 50) {
            if (seen.has(cur)) {
                refAnomalies.push({
                    type: "推荐关系",
                    user: data.addr,
                    issues: [`检测到循环推荐，深度${depth}处回到${shortAddr(cur)}`],
                });
                break;
            }
            seen.add(cur);
            const ref = referrerMap[cur];
            if (!ref) break;
            cur = ref;
            depth++;
        }
    }

    console.log(`  推荐关系异常: ${refAnomalies.length}个\n`);
    anomalies.push(...refAnomalies);

    // ======= 4.6 验证收到奖励但无推荐下线的用户 =======
    console.log("--- 4.6 验证收到推荐奖励但无推荐下线的用户 ---\n");

    const rewardReceivers = new Set();
    referralRewardEvents.forEach(ev => {
        if (ev.args?.user) rewardReceivers.add(ev.args.user.toLowerCase());
    });

    const noChildrenButReward = [];
    for (const rAddr of rewardReceivers) {
        const data = userDataMap[rAddr];
        if (!data || data.error) continue;
        const children = childrenMap[rAddr] || [];
        if (children.length === 0 && data.directReferrals?.length === 0) {
            // 收到了推荐奖励但没有任何下线
            const receivedEvents = referralRewardEvents.filter(
                ev => ev.args?.user?.toLowerCase() === rAddr
            );
            noChildrenButReward.push({
                type: "推荐奖励异常",
                user: data.addr,
                rewardEventsCount: receivedEvents.length,
                issues: [`此用户收到${receivedEvents.length}笔推荐相关奖励，但没有任何下线推荐关系`],
            });
        }
    }
    console.log(`  无下线但收到推荐奖励: ${noChildrenButReward.length}个\n`);
    anomalies.push(...noChildrenButReward);

    // ======= 4.7 检查收入超过上限的用户 =======
    console.log("--- 4.7 检查收入溢出（totalRevenue > currentCap） ---\n");

    const overCapUsers = [];
    for (const [addr, data] of Object.entries(userDataMap)) {
        if (data.error) continue;
        if (data.currentCap > 0n && data.totalRevenue > data.currentCap) {
            const overflow = data.totalRevenue - data.currentCap;
            overCapUsers.push({
                type: "收入溢出",
                user: data.addr,
                totalRevenue: formatMC(data.totalRevenue),
                currentCap: formatMC(data.currentCap),
                overflow: formatMC(overflow),
                isActive: data.isActive,
                issues: [`总收入(${formatMC(data.totalRevenue)})超过上限(${formatMC(data.currentCap)})，溢出${formatMC(overflow)} MC`],
            });
        }
    }
    console.log(`  收入溢出用户: ${overCapUsers.length}个\n`);
    anomalies.push(...overCapUsers);

    // ========== 第5步：汇总输出报告 ==========
    console.log("=".repeat(80));
    console.log("汇总报告");
    console.log("=".repeat(80));
    console.log(`总用户数: ${userList.length}`);
    console.log(`总奖励事件: ${referralRewardEvents.length}`);
    console.log(`  - 直推奖励: ${directRewardEvents.length} (异常: ${directAnom})`);
    console.log(`  - 层级奖励: ${levelRewardEvents.length} (异常: ${levelAnom})`);
    console.log(`  - 极差奖励: ${diffRewardEvents.length} (异常: ${diffAnom})`);
    console.log(`缺失直推奖励的门票: ${missingDirectCount}张`);
    console.log(`推荐关系异常: ${refAnomalies.length}个`);
    console.log(`无下线但收到奖励: ${noChildrenButReward.length}个`);
    console.log(`收入溢出用户: ${overCapUsers.length}个`);
    console.log(`\n总异常数: ${anomalies.length}`);

    // 详细输出
    if (anomalies.length > 0) {
        console.log("\n" + "=".repeat(80));
        console.log("异常详情");
        console.log("=".repeat(80));

        // 按类型分组
        const byType = {};
        anomalies.forEach(a => {
            if (!byType[a.type]) byType[a.type] = [];
            byType[a.type].push(a);
        });

        for (const [type, items] of Object.entries(byType)) {
            console.log(`\n【${type}】- ${items.length}个异常`);
            console.log("-".repeat(60));
            items.forEach((item, idx) => {
                console.log(`\n  #${idx + 1}`);
                if (item.user) console.log(`  用户: ${item.user}`);
                if (item.receiver) console.log(`  接收者: ${item.receiver}`);
                if (item.from) console.log(`  来源: ${item.from}`);
                if (item.buyer) console.log(`  买票者: ${item.buyer}`);
                if (item.staker) console.log(`  质押者: ${item.staker}`);
                if (item.ticketId !== undefined) console.log(`  门票ID: ${item.ticketId}`);
                if (item.stakeId !== undefined) console.log(`  质押ID: ${item.stakeId}`);
                if (item.ticketAmount) console.log(`  门票金额: ${item.ticketAmount} MC`);
                if (item.stakeAmount) console.log(`  质押金额: ${item.stakeAmount} MC`);
                if (item.mcAmount) console.log(`  奖励MC: ${item.mcAmount}`);
                if (item.totalRevenue) console.log(`  总收入: ${item.totalRevenue} MC`);
                if (item.currentCap) console.log(`  收入上限: ${item.currentCap} MC`);
                if (item.overflow) console.log(`  溢出: ${item.overflow} MC`);
                if (item.issues) {
                    item.issues.forEach(issue => {
                        console.log(`  ⚠️  ${issue}`);
                    });
                }
            });
        }
    }

    // 输出缺失直推奖励详情
    if (missingDirectRewards.length > 0) {
        console.log(`\n\n【缺失直推奖励详情（前30条）】`);
        console.log("-".repeat(60));
        missingDirectRewards.slice(0, 30).forEach((item, idx) => {
            console.log(`  #${idx + 1} 门票ID: ${item.ticketId}, 买票者: ${shortAddr(item.buyer)}, 推荐人: ${shortAddr(item.referrer)}, 门票: ${item.ticketAmount} MC, 应得: ${item.expectedReward} MC`);
            console.log(`     推荐人当前活跃: ${item.referrerCurrentlyActive}, 原因: ${item.reason}`);
        });
        if (missingDirectRewards.length > 30) {
            console.log(`  ... 还有 ${missingDirectRewards.length - 30} 条`);
        }
    }

    // 保存完整报告到文件
    const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
            totalUsers: userList.length,
            totalRewardEvents: referralRewardEvents.length,
            directRewards: { total: directRewardEvents.length, ok: directOk, anomalies: directAnom },
            levelRewards: { total: levelRewardEvents.length, ok: levelOk, anomalies: levelAnom },
            differentialRewards: { total: diffRewardEvents.length, ok: diffOk, anomalies: diffAnom },
            missingDirectRewards: missingDirectCount,
            referralAnomalies: refAnomalies.length,
            noChildrenButReward: noChildrenButReward.length,
            overCapUsers: overCapUsers.length,
            totalAnomalies: anomalies.length,
        },
        anomalies,
        missingDirectRewards: missingDirectRewards,
    };

    const outputDir = path.join(__dirname, "..", "output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `reward-logic-verification-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(reportData, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));
    console.log(`\n\n完整报告已保存: ${outputFile}`);
}

main().catch(e => {
    console.error("脚本执行失败:", e);
    process.exit(1);
});
