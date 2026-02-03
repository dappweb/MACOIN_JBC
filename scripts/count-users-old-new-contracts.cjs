/**
 * 新旧合约分别统计用户总数
 * 用法: node scripts/count-users-old-new-contracts.cjs
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
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

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // 新合约：最近 50 万区块；旧合约：从区块 0 起全历史（已弃用，仅历史有事件）
    const oldFromBlock = 0;
    console.log("新合约查询区块范围:", fromBlock, "-", currentBlock);
    console.log("旧合约查询区块范围:", oldFromBlock, "-", currentBlock, "(全历史)");
    console.log("");

    // 旧合约（全历史）
    console.log("--- 旧合约 ---");
    console.log("地址:", OLD_PROTOCOL_ADDRESS);
    const [oldBound, oldTicket, oldStake] = await Promise.all([
        oldProtocol.queryFilter(oldProtocol.filters.BoundReferrer(), oldFromBlock, currentBlock),
        oldProtocol.queryFilter(oldProtocol.filters.TicketPurchased(), oldFromBlock, currentBlock),
        oldProtocol.queryFilter(oldProtocol.filters.LiquidityStaked(), oldFromBlock, currentBlock),
    ]);
    const oldUsers = collectUsersFromEvents(oldBound, oldTicket, oldStake);
    console.log("事件: BoundReferrer", oldBound.length, "| TicketPurchased", oldTicket.length, "| LiquidityStaked", oldStake.length);
    console.log("用户数（去重）:", oldUsers.size);
    console.log("");

    // 新合约
    console.log("--- 新合约 ---");
    console.log("地址:", NEW_PROTOCOL_ADDRESS);
    const [newBound, newTicket, newStake] = await Promise.all([
        newProtocol.queryFilter(newProtocol.filters.BoundReferrer(), fromBlock, currentBlock),
        newProtocol.queryFilter(newProtocol.filters.TicketPurchased(), fromBlock, currentBlock),
        newProtocol.queryFilter(newProtocol.filters.LiquidityStaked(), fromBlock, currentBlock),
    ]);
    const newUsers = collectUsersFromEvents(newBound, newTicket, newStake);
    console.log("事件: BoundReferrer", newBound.length, "| TicketPurchased", newTicket.length, "| LiquidityStaked", newStake.length);
    console.log("用户数（去重）:", newUsers.size);
    console.log("");

    // 合并去重（两合约任一出现即算）
    const merged = new Set([...oldUsers, ...newUsers]);
    const onlyOld = [...oldUsers].filter((a) => !newUsers.has(a));
    const onlyNew = [...newUsers].filter((a) => !oldUsers.has(a));
    const inBoth = [...oldUsers].filter((a) => newUsers.has(a));

    console.log("=== 汇总 ===");
    console.log("旧合约用户数:", oldUsers.size);
    console.log("新合约用户数:", newUsers.size);
    console.log("合并去重后总用户数:", merged.size);
    console.log("仅在旧合约:", onlyOld.length);
    console.log("仅在新合约:", onlyNew.length);
    console.log("两合约均有:", inBoth.length);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
