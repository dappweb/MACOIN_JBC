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
 * 检查所有用户是否存在 teamCount 差异问题
 */
async function checkAllUsersTeamCountIssue() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 检查所有用户是否存在 teamCount 差异问题");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 获取所有用户
    console.log("📋 步骤 1: 获取所有用户地址...");
    const { referrerMap, referrerToUsers, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    const userList = Array.from(allUsers);
    console.log(`  ✅ 找到 ${userList.length} 个用户地址`);

    // 步骤 2: 计算真实的 teamCount
    console.log("\n📋 步骤 2: 计算真实的 teamCount（递归方式）...");
    const realTeamCounts = new Map();
    const cache = new Map();
    for (let i = 0; i < userList.length; i++) {
        if ((i + 1) % 100 === 0) {
            console.log(`  ⏳ 已计算: ${i + 1}/${userList.length}`);
        }
        const user = userList[i];
        const realCount = calculateTeamCountRecursive(user, referrerToUsers, cache);
        realTeamCounts.set(user, realCount);
    }
    console.log(`  ✅ 已计算 ${userList.length} 个用户的真实 teamCount`);

    // 步骤 3: 获取合约中的 teamCount
    console.log("\n📋 步骤 3: 获取合约中的 teamCount...");
    const contractTeamCounts = new Map();
    for (let i = 0; i < userList.length; i++) {
        if ((i + 1) % 100 === 0) {
            console.log(`  ⏳ 已处理: ${i + 1}/${userList.length}`);
        }
        const user = userList[i];
        try {
            const info = await newProtocol.userInfo(user);
            contractTeamCounts.set(user, Number(info.teamCount));
        } catch (error) {
            try {
                const info = await oldProtocol.userInfo(user);
                contractTeamCounts.set(user, Number(info.teamCount));
            } catch (oldError) {
                contractTeamCounts.set(user, 0);
            }
        }
    }
    console.log(`  ✅ 已获取 ${userList.length} 个用户的合约 teamCount`);

    // 步骤 4: 对比分析
    console.log("\n📋 步骤 4: 对比分析...");
    const issues = [];
    let matchCount = 0;
    let mismatchCount = 0;
    let totalRealCount = 0;
    let totalContractCount = 0;

    for (const user of userList) {
        const realCount = realTeamCounts.get(user) || 0;
        const contractCount = contractTeamCounts.get(user) || 0;
        const diff = realCount - contractCount;
        
        totalRealCount += realCount;
        totalContractCount += contractCount;

        if (realCount !== contractCount) {
            mismatchCount++;
            issues.push({
                user,
                realCount,
                contractCount,
                diff,
                absDiff: Math.abs(diff)
            });
        } else {
            matchCount++;
        }
    }

    // 按差异大小排序
    issues.sort((a, b) => b.absDiff - a.absDiff);

    // 输出统计结果
    console.log("\n" + "=".repeat(80));
    console.log("📊 统计结果");
    console.log("=".repeat(80));
    console.log(`总用户数: ${userList.length.toLocaleString()}`);
    console.log(`匹配用户数: ${matchCount.toLocaleString()} (${(matchCount / userList.length * 100).toFixed(2)}%)`);
    console.log(`不匹配用户数: ${mismatchCount.toLocaleString()} (${(mismatchCount / userList.length * 100).toFixed(2)}%)`);
    console.log(`\n团队人数统计:`);
    console.log(`  真实团队人数总和: ${totalRealCount.toLocaleString()}`);
    console.log(`  合约团队人数总和: ${totalContractCount.toLocaleString()}`);
    console.log(`  差异: ${(totalRealCount - totalContractCount).toLocaleString()}`);

    // 输出问题用户详情
    if (issues.length > 0) {
        console.log(`\n📋 存在差异的用户详情（前30个，按差异大小排序）:`);
        issues.slice(0, 30).forEach((issue, index) => {
            const sign = issue.diff > 0 ? '+' : '';
            console.log(`\n${index + 1}. ${issue.user}`);
            console.log(`   真实 teamCount: ${issue.realCount.toLocaleString()}`);
            console.log(`   合约 teamCount: ${issue.contractCount.toLocaleString()}`);
            console.log(`   差异: ${sign}${issue.diff.toLocaleString()}`);
        });
    }

    // 统计差异类型
    const underCounted = issues.filter(i => i.diff > 0).length; // 合约值小于真实值
    const overCounted = issues.filter(i => i.diff < 0).length; // 合约值大于真实值
    
    console.log(`\n📊 差异类型统计:`);
    console.log(`  合约值小于真实值（需要增加）: ${underCounted.toLocaleString()} 个用户`);
    console.log(`  合约值大于真实值（需要减少）: ${overCounted.toLocaleString()} 个用户`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ 检查完成");
    console.log("=".repeat(80));
    
    return {
        totalUsers: userList.length,
        matchCount,
        mismatchCount,
        issues,
        underCounted,
        overCounted
    };
}

if (require.main === module) {
    checkAllUsersTeamCountIssue().catch(console.error);
}
