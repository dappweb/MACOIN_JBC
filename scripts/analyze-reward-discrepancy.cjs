const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

const REWARD_TYPE_NAMES = {
    0: '直推奖励 (Direct)',
    1: '层级奖励 (Tier)',
    2: '等级奖励 (Level)',
    3: '差异奖励 (Differential)',
    4: '极差奖励 (Gap)'
};

async function analyzeRewardDiscrepancy() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // 用户反馈的地址
    const complainingUser = "0x0F1868dA5C4Fe2Bf3a5fa56fFf51304aE3624d24";
    const comparisonUser = "0xD0826C698741dca45b14bAa4f42d352F06415FB5";

    console.log("🔍 奖励差异分析报告\n");
    console.log("=".repeat(80));
    console.log(`分析时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    // 获取两个用户的基本信息
    console.log("📋 用户基本信息对比:");
    console.log("-".repeat(80));
    
    const userInfo1 = await protocol.userInfo(complainingUser);
    const userInfo2 = await protocol.userInfo(comparisonUser);
    const ticket1 = await protocol.userTicket(complainingUser);
    const ticket2 = await protocol.userTicket(comparisonUser);
    
    let level1, level2;
    try {
        level1 = await protocol.getUserLevel(complainingUser);
        level2 = await protocol.getUserLevel(comparisonUser);
    } catch (e) {}

    console.log(`
┌──────────────────────────────────────┬──────────────────────────────────────┐
│ 用户1 (反馈问题的用户)                │ 用户2 (对比用户)                       │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 地址: ${complainingUser.slice(0,10)}...${complainingUser.slice(-8)}      │ 地址: ${comparisonUser.slice(0,10)}...${comparisonUser.slice(-8)}      │
│ 门票: ${ethers.formatEther(ticket1.amount).padEnd(20)} MC      │ 门票: ${ethers.formatEther(ticket2.amount).padEnd(20)} MC      │
│ 等级: V${level1?.level || '?'} (${level1 ? (Number(level1.percent)/100).toFixed(2) : '?'}%)               │ 等级: V${level2?.level || '?'} (${level2 ? (Number(level2.percent)/100).toFixed(2) : '?'}%)               │
│ 团队: ${userInfo1.teamCount.toString().padEnd(20)}人      │ 团队: ${userInfo2.teamCount.toString().padEnd(20)}人      │
│ 总收益: ${ethers.formatEther(userInfo1.totalRevenue).padEnd(18)} MC      │ 总收益: ${ethers.formatEther(userInfo2.totalRevenue).padEnd(18)} MC      │
│ 上限: ${ethers.formatEther(userInfo1.currentCap).padEnd(20)} MC      │ 上限: ${ethers.formatEther(userInfo2.currentCap).padEnd(20)} MC      │
└──────────────────────────────────────┴──────────────────────────────────────┘
`);

    // 获取所有奖励事件并按类型统计
    console.log("\n📊 奖励类型统计:");
    console.log("-".repeat(80));

    const rewards1 = await protocol.queryFilter(protocol.filters.ReferralRewardPaid(complainingUser));
    const rewards2 = await protocol.queryFilter(protocol.filters.ReferralRewardPaid(comparisonUser));

    const stats1 = { total: 0n, byType: {} };
    const stats2 = { total: 0n, byType: {} };

    for (const event of rewards1) {
        const mc = event.args.mcAmount;
        const type = event.args.rewardType;
        stats1.total += mc;
        stats1.byType[type] = (stats1.byType[type] || 0n) + mc;
    }

    for (const event of rewards2) {
        const mc = event.args.mcAmount;
        const type = event.args.rewardType;
        stats2.total += mc;
        stats2.byType[type] = (stats2.byType[type] || 0n) + mc;
    }

    console.log(`
用户1 (${complainingUser.slice(0,10)}...) 奖励统计:
  总计: ${ethers.formatEther(stats1.total)} MC (${rewards1.length} 笔)`);
    for (const [type, amount] of Object.entries(stats1.byType)) {
        console.log(`  类型 ${type} (${REWARD_TYPE_NAMES[type] || '未知'}): ${ethers.formatEther(amount)} MC`);
    }

    console.log(`
用户2 (${comparisonUser.slice(0,10)}...) 奖励统计:
  总计: ${ethers.formatEther(stats2.total)} MC (${rewards2.length} 笔)`);
    for (const [type, amount] of Object.entries(stats2.byType)) {
        console.log(`  类型 ${type} (${REWARD_TYPE_NAMES[type] || '未知'}): ${ethers.formatEther(amount)} MC`);
    }

    // 查找最近的门票购买事件
    console.log("\n\n📅 最近门票购买及奖励分配分析:");
    console.log("-".repeat(80));

    const ticketEvents = await protocol.queryFilter(protocol.filters.TicketPurchased());
    const recentTickets = ticketEvents.slice(-20); // 最近20笔

    for (const ticketEvent of recentTickets.reverse()) {
        const buyer = ticketEvent.args.user;
        const amount = ticketEvent.args.amount;
        const ticketId = ticketEvent.args.ticketId;
        
        // 获取该门票产生的奖励
        const allRewards = await protocol.queryFilter(protocol.filters.ReferralRewardPaid());
        const ticketRewards = allRewards.filter(r => 
            r.args.from.toLowerCase() === buyer.toLowerCase() &&
            r.blockNumber === ticketEvent.blockNumber
        );

        if (ticketRewards.length > 0) {
            const block = await provider.getBlock(ticketEvent.blockNumber);
            const blockTime = new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN');
            
            // 检查是否给了用户1或用户2奖励
            const reward1 = ticketRewards.filter(r => r.args.user.toLowerCase() === complainingUser.toLowerCase());
            const reward2 = ticketRewards.filter(r => r.args.user.toLowerCase() === comparisonUser.toLowerCase());
            
            if (reward1.length > 0 || reward2.length > 0) {
                console.log(`\n🎫 门票购买: ${ethers.formatEther(amount)} MC`);
                console.log(`   购买者: ${buyer}`);
                console.log(`   时间: ${blockTime} (区块 ${ticketEvent.blockNumber})`);
                console.log(`   门票ID: ${ticketId}`);
                
                if (reward1.length > 0) {
                    console.log(`   → 用户1收到:`);
                    for (const r of reward1) {
                        console.log(`      ${ethers.formatEther(r.args.mcAmount)} MC (类型: ${REWARD_TYPE_NAMES[r.args.rewardType]})`);
                    }
                }
                
                if (reward2.length > 0) {
                    console.log(`   → 用户2收到:`);
                    for (const r of reward2) {
                        console.log(`      ${ethers.formatEther(r.args.mcAmount)} MC (类型: ${REWARD_TYPE_NAMES[r.args.rewardType]})`);
                    }
                }
                
                // 显示所有该门票的奖励分配
                if (ticketRewards.length > 0) {
                    console.log(`   完整奖励分配 (共 ${ticketRewards.length} 笔):`);
                    for (const r of ticketRewards) {
                        const isUser1 = r.args.user.toLowerCase() === complainingUser.toLowerCase();
                        const isUser2 = r.args.user.toLowerCase() === comparisonUser.toLowerCase();
                        const marker = isUser1 ? ' ★用户1' : (isUser2 ? ' ★用户2' : '');
                        console.log(`      ${r.args.user.slice(0,10)}...: ${ethers.formatEther(r.args.mcAmount)} MC (${REWARD_TYPE_NAMES[r.args.rewardType]})${marker}`);
                    }
                }
            }
        }
    }

    // 分析推荐链
    console.log("\n\n🔗 推荐链分析:");
    console.log("-".repeat(80));
    
    console.log("\n用户1的上线链:");
    let current = complainingUser;
    let depth = 0;
    while (current !== ethers.ZeroAddress && depth < 10) {
        const info = await protocol.userInfo(current);
        let levelInfo;
        try { levelInfo = await protocol.getUserLevel(current); } catch {}
        const ticket = await protocol.userTicket(current);
        console.log(`  ${depth === 0 ? '→' : '  '} L${depth}: ${current.slice(0,10)}...${current.slice(-8)} | 门票: ${ethers.formatEther(ticket.amount)} MC | 等级: V${levelInfo?.level || '?'} | 团队: ${info.teamCount}`);
        current = info.referrer;
        depth++;
    }

    console.log("\n用户2的上线链:");
    current = comparisonUser;
    depth = 0;
    while (current !== ethers.ZeroAddress && depth < 10) {
        const info = await protocol.userInfo(current);
        let levelInfo;
        try { levelInfo = await protocol.getUserLevel(current); } catch {}
        const ticket = await protocol.userTicket(current);
        console.log(`  ${depth === 0 ? '→' : '  '} L${depth}: ${current.slice(0,10)}...${current.slice(-8)} | 门票: ${ethers.formatEther(ticket.amount)} MC | 等级: V${levelInfo?.level || '?'} | 团队: ${info.teamCount}`);
        current = info.referrer;
        depth++;
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 分析完成");
}

analyzeRewardDiscrepancy().catch(console.error);



