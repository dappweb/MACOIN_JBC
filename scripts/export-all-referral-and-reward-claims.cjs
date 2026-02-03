/**
 * 导出所有人的推荐关系和奖金领取数据
 * 1. 推荐关系：980 账户在旧/新合约的 referrer、getDirectReferrals
 * 2. 奖金领取：旧/新合约全历史 RewardClaimed、ReferralRewardPaid 事件
 * 用法: node scripts/export-all-referral-and-reward-claims.cjs
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const EVENTS_ABI = [
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
    "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
];
const VIEW_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
];

const REWARD_TYPE_NAMES = { 0: "unknown", 1: "direct", 2: "level", 3: "differential", 4: "static" };

function collectUsersFromEvents(boundEvents, ticketEvents, stakeEvents) {
    const users = new Set();
    const zero = ethers.ZeroAddress.toLowerCase();
    boundEvents.forEach((e) => {
        if (e.args?.user) users.add(String(e.args.user).toLowerCase());
        if (e.args?.referrer) users.add(String(e.args.referrer).toLowerCase());
    });
    ticketEvents.forEach((e) => {
        if (e.args?.user) users.add(String(e.args.user).toLowerCase());
    });
    stakeEvents.forEach((e) => {
        if (e.args?.user) users.add(String(e.args.user).toLowerCase());
    });
    users.delete(zero);
    return users;
}

async function getReferralDataForUser(protocol, address, contractAddress) {
    let referrer = null;
    let directReferrals = [];
    try {
        const info = await protocol.userInfo(address);
        const r = String(info.referrer || "").toLowerCase();
        if (r && r !== ethers.ZeroAddress.toLowerCase()) referrer = r;
    } catch (_) {}
    try {
        const list = await protocol.getDirectReferrals(address);
        directReferrals = (list || []).map((a) => String(a).toLowerCase()).filter((a) => a && a !== ethers.ZeroAddress.toLowerCase());
    } catch (_) {}
    return { referrer, directReferrals };
}

async function getUserReferralRelationships(oldProtocol, newProtocol, address) {
    const [oldData, newData] = await Promise.all([
        getReferralDataForUser(oldProtocol, address, OLD_PROTOCOL_ADDRESS),
        getReferralDataForUser(newProtocol, address, NEW_PROTOCOL_ADDRESS),
    ]);
    return {
        address,
        oldContract: { address: OLD_PROTOCOL_ADDRESS, referrer: oldData.referrer, directReferrals: oldData.directReferrals },
        newContract: { address: NEW_PROTOCOL_ADDRESS, referrer: newData.referrer, directReferrals: newData.directReferrals },
    };
}

async function getRewardEventsForContract(protocol, contractAddress, fromBlock, toBlock) {
    const events = [];
    try {
        const [claimed, referralPaid] = await Promise.all([
            protocol.queryFilter(protocol.filters.RewardClaimed(), fromBlock, toBlock),
            protocol.queryFilter(protocol.filters.ReferralRewardPaid(), fromBlock, toBlock),
        ]);
        for (const e of claimed) {
            if (!e.args) continue;
            const rewardType = Number(e.args.rewardType ?? 0);
            events.push({
                type: "RewardClaimed",
                user: String(e.args.user).toLowerCase(),
                from: null,
                mcAmount: ethers.formatEther(e.args.mcAmount ?? 0n),
                jbcAmount: ethers.formatEther(e.args.jbcAmount ?? 0n),
                rewardType,
                rewardTypeName: REWARD_TYPE_NAMES[rewardType] || "unknown",
                ticketId: Number(e.args.ticketId ?? 0),
                blockNumber: e.blockNumber,
                transactionHash: e.transactionHash,
                contractAddress,
            });
        }
        for (const e of referralPaid) {
            if (!e.args) continue;
            const rewardType = Number(e.args.rewardType ?? 0);
            events.push({
                type: "ReferralRewardPaid",
                user: String(e.args.user).toLowerCase(),
                from: e.args.from ? String(e.args.from).toLowerCase() : null,
                mcAmount: ethers.formatEther(e.args.mcAmount ?? 0n),
                jbcAmount: ethers.formatEther(e.args.jbcAmount ?? 0n),
                rewardType,
                rewardTypeName: REWARD_TYPE_NAMES[rewardType] || "unknown",
                ticketId: Number(e.args.ticketId ?? 0),
                blockNumber: e.blockNumber,
                transactionHash: e.transactionHash,
                contractAddress,
            });
        }
    } catch (err) {
        console.warn("  getRewardEventsForContract error:", err.message);
    }
    events.sort((a, b) => a.blockNumber - b.blockNumber || (a.transactionHash || "").localeCompare(b.transactionHash || ""));
    return events;
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);
    const oldFromBlock = 0;

    const fullAbi = [...EVENTS_ABI, ...VIEW_ABI];
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, fullAbi, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, fullAbi, provider);

    console.log("1. 收集 980 个账户地址（旧+新合约事件合并去重）...\n");

    const [oldBound, oldTicketEv, oldStake] = await Promise.all([
        oldProtocol.queryFilter(oldProtocol.filters.BoundReferrer(), oldFromBlock, currentBlock),
        oldProtocol.queryFilter(oldProtocol.filters.TicketPurchased(), oldFromBlock, currentBlock),
        oldProtocol.queryFilter(oldProtocol.filters.LiquidityStaked(), oldFromBlock, currentBlock),
    ]);
    const [newBound, newTicketEv, newStake] = await Promise.all([
        newProtocol.queryFilter(newProtocol.filters.BoundReferrer(), fromBlock, currentBlock),
        newProtocol.queryFilter(newProtocol.filters.TicketPurchased(), fromBlock, currentBlock),
        newProtocol.queryFilter(newProtocol.filters.LiquidityStaked(), fromBlock, currentBlock),
    ]);

    const oldUsers = collectUsersFromEvents(oldBound, oldTicketEv, oldStake);
    const newUsers = collectUsersFromEvents(newBound, newTicketEv, newStake);
    const merged = new Set([...oldUsers, ...newUsers]);
    const addresses = Array.from(merged);

    console.log("总账户数:", addresses.length);
    console.log("2. 查询每个账户的推荐关系（旧/新合约 referrer + directReferrals）...\n");

    const referralResults = [];
    const batchSize = 8;
    for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(addresses.length / batchSize);
        process.stdout.write(`\r推荐关系进度 ${batchNum}/${totalBatches} (${Math.min(i + batchSize, addresses.length)}/${addresses.length})`);
        const rows = await Promise.all(batch.map((addr) => getUserReferralRelationships(oldProtocol, newProtocol, addr)));
        referralResults.push(...rows);
        if (i + batchSize < addresses.length) await new Promise((r) => setTimeout(r, 150));
    }
    console.log("\n");

    console.log("3. 查询旧/新合约全历史奖金领取事件（RewardClaimed、ReferralRewardPaid）...\n");

    const [oldRewardEvents, newRewardEvents] = await Promise.all([
        getRewardEventsForContract(oldProtocol, OLD_PROTOCOL_ADDRESS, oldFromBlock, currentBlock),
        getRewardEventsForContract(newProtocol, NEW_PROTOCOL_ADDRESS, fromBlock, currentBlock),
    ]);

    const allRewardEvents = [...oldRewardEvents, ...newRewardEvents];
    allRewardEvents.sort((a, b) => a.blockNumber - b.blockNumber || (a.transactionHash || "").localeCompare(b.transactionHash || ""));

    const exportTime = new Date().toISOString();
    const output = {
        exportTime,
        oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
        newProtocolAddress: NEW_PROTOCOL_ADDRESS,
        totalAccounts: referralResults.length,
        summary: {
            referralRelationships: referralResults.length,
            rewardClaimedCount: allRewardEvents.filter((e) => e.type === "RewardClaimed").length,
            referralRewardPaidCount: allRewardEvents.filter((e) => e.type === "ReferralRewardPaid").length,
            totalRewardEvents: allRewardEvents.length,
            oldContractRewardEvents: oldRewardEvents.length,
            newContractRewardEvents: newRewardEvents.length,
        },
        referralRelationships: referralResults,
        rewardClaimEvents: allRewardEvents,
    };

    const outputDir = path.join(__dirname, "..", "output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const timestamp = exportTime.replace(/[:.]/g, "-").slice(0, 19);
    const outPath = path.join(outputDir, `all-referral-and-reward-claims-${timestamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

    console.log("汇总:");
    console.log("  推荐关系账户数:", output.summary.referralRelationships);
    console.log("  RewardClaimed 条数:", output.summary.rewardClaimedCount);
    console.log("  ReferralRewardPaid 条数:", output.summary.referralRewardPaidCount);
    console.log("  奖金领取事件总条数:", output.summary.totalRewardEvents);
    console.log("已写入:", outPath);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
