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
 * 分析推荐关系树
 */
async function analyzeReferralTree() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 分析推荐关系树结构");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 获取所有用户
    const { referrerMap, referrerToUsers, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    const userList = Array.from(allUsers);
    console.log(`总用户数: ${userList.length}\n`);

    // 步骤 2: 找出根用户（没有推荐人的用户）
    console.log("📋 步骤 1: 找出根用户（没有推荐人的用户）...");
    const rootUsers = [];
    const usersWithReferrer = new Set();
    
    referrerMap.forEach((data, user) => {
        if (data.referrer === ethers.ZeroAddress.toLowerCase() || !data.referrer) {
            rootUsers.push(user);
        } else {
            usersWithReferrer.add(user);
            // 检查推荐人是否在用户列表中
            if (!allUsers.has(data.referrer)) {
                console.log(`  ⚠️  用户 ${user} 的推荐人 ${data.referrer} 不在用户列表中`);
            }
        }
    });
    
    // 也检查那些在 allUsers 中但没有在 referrerMap 中的用户（可能是根用户）
    for (const user of allUsers) {
        if (!referrerMap.has(user)) {
            rootUsers.push(user);
        }
    }
    
    console.log(`  ✅ 根用户数: ${rootUsers.length}`);
    console.log(`  ✅ 有推荐人的用户数: ${usersWithReferrer.size}`);
    console.log(`  ✅ 总用户数: ${userList.length}`);
    
    if (rootUsers.length > 0) {
        console.log(`\n  根用户列表:`);
        rootUsers.forEach((user, index) => {
            console.log(`    ${index + 1}. ${user}`);
        });
    }
    console.log("");

    // 步骤 3: 检查推荐关系链，找出可能的循环
    console.log("📋 步骤 2: 检查推荐关系链...");
    
    // 从每个用户向上追踪到根用户
    const userToRoot = new Map();
    const cycles = [];
    
    function findRoot(user, visited = new Set(), path = []) {
        if (visited.has(user)) {
            // 发现循环
            const cycleStart = path.indexOf(user);
            if (cycleStart !== -1) {
                const cycle = path.slice(cycleStart);
                cycles.push(cycle);
            }
            return null;
        }
        
        visited.add(user);
        path.push(user);
        
        const referrerData = referrerMap.get(user);
        if (!referrerData || referrerData.referrer === ethers.ZeroAddress.toLowerCase()) {
            // 找到根用户
            return user;
        }
        
        // 检查推荐人是否在用户列表中
        if (!allUsers.has(referrerData.referrer)) {
            return user; // 推荐人不在列表中，当前用户就是根
        }
        
        return findRoot(referrerData.referrer, new Set(visited), [...path]);
    }
    
    for (const user of userList) {
        const root = findRoot(user);
        if (root) {
            userToRoot.set(user, root);
        }
    }
    
    console.log(`  ✅ 发现 ${cycles.length} 个循环`);
    if (cycles.length > 0) {
        console.log(`\n  循环列表（前5个）:`);
        cycles.slice(0, 5).forEach((cycle, index) => {
            console.log(`    ${index + 1}. ${cycle.join(' -> ')} -> ...`);
        });
    }
    
    // 统计每个根用户下的用户数
    const rootToUsers = new Map();
    userToRoot.forEach((root, user) => {
        if (!rootToUsers.has(root)) {
            rootToUsers.set(root, []);
        }
        rootToUsers.get(root).push(user);
    });
    
    console.log(`\n  ✅ 根用户分布:`);
    const sortedRoots = Array.from(rootToUsers.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);
    
    sortedRoots.forEach(([root, users]) => {
        console.log(`    根用户 ${root}: ${users.length} 个用户`);
    });
    console.log("");

    // 步骤 4: 正确计算某个用户的唯一团队成员数
    function getUniqueTeamCount(userAddress, referrerToUsers, allUsers) {
        const allTeamMembers = new Set();
        const visited = new Set();
        
        function getAllTeamMembersRecursive(addr) {
            if (visited.has(addr)) return;
            if (!allUsers.has(addr)) return; // 确保地址在用户列表中
            visited.add(addr);
            
            const directReferrals = referrerToUsers.get(addr) || [];
            for (const referral of directReferrals) {
                if (allUsers.has(referral)) { // 确保推荐人在用户列表中
                    allTeamMembers.add(referral);
                    getAllTeamMembersRecursive(referral);
                }
            }
        }
        
        getAllTeamMembersRecursive(userAddress.toLowerCase());
        return allTeamMembers.size;
    }

    // 测试几个用户
    console.log("📋 步骤 3: 测试几个用户的唯一团队成员数...");
    const testUsers = [
        "0x96665cfb0624bd4a5aaf60fea544c8ae22d3f55e",
        "0x4544c0cf9d62d3bb441c04a5f31c1ba0e432d37e",
        rootUsers[0] || sortedRoots[0]?.[0] || userList[0]
    ];
    
    for (const testUser of testUsers) {
        if (!userList.includes(testUser.toLowerCase())) continue;
        
        const uniqueCount = getUniqueTeamCount(testUser, referrerToUsers, allUsers);
        const directCount = referrerToUsers.get(testUser.toLowerCase())?.length || 0;
        const root = userToRoot.get(testUser.toLowerCase());
        
        console.log(`\n  用户: ${testUser}`);
        console.log(`    直推人数: ${directCount}`);
        console.log(`    唯一团队成员数: ${uniqueCount}`);
        console.log(`    所属根用户: ${root || '未知'}`);
        
        // 检查是否是根用户
        const referrerData = referrerMap.get(testUser.toLowerCase());
        if (!referrerData || referrerData.referrer === ethers.ZeroAddress.toLowerCase()) {
            console.log(`    状态: 根用户（没有推荐人）`);
        } else {
            console.log(`    推荐人: ${referrerData.referrer}`);
        }
    }
    console.log("");

    console.log("=".repeat(80));
    console.log("✅ 分析完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    analyzeReferralTree().catch(console.error);
}
