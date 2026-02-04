#!/usr/bin/env node
/**
 * 仅输出具体金额：已售出门票总额（MC/USD）、可能盈利额（MC/USD）。
 * 用法: node scripts/get-ticket-profit-amounts.cjs [--mc-usd 0.5]
 *       MC_USD=0.5 node scripts/get-ticket-profit-amounts.cjs
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

function parseMcUsd() {
    const i = process.argv.indexOf("--mc-usd");
    if (i >= 0 && process.argv[i + 1]) {
        const v = parseFloat(process.argv[i + 1]);
        if (!Number.isNaN(v) && v > 0) return v;
    }
    const env = process.env.MC_USD;
    if (env) {
        const v = parseFloat(env);
        if (!Number.isNaN(v) && v > 0) return v;
    }
    return null;
}

async function main() {
    const mcUsd = parseMcUsd();
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 2_000_000);

    // 1. 已售出门票总额（新+旧合约 TicketPurchased）
    const [newTicketEvents, oldTicketEvents] = await Promise.all([
        protocol.queryFilter(protocol.filters.TicketPurchased(), fromBlock),
        oldProtocol.queryFilter(oldProtocol.filters.TicketPurchased(), fromBlock),
    ]);
    let totalTicketSoldWei = 0n;
    for (const e of newTicketEvents) {
        if (e.args?.amount) totalTicketSoldWei += BigInt(e.args.amount.toString());
    }
    for (const e of oldTicketEvents) {
        if (e.args?.amount) totalTicketSoldWei += BigInt(e.args.amount.toString());
    }
    const totalTicketSoldMC = Number(ethers.formatEther(totalTicketSoldWei));
    const totalTicketSoldUSD = mcUsd ? totalTicketSoldMC * mcUsd : null;

    // 2. 平台总累计收益（所有用户 totalRevenue 之和）
    const userSet = new Set();
    const boundEvents = await protocol.queryFilter(protocol.filters.BoundReferrer(), fromBlock);
    boundEvents.forEach((e) => {
        if (e.args?.user) userSet.add(e.args.user.toLowerCase());
        if (e.args?.referrer && e.args.referrer !== ethers.ZeroAddress) userSet.add(e.args.referrer.toLowerCase());
    });
    const ticketEvents = await protocol.queryFilter(protocol.filters.TicketPurchased(), fromBlock);
    ticketEvents.forEach((e) => {
        if (e.args?.user) userSet.add(e.args.user.toLowerCase());
    });
    const users = Array.from(userSet);

    let totalRevenueWei = 0n;
    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const infos = await Promise.all(
            batch.map((addr) => protocol.userInfo(addr).catch(() => ({ totalRevenue: 0n })))
        );
        infos.forEach((info) => {
            totalRevenueWei += BigInt((info.totalRevenue || 0n).toString());
        });
    }
    const totalRevenueMC = Number(ethers.formatEther(totalRevenueWei));
    const totalRevenueUSD = mcUsd ? totalRevenueMC * mcUsd : null;

    // 3. 可能盈利额 = 已售出门票总额 - 平台总累计收益
    const possibleProfitMC = Math.max(0, totalTicketSoldMC - totalRevenueMC);
    const possibleProfitUSD = mcUsd ? possibleProfitMC * mcUsd : null;

    // 仅输出具体金额
    console.log("--- 具体金额 ---");
    console.log("已售出门票总额(MC):", totalTicketSoldMC.toFixed(4));
    if (totalTicketSoldUSD != null) console.log("已售出门票总额(USD):", totalTicketSoldUSD.toFixed(2));
    console.log("可能盈利额(MC):", possibleProfitMC.toFixed(4));
    if (possibleProfitUSD != null) console.log("可能盈利额(USD):", possibleProfitUSD.toFixed(2));
    if (!mcUsd) console.log("(指定 --mc-usd <汇率> 或 MC_USD 可输出 USD 金额)");
}

main().catch((err) => {
    console.error("❌", err.message);
    process.exit(1);
});
