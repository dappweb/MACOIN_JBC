const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

/**
 * 从事件获取所有用户及其推荐关系
 */
async function getAllUsersAndReferrers(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    
    const referrerMap = new Map(); // user -> referrer
    const allUsers = new Set();
    
    // 从新旧合约获取所有 BoundReferrer 事件
    for (const protocol of [newProtocol, oldProtocol]) {
        try {
            const events = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock,
                currentBlock
            );
            events.forEach(event => {
                if (event.args && event.args.referrer && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const referrer = event.args.referrer.toLowerCase();
                    const blockNumber = event.blockNumber || (event.log && event.log.blockNumber) || 0;
                    // 如果用户还没有推荐人，或者新事件的区块号更大，则更新
                    const existing = referrerMap.get(user);
                    if (!existing || blockNumber > (existing.blockNumber || 0)) {
                        referrerMap.set(user, { referrer, blockNumber });
                    }
                    allUsers.add(user);
                    allUsers.add(referrer);
                }
            });
        } catch (error) {
            console.warn(`⚠️ 无法从合约事件获取用户: ${error.message}`);
        }
    }
    
    return { referrerMap, allUsers };
}

/**
 * 获取用户链上的 teamCount
 */
async function getUserTeamCount(userAddress, newProtocol, oldProtocol) {
    let maxTeamCount = 0n;
    
    try {
        const newUserInfo = await newProtocol.userInfo(userAddress);
        maxTeamCount = newUserInfo.teamCount;
    } catch (error) {
        // 用户不在新合约中
    }
    
    try {
        const oldUserInfo = await oldProtocol.userInfo(userAddress);
        if (oldUserInfo.teamCount > maxTeamCount) {
            maxTeamCount = oldUserInfo.teamCount;
        }
    } catch (error) {
        // 用户不在旧合约中
    }
    
    return Number(maxTeamCount);
}

/**
 * 验证推荐关系层级中 teamCount 是否从上到下依次减少
 */
async function verifyTeamCountHierarchy() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 验证推荐关系层级中 teamCount 是否从上到下依次减少");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 获取所有用户和推荐关系
    console.log("📋 步骤 1: 获取所有用户和推荐关系...");
    const { referrerMap, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 找到 ${allUsers.size} 个用户`);
    console.log(`  ✅ 构建了 ${referrerMap.size} 个推荐关系\n`);

    // 步骤 2: 获取所有用户的 teamCount
    console.log("📋 步骤 2: 获取所有用户的 teamCount...");
    const userTeamCounts = new Map();
    let processedCount = 0;
    
    for (const userAddress of allUsers) {
        const teamCount = await getUserTeamCount(userAddress, newProtocol, oldProtocol);
        userTeamCounts.set(userAddress, teamCount);
        
        processedCount++;
        if (processedCount % 100 === 0) {
            console.log(`  ⏳ 已处理: ${processedCount}/${allUsers.size}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`  ✅ 已获取 ${userTeamCounts.size} 个用户的 teamCount\n`);

    // 步骤 3: 验证层级关系
    console.log("📋 步骤 3: 验证推荐关系层级...");
    const violations = [];
    let validCount = 0;
    let totalChecked = 0;

    for (const [userAddress, referrerData] of referrerMap.entries()) {
        const referrer = referrerData.referrer;
        
        if (referrer === ethers.ZeroAddress.toLowerCase()) {
            continue; // 跳过没有推荐人的用户（根用户）
        }

        const userTeamCount = userTeamCounts.get(userAddress) || 0;
        const referrerTeamCount = userTeamCounts.get(referrer) || 0;

        totalChecked++;

        // 验证：推荐人的 teamCount 应该 >= 被推荐人的 teamCount
        // 因为推荐人的团队包含被推荐人及其所有下线
        if (referrerTeamCount < userTeamCount) {
            violations.push({
                user: userAddress,
                referrer: referrer,
                userTeamCount,
                referrerTeamCount,
                difference: userTeamCount - referrerTeamCount
            });
        } else {
            validCount++;
        }
    }

    // 输出结果
    console.log("\n" + "=".repeat(80));
    console.log("📊 验证结果");
    console.log("=".repeat(80));
    console.log(`总检查数: ${totalChecked}`);
    console.log(`✅ 符合逻辑: ${validCount} (${((validCount / totalChecked) * 100).toFixed(2)}%)`);
    console.log(`❌ 违反逻辑: ${violations.length} (${((violations.length / totalChecked) * 100).toFixed(2)}%)`);

    if (violations.length > 0) {
        console.log("\n📋 违反逻辑的用户（前20个）:");
        violations
            .sort((a, b) => b.difference - a.difference)
            .slice(0, 20)
            .forEach((violation, index) => {
                console.log(`\n${index + 1}. 用户: ${violation.user}`);
                console.log(`   推荐人: ${violation.referrer}`);
                console.log(`   用户 teamCount: ${violation.userTeamCount.toLocaleString()}`);
                console.log(`   推荐人 teamCount: ${violation.referrerTeamCount.toLocaleString()}`);
                console.log(`   差异: +${violation.difference.toLocaleString()} (用户 > 推荐人，违反逻辑)`);
            });
    } else {
        console.log("\n✅ 所有推荐关系都符合逻辑！");
        console.log("   推荐人的 teamCount >= 被推荐人的 teamCount");
    }

    // 统计信息
    if (violations.length > 0) {
        const maxViolation = violations.reduce((max, v) => v.difference > max.difference ? v : max, violations[0]);
        const avgViolation = violations.reduce((sum, v) => sum + v.difference, 0) / violations.length;
        
        console.log("\n📊 违反逻辑统计:");
        console.log(`   最大差异: ${maxViolation.difference.toLocaleString()}`);
        console.log(`   平均差异: ${avgViolation.toFixed(2)}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 验证完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    verifyTeamCountHierarchy().catch(console.error);
}
