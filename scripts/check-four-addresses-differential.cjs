/**
 * 检查四个地址的极差奖励情况
 * 用法: node scripts/check-four-addresses-differential.cjs
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const ADDRESSES = [
    "0xd5cFE4E34d13AC239C2e4a59662ce9faEc2fEDaA",
    "0xa5B6131D4F7C407BbF557f95aaAb0DcB1b382929",
    "0x80E0b6a4Eada66AC7c731C1e9BCd4A88A9F00a9B",
    "0xD19fE0623e4810a283a3475b91fC7450D6A96286",
].map((a) => a.toLowerCase());

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
];

async function getStakeCount(protocol, address) {
    let n = 0;
    for (let i = 0; i < 100; i++) {
        try {
            const s = await protocol.userStakes(address, i);
            if (Number(s.id) > 0) n++;
            else break;
        } catch (_) {
            break;
        }
    }
    return n;
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    console.log("🔍 检查四个地址的极差奖励情况\n");
    console.log("协议:", PROTOCOL_ADDRESS);
    console.log("区块:", currentBlock, "\n");
    console.log("=".repeat(80));

    for (const addr of ADDRESSES) {
        console.log("\n📍 地址:", addr);
        console.log("-".repeat(60));

        let userInfo, ticket, level, directReferrals;
        try {
            [userInfo, ticket, level, directReferrals] = await Promise.all([
                protocol.userInfo(addr),
                protocol.userTicket(addr),
                protocol.getUserLevel(addr).catch(() => ({ level: 0, percent: 0, teamCount: 0n })),
                protocol.getDirectReferrals(addr),
            ]);
        } catch (e) {
            console.log("  读取合约失败:", e.message);
            continue;
        }

        const referrer = String(userInfo.referrer || "").toLowerCase();
        const teamCount = Number(userInfo.teamCount ?? 0);
        const isActive = userInfo.isActive ?? false;
        const ticketAmount = ticket.amount ?? 0n;
        const ticketExited = ticket.exited ?? false;
        const levelNum = Number(level.level ?? 0);
        const percent = Number(level.percent ?? 0);
        const refs = (directReferrals || []).map((a) => String(a).toLowerCase());

        console.log("  推荐人:", referrer || "无");
        console.log("  直推数:", refs.length);
        console.log("  团队人数:", teamCount);
        console.log("  是否激活(isActive):", isActive);
        console.log("  门票金额:", ethers.formatEther(ticketAmount), "MC");
        console.log("  门票已退出:", ticketExited);
        console.log("  等级: V" + levelNum + ", 极差比例:", percent + "%");

        // 直推中有人质押过吗
        let downstreamStakeCount = 0;
        for (const r of refs.slice(0, 20)) {
            const n = await getStakeCount(protocol, r);
            downstreamStakeCount += n;
        }
        if (refs.length > 20) {
            console.log("  (仅检查前20个直推的质押数)");
        }
        console.log("  直推中已质押条数(前20人):", downstreamStakeCount);

        // 极差相关事件
        const refPaid = await protocol.queryFilter(protocol.filters.ReferralRewardPaid(addr), fromBlock, currentBlock);
        const diffPaid = await protocol.queryFilter(protocol.filters.DifferentialRewardDistributed(addr), fromBlock, currentBlock);
        const refPaidType3 = refPaid.filter((e) => e.args && Number(e.args.rewardType) === 3);

        console.log("  ReferralRewardPaid(极差 rewardType=3) 条数:", refPaidType3.length);
        console.log("  DifferentialRewardDistributed 条数:", diffPaid.length);

        // 可能原因
        const reasons = [];
        if (refPaidType3.length === 0 && diffPaid.length === 0) reasons.push("链上无极差发放记录");
        if (!isActive) reasons.push("未激活(未质押过流动性)");
        if (ticketAmount === 0n || ticketExited) reasons.push("无有效门票");
        if (teamCount < 10) reasons.push("团队人数<10，无V1极差比例(5%)");
        if (refs.length === 0) reasons.push("无直推");
        if (downstreamStakeCount === 0 && refs.length > 0) reasons.push("直推中无人质押或质押条数为0");
        if (reasons.length > 0) {
            console.log("  可能原因:", reasons.join("; "));
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 检查完成");
    console.log("\n说明: 极差是「下级质押、上级拿」；要等下级周期结束后点「领取收益」上级才会收到极差。");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
