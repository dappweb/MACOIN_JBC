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
    const referrerToUsers = new Map(); // referrer -> [users]
    const allUsers = new Set();
    
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
    
    // 构建反向映射：referrer -> [users]
    referrerMap.forEach((data, user) => {
        const referrer = data.referrer;
        if (referrer !== ethers.ZeroAddress.toLowerCase()) {
            if (!referrerToUsers.has(referrer)) {
                referrerToUsers.set(referrer, []);
            }
            referrerToUsers.get(referrer).push(user);
        }
    });
    
    return { referrerMap, referrerToUsers, allUsers };
}

/**
 * 递归计算用户的真实 teamCount（从下往上）
 * teamCount = 直接下线数 + 所有下线的 teamCount 之和
 */
function calculateTeamCountRecursive(userAddress, referrerToUsers, cache = new Map(), visited = new Set()) {
    if (cache.has(userAddress)) {
        return cache.get(userAddress);
    }
    
    if (visited.has(userAddress)) {
        return 0; // 防止循环
    }
    visited.add(userAddress);
    
    const directReferrals = referrerToUsers.get(userAddress) || [];
    let count = directReferrals.length; // 直接下线数
    
    // 递归计算每个直接下线的 teamCount
    for (const referral of directReferrals) {
        count += calculateTeamCountRecursive(referral, referrerToUsers, cache, new Set(visited));
    }
    
    visited.delete(userAddress);
    cache.set(userAddress, count);
    return count;
}

/**
 * 模拟合约的计算方式：每当有新用户加入，所有上级的 teamCount 都 +1
 * 这是合约中 _updateTeamCount 的逻辑
 */
function calculateTeamCountByContractLogic(userAddress, referrerMap, referrerToUsers) {
    // 合约逻辑：遍历所有用户，如果该用户是目标用户的下线（直接或间接），则计数 +1
    let count = 0;
    const visited = new Set();
    
    function isDescendant(user, target) {
        if (user === target) return true;
        if (visited.has(user)) return false;
        visited.add(user);
        
        const referrer = referrerMap.get(user);
        if (!referrer || referrer === ethers.ZeroAddress.toLowerCase()) {
            return false;
        }
        if (referrer === target) return true;
        return isDescendant(referrer, target);
    }
    
    // 遍历所有用户，检查是否是目标用户的下线
    referrerMap.forEach((data, user) => {
        if (user !== userAddress && isDescendant(user, userAddress)) {
            count++;
        }
        visited.clear();
    });
    
    return count;
}

/**
 * 分析 teamCount 差异
 */
