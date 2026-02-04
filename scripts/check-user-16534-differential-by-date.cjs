/**
 * 按日期查询 0x16534... 的 DifferentialRewardDistributed 极差数据
 * 用法: node scripts/check-user-16534-differential-by-date.cjs [YYYY-MM-DD]
 * 示例: node scripts/check-user-16534-differential-by-date.cjs 2026-02-03
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const USER = "0x16534F0Dae6602c8E20d25000F9691C9b7A68462".toLowerCase();

const PROTOCOL_ABI = [
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
];

async function main() {
    const dateStr = process.argv[2] || "2026-02-03";
    const dayStart = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
    const dayEnd = Math.floor(new Date(dateStr + "T23:59:59Z").getTime() / 1000) + 1;

    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    console.log("📅 " + dateStr + " 极差数据（用户 " + USER + "）\n");

    const diffDist = await protocol.queryFilter(protocol.filters.DifferentialRewardDistributed(USER), fromBlock, currentBlock);
    const onDay = diffDist.filter((e) => {
        const ts = Number(e.args && e.args.timestamp ? e.args.timestamp : 0);
        return ts >= dayStart && ts <= dayEnd;
    });

    console.log("当日 DifferentialRewardDistributed 条数:", onDay.length);
    if (onDay.length === 0) {
        console.log("（该日无记录）");
        return;
    }

    for (let i = 0; i < onDay.length; i++) {
        const e = onDay[i];
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
        console.log("\n条" + (i + 1) + ": 区块 " + e.blockNumber + " | MC " + mc + " | JBC " + jbc + " | 时间 " + timeStr + " | 触发账户 " + triggerAccount + " | 交易 " + (e.transactionHash || ""));
    }

    const totalMc = onDay.reduce((sum, e) => sum + Number(ethers.formatEther((e.args && e.args.mcAmount) || 0n)), 0);
    console.log("\n当日 MC 合计:", totalMc);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
