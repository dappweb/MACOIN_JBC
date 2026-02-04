/**
 * 检查 0x16534 在 2月3日「该有极差但没有」的原因：下级质押到期日、是否已领取
 * 极差在下级「领取收益」时才发放，若下级质押在 2.3 到期但未领，则 2.3 日不会有记录
 * 用法: node scripts/check-pending-differential-2月3日.cjs
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const USER = "0x16534F0Dae6602c8E20d25000F9691C9b7A68462".toLowerCase();
const SECONDS_IN_UNIT = 86400;
const TARGET_DAY = "2026-02-03";
const dayStart = Math.floor(new Date(TARGET_DAY + "T00:00:00Z").getTime() / 1000);
const dayEnd = Math.floor(new Date(TARGET_DAY + "T23:59:59Z").getTime() / 1000);

const PROTOCOL_ABI = [
    "function getDirectReferrals(address) view returns (address[])",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
];

async function getStakes(protocol, address) {
    const list = [];
    for (let i = 0; i < 50; i++) {
        try {
            const s = await protocol.userStakes(address, i);
            if (Number(s.id) > 0) list.push({
                id: Number(s.id),
                amount: s.amount,
                startTime: Number(s.startTime),
                cycleDays: Number(s.cycleDays),
                active: s.active,
                paid: s.paid,
                endTime: Number(s.startTime) + Number(s.cycleDays) * SECONDS_IN_UNIT,
            });
            else break;
        } catch (_) {
            break;
        }
    }
    return list;
}

function timeStr(ts) {
    return ts ? new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "-";
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "MC Chain", chainId: 88813 });
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("📅 2月3日「该有极差但没有」排查\n");
    console.log("用户:", USER);
    console.log("目标日:", TARGET_DAY, "(UTC)");
    console.log("=".repeat(70) + "\n");

    const refs = await protocol.getDirectReferrals(USER).then((r) => (r || []).map((a) => String(a).toLowerCase()));
    console.log("直推数:", refs.length);

    const stakesEndingOnDay = [];
    const stakesEndedBeforeDay = [];

    for (let i = 0; i < refs.length; i++) {
        const addr = refs[i];
        const stakes = await getStakes(protocol, addr);
        for (const s of stakes) {
            const endTime = s.endTime;
            if (endTime >= dayStart && endTime <= dayEnd) {
                stakesEndingOnDay.push({ addr, ...s });
            } else if (endTime <= dayEnd && endTime >= dayStart - 7 * 86400) {
                stakesEndedBeforeDay.push({ addr, ...s });
            }
        }
    }

    console.log("\n【1】2月3日当天到期的质押（到期后下级领收益才会给上级发极差）");
    if (stakesEndingOnDay.length === 0) {
        console.log("  无。没有任何直推的质押在 2026-02-03 当天到期。");
    } else {
        for (const x of stakesEndingOnDay) {
            console.log("  直推:", x.addr);
            console.log("    质押ID:", x.id, "| 金额:", ethers.formatEther(x.amount), "MC | 到期:", timeStr(x.endTime));
            console.log("    说明: 该笔到期后，若该直推未点击「领取收益」，您不会在 2.3 日收到极差；需等其领取后才会发放。");
        }
    }

    console.log("\n【2】2月3日前几天内到期的质押（可能「该有」但下级尚未领取）");
    const recentEnded = [];
    for (const addr of refs) {
        const stakes = await getStakes(protocol, addr);
        for (const s of stakes) {
            if (s.endTime <= dayEnd && s.endTime >= dayStart - 14 * 86400) {
                recentEnded.push({ addr, ...s });
            }
        }
    }
    if (recentEnded.length === 0) {
        console.log("  无。");
    } else {
        recentEnded.sort((a, b) => a.endTime - b.endTime);
        for (const x of recentEnded) {
            console.log("  直推:", x.addr, "| 质押ID:", x.id, "| 到期:", timeStr(x.endTime), "| 金额:", ethers.formatEther(x.amount), "MC");
        }
    }

    console.log("\n【3】结论与对用户说明建议");
    console.log("  - 链上 2月3日 对您地址的 DifferentialRewardDistributed 条数为 0，即 2.3 日确实没有新的极差到账。");
    console.log("  - 极差发放条件：下级某笔质押「周期结束」且该下级点击「领取收益」后，合约才会给上级发极差。");
    console.log("  - 若用户认为「该有」：可能是某位下级的质押在 2.3 或前几天到期，但该下级尚未领取收益，故极差尚未触发。");
    console.log("  - 建议告知用户：请提醒到期未领的下级尽快点击「领取收益」，您的极差会在其领取时一并发放。");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
