/**
 * 检查 0x16534F0Dae6602c8E20d25000F9691C9b7A68462 极差奖励问题，给出问题细节
 * 用法: node scripts/check-user-16534-differential.cjs
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const USER = "0x16534F0Dae6602c8E20d25000F9691C9b7A68462".toLowerCase();

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
    "event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)",
];

async function getStakes(protocol, address) {
    const list = [];
    for (let i = 0; i < 50; i++) {
        try {
            const s = await protocol.userStakes(address, i);
            if (Number(s.id) > 0) list.push({ id: Number(s.id), amount: s.amount, startTime: Number(s.startTime), cycleDays: Number(s.cycleDays), active: s.active });
            else break;
        } catch (_) {
            break;
        }
    }
    return list;
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    console.log("🔍 检查用户极差奖励问题\n");
    console.log("地址:", USER);
    console.log("协议:", PROTOCOL_ADDRESS);
    console.log("区块:", currentBlock);
    console.log("=".repeat(70) + "\n");

    const [userInfo, ticket, level, directReferrals] = await Promise.all([
        protocol.userInfo(USER),
        protocol.userTicket(USER),
        protocol.getUserLevel(USER).catch(() => ({ level: 0, percent: 0, teamCount: 0n })),
        protocol.getDirectReferrals(USER),
    ]);

    const referrer = String(userInfo.referrer || "").toLowerCase();
    const teamCount = Number(userInfo.teamCount ?? 0);
    const isActive = userInfo.isActive ?? false;
    const ticketAmount = ticket.amount ?? 0n;
    const ticketExited = ticket.exited ?? false;
    const levelNum = Number(level.level ?? 0);
    const percent = Number(level.percent ?? 0);
    const refs = (directReferrals || []).map((a) => String(a).toLowerCase());

    console.log("【一、账户当前状态】");
    console.log("  推荐人:", referrer || "无");
    console.log("  直推数:", refs.length);
    console.log("  团队人数:", teamCount);
    console.log("  是否激活(isActive):", isActive);
    console.log("  门票金额:", ethers.formatEther(ticketAmount), "MC");
    console.log("  门票已退出:", ticketExited);
    console.log("  等级: V" + levelNum);
    console.log("  极差比例:", percent + "%");
    console.log("  累计收益(totalRevenue):", ethers.formatEther(userInfo.totalRevenue || 0n), "MC");
    console.log("  收益上限(currentCap):", ethers.formatEther(userInfo.currentCap || 0n), "MC");
    console.log("");

    const refPaid = await protocol.queryFilter(protocol.filters.ReferralRewardPaid(USER), fromBlock, currentBlock);
    const diffDist = await protocol.queryFilter(protocol.filters.DifferentialRewardDistributed(USER), fromBlock, currentBlock);
    const refPaidType3 = refPaid.filter((e) => e.args && Number(e.args.rewardType) === 3);

    console.log("【二、极差相关链上事件】");
    console.log("  ReferralRewardPaid(本地址为user) 总条数:", refPaid.length);
    console.log("  其中 rewardType=3(极差) 条数:", refPaidType3.length);
    console.log("  DifferentialRewardDistributed(本地址) 条数:", diffDist.length);
    if (refPaidType3.length > 0) {
        console.log("  极差发放记录(最近3条):");
        refPaidType3.slice(-3).forEach((e, i) => {
            console.log("    ", i + 1, "from:", e.args.from, "mc:", ethers.formatEther(e.args.mcAmount || 0n), "jbc:", ethers.formatEther(e.args.jbcAmount || 0n));
        });
    }
    // 11 条 DifferentialRewardDistributed 完整细节（含触发账户 = 调用 claimRewards 的账户）
    if (diffDist.length > 0) {
        console.log("\n  【DifferentialRewardDistributed 共 " + diffDist.length + " 条明细（含触发账户）】");
        for (let i = 0; i < diffDist.length; i++) {
            const e = diffDist[i];
            const a = e.args || {};
            const mc = ethers.formatEther(a.mcAmount || 0n);
            const jbc = ethers.formatEther(a.jbcAmount || 0n);
            const ts = Number(a.timestamp || 0);
            const timeStr = ts ? new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) : "-";
            let triggerAccount = "-";
            try {
                const tx = await provider.getTransaction(e.transactionHash);
                if (tx && tx.from) triggerAccount = tx.from.toLowerCase();
            } catch (_) {}
            console.log("    条" + (i + 1) + ": 区块 " + e.blockNumber + " | MC " + mc + " | JBC " + jbc + " | 时间 " + timeStr + " | 触发账户 " + triggerAccount + " | 交易 " + (e.transactionHash || ""));
        }
    }
    console.log("");

    console.log("【三、直推列表及质押情况】");
    const SECONDS_IN_UNIT = 86400;
    for (let i = 0; i < refs.length; i++) {
        const addr = refs[i];
        const stakes = await getStakes(protocol, addr);
        const now = Math.floor(Date.now() / 1000);
        const ended = stakes.filter((s) => !s.active || now >= s.startTime + s.cycleDays * SECONDS_IN_UNIT);
        const active = stakes.filter((s) => s.active && now < s.startTime + s.cycleDays * SECONDS_IN_UNIT);
        console.log("  直推" + (i + 1) + ":", addr);
        console.log("    质押条数:", stakes.length, "| 已结束:", ended.length, "| 进行中:", active.length);
    }
    console.log("");

    console.log("【四、问题分析】");
    const reasons = [];
    if (refPaidType3.length === 0 && diffDist.length === 0) {
        reasons.push("链上无该地址收到的极差发放记录(ReferralRewardPaid type=3 / DifferentialRewardDistributed)。");
    }
    if (!isActive) {
        reasons.push("未激活(isActive=false)：极差只发给「已质押过流动性」的上级，未激活则不会被记极差。");
    }
    if (ticketAmount === 0n || ticketExited) {
        reasons.push("无有效门票(金额为0或已退出)：上级须有有效门票才会被记极差。");
    }
    if (teamCount < 10) {
        reasons.push("团队人数<10：合约规定V1需teamCount≥10才有5%极差比例，否则极差比例为0%，不会产生极差。");
    }
    if (refs.length === 0) {
        reasons.push("无直推：没有下级则不可能有「下级质押→上级拿极差」。");
    }
    let totalDownstreamStakes = 0;
    for (const r of refs) {
        const s = await getStakes(protocol, r);
        totalDownstreamStakes += s.length;
    }
    if (refs.length > 0 && totalDownstreamStakes === 0) {
        reasons.push("直推中无人质押：极差来自「下级质押」，直推无人质押则不会有极差记录。");
    }
    if (refs.length > 0 && totalDownstreamStakes > 0 && refPaidType3.length === 0) {
        reasons.push("直推有人质押但极差未发放：极差要等「质押人(下级)」在质押周期结束后点击「领取收益」才会发放给上级；若下级从未领收益，上级不会收到该笔极差。");
    }
    reasons.forEach((r, i) => console.log("  " + (i + 1) + ". " + r));
    console.log("");

    console.log("【五、结论与建议】");
    if (reasons.length === 0) {
        console.log("  链上已有极差发放记录，若前端显示「没有极差」请检查前端是否展示极差(ReferralRewardPaid rewardType=3)。");
    } else {
        console.log("  可能原因已列于【四】。建议：");
        if (!isActive) console.log("  - 该账户需先完成一次流动性质押(激活)，才能作为上级领取极差。");
        if (ticketAmount === 0n || ticketExited) console.log("  - 需持有有效门票(购买且未退出)才能作为上级领取极差。");
        if (teamCount < 10) console.log("  - 团队人数达到10后才有V1极差比例(5%)，当前teamCount=" + teamCount + "。");
        if (refs.length > 0 && totalDownstreamStakes > 0 && refPaidType3.length === 0) {
            console.log("  - 提醒直推/下级：在质押周期结束后及时点击「领取收益」，上级的极差才会到账。");
        }
    }
    console.log("\n" + "=".repeat(70));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
