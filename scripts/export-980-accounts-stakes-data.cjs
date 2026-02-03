/**
 * 导出 980 个账户（新旧合约合并去重）的流动性质押数据
 * 每个账户分别查旧合约、新合约的 userStakes，输出 JSON
 * 用法: node scripts/export-980-accounts-stakes-data.cjs
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
];
const VIEW_ABI = [
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
];

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

async function getStakesForUser(protocol, address, maxStakes = 200) {
    const stakes = [];
    for (let i = 0; i < maxStakes; i++) {
        try {
            const s = await protocol.userStakes(address, i);
            const id = Number(s.id ?? 0);
            if (id <= 0) break;
            stakes.push({
                id,
                amountMc: ethers.formatEther(s.amount ?? 0n),
                startTime: Number(s.startTime ?? 0),
                startTimeFormatted:
                    Number(s.startTime ?? 0) > 0 ? new Date(Number(s.startTime) * 1000).toISOString() : null,
                cycleDays: Number(s.cycleDays ?? 0),
                active: s.active ?? false,
                paidMc: ethers.formatEther(s.paid ?? 0n),
            });
        } catch (_) {
            break;
        }
    }
    return stakes;
}

async function getUserStakesData(oldProtocol, newProtocol, address) {
    const [oldStakes, newStakes] = await Promise.all([
        getStakesForUser(oldProtocol, address),
        getStakesForUser(newProtocol, address),
    ]);
    return {
        address,
        oldContract: { address: OLD_PROTOCOL_ADDRESS, stakes: oldStakes, count: oldStakes.length },
        newContract: { address: NEW_PROTOCOL_ADDRESS, stakes: newStakes, count: newStakes.length },
    };
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);
    const oldFromBlock = 0;

    const fullAbi = [...EVENTS_ABI, ...VIEW_ABI];
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, fullAbi, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, fullAbi, provider);

    console.log("收集 980 个账户地址（旧+新合约事件合并去重）...\n");

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
    console.log("正在查询每个账户在旧合约、新合约的流动性质押数据...\n");

    const results = [];
    const batchSize = 5;
    for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(addresses.length / batchSize);
        process.stdout.write(`\r进度 ${batchNum}/${totalBatches} (${Math.min(i + batchSize, addresses.length)}/${addresses.length})`);
        const rows = await Promise.all(batch.map((addr) => getUserStakesData(oldProtocol, newProtocol, addr)));
        results.push(...rows);
        if (i + batchSize < addresses.length) await new Promise((r) => setTimeout(r, 200));
    }
    console.log("\n");

    const withOldStakes = results.filter((r) => r.oldContract.count > 0).length;
    const withNewStakes = results.filter((r) => r.newContract.count > 0).length;
    const totalOldStakes = results.reduce((s, r) => s + r.oldContract.count, 0);
    const totalNewStakes = results.reduce((s, r) => s + r.newContract.count, 0);

    const exportTime = new Date().toISOString();
    const output = {
        exportTime,
        oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
        newProtocolAddress: NEW_PROTOCOL_ADDRESS,
        totalAccounts: results.length,
        summary: {
            withStakesOnOld: withOldStakes,
            withStakesOnNew: withNewStakes,
            totalStakesOnOld: totalOldStakes,
            totalStakesOnNew: totalNewStakes,
        },
        accounts: results,
    };

    const outputDir = path.join(__dirname, "..", "output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const timestamp = exportTime.replace(/[:.]/g, "-").slice(0, 19);
    const outPath = path.join(outputDir, `980-accounts-stakes-data-${timestamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

    console.log("汇总: 旧合约有质押账户", withOldStakes, "条数", totalOldStakes, "| 新合约有质押账户", withNewStakes, "条数", totalNewStakes);
    console.log("已写入:", outPath);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
