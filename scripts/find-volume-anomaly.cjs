/**
 * 查找所有"推荐人的团队总业绩 < 被推荐人的团队总业绩"的异常账号
 * 
 * 原理：推荐人的 teamTotalVolume 应该 >= 其下属所有人的 teamTotalVolume
 *       如果推荐人的业绩反而比下属少，说明数据有问题
 * 
 * 用法: node scripts/find-volume-anomaly.cjs
 */

const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "═".repeat(80));
    console.log("  查找推荐人团队业绩 < 被推荐人团队业绩的异常账号");
    console.log("  查询时间:", new Date().toLocaleString('zh-CN'));
    console.log("═".repeat(80));

    // 第1步：从链上事件获取所有推荐关系
    console.log("\n  正在从链上获取推荐关系...");
    const referrerMap = new Map(); // user -> referrer
    const referrerToUsers = new Map(); // referrer -> [users]
    const allUsers = new Set();

    for (const proto of [protocol, oldProtocol]) {
        try {
            const currentBlock = await provider.getBlockNumber();
            const events = await proto.queryFilter(
                proto.filters.BoundReferrer(),
                0,
                currentBlock
            );
            events.forEach(event => {
                if (event.args && event.args.referrer && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const referrer = event.args.referrer.toLowerCase();
                    allUsers.add(user);
                    allUsers.add(referrer);
                    referrerMap.set(user, referrer);
                    if (!referrerToUsers.has(referrer)) {
                        referrerToUsers.set(referrer, []);
                    }
                    if (!referrerToUsers.get(referrer).includes(user)) {
                        referrerToUsers.get(referrer).push(user);
                    }
                }
            });
        } catch (error) {
            console.warn(`  ⚠ 获取事件失败: ${error.message}`);
        }
    }
    console.log(`  ✅ 总用户数: ${allUsers.size}`);
    console.log(`  ✅ 有推荐关系的用户数: ${referrerMap.size}`);

    // 第2步：批量查询所有用户的 userInfo
    console.log("\n  正在查询所有用户的合约数据...");
    const userDataMap = new Map(); // address -> { teamTotalVolume, activeDirects, teamCount, isActive, ... }
    const userList = Array.from(allUsers);
    
    let queryCount = 0;
    const batchSize = 20;
    for (let i = 0; i < userList.length; i += batchSize) {
        const batch = userList.slice(i, i + batchSize);
        const promises = batch.map(async (addr) => {
            try {
                const info = await protocol.userInfo(addr);
                let ticketAmount = 0n;
                try {
                    const ticket = await protocol.userTicket(addr);
                    if (!ticket.exited) {
                        ticketAmount = ticket.amount ?? 0n;
                    }
                } catch (_) {}
                
                userDataMap.set(addr, {
                    referrer: info.referrer.toLowerCase(),
                    activeDirects: Number(info.activeDirects),
                    teamCount: Number(info.teamCount),
                    isActive: info.isActive,
                    totalRevenue: info.totalRevenue,
                    currentCap: info.currentCap,
                    teamTotalVolume: info.teamTotalVolume,
                    teamTotalCap: info.teamTotalCap,
                    ticketAmount: ticketAmount,
                });
            } catch (e) {
                // skip
            }
        });
        await Promise.all(promises);
        queryCount += batch.length;
        if (queryCount % 100 === 0 || queryCount === userList.length) {
            process.stdout.write(`\r  已查询 ${queryCount}/${userList.length} ...`);
        }
    }
    console.log(`\n  ✅ 成功查询 ${userDataMap.size} 个用户`);

    // 第3步：找出异常——推荐人的 teamTotalVolume < 被推荐人的 teamTotalVolume
    console.log("\n" + "━".repeat(80));
    console.log("  异常报告：推荐人团队总业绩 < 被推荐人团队总业绩");
    console.log("━".repeat(80));

    const anomalies = [];

    for (const [user, referrer] of referrerMap.entries()) {
        if (referrer === ethers.ZeroAddress.toLowerCase()) continue;

        const userData = userDataMap.get(user);
        const referrerData = userDataMap.get(referrer);

        if (!userData || !referrerData) continue;

        const userVolume = userData.teamTotalVolume;
        const referrerVolume = referrerData.teamTotalVolume;

        if (referrerVolume < userVolume) {
            anomalies.push({
                user,
                referrer,
                userVolume,
                referrerVolume,
                diff: userVolume - referrerVolume,
                userTeamCount: userData.teamCount,
                referrerTeamCount: referrerData.teamCount,
                userTicket: userData.ticketAmount,
                referrerTicket: referrerData.ticketAmount,
                userActive: userData.isActive,
                referrerActive: referrerData.isActive,
            });
        }
    }

    // 按差额从大到小排序
    anomalies.sort((a, b) => (b.diff > a.diff ? 1 : b.diff < a.diff ? -1 : 0));

    console.log(`\n  共发现 ${anomalies.length} 个异常\n`);

    if (anomalies.length === 0) {
        console.log("  ✅ 没有发现推荐人业绩 < 被推荐人业绩的异常情况\n");
    } else {
        for (let i = 0; i < anomalies.length; i++) {
            const a = anomalies[i];
            console.log(`  [${ i + 1}] ─────────────────────────────────────────────`);
            console.log(`  被推荐人: ${a.user}`);
            console.log(`    团队总业绩: ${ethers.formatEther(a.userVolume)} MC`);
            console.log(`    团队人数:   ${a.userTeamCount}`);
            console.log(`    门票金额:   ${ethers.formatEther(a.userTicket)} MC`);
            console.log(`    是否激活:   ${a.userActive}`);
            console.log(`  推荐人:   ${a.referrer}`);
            console.log(`    团队总业绩: ${ethers.formatEther(a.referrerVolume)} MC`);
            console.log(`    团队人数:   ${a.referrerTeamCount}`);
            console.log(`    门票金额:   ${ethers.formatEther(a.referrerTicket)} MC`);
            console.log(`    是否激活:   ${a.referrerActive}`);
            console.log(`  ⚠ 差额:     ${ethers.formatEther(a.diff)} MC (推荐人少了这么多)`);
            console.log("");
        }
    }

    // 第4步：分析问题根因
    console.log("\n" + "━".repeat(80));
    console.log("  问题根因分析");
    console.log("━".repeat(80));

    if (anomalies.length > 0) {
        // 统计分类
        const referrerNotActive = anomalies.filter(a => !a.referrerActive);
        const referrerTeamCountLess = anomalies.filter(a => a.referrerTeamCount < a.userTeamCount);
        const bothActive = anomalies.filter(a => a.referrerActive && a.userActive);

        // 检查是否有推荐人的 teamTotalVolume 为 0
        const referrerVolumeZero = anomalies.filter(a => a.referrerVolume === 0n);

        // 检查推荐人是否也出现在其他异常中（链式问题）
        const referrerSet = new Set(anomalies.map(a => a.referrer));
        const userSet = new Set(anomalies.map(a => a.user));
        const chainIssues = anomalies.filter(a => referrerSet.has(a.user) || userSet.has(a.referrer));

        console.log(`\n  1. 推荐人未激活导致业绩不计入:     ${referrerNotActive.length} 个`);
        console.log(`  2. 推荐人团队人数也比下属少:       ${referrerTeamCountLess.length} 个`);
        console.log(`  3. 推荐人业绩为0但下属有业绩:      ${referrerVolumeZero.length} 个`);
        console.log(`  4. 双方都激活但业绩仍异常:         ${bothActive.length} 个`);
        console.log(`  5. 存在链式传递问题(多层异常):     ${chainIssues.length} 个`);

        console.log("\n  可能的原因:");
        console.log("  ─────────────────────────────────────────────");
        
        if (referrerVolumeZero.length > 0) {
            console.log("  ❌ 原因1: 合约升级/数据迁移时，推荐人的 teamTotalVolume 没有正确同步");
            console.log("     - 旧合约迁移到新合约时，部分推荐人的团队业绩数据丢失");
            console.log("     - 需要重新计算这些推荐人的 teamTotalVolume");
        }
        
        if (bothActive.length > 0) {
            console.log("  ❌ 原因2: teamTotalVolume 累加逻辑存在问题");
            console.log("     - 当下级用户购买门票时，业绩没有正确向上层推荐人累加");
            console.log("     - 或者用户退票时扣减了推荐人业绩但没扣减下属记录");
        }

        if (referrerTeamCountLess.length > 0) {
            console.log("  ❌ 原因3: teamCount 数据也不一致");
            console.log("     - 推荐人的团队人数比下属还少，说明整体团队数据维护有问题");
        }

        if (chainIssues.length > 0) {
            console.log("  ❌ 原因4: 链式传递问题");
            console.log("     - 某个中间节点的数据错误导致上层推荐人的数据全部偏低");
        }

        // 计算需要修复的总金额
        let totalDiff = 0n;
        for (const a of anomalies) {
            totalDiff += a.diff;
        }
        console.log(`\n  📊 需要修复的总业绩差额: ${ethers.formatEther(totalDiff)} MC`);

        // 列出受影响最大的推荐人（去重）
        const affectedReferrers = new Map();
        for (const a of anomalies) {
            if (!affectedReferrers.has(a.referrer)) {
                affectedReferrers.set(a.referrer, {
                    address: a.referrer,
                    currentVolume: a.referrerVolume,
                    maxSubVolume: a.userVolume,
                    affectedCount: 1,
                    teamCount: a.referrerTeamCount,
                });
            } else {
                const existing = affectedReferrers.get(a.referrer);
                existing.affectedCount++;
                if (a.userVolume > existing.maxSubVolume) {
                    existing.maxSubVolume = a.userVolume;
                }
            }
        }

        const sortedReferrers = Array.from(affectedReferrers.values())
            .sort((a, b) => b.affectedCount - a.affectedCount);

        console.log(`\n  受影响的推荐人 (共 ${sortedReferrers.length} 个):`);
        for (const r of sortedReferrers) {
            console.log(`    ${r.address}`);
            console.log(`      当前团队业绩: ${ethers.formatEther(r.currentVolume)} MC`);
            console.log(`      下属最大业绩: ${ethers.formatEther(r.maxSubVolume)} MC`);
            console.log(`      团队人数: ${r.teamCount}`);
            console.log(`      涉及异常下属数: ${r.affectedCount}`);
        }
    }

    console.log("\n" + "═".repeat(80));
    console.log("  ✅ 分析完成");
    console.log("═".repeat(80) + "\n");
}

main().catch((e) => {
    console.error("❌ 错误:", e);
    process.exit(1);
});
