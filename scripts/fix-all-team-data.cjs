/**
 * 全量重算 teamCount + teamTotalVolume，一次性修复两项数据
 * 
 * 逻辑：
 *   teamCount(X)       = X 的所有下游用户总数（不含 X 自己）
 *   teamTotalVolume(X)  = X 的所有下游用户的门票金额之和（不含 X 自己）
 * 
 * 使用合约的 adminSetTeamCount + adminSetTeamTotalVolume 进行修复
 * 
 * 用法:
 *   node scripts/fix-all-team-data.cjs              # 干跑（只输出对比报告）
 *   node scripts/fix-all-team-data.cjs --execute     # 实际执行修复
 */

const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function owner() view returns (address)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

const BATCH = 20;
const EXECUTE = process.argv.includes("--execute");

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "═".repeat(80));
    console.log("  teamCount + teamTotalVolume 全量重算 & 修复");
    console.log("  模式:", EXECUTE ? "⚡ 实际执行" : "🔍 模拟运行 (加 --execute 参数执行修复)");
    console.log("  时间:", new Date().toLocaleString("zh-CN"));
    console.log("═".repeat(80));

    // ── 第1步：获取所有用户地址 + 从合约读取实际推荐关系 ──────────
    console.log("\n  [1/4] 获取用户列表 & 合约推荐关系...");
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
        } catch (e) {
            console.warn("  ⚠ 事件获取异常:", e.message);
        }
    }
    console.log(`  用户数(事件): ${allUsers.size}`);

    // 从合约读取实际 referrer + 当前 teamCount/teamTotalVolume + 门票
    console.log("  从合约读取用户数据...");
    const referrerToUsers = new Map();
    const userDataMap = new Map();
    const userList = Array.from(allUsers);
    let done = 0;

    for (let i = 0; i < userList.length; i += BATCH) {
        const batch = userList.slice(i, i + BATCH);
        await Promise.all(batch.map(async (addr) => {
            try {
                const [info, ticket] = await Promise.all([
                    protocol.userInfo(addr),
                    protocol.userTicket(addr),
                ]);
                const referrer = info.referrer.toLowerCase();
                const ticketAmt = (!ticket.exited && ticket.amount) ? ticket.amount : 0n;

                userDataMap.set(addr, {
                    referrer,
                    currentTeamCount: Number(info.teamCount),
                    currentTeamVolume: info.teamTotalVolume,
                    ticketAmount: ticketAmt,
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
    console.log(`\n  ✅ 成功读取 ${userDataMap.size} 个用户`);

    // ── 第2步：递归计算正确的 teamCount 和 teamTotalVolume ────────
    console.log("\n  [2/4] 递归计算正确值...");

    const correctCountCache = new Map();
    const correctVolumeCache = new Map();

    function calcCorrectCount(addr, visited = new Set()) {
        if (correctCountCache.has(addr)) return correctCountCache.get(addr);
        if (visited.has(addr)) return 0;
        visited.add(addr);
        let count = 0;
        for (const child of (referrerToUsers.get(addr) || [])) {
            count += 1;
            count += calcCorrectCount(child, visited);
        }
        correctCountCache.set(addr, count);
        return count;
    }

    function calcCorrectVolume(addr, visited = new Set()) {
        if (correctVolumeCache.has(addr)) return correctVolumeCache.get(addr);
        if (visited.has(addr)) return 0n;
        visited.add(addr);
        let volume = 0n;
        for (const child of (referrerToUsers.get(addr) || [])) {
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
    console.log(`  ✅ 计算完毕`);

    // ── 第3步：对比找差异 ────────────────────────────────────────
    console.log("\n  [3/4] 对比数据...");

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

    countDiffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    volumeDiffs.sort((a, b) => {
        const absA = a.delta < 0n ? -a.delta : a.delta;
        const absB = b.delta < 0n ? -b.delta : b.delta;
        return absB > absA ? 1 : absB < absA ? -1 : 0;
    });

    // ── 第4步：输出报告 ─────────────────────────────────────────
    // === teamCount 报告 ===
    console.log("\n" + "━".repeat(80));
    console.log("  一、teamCount（团队总人数）修复方案");
    console.log("━".repeat(80));
    console.log(`  需修复: ${countDiffs.length} / ${userList.length} 个用户`);

    if (countDiffs.length > 0) {
        let up = countDiffs.filter(d => d.delta > 0).length;
        let down = countDiffs.filter(d => d.delta < 0).length;
        console.log(`  需调高: ${up} 个, 需调低: ${down} 个\n`);

        console.log("  #   地址                                           当前值     正确值      差额");
        console.log("  " + "─".repeat(76));
        countDiffs.forEach((d, i) => {
            const sign = d.delta > 0 ? "+" : "";
            console.log(`  ${String(i + 1).padStart(3)}  ${d.address}  ${String(d.current).padStart(8)}  ${String(d.correct).padStart(8)}  ${(sign + d.delta).padStart(8)}`);
        });
        console.log("  " + "─".repeat(76));
    } else {
        console.log("  ✅ 所有 teamCount 均正确");
    }

    // === teamTotalVolume 报告 ===
    console.log("\n" + "━".repeat(80));
    console.log("  二、teamTotalVolume（团队总业绩）修复方案");
    console.log("━".repeat(80));
    console.log(`  需修复: ${volumeDiffs.length} / ${userList.length} 个用户`);

    if (volumeDiffs.length > 0) {
        let up = volumeDiffs.filter(d => d.delta > 0n).length;
        let down = volumeDiffs.filter(d => d.delta < 0n).length;
        let totalUp = 0n, totalDown = 0n;
        volumeDiffs.forEach(d => d.delta > 0n ? totalUp += d.delta : totalDown += d.delta);
        console.log(`  需调高: ${up} 个 (+${ethers.formatEther(totalUp)} MC)`);
        console.log(`  需调低: ${down} 个 (${ethers.formatEther(totalDown)} MC)\n`);

        console.log("  #   地址                                           当前值         正确值         差额");
        console.log("  " + "─".repeat(80));
        volumeDiffs.forEach((d, i) => {
            const sign = d.delta > 0n ? "+" : "";
            console.log(`  ${String(i + 1).padStart(3)}  ${d.address}  ${ethers.formatEther(d.current).padStart(12)}  ${ethers.formatEther(d.correct).padStart(12)}  ${(sign + ethers.formatEther(d.delta)).padStart(12)}`);
        });
        console.log("  " + "─".repeat(80));
    } else {
        console.log("  ✅ 所有 teamTotalVolume 均正确");
    }

    // === 汇总 ===
    const countSet = new Set(countDiffs.map(d => d.address));
    const volumeSet = new Set(volumeDiffs.map(d => d.address));
    const allFixAddrs = new Set([...countSet, ...volumeSet]);
    const bothWrong = [...countSet].filter(a => volumeSet.has(a));

    console.log("\n" + "━".repeat(80));
    console.log("  三、汇总");
    console.log("━".repeat(80));
    console.log(`  teamCount 需修复:        ${countDiffs.length} 个`);
    console.log(`  teamTotalVolume 需修复:  ${volumeDiffs.length} 个`);
    console.log(`  两者都要修:              ${bothWrong.length} 个`);
    console.log(`  总共需修复的用户:        ${allFixAddrs.size} 个`);
    console.log(`  总共需发送的交易数:      ${countDiffs.length + volumeDiffs.length} 笔`);

    // ── 执行修复 ─────────────────────────────────────────────────
    if (EXECUTE) {
        console.log("\n" + "━".repeat(80));
        console.log("  ⚡ 开始执行链上修复");
        console.log("━".repeat(80));

        if (!process.env.PRIVATE_KEY) {
            console.error("\n  ❌ 请设置 PRIVATE_KEY 环境变量\n");
            return;
        }

        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const protocolWithSigner = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

        const owner = await protocolWithSigner.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`\n  ❌ 权限不足：合约Owner为 ${owner}，当前钱包为 ${wallet.address}\n`);
            return;
        }
        console.log(`  合约Owner: ${owner}`);
        console.log(`  当前钱包: ${wallet.address}\n`);

        let success = 0, fail = 0;

        // 修复 teamCount
        if (countDiffs.length > 0) {
            console.log(`  ── 修复 teamCount (${countDiffs.length} 笔) ──`);
            for (let i = 0; i < countDiffs.length; i++) {
                const d = countDiffs[i];
                const sign = d.delta > 0 ? "+" : "";
                process.stdout.write(`  [${i + 1}/${countDiffs.length}] teamCount ${d.address} ${d.current}→${d.correct} (${sign}${d.delta}) ... `);
                try {
                    const tx = await protocolWithSigner.adminSetTeamCount(
                        d.address,
                        d.correct,
                        { gasLimit: 100000 }
                    );
                    const receipt = await tx.wait();
                    console.log(`✅ 区块 ${receipt.blockNumber}`);
                    success++;
                } catch (e) {
                    console.log(`❌ ${e.message.slice(0, 80)}`);
                    fail++;
                }
            }
        }

        // 修复 teamTotalVolume
        if (volumeDiffs.length > 0) {
            console.log(`\n  ── 修复 teamTotalVolume (${volumeDiffs.length} 笔) ──`);
            for (let i = 0; i < volumeDiffs.length; i++) {
                const d = volumeDiffs[i];
                const sign = d.delta > 0n ? "+" : "";
                process.stdout.write(`  [${i + 1}/${volumeDiffs.length}] teamVolume ${d.address} (${sign}${ethers.formatEther(d.delta)}) ... `);
                try {
                    const tx = await protocolWithSigner.adminSetTeamTotalVolume(
                        d.address,
                        d.correct,
                        { gasLimit: 100000 }
                    );
                    const receipt = await tx.wait();
                    console.log(`✅ 区块 ${receipt.blockNumber}`);
                    success++;
                } catch (e) {
                    console.log(`❌ ${e.message.slice(0, 80)}`);
                    fail++;
                }
            }
        }

        console.log(`\n  修复结果: 成功 ${success} 笔，失败 ${fail} 笔`);

        // 验证
        if (success > 0) {
            console.log("\n  修复后验证...");
            let anomalies = 0;
            for (const addr of allFixAddrs) {
                try {
                    const info = await protocol.userInfo(addr);
                    const correctC = correctCountCache.get(addr) || 0;
                    const correctV = correctVolumeCache.get(addr) || 0n;
                    if (Number(info.teamCount) !== correctC) {
                        console.log(`  ⚠ teamCount 未修正: ${addr} 期望${correctC} 实际${info.teamCount}`);
                        anomalies++;
                    }
                    if (info.teamTotalVolume !== correctV) {
                        console.log(`  ⚠ teamVolume 未修正: ${addr}`);
                        anomalies++;
                    }
                } catch (_) {}
            }
            if (anomalies === 0) {
                console.log("  ✅ 验证全部通过！");
            }
        }
    } else {
        console.log(`\n  💡 以上为模拟结果。确认无误后，执行修复命令：`);
        console.log(`     node scripts/fix-all-team-data.cjs --execute\n`);
    }

    console.log("═".repeat(80));
    console.log("  完成");
    console.log("═".repeat(80) + "\n");
}

main().catch(e => {
    console.error("❌ 错误:", e);
    process.exit(1);
});
