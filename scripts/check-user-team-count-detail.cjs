const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "function getLevel(address) view returns (uint256)",
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
    
    // 构建反向映射：referrer -> [directs]
    const referrerToUsers = new Map(); // referrer -> [directs]
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
 * 递归计算真实的团队成员数（不包括自己）
 */
function calculateRealTeamCount(userAddress, referrerToUsers, cache = new Map(), visited = new Set()) {
    if (cache.has(userAddress)) {
        return cache.get(userAddress);
    }
    
    if (visited.has(userAddress)) {
        return 0; // 防止循环
    }
    visited.add(userAddress);
    
    const directReferrals = referrerToUsers.get(userAddress) || [];
    let count = directReferrals.length; // 只计算直接下线
    
    // 递归计算每个直接下线的团队成员数
    for (const referral of directReferrals) {
        count += calculateRealTeamCount(referral, referrerToUsers, cache, new Set(visited));
    }
    
    visited.delete(userAddress);
    cache.set(userAddress, count);
    return count;
}

/**
 * 获取用户的所有团队成员地址（递归）
 */
function getAllTeamMembers(userAddress, referrerToUsers, allMembers = new Set(), visited = new Set()) {
    if (visited.has(userAddress)) {
        return; // 防止循环
    }
    visited.add(userAddress);
    
    const directReferrals = referrerToUsers.get(userAddress) || [];
    for (const referral of directReferrals) {
        allMembers.add(referral);
        getAllTeamMembers(referral, referrerToUsers, allMembers, new Set(visited));
    }
}

async function checkUserTeamCountDetail(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 检查用户团队人数详情");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    console.log(`用户地址: ${userAddress}\n`);

    // 步骤 1: 获取合约中的 teamCount
    console.log("📋 步骤 1: 查询合约中的 teamCount...");
    let contractTeamCount = 0;
    let userInfo = null;
    let isFromOldContract = false;
    
    try {
        userInfo = await newProtocol.userInfo(userAddress);
        contractTeamCount = Number(userInfo.teamCount);
        console.log(`  ✅ 新合约 teamCount: ${contractTeamCount.toLocaleString()}`);
        console.log(`     直推人数 (activeDirects): ${userInfo.activeDirects.toLocaleString()}`);
        console.log(`     是否激活 (isActive): ${userInfo.isActive}`);
    } catch (error) {
        try {
            userInfo = await oldProtocol.userInfo(userAddress);
            contractTeamCount = Number(userInfo.teamCount);
            isFromOldContract = true;
            console.log(`  ✅ 旧合约 teamCount: ${contractTeamCount.toLocaleString()}`);
            console.log(`     直推人数 (activeDirects): ${userInfo.activeDirects.toLocaleString()}`);
            console.log(`     是否激活 (isActive): ${userInfo.isActive}`);
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

    // 步骤 3: 计算真实的团队成员数
    console.log("\n📋 步骤 3: 计算真实的团队成员数...");
    const normalizedAddress = userAddress.toLowerCase();
    const realTeamCount = calculateRealTeamCount(normalizedAddress, referrerToUsers);
    console.log(`  ✅ 真实团队成员数: ${realTeamCount.toLocaleString()}`);

    // 步骤 4: 获取所有团队成员地址
    console.log("\n📋 步骤 4: 获取所有团队成员地址...");
    const allTeamMembers = new Set();
    getAllTeamMembers(normalizedAddress, referrerToUsers, allTeamMembers);
    console.log(`  ✅ 团队成员总数: ${allTeamMembers.size.toLocaleString()}`);
    
    // 获取直推成员
    const directReferrals = referrerToUsers.get(normalizedAddress) || [];
    console.log(`  ✅ 直推成员数: ${directReferrals.length.toLocaleString()}`);

    // 步骤 5: 对比分析
    console.log("\n" + "=".repeat(80));
    console.log("📊 对比分析");
    console.log("=".repeat(80));
    console.log(`合约中的 teamCount: ${contractTeamCount.toLocaleString()}`);
    console.log(`真实团队成员数: ${realTeamCount.toLocaleString()}`);
    console.log(`团队成员地址总数: ${allTeamMembers.size.toLocaleString()}`);
    console.log(`直推成员数: ${directReferrals.length.toLocaleString()}`);

    const difference = contractTeamCount - realTeamCount;
    if (difference === 0) {
        console.log(`\n✅ 团队人数一致！`);
    } else if (difference > 0) {
        console.log(`\n⚠️  合约中的 teamCount 比真实值大 ${difference.toLocaleString()}`);
    } else {
        console.log(`\n⚠️  合约中的 teamCount 比真实值小 ${Math.abs(difference).toLocaleString()}`);
    }

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

    // 查询等级
    try {
        let level = null;
        if (!isFromOldContract) {
            level = await newProtocol.getLevel(userAddress);
            level = Number(level);
        }
        if (level !== null) {
            console.log(`\n📊 用户等级: V${level}`);
        }
    } catch (error) {
        // 忽略等级查询错误
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 检查完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    const userAddress = process.argv[2] || "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";
    checkUserTeamCountDetail(userAddress).catch(console.error);
}
