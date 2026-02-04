/**
 * 查询 2月2日「领取奖励」这笔交易的具体细节（按 RewardClaimed 事件反查）
 * 用法: node scripts/get-claim-tx-details-2月2日.cjs [领取人地址]
 * 默认领取人: 0x40Ee97d7B8D424489938BFa0a523ae39B59d7f5b（截图收益记录所属地址）
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const CLAIMER = (process.argv[2] || "0x40Ee97d7B8D424489938BFa0a523ae39B59d7f5b").toLowerCase();

const PROTOCOL_ABI = [
    "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    const dayStart = Math.floor(new Date("2026-02-02T00:00:00Z").getTime() / 1000);
    const dayEnd = Math.floor(new Date("2026-02-02T23:59:59Z").getTime() / 1000) + 1;

    console.log("📋 2月2日「领取奖励」交易具体细节\n");
    console.log("领取人地址:", CLAIMER);
    console.log("协议:", PROTOCOL_ADDRESS);
    console.log("=".repeat(70) + "\n");

    const claimed = await protocol.queryFilter(protocol.filters.RewardClaimed(CLAIMER), fromBlock, currentBlock);
    const onDay = [];
    for (const e of claimed) {
        const block = await provider.getBlock(e.blockNumber).catch(() => null);
        const ts = block ? block.timestamp : 0;
        if (ts >= dayStart && ts <= dayEnd) onDay.push(e);
    }

    if (onDay.length === 0) {
        console.log("未在 2026-02-02 当天查到该地址的 RewardClaimed 事件。");
        console.log("（可能区块范围不足或领取人地址与截图不一致）");
        return;
    }

    for (let i = 0; i < onDay.length; i++) {
        const ev = onDay[i];
        const block = await provider.getBlock(ev.blockNumber);
        const tx = await provider.getTransaction(ev.transactionHash);
        const receipt = await provider.getTransactionReceipt(ev.transactionHash);
        const args = ev.args || {};
        const mc = ethers.formatEther(args.mcAmount || 0n);
        const jbc = ethers.formatEther(args.jbcAmount || 0n);
        const timeStr = block && block.timestamp ? new Date(block.timestamp * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "-";

        console.log("【第 " + (i + 1) + " 笔领取】");
        console.log("  交易哈希:", ev.transactionHash);
        console.log("  区块高度:", ev.blockNumber);
        console.log("  时间:", timeStr);
        console.log("  发起人(from):", (tx && tx.from) || "-");
        console.log("  调用合约(to):", (tx && tx.to) || "-");
        console.log("  RewardClaimed 参数:");
        console.log("    user:", args.user);
        console.log("    mcAmount:", mc, "MC");
        console.log("    jbcAmount:", jbc, "JBC");
        console.log("    rewardType:", args.rewardType != null ? String(args.rewardType) : "-");
        console.log("    ticketId:", args.ticketId != null ? String(args.ticketId) : "-");
        console.log("");

        if (receipt && receipt.logs) {
            const iface = new ethers.Interface(PROTOCOL_ABI);
            const refPaid = [];
            const diffDist = [];
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() !== PROTOCOL_ADDRESS.toLowerCase()) continue;
                try {
                    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                    if (parsed && parsed.name === "ReferralRewardPaid") {
                        refPaid.push(parsed.args);
                    } else if (parsed && parsed.name === "DifferentialRewardDistributed") {
                        diffDist.push(parsed.args);
                    }
                } catch (_) {}
            }
            if (refPaid.length > 0) {
                console.log("  同笔交易内 ReferralRewardPaid（推荐/层级/极差发给谁）:");
                refPaid.forEach((a, j) => {
                    const typeStr = a.rewardType == 1 ? "直推" : a.rewardType == 2 ? "层级" : a.rewardType == 3 ? "极差" : "type" + a.rewardType;
                    console.log("    " + (j + 1) + " 接收人:", a.user, "| from:", a.from, "| MC:", ethers.formatEther(a.mcAmount || 0n), "| JBC:", ethers.formatEther(a.jbcAmount || 0n), "|", typeStr);
                });
                console.log("");
            }
            if (diffDist.length > 0) {
                console.log("  同笔交易内 DifferentialRewardDistributed:");
                diffDist.forEach((a, j) => {
                    console.log("    " + (j + 1) + " 接收人:", a.user, "| MC:", ethers.formatEther(a.mcAmount || 0n), "| JBC:", ethers.formatEther(a.jbcAmount || 0n));
                });
                console.log("");
            }
            if (refPaid.length === 0 && diffDist.length === 0) {
                console.log("  （该笔交易无 ReferralRewardPaid / DifferentialRewardDistributed，即未向其他地址发放推荐或极差）");
                console.log("");
            }
        }
        console.log("---");
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
