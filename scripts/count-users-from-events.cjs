/**
 * 从链上事件重新确定用户数
 * 用法: node scripts/count-users-from-events.cjs
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    console.log("协议:", PROTOCOL_ADDRESS);
    console.log("区块范围:", fromBlock, "-", currentBlock, "\n");

    const [boundEvents, ticketEvents, stakeEvents] = await Promise.all([
        protocol.queryFilter(protocol.filters.BoundReferrer(), fromBlock, currentBlock),
        protocol.queryFilter(protocol.filters.TicketPurchased(), fromBlock, currentBlock),
        protocol.queryFilter(protocol.filters.LiquidityStaked(), fromBlock, currentBlock),
    ]);

    const fromBound = new Set();
    const fromTicket = new Set();
    const fromStake = new Set();

    boundEvents.forEach((e) => {
        if (e.args?.user) fromBound.add(String(e.args.user).toLowerCase());
        if (e.args?.referrer) fromBound.add(String(e.args.referrer).toLowerCase());
    });
    ticketEvents.forEach((e) => {
        if (e.args?.user) fromTicket.add(String(e.args.user).toLowerCase());
    });
    stakeEvents.forEach((e) => {
        if (e.args?.user) fromStake.add(String(e.args.user).toLowerCase());
    });

    const zero = ethers.ZeroAddress.toLowerCase();
    const all = new Set([...fromBound, ...fromTicket, ...fromStake]);
    all.delete(zero);

    const total = all.size;

    console.log("事件数量:");
    console.log("  BoundReferrer:", boundEvents.length);
    console.log("  TicketPurchased:", ticketEvents.length);
    console.log("  LiquidityStaked:", stakeEvents.length);
    console.log("");
    console.log("去重后地址来源:");
    console.log("  仅来自 BoundReferrer:", fromBound.size);
    console.log("  仅来自 TicketPurchased:", fromTicket.size);
    console.log("  仅来自 LiquidityStaked:", fromStake.size);
    console.log("");
    console.log("=== 用户数（去重后）:", total, "===");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
