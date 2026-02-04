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
 * 从合约中直接查询推荐关系（而不是从事件中获取）
 */
async function getReferrerFromContract(userAddress, protocol) {
    try {
        const userInfo = await protocol.userInfo(userAddress);
        return userInfo.referrer.toLowerCase();
    } catch (error) {
        return null;
    }
}

/**
 * 从合约中获取所有用户的推荐关系
 */
async function getAllReferrersFromContract(newProtocol, oldProtocol, allUsers) {
    const referrerMap = new Map();
    
    console.log("📋 从合约中查询所有用户的推荐关系...");
    let count = 0;
    for (const user of allUsers) {
        if (++count % 100 === 0) {
            console.log(`  ⏳ 已处理: ${count}/${allUsers.size}`);
        }
        
        // 先尝试从新合约查询
        let referrer = await getReferrerFromContract(user, newProtocol);
        if (!referrer || referrer === ethers.ZeroAddress.toLowerCase()) {
            // 如果新合约没有，尝试旧合约
            referrer = await getReferrerFromContract(user, oldProtocol);
        }
        
        if (referrer && referrer !== ethers.ZeroAddress.toLowerCase()) {
            referrerMap.set(user, referrer);
        }
    }
    console.log(`  ✅ 已查询 ${allUsers.size} 个用户的推荐关系\n`);
    
    return referrerMap;
}

/**
 * 从事件获取所有用户
 */
async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
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
                    allUsers.add(event.args.user.toLowerCase());
                    allUsers.add(event.args.referrer.toLowerCase());
                }
            });
        } catch (error) {
            console.warn(`⚠️ 无法从合约事件获取用户: ${error.message}`);
        }
    }
    
    return allUsers;
}

/**
 * 正确计算用户的唯一团队成员数（从合约中获取推荐关系）
 */
async function getTeamCountFromContract() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 从合约中获取推荐关系并计算 teamCount");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 从事件获取所有用户
    console.log("📋 步骤 1: 从事件获取所有用户...");
    const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 找到 ${allUsers.size} 个用户\n`);

    // 步骤 2: 从合约中查询所有用户的推荐关系
    const referrerMap = await getAllReferrersFromContract(newProtocol, oldProtocol, allUsers);

    // 步骤 3: 构建反向映射
    const referrerToUsers = new Map();
    referrerMap.forEach((referrer, user) => {
        if (!referrerToUsers.has(referrer)) {
            referrerToUsers.set(referrer, []);
        }
        referrerToUsers.get(referrer).push(user);
    });

    // 步骤 4: 找出根用户
    const rootUsers = [];
    referrerMap.forEach((referrer, user) => {
        if (referrer === ethers.ZeroAddress.toLowerCase() || !referrer) {
            rootUsers.push(user);
        }
    });
    
    // 也检查那些没有推荐关系的用户
    for (const user of allUsers) {
        if (!referrerMap.has(user)) {
            rootUsers.push(user);
        }
    }
    
    console.log(`📋 步骤 2: 分析推荐关系...`);
    console.log(`  ✅ 根用户数: ${rootUsers.length}`);
    console.log(`  ✅ 有推荐人的用户数: ${referrerMap.size}`);
    
    if (rootUsers.length > 0) {
        console.log(`\n  根用户列表（前10个）:`);
        rootUsers.slice(0, 10).forEach((user, index) => {
            console.log(`    ${index + 1}. ${user}`);
        });
    }
    console.log("");

    // 步骤 5: 测试几个用户的唯一团队成员数
    function getUniqueTeamCount(userAddress, referrerToUsers, allUsers) {
        const allTeamMembers = new Set();
        const visited = new Set();
        
        function getAllTeamMembersRecursive(addr) {
            if (visited.has(addr)) return;
            if (!allUsers.has(addr)) return;
            visited.add(addr);
            
            const directReferrals = referrerToUsers.get(addr) || [];
            for (const referral of directReferrals) {
                if (allUsers.has(referral)) {
                    allTeamMembers.add(referral);
                    getAllTeamMembersRecursive(referral);
                }
            }
        }
        
        getAllTeamMembersRecursive(userAddress.toLowerCase());
        return allTeamMembers.size;
    }

    console.log("📋 步骤 3: 测试几个用户的唯一团队成员数...");
    const testUsers = [
        "0x96665cfb0624bd4a5aaf60fea544c8ae22d3f55e",
        "0x4544c0cf9d62d3bb441c04a5f31c1ba0e432d37e",
        rootUsers[0] || Array.from(allUsers)[0]
    ];
    
    for (const testUser of testUsers) {
        if (!allUsers.has(testUser.toLowerCase())) continue;
        
        const uniqueCount = getUniqueTeamCount(testUser, referrerToUsers, allUsers);
        const directCount = referrerToUsers.get(testUser.toLowerCase())?.length || 0;
        const referrer = referrerMap.get(testUser.toLowerCase());
        
        console.log(`\n  用户: ${testUser}`);
        console.log(`    直推人数: ${directCount}`);
        console.log(`    唯一团队成员数: ${uniqueCount}`);
        console.log(`    推荐人: ${referrer || '无（根用户）'}`);
        
        // 获取合约中的 teamCount
        try {
            const userInfo = await newProtocol.userInfo(testUser);
            console.log(`    合约中的 teamCount: ${userInfo.teamCount.toString()}`);
        } catch (error) {
            try {
                const userInfo = await oldProtocol.userInfo(testUser);
                console.log(`    合约中的 teamCount: ${userInfo.teamCount.toString()}`);
            } catch (oldError) {
                console.log(`    合约中的 teamCount: 无法查询`);
            }
        }
    }
    console.log("");

    console.log("=".repeat(80));
    console.log("✅ 分析完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    getTeamCountFromContract().catch(console.error);
}
