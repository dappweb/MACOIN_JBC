/**
 * 全量重算 teamTotalVolume + 生成修复方案 + 修复前后数据对比
 * 
 * 逻辑：
 *   teamTotalVolume(X) = 所有下游用户(不含X自己)的门票金额之和
 *   即：递归遍历X的直推及其下级，把每个人的 userTicket.amount 累加
 * 
 * 用法:
 *   node scripts/fix-all-team-volumes.cjs              # 干跑（只输出对比报告）
 *   node scripts/fix-all-team-volumes.cjs --execute     # 实际执行修复
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
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function owner() view returns (address)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

const EXECUTE = process.argv.includes("--execute");

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "═".repeat(80));
    console.log("  teamTotalVolume 全量重算 & 修复方案");
    console.log("  模式:", EXECUTE ? "⚡ 实际执行" : "🔍 模拟运行 (加 --execute 参数执行修复)");
    console.log("  时间:", new Date().toLocaleString("zh-CN"));
    console.log("═".repeat(80));

    const BATCH = 20;

    // ── 第1步：获取所有用户地址（从事件），然后从合约读取实际推荐关系 ──
    console.log("\n  [1/5] 获取用户列表 & 从合约读取实际推荐关系...");
    const allUsers = new Set();

    // 先从事件获取所有用户地址
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
    console.log(`  ✅ 从事件获取用户数: ${allUsers.size}`);

    // 从合约 userInfo 读取每个用户的实际 referrer（合约才是 ground truth）
    console.log("  正在从合约读取每个用户的实际推荐人...");
    const referrerMap = new Map();   // user -> referrer (from contract)
    const referrerToUsers = new Map(); // referrer -> [direct users]
    const userListTemp = Array.from(allUsers);
    let qDone = 0;

    for (let i = 0; i < userListTemp.length; i += BATCH) {
        const batch = userListTemp.slice(i, i + BATCH);
        await Promise.all(batch.map(async (addr) => {
            try {
                const info = await protocol.userInfo(addr);
                const referrer = info.referrer.toLowerCase();
                if (referrer !== ethers.ZeroAddress.toLowerCase() && referrer !== "0x0000000000000000000000000000000000000000") {
                    referrerMap.set(addr, referrer);
                    if (!referrerToUsers.has(referrer)) referrerToUsers.set(referrer, []);
                    const list = referrerToUsers.get(referrer);
                    if (!list.includes(addr)) list.push(addr);
                }
            } catch (_) {}
        }));
        qDone += batch.length;
        if (qDone % 100 === 0 || qDone === userListTemp.length) {
            process.stdout.write(`\r  已查询 ${qDone}/${userListTemp.length} ...`);
        }
    }
    console.log(`\n  ✅ 用户总数 ${allUsers.size}，有推荐关系(合约) ${referrerMap.size}`);

    // ── 第2步：批量查询所有用户当前门票金额 ────────────────────────
    console.log("\n  [2/5] 批量查询所有用户门票金额...");
    const userTicketMap = new Map(); // address -> ticketAmount (bigint)
    const userList = Array.from(allUsers);
    let done = 0;

    for (let i = 0; i < userList.length; i += BATCH) {
        const batch = userList.slice(i, i + BATCH);
        await Promise.all(batch.map(async (addr) => {
            try {
                const ticket = await protocol.userTicket(addr);
                // 只计算未退出的门票
                const amt = (!ticket.exited && ticket.amount) ? ticket.amount : 0n;
                userTicketMap.set(addr, amt);
            } catch (_) {
                userTicketMap.set(addr, 0n);
            }
        }));
        done += batch.length;
        if (done % 100 === 0 || done === userList.length) {
            process.stdout.write(`\r  已查询 ${done}/${userList.length} ...`);
        }
    }
    console.log(`\n  ✅ 完成`);

    // ── 第3步：递归计算每个用户的正确 teamTotalVolume ──────────────
    console.log("\n  [3/5] 递归计算正确的 teamTotalVolume...");

    // 缓存：address -> correctTeamTotalVolume (bigint)
    const correctVolumeCache = new Map();

    /**
     * 计算 addr 的 teamTotalVolume = 所有下游用户的门票之和（不含 addr 自身）
     */
    function calcCorrectVolume(addr, visited = new Set()) {
        if (correctVolumeCache.has(addr)) return correctVolumeCache.get(addr);
        if (visited.has(addr)) return 0n; // 防环
        visited.add(addr);

        let volume = 0n;
        const directs = referrerToUsers.get(addr) || [];
        for (const child of directs) {
            // 加上这个孩子自身的门票
            volume += userTicketMap.get(child) || 0n;
            // 加上这个孩子的下游门票
            volume += calcCorrectVolume(child, visited);
        }

        correctVolumeCache.set(addr, volume);
        return volume;
    }

    for (const addr of userList) {
        calcCorrectVolume(addr);
    }
    console.log(`  ✅ 计算完毕，共 ${correctVolumeCache.size} 个用户`);

    // ── 第4步：查询链上当前值并对比，找出需要修复的 ────────────────
    console.log("\n  [4/5] 对比链上数据，寻找差异...");

    const currentVolumeMap = new Map(); // address -> current on-chain teamTotalVolume (bigint)
    done = 0;
    for (let i = 0; i < userList.length; i += BATCH) {
        const batch = userList.slice(i, i + BATCH);
        await Promise.all(batch.map(async (addr) => {
            try {
                const info = await protocol.userInfo(addr);
                currentVolumeMap.set(addr, info.teamTotalVolume);
            } catch (_) {
                currentVolumeMap.set(addr, 0n);
            }
        }));
        done += batch.length;
        if (done % 100 === 0 || done === userList.length) {
            process.stdout.write(`\r  已查询 ${done}/${userList.length} ...`);
        }
    }
    console.log("");

    // 比较
    const diffs = [];
    for (const addr of userList) {
        const correct = correctVolumeCache.get(addr) || 0n;
        const current = currentVolumeMap.get(addr) || 0n;
        if (correct !== current) {
            diffs.push({
                address: addr,
                current,
                correct,
                delta: correct - current,
            });
        }
    }

    // 按 |delta| 从大到小排序
    diffs.sort((a, b) => {
        const absA = a.delta < 0n ? -a.delta : a.delta;
        const absB = b.delta < 0n ? -b.delta : b.delta;
        return absB > absA ? 1 : absB < absA ? -1 : 0;
    });

    // ── 第5步：输出报告 ────────────────────────────────────────
    console.log("\n" + "━".repeat(80));
    console.log("  修复方案 & 数据对比报告");
    console.log("━".repeat(80));
    console.log(`\n  需要修复的用户数: ${diffs.length} / ${userList.length}`);

    if (diffs.length === 0) {
        console.log("\n  ✅ 所有用户的 teamTotalVolume 均正确，无需修复\n");
        return;
    }

    // 汇总统计
    let totalPositiveDelta = 0n;
    let totalNegativeDelta = 0n;
    let positiveCount = 0;
    let negativeCount = 0;

    for (const d of diffs) {
        if (d.delta > 0n) {
            totalPositiveDelta += d.delta;
            positiveCount++;
        } else {
            totalNegativeDelta += d.delta;
            negativeCount++;
        }
    }

    console.log(`  需要调高的: ${positiveCount} 个用户，总计 +${ethers.formatEther(totalPositiveDelta)} MC`);
    console.log(`  需要调低的: ${negativeCount} 个用户，总计 ${ethers.formatEther(totalNegativeDelta)} MC`);
    console.log("");

    // 详细列表
    console.log("  " + "─".repeat(76));
    console.log("  #   地址                                           当前值           正确值           差额");
    console.log("  " + "─".repeat(76));

    const levelNames = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5'];

    for (let i = 0; i < diffs.length; i++) {
        const d = diffs[i];
        const curStr = ethers.formatEther(d.current).padStart(12);
        const corStr = ethers.formatEther(d.correct).padStart(12);
        const deltaSign = d.delta > 0n ? "+" : "";
        const deltaStr = (deltaSign + ethers.formatEther(d.delta)).padStart(12);
        console.log(`  ${String(i + 1).padStart(3)}  ${d.address}  ${curStr}  ${corStr}  ${deltaStr}`);
    }
    console.log("  " + "─".repeat(76));

    // 验证：修复后不再有 "推荐人业绩 < 被推荐人业绩" 的异常
    console.log("\n\n" + "━".repeat(80));
    console.log("  修复后验证：推荐人团队业绩 vs 被推荐人团队业绩");
    console.log("━".repeat(80));

    let anomalyAfterFix = 0;
    for (const [user, referrer] of referrerMap.entries()) {
        if (referrer === ethers.ZeroAddress.toLowerCase()) continue;
        const userVol = correctVolumeCache.get(user) || 0n;
        const refVol = correctVolumeCache.get(referrer) || 0n;
        if (refVol < userVol) {
            anomalyAfterFix++;
            console.log(`  ⚠ 仍异常: 推荐人 ${referrer} (${ethers.formatEther(refVol)}) < 被推荐人 ${user} (${ethers.formatEther(userVol)})`);
        }
    }
    if (anomalyAfterFix === 0) {
        console.log("\n  ✅ 修复后所有推荐关系的团队业绩均满足 推荐人 >= 被推荐人，不再有异常！\n");
    } else {
        console.log(`\n  ⚠ 修复后仍有 ${anomalyAfterFix} 个异常（可能是特殊情况需进一步分析）\n`);
    }

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

        // 验证权限
        const owner = await protocolWithSigner.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`\n  ❌ 权限不足：合约Owner为 ${owner}，当前钱包为 ${wallet.address}\n`);
            return;
        }
        console.log(`  合约Owner: ${owner}`);
        console.log(`  当前钱包: ${wallet.address}`);
        console.log(`  待修复用户: ${diffs.length}\n`);

        let success = 0;
        let fail = 0;
        for (let i = 0; i < diffs.length; i++) {
            const d = diffs[i];
            const deltaSign = d.delta > 0n ? "+" : "";
            process.stdout.write(`  [${i + 1}/${diffs.length}] ${d.address} (${deltaSign}${ethers.formatEther(d.delta)}) ... `);
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

        console.log(`\n  修复结果: 成功 ${success}，失败 ${fail}`);

        // 修复后再次验证
        if (success > 0) {
            console.log("\n  修复后验证...");
            let postFixAnomalies = 0;
            for (const [user, referrer] of referrerMap.entries()) {
                if (referrer === ethers.ZeroAddress.toLowerCase()) continue;
                try {
                    const uInfo = await protocol.userInfo(user);
                    const rInfo = await protocol.userInfo(referrer);
                    if (rInfo.teamTotalVolume < uInfo.teamTotalVolume) {
                        postFixAnomalies++;
                    }
                } catch (_) {}
            }
            if (postFixAnomalies === 0) {
                console.log("  ✅ 验证通过：修复后不再有推荐人业绩 < 被推荐人业绩的异常");
            } else {
                console.log(`  ⚠ 修复后仍有 ${postFixAnomalies} 个异常`);
            }
        }
    } else {
        console.log("\n  💡 以上为模拟结果。确认无误后，执行修复命令：");
        console.log("     node scripts/fix-all-team-volumes.cjs --execute\n");
    }

    console.log("═".repeat(80));
    console.log("  完成");
    console.log("═".repeat(80) + "\n");
}

main().catch(e => {
    console.error("❌ 错误:", e);
    process.exit(1);
});
