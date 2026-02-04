/**
 * 检查线上合约：Owner、暂停状态、关键配置、储备金等
 * 用法: node scripts/check-online-contract.cjs
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076c3735a920a3ca505d382bbc";

const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function directRewardPercent() view returns (uint256)",
    "function levelRewardPercent() view returns (uint256)",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
    "function jbcToken() view returns (address)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "function nextTicketId() view returns (uint256)",
    "function nextStakeId() view returns (uint256)",
    "function marketingWallet() view returns (address)",
    "function treasuryWallet() view returns (address)",
    "function lpInjectionWallet() view returns (address)",
    "function buybackWallet() view returns (address)",
    "function ticketFlexibilityDuration() view returns (uint256)",
    "function liquidityEnabled() view returns (bool)",
    "function redeemEnabled() view returns (bool)",
];

async function main() {
    console.log("🔍 检查线上合约\n");
    console.log("=".repeat(60));
    console.log("协议合约:", PROTOCOL_ADDRESS);
    console.log("RPC:", RPC_URL);
    console.log("=".repeat(60) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    const blockNumber = await provider.getBlockNumber();
    console.log("📡 当前区块:", blockNumber, "\n");

    // 1. 合约代码（是否代理）
    const code = await provider.getCode(PROTOCOL_ADDRESS);
    const codeLen = code.length;
    console.log("📋 合约");
    console.log("  有代码:", code !== "0x" && code.length > 2 ? "是" : "否");
    console.log("  代码长度:", codeLen, "字符\n");

    // 2. Owner
    try {
        const owner = await protocol.owner();
        const ownerCode = await provider.getCode(owner);
        console.log("👤 Owner");
        console.log("  地址:", owner);
        console.log("  类型:", ownerCode !== "0x" && ownerCode.length > 2 ? "合约" : "EOA");
        console.log("");
    } catch (e) {
        console.log("👤 Owner: 读取失败", e.message, "\n");
    }

    // 3. 暂停状态
    try {
        const paused = await protocol.paused();
        console.log("⏸️  暂停状态:", paused ? "已暂停" : "未暂停");
        console.log("");
    } catch (e) {
        console.log("⏸️  暂停状态: 未提供或读取失败\n");
    }

    // 4. 奖励比例
    try {
        const direct = await protocol.directRewardPercent();
        const level = await protocol.levelRewardPercent();
        console.log("💰 奖励比例");
        console.log("  直推:", Number(direct) + "%");
        console.log("  层级:", Number(level) + "%");
        console.log("");
    } catch (e) {
        console.log("💰 奖励比例: 读取失败", e.message, "\n");
    }

    // 5. 储备与 JBC
    try {
        const reserveMC = await protocol.swapReserveMC();
        const reserveJBC = await protocol.swapReserveJBC();
        const jbcAddr = await protocol.jbcToken();
        console.log("🏦 储备与代币");
        console.log("  swapReserveMC:", ethers.formatEther(reserveMC), "MC");
        console.log("  swapReserveJBC:", ethers.formatEther(reserveJBC), "JBC");
        console.log("  jbcToken:", jbcAddr);
        console.log("");
    } catch (e) {
        console.log("🏦 储备: 读取失败", e.message, "\n");
    }

    // 6. 时间与计数
    try {
        const secUnit = await protocol.SECONDS_IN_UNIT();
        const nextTicket = await protocol.nextTicketId();
        const nextStake = await protocol.nextStakeId();
        console.log("⏱️  时间与计数");
        console.log("  SECONDS_IN_UNIT:", secUnit.toString(), "秒");
        console.log("  nextTicketId:", nextTicket.toString());
        console.log("  nextStakeId:", nextStake.toString());
        console.log("");
    } catch (e) {
        console.log("⏱️  时间与计数: 部分失败", e.message, "\n");
    }

    // 7. 钱包地址
    try {
        const marketing = await protocol.marketingWallet();
        const treasury = await protocol.treasuryWallet();
        const lpInjection = await protocol.lpInjectionWallet();
        const buyback = await protocol.buybackWallet();
        console.log("👛 钱包");
        console.log("  marketingWallet:", marketing);
        console.log("  treasuryWallet:", treasury);
        console.log("  lpInjectionWallet:", lpInjection);
        console.log("  buybackWallet:", buyback);
        console.log("");
    } catch (e) {
        console.log("👛 钱包: 读取失败", e.message, "\n");
    }

    // 8. 功能开关
    try {
        const flexDuration = await protocol.ticketFlexibilityDuration();
        const liqEnabled = await protocol.liquidityEnabled();
        const redeemEnabled = await protocol.redeemEnabled();
        console.log("🔧 功能");
        console.log("  ticketFlexibilityDuration:", flexDuration.toString(), "秒");
        console.log("  liquidityEnabled:", liqEnabled);
        console.log("  redeemEnabled:", redeemEnabled);
        console.log("");
    } catch (e) {
        console.log("🔧 功能: 部分失败", e.message, "\n");
    }

    // 9. 代理实现地址（EIP-1967）
    try {
        const implSlot = await provider.getStorage(PROTOCOL_ADDRESS, EIP1967_IMPLEMENTATION_SLOT);
        if (implSlot && implSlot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const implAddr = "0x" + implSlot.slice(-40);
            console.log("🔗 代理");
            console.log("  实现地址(EIP-1967):", ethers.getAddress(implAddr));
        }
    } catch (e) {}

    console.log("=".repeat(60));
    console.log("✅ 检查完成");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
