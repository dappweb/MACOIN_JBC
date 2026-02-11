/**
 * 同时检查 teamCount 和 teamTotalVolume 的正确性
 * 基于合约实际推荐关系递归计算
 */
const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

const BATCH = 20;

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "═".repeat(80));
    console.log("  teamCount + teamTotalVolume 全量对比");
    console.log("  时间:", new Date().toLocaleString("zh-CN"));
    console.log("═".repeat(80));

    // 第1步：获取所有用户地址
    console.log("\n  [1/4] 获取用户列表...");
    const allUsers = new Set();
    for (const proto of [protocol, oldProtocol]) {
        try {
            const currentBlock = await provider.getBlockNumber();
            const events = await proto.queryFilter(proto.filters.BoundReferrer(), 0, currentBlock);
            events.forEach(event => {
                if (event.args?.referrer && event.args?.user) {
                    allUsers.add(event.args.user.toLowerCase());
                    allUsers.add(event.args.referrer.toLowerCase());
                }
            });
        } catch (e) {}
    }
    console.log(`  ✅ 用户数: ${allUsers.size}`);

    // 第2步：从合约读取实际推荐关系
    console.log("\n  [2/4] 从合约读取推荐关系 + 用户数据...");
    const referrerToUsers = new Map();
    const userDataMap = new Map();
    const userList = Array.from(allUsers);
    let done = 0;

    for (let i = 0; i < userList.length; i += BATCH) {
        const batch = userList.slice(i, i + BATCH);
        await Promise.all(batch.map(async (addr) => {
            try {
                const info = await protocol.userInfo(addr);
                const referrer = info.referrer.toLowerCase();
                const ticket = await protocol.userTicket(addr);
                const ticketAmt = (!ticket.exited && ticket.amount) ? ticket.amount : 0n;

                userDataMap.set(addr, {
                    referrer,
                    currentTeamCount: Number(info.teamCount),
                    currentTeamVolume: info.teamTotalVolume,
                    ticketAmount: ticketAmt,
                    isActive: info.isActive,
                });

                if (referrer !== ethers.ZeroAddress.toLowerCase()) {
                    if (!referrerToUsers.has(referrer)) referrerToUsers.set(referrer, []);
                    const list = referrerToUsers.get(referrer);
                    if (!list.includes(addr)) list.push(addr);
                }
            } catch (_) {}
        }));
        done += batch.length;
        if (done % 100 === 0 || done === userList.length) {
            process.stdout.write(`\r  已查询 ${done}/${userList.length} ...`);
        }
    }
    console.log("");

    // 第3步：递归计算正确的 teamCount 和 teamTotalVolume
    console.log("\n  [3/4] 递归计算正确值...");

    const correctCountCache = new Map();
    const correctVolumeCache = new Map();

    // teamCount = 所有下游用户的总数（不含自己）
    function calcCorrectCount(addr, visited = new Set()) {
        if (correctCountCache.has(addr)) return correctCountCache.get(addr);
        if (visited.has(addr)) return 0;
        visited.add(addr);

        let count = 0;
        const directs = referrerToUsers.get(addr) || [];
        for (const child of directs) {
            count += 1; // 这个孩子
            count += calcCorrectCount(child, visited); // 孩子的下游
        }
        correctCountCache.set(addr, count);
        return count;
    }

    // teamTotalVolume = 所有下游用户的门票之和（不含自己）
    function calcCorrectVolume(addr, visited = new Set()) {
        if (correctVolumeCache.has(addr)) return correctVolumeCache.get(addr);
        if (visited.has(addr)) return 0n;
        visited.add(addr);

        let volume = 0n;
        const directs = referrerToUsers.get(addr) || [];
        for (const child of directs) {
            const data = userDataMap.get(child);
            volume += data ? data.ticketAmount : 0n;
            volume += calcCorrectVolume(child, visited);
        }
        correctVolumeCache.set(addr, volume);
        return volume;
    }

    for (const addr of userList) {
        calcCorrectCount(addr);
        calcCorrectVolume(addr);
    }

    // 第4步：对比
    console.log("\n  [4/4] 对比结果...");

    const countDiffs = [];
    const volumeDiffs = [];

    for (const addr of userList) {
        const data = userDataMap.get(addr);
        if (!data) continue;

        const correctCount = correctCountCache.get(addr) || 0;
        const correctVolume = correctVolumeCache.get(addr) || 0n;

        if (data.currentTeamCount !== correctCount) {
            countDiffs.push({
                address: addr,
                current: data.currentTeamCount,
                correct: correctCount,
                delta: correctCount - data.currentTeamCount,
            });
        }

        if (data.currentTeamVolume !== correctVolume) {
            volumeDiffs.push({
                address: addr,
                current: data.currentTeamVolume,
                correct: correctVolume,
                delta: correctVolume - data.currentTeamVolume,
            });
        }
    }

    // 输出 teamCount 差异
    countDiffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    volumeDiffs.sort((a, b) => {
        const absA = a.delta < 0n ? -a.delta : a.delta;
        const absB = b.delta < 0n ? -b.delta : b.delta;
        return absB > absA ? 1 : absB < absA ? -1 : 0;
    });

    console.log("\n" + "━".repeat(80));
    console.log("  teamCount（团队总人数）差异");
    console.log("━".repeat(80));
    console.log(`  异常用户数: ${countDiffs.length} / ${userList.length}`);

    if (countDiffs.length > 0) {
        let needUp = 0, needDown = 0;
        countDiffs.forEach(d => d.delta > 0 ? needUp++ : needDown++);
        console.log(`  需要调高: ${needUp} 个, 需要调低: ${needDown} 个\n`);

        console.log("  #   地址                                           当前值     正确值      差额");
        console.log("  " + "─".repeat(76));
        countDiffs.forEach((d, i) => {
            const sign = d.delta > 0 ? "+" : "";
            console.log(`  ${String(i + 1).padStart(3)}  ${d.address}  ${String(d.current).padStart(8)}  ${String(d.correct).padStart(8)}  ${(sign + d.delta).padStart(8)}`);
        });
    } else {
        console.log("  ✅ 所有用户的 teamCount 均正确，无需修复");
    }

    console.log("\n" + "━".repeat(80));
    console.log("  teamTotalVolume（团队总业绩）差异");
    console.log("━".repeat(80));
    console.log(`  异常用户数: ${volumeDiffs.length} / ${userList.length}`);

    if (volumeDiffs.length > 0) {
        let needUp = 0, needDown = 0;
        volumeDiffs.forEach(d => d.delta > 0n ? needUp++ : needDown++);
        console.log(`  需要调高: ${needUp} 个, 需要调低: ${needDown} 个\n`);

        console.log("  #   地址                                           当前值         正确值         差额");
        console.log("  " + "─".repeat(80));
        volumeDiffs.forEach((d, i) => {
            const sign = d.delta > 0n ? "+" : "";
            console.log(`  ${String(i + 1).padStart(3)}  ${d.address}  ${ethers.formatEther(d.current).padStart(12)}  ${ethers.formatEther(d.correct).padStart(12)}  ${(sign + ethers.formatEther(d.delta)).padStart(12)}`);
        });
    } else {
        console.log("  ✅ 所有用户的 teamTotalVolume 均正确，无需修复");
    }

    // 汇总
    console.log("\n" + "━".repeat(80));
    console.log("  汇总");
    console.log("━".repeat(80));
    console.log(`  teamCount 需修复:        ${countDiffs.length} 个用户`);
    console.log(`  teamTotalVolume 需修复:  ${volumeDiffs.length} 个用户`);

    // 两者都有问题的用户
    const countSet = new Set(countDiffs.map(d => d.address));
    const volumeSet = new Set(volumeDiffs.map(d => d.address));
    const bothWrong = [...countSet].filter(a => volumeSet.has(a));
    const onlyCount = [...countSet].filter(a => !volumeSet.has(a));
    const onlyVolume = [...volumeSet].filter(a => !countSet.has(a));

    console.log(`  两者都错:                ${bothWrong.length} 个用户`);
    console.log(`  仅 teamCount 错:         ${onlyCount.length} 个用户`);
    console.log(`  仅 teamTotalVolume 错:   ${onlyVolume.length} 个用户`);

    console.log("\n" + "═".repeat(80));
    console.log("  完成");
    console.log("═".repeat(80) + "\n");
}

main().catch(e => {
    console.error("❌ 错误:", e);
    process.exit(1);
});
