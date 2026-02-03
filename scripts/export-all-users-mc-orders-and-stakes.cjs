/**
 * 导出所有用户的 MC 订单（门票）和流动性质押数据，输出为 JSON
 * 用法: node scripts/export-all-users-mc-orders-and-stakes.cjs
 * 输出: output/all-users-mc-orders-and-stakes-{timestamp}.json
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
];

async function getAllUserAddresses(protocol, provider) {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    const [boundEvents, ticketEvents, stakeEvents] = await Promise.all([
        protocol.queryFilter(protocol.filters.BoundReferrer(), fromBlock, currentBlock),
        protocol.queryFilter(protocol.filters.TicketPurchased(), fromBlock, currentBlock),
        protocol.queryFilter(protocol.filters.LiquidityStaked(), fromBlock, currentBlock),
    ]);

    const users = new Set();
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

    return Array.from(users).filter((addr) => addr !== ethers.ZeroAddress.toLowerCase());
}

async function getUserMcOrderAndStakes(protocol, userAddress) {
    const result = { address: userAddress, ticket: null, stakes: [] };

    // MC 订单（门票）
    try {
        const ticket = await protocol.userTicket(userAddress);
        const ticketId = Number(ticket.ticketId ?? 0);
        if (ticketId > 0 || Number(ticket.amount ?? 0) > 0) {
            result.ticket = {
                ticketId,
                amountMc: ethers.formatEther(ticket.amount ?? 0n),
                purchaseTime: Number(ticket.purchaseTime ?? 0),
                purchaseTimeFormatted:
                    Number(ticket.purchaseTime ?? 0) > 0
                        ? new Date(Number(ticket.purchaseTime) * 1000).toISOString()
                        : null,
                exited: ticket.exited ?? false,
            };
        }
    } catch (e) {
        result.ticketError = e.message;
    }

    // 流动性质押（全部条数，不限制 10）
    try {
        let index = 0;
        while (true) {
            try {
                const stake = await protocol.userStakes(userAddress, index);
                const id = Number(stake.id ?? 0);
                if (id > 0) {
                    result.stakes.push({
                        id,
                        amountMc: ethers.formatEther(stake.amount ?? 0n),
                        startTime: Number(stake.startTime ?? 0),
                        startTimeFormatted:
                            Number(stake.startTime ?? 0) > 0
                                ? new Date(Number(stake.startTime) * 1000).toISOString()
                                : null,
                        cycleDays: Number(stake.cycleDays ?? 0),
                        active: stake.active ?? false,
                        paidMc: ethers.formatEther(stake.paid ?? 0n),
                    });
                }
                index++;
                if (index > 500) break; // 单用户最多 500 条防止死循环
            } catch (_) {
                break;
            }
        }
    } catch (e) {
        result.stakesError = e.message;
    }

    return result;
}

async function main() {
    console.log("导出所有用户 MC 订单 + 流动性质押数据（JSON）\n");
    console.log("协议合约:", PROTOCOL_ADDRESS);
    console.log("RPC:", RPC_URL, "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    const blockNumber = await provider.getBlockNumber();
    console.log("当前区块:", blockNumber, "\n");

    console.log("正在收集用户地址...");
    const addresses = await getAllUserAddresses(protocol, provider);
    console.log("用户数:", addresses.length, "\n");

    if (addresses.length === 0) {
        console.log("未找到任何用户");
        process.exit(1);
    }

    const users = [];
    const batchSize = 5;
    for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(addresses.length / batchSize);
        process.stdout.write(`\r查询进度 ${batchNum}/${totalBatches} (${Math.min(i + batchSize, addresses.length)}/${addresses.length})`);
        const rows = await Promise.all(batch.map((addr) => getUserMcOrderAndStakes(protocol, addr)));
        users.push(...rows);
        if (i + batchSize < addresses.length) {
            await new Promise((r) => setTimeout(r, 200));
        }
    }
    console.log("\n");

    const exportTime = new Date().toISOString();
    const output = {
        exportTime,
        protocolAddress: PROTOCOL_ADDRESS,
        totalUsers: users.length,
        summary: {
            withTicket: users.filter((u) => u.ticket && Number(u.ticket.amountMc) > 0).length,
            withStakes: users.filter((u) => u.stakes && u.stakes.length > 0).length,
            totalStakes: users.reduce((sum, u) => sum + (u.stakes?.length || 0), 0),
        },
        users,
    };

    const outputDir = path.join(__dirname, "..", "output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const timestamp = exportTime.replace(/[:.]/g, "-").slice(0, 19);
    const jsonPath = path.join(outputDir, `all-users-mc-orders-and-stakes-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf8");

    console.log("汇总: 有门票", output.summary.withTicket, "| 有质押", output.summary.withStakes, "| 质押总条数", output.summary.totalStakes);
    console.log("已写入:", jsonPath);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
