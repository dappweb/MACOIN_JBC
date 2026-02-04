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
 * 递归获取用户下的所有唯一团队成员（去重）
 */
function getAllTeamMembersRecursive(userAddress, referrerToUsers, allMembers = new Set(), visited = new Set()) {
    if (visited.has(userAddress)) {
        return; // 防止循环
    }
    visited.add(userAddress);
    
    const directReferrals = referrerToUsers.get(userAddress) || [];
    for (const referral of directReferrals) {
        allMembers.add(referral);
        getAllTeamMembersRecursive(referral, referrerToUsers, allMembers, new Set(visited));
    }
}

/**
 * 获取用户的社区总人数（唯一团队成员数）
 */
async function getUserCommunityCount(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 统计用户社区总人数（唯一团队成员数）");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    console.log(`用户地址: ${userAddress}\n`);

    // 步骤 1: 获取用户信息
    console.log("📋 步骤 1: 获取用户信息...");
    let userInfo = null;
    let contractTeamCount = 0;
    let isFromOldContract = false;
    
    try {
        userInfo = await newProtocol.userInfo(userAddress);
        contractTeamCount = Number(userInfo.teamCount);
        console.log(`  ✅ 新合约 teamCount: ${contractTeamCount.toLocaleString()}`);
        console.log(`     直推人数 (activeDirects): ${userInfo.activeDirects.toLocaleString()}`);
    } catch (error) {
        try {
            userInfo = await oldProtocol.userInfo(userAddress);
            contractTeamCount = Number(userInfo.teamCount);
            isFromOldContract = true;
            console.log(`  ✅ 旧合约 teamCount: ${contractTeamCount.toLocaleString()}`);
            console.log(`     直推人数 (activeDirects): ${userInfo.activeDirects.toLocaleString()}`);
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

    // 步骤 3: 获取该用户下的所有唯一团队成员
    console.log("\n📋 步骤 3: 获取该用户下的所有唯一团队成员（去重）...");
    const normalizedAddress = userAddress.toLowerCase();
    const allTeamMembers = new Set();
    getAllTeamMembersRecursive(normalizedAddress, referrerToUsers, allTeamMembers);
    
    const uniqueTeamCount = allTeamMembers.size;
    const directReferrals = referrerToUsers.get(normalizedAddress) || [];
    
    console.log(`  ✅ 直推成员数: ${directReferrals.length.toLocaleString()}`);
    console.log(`  ✅ 唯一团队成员总数（去重后）: ${uniqueTeamCount.toLocaleString()}`);

    // 步骤 4: 输出结果
    console.log("\n" + "=".repeat(80));
    console.log("📊 统计结果");
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log(`合约中的 teamCount: ${contractTeamCount.toLocaleString()}`);
    console.log(`直推成员数: ${directReferrals.length.toLocaleString()}`);
    console.log(`唯一团队成员总数（去重后）: ${uniqueTeamCount.toLocaleString()}`);
    
    console.log(`\n💡 说明:`);
    console.log(`  - 唯一团队成员总数是去重后的实际人数`);
    console.log(`  - 不包括用户自己，只包括其所有下线成员`);
    console.log(`  - teamCount 可能包含重复计算，但唯一团队成员数是准确的`);

    // 显示前10个直推成员
    if (directReferrals.length > 0) {
        console.log(`\n📋 直推成员列表（前10个）:`);
        directReferrals.slice(0, 10).forEach((addr, index) => {
            console.log(`  ${index + 1}. ${addr}`);
        });
        if (directReferrals.length > 10) {
            console.log(`  ... 还有 ${directReferrals.length - 10} 个直推成员`);
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 统计完成");
    console.log("=".repeat(80));
    console.log(`\n📊 结论: 该用户的社区总人数（唯一团队成员数）是 ${uniqueTeamCount.toLocaleString()}`);
}

if (require.main === module) {
    const userAddress = process.argv[2] || "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";
    getUserCommunityCount(userAddress).catch(console.error);
}
