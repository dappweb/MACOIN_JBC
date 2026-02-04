const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
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
 * 验证推荐关系图
 */
async function verifyTeamCountCalculation() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 验证 teamCount 计算逻辑");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 获取所有用户
    console.log("📋 步骤 1: 获取所有用户地址...");
    const { referrerMap, referrerToUsers, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    const userList = Array.from(allUsers);
    console.log(`  ✅ 找到 ${userList.length} 个用户地址\n`);

    // 步骤 2: 找出根用户（没有推荐人的用户）
    console.log("📋 步骤 2: 找出根用户（没有推荐人的用户）...");
    const rootUsers = [];
    const usersWithReferrer = new Set();
    
    referrerMap.forEach((data, user) => {
        if (data.referrer === ethers.ZeroAddress.toLowerCase() || !data.referrer) {
            rootUsers.push(user);
        } else {
            usersWithReferrer.add(user);
        }
    });
    
    console.log(`  ✅ 根用户数: ${rootUsers.length}`);
    console.log(`  ✅ 有推荐人的用户数: ${usersWithReferrer.size}`);
    console.log(`  ✅ 总用户数: ${userList.length}`);
    
    if (rootUsers.length > 0) {
        console.log(`\n  根用户列表（前10个）:`);
        rootUsers.slice(0, 10).forEach((user, index) => {
            console.log(`    ${index + 1}. ${user}`);
        });
    }
    console.log("");

    // 步骤 3: 检查推荐关系图的结构
    console.log("📋 步骤 3: 检查推荐关系图的结构...");
    
    // 统计每个用户的直推人数
    const directReferralCounts = new Map();
    referrerToUsers.forEach((users, referrer) => {
        directReferralCounts.set(referrer, users.length);
    });
    
    // 找出直推人数最多的用户
    const topReferrers = Array.from(directReferralCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    console.log(`  直推人数最多的用户（前10个）:`);
    topReferrers.forEach(([user, count], index) => {
        console.log(`    ${index + 1}. ${user}: ${count} 个直推`);
    });
    console.log("");

    // 步骤 4: 正确计算某个用户的唯一团队成员数
    function getUniqueTeamCount(userAddress, referrerToUsers) {
        const allTeamMembers = new Set();
        const visited = new Set();
        
        function getAllTeamMembersRecursive(addr) {
            if (visited.has(addr)) return;
            visited.add(addr);
            
            const directReferrals = referrerToUsers.get(addr) || [];
            for (const referral of directReferrals) {
                allTeamMembers.add(referral);
                getAllTeamMembersRecursive(referral);
            }
        }
        
        getAllTeamMembersRecursive(userAddress.toLowerCase());
        return allTeamMembers.size;
    }

    // 测试几个用户
    console.log("📋 步骤 4: 测试几个用户的唯一团队成员数...");
    const testUsers = [
        "0x96665cfb0624bd4a5aaf60fea544c8ae22d3f55e",
        "0x4544c0cf9d62d3bb441c04a5f31c1ba0e432d37e",
        rootUsers[0] || userList[0]
    ];
    
    for (const testUser of testUsers) {
        if (!userList.includes(testUser.toLowerCase())) continue;
        
        const uniqueCount = getUniqueTeamCount(testUser, referrerToUsers);
        const directCount = referrerToUsers.get(testUser.toLowerCase())?.length || 0;
        
        console.log(`\n  用户: ${testUser}`);
        console.log(`    直推人数: ${directCount}`);
        console.log(`    唯一团队成员数: ${uniqueCount}`);
        
        // 检查是否是根用户
        const referrerData = referrerMap.get(testUser.toLowerCase());
        if (!referrerData || referrerData.referrer === ethers.ZeroAddress.toLowerCase()) {
            console.log(`    状态: 根用户（没有推荐人）`);
        } else {
            console.log(`    推荐人: ${referrerData.referrer}`);
        }
    }
    console.log("");

    // 步骤 5: 分析为什么会有这么多用户的唯一成员数是 954
    console.log("📋 步骤 5: 分析推荐关系图...");
    
    // 检查是否有循环引用
    const hasCycle = new Set();
    function checkCycle(user, visited = new Set(), path = new Set()) {
        if (path.has(user)) {
            return true; // 发现循环
        }
        if (visited.has(user)) {
            return false;
        }
        visited.add(user);
        path.add(user);
        
        const referrerData = referrerMap.get(user);
        if (referrerData && referrerData.referrer !== ethers.ZeroAddress.toLowerCase()) {
            if (checkCycle(referrerData.referrer, visited, new Set(path))) {
                return true;
            }
        }
        path.delete(user);
        return false;
    }
    
    let cycleCount = 0;
    for (const user of userList) {
        if (checkCycle(user)) {
            cycleCount++;
        }
    }
    
    console.log(`  循环引用检查: ${cycleCount > 0 ? `发现 ${cycleCount} 个循环` : '未发现循环'}`);
    console.log("");

    // 步骤 6: 统计每个用户的唯一团队成员数分布
    console.log("📋 步骤 6: 统计唯一团队成员数分布...");
    const countDistribution = new Map();
    
    for (const user of userList) {
        const uniqueCount = getUniqueTeamCount(user, referrerToUsers);
        countDistribution.set(uniqueCount, (countDistribution.get(uniqueCount) || 0) + 1);
    }
    
    const sortedDistribution = Array.from(countDistribution.entries())
        .sort((a, b) => b[0] - a[0])
        .slice(0, 20);
    
    console.log(`  唯一团队成员数分布（前20个）:`);
    sortedDistribution.forEach(([count, userCount]) => {
        console.log(`    ${count} 个成员: ${userCount} 个用户`);
    });
    console.log("");

    console.log("=".repeat(80));
    console.log("✅ 验证完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    verifyTeamCountCalculation().catch(console.error);
}