async function analyzeTeamCountDifference(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 分析 teamCount 差异原因");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    console.log(`用户地址: ${userAddress}\n`);

    // 步骤 1: 获取合约中的 teamCount
    console.log("📋 步骤 1: 获取合约中的 teamCount...");
    let userInfo = null;
    let contractTeamCount = 0;
    
    try {
        userInfo = await newProtocol.userInfo(userAddress);
        contractTeamCount = Number(userInfo.teamCount);
        console.log(`  ✅ 合约中的 teamCount: ${contractTeamCount.toLocaleString()}`);
        console.log(`     直推人数 (activeDirects): ${userInfo.activeDirects.toLocaleString()}`);
    } catch (error) {
        try {
            userInfo = await oldProtocol.userInfo(userAddress);
            contractTeamCount = Number(userInfo.teamCount);
            console.log(`  ✅ 旧合约中的 teamCount: ${contractTeamCount.toLocaleString()}`);
        } catch (oldError) {
            console.error(`  ❌ 无法从新旧合约获取用户数据: ${oldError.message}`);
            return;
        }
    }

    // 步骤 2: 构建推荐关系图
    console.log("\n📋 步骤 2: 构建推荐关系图...");
    const { referrerMap, referrerToUsers, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 找到 ${allUsers.size} 个用户`);
    console.log(`  ✅ 构建了 ${referrerToUsers.size} 个推荐关系`);

    // 步骤 3: 计算递归方式的 teamCount（正确方式）
    console.log("\n📋 步骤 3: 计算递归方式的 teamCount（正确方式）...");
    const normalizedAddress = userAddress.toLowerCase();
    const recursiveTeamCount = calculateTeamCountRecursive(normalizedAddress, referrerToUsers);
    console.log(`  ✅ 递归计算的 teamCount: ${recursiveTeamCount.toLocaleString()}`);
    console.log(`     公式: teamCount = 直接下线数 + 所有下线的 teamCount 之和`);

    // 步骤 4: 计算唯一团队成员数（去重后）
    console.log("\n📋 步骤 4: 计算唯一团队成员数（去重后）...");
    const allTeamMembers = new Set();
    function getAllTeamMembersRecursive(addr, visited = new Set()) {
        if (visited.has(addr)) return;
        visited.add(addr);
        const directReferrals = referrerToUsers.get(addr) || [];
        for (const referral of directReferrals) {
            allTeamMembers.add(referral);
            getAllTeamMembersRecursive(referral, new Set(visited));
        }
    }
    getAllTeamMembersRecursive(normalizedAddress);
    const uniqueTeamCount = allTeamMembers.size;
    console.log(`  ✅ 唯一团队成员数（去重后）: ${uniqueTeamCount.toLocaleString()}`);

    // 步骤 5: 分析差异
    console.log("\n" + "=".repeat(80));
    console.log("📊 分析结果");
    console.log("=".repeat(80));
    console.log(`合约中的 teamCount: ${contractTeamCount.toLocaleString()}`);
    console.log(`递归计算的 teamCount: ${recursiveTeamCount.toLocaleString()}`);
    console.log(`唯一团队成员数（去重后）: ${uniqueTeamCount.toLocaleString()}`);
    console.log(`\n差异分析:`);
    console.log(`  - 合约 teamCount vs 递归计算: ${contractTeamCount - recursiveTeamCount > 0 ? '+' : ''}${(contractTeamCount - recursiveTeamCount).toLocaleString()}`);
    console.log(`  - 合约 teamCount vs 唯一成员数: ${contractTeamCount - uniqueTeamCount > 0 ? '+' : ''}${(contractTeamCount - uniqueTeamCount).toLocaleString()}`);
    console.log(`  - 递归计算 vs 唯一成员数: ${recursiveTeamCount - uniqueTeamCount > 0 ? '+' : ''}${(recursiveTeamCount - uniqueTeamCount).toLocaleString()}`);

    console.log(`\n💡 说明:`);
    console.log(`  1. 合约中的 teamCount 计算方式:`);
    console.log(`     - 每当有新用户加入时，沿着推荐链向上，每个上级的 teamCount 都 +1`);
    console.log(`     - 这种方式计算的是：该用户的所有下线（直接+间接）的总数`);
    console.log(`  2. 递归计算的 teamCount:`);
    console.log(`     - teamCount = 直接下线数 + 所有下线的 teamCount 之和`);
    console.log(`     - 这种方式计算的是：该用户的所有下线（直接+间接）的总数`);
    console.log(`  3. 唯一团队成员数（去重后）:`);
    console.log(`     - 这是实际的唯一用户数，不包括重复计算`);
    console.log(`     - 如果所有用户都有推荐人，且该用户是大部分用户的推荐人，则接近总用户数`);
    
    console.log(`\n🔍 为什么会有差异？`);
    if (contractTeamCount < recursiveTeamCount) {
        console.log(`  ⚠️ 合约中的 teamCount (${contractTeamCount}) 小于递归计算的值 (${recursiveTeamCount})`);
        console.log(`     可能原因:`);
        console.log(`     1. 合约中的 teamCount 更新不完整（某些用户加入时没有正确更新）`);
        console.log(`     2. 数据迁移时 teamCount 没有正确同步`);
        console.log(`     3. 某些历史事件丢失或未正确处理`);
    } else if (contractTeamCount > recursiveTeamCount) {
        console.log(`  ⚠️ 合约中的 teamCount (${contractTeamCount}) 大于递归计算的值 (${recursiveTeamCount})`);
        console.log(`     可能原因:`);
        console.log(`     1. 合约中的 teamCount 包含了重复计算`);
        console.log(`     2. 某些用户被重复计算`);
    } else {
        console.log(`  ✅ 合约中的 teamCount 与递归计算的值一致`);
    }

    if (uniqueTeamCount === allUsers.size) {
        console.log(`\n  📌 该用户是几乎所有用户的推荐人（直接或间接）`);
        console.log(`     所以唯一团队成员数 = 总用户数 = ${allUsers.size}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 分析完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    const userAddress = process.argv[2] || "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";
    analyzeTeamCountDifference(userAddress).catch(console.error);
}
