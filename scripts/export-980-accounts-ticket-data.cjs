/**
 * 导出 980 个账户（新旧合约合并去重）的门票数据
 * 每个账户分别查旧合约、新合约的 userTicket，输出 JSON
 * 用法: node scripts/export-980-accounts-ticket-data.cjs
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
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
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

function formatTicket(ticket) {
    if (!ticket) return null;
    const ticketId = Number(ticket.ticketId ?? 0);
    const amount = ticket.amount ?? 0n;
    if (ticketId === 0 && amount === 0n) return null;
    const purchaseTime = Number(ticket.purchaseTime ?? 0);
    return {
        ticketId,
        amountMc: ethers.formatEther(amount),
        purchaseTime,
        purchaseTimeFormatted: purchaseTime > 0 ? new Date(purchaseTime * 1000).toISOString() : null,
        exited: ticket.exited ?? false,
    };
}

async function getUserTicketData(oldProtocol, newProtocol, address) {
    let oldTicket = null;
    let newTicket = null;
    try {
        const t = await oldProtocol.userTicket(address);
        oldTicket = formatTicket(t);
    } catch (_) {}
    try {
        const t = await newProtocol.userTicket(address);
        newTicket = formatTicket(t);
    } catch (_) {}
    return {
        address,
        oldContract: { address: OLD_PROTOCOL_ADDRESS, ticket: oldTicket },
        newContract: { address: NEW_PROTOCOL_ADDRESS, ticket: newTicket },
    };
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);
    const oldFromBlock = 0;

    const eventsAbi = [...EVENTS_ABI];
    const viewAbi = [...VIEW_ABI];
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, eventsAbi.concat(viewAbi), provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, eventsAbi.concat(viewAbi), provider);

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
    console.log("正在查询每个账户在旧合约、新合约的门票数据...\n");

    const results = [];
    const batchSize = 8;
    for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(addresses.length / batchSize);
        process.stdout.write(`\r进度 ${batchNum}/${totalBatches} (${Math.min(i + batchSize, addresses.length)}/${addresses.length})`);
        const rows = await Promise.all(batch.map((addr) => getUserTicketData(oldProtocol, newProtocol, addr)));
        results.push(...rows);
        if (i + batchSize < addresses.length) await new Promise((r) => setTimeout(r, 150));
    }
    console.log("\n");

    const withOldTicket = results.filter((r) => r.oldContract.ticket != null).length;
    const withNewTicket = results.filter((r) => r.newContract.ticket != null).length;
    const withAnyTicket = results.filter((r) => r.oldContract.ticket != null || r.newContract.ticket != null).length;

    const exportTime = new Date().toISOString();
    const output = {
        exportTime,
        oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
        newProtocolAddress: NEW_PROTOCOL_ADDRESS,
        totalAccounts: results.length,
        summary: {
            withTicketOnOld: withOldTicket,
            withTicketOnNew: withNewTicket,
            withTicketOnEither: withAnyTicket,
        },
        accounts: results,
    };

    const outputDir = path.join(__dirname, "..", "output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const timestamp = exportTime.replace(/[:.]/g, "-").slice(0, 19);
    const outPath = path.join(outputDir, `980-accounts-ticket-data-${timestamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

    console.log("汇总: 旧合约有门票", withOldTicket, "| 新合约有门票", withNewTicket, "| 任一合约有门票", withAnyTicket);
    console.log("已写入:", outPath);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
