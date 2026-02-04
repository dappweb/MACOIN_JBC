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
    
    const referrerMap = new Map();
    const referrerToUsers = new Map();
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
 * 获取用户的唯一团队成员数（去重后）
 */
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

/**
 * 获取所有用户的团队人数差异表
 */
async function getAllTeamCountDifferences() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(100));
    console.log("📊 所有用户的团队人数差异表");
    console.log("=".repeat(100));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 获取所有用户
    console.log("📋 步骤 1: 获取所有用户地址...");
    const { referrerMap, referrerToUsers, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    const userList = Array.from(allUsers);
    console.log(`  ✅ 找到 ${userList.length} 个用户地址\n`);

    // 步骤 2: 计算每个用户的唯一团队成员数
    console.log("📋 步骤 2: 计算每个用户的唯一团队成员数（去重后）...");
    const userTeamCounts = new Map();
    for (let i = 0; i < userList.length; i++) {
        if ((i + 1) % 100 === 0) {
            console.log(`  ⏳ 已计算: ${i + 1}/${userList.length}`);
        }
        const user = userList[i];
        const uniqueCount = getUniqueTeamCount(user, referrerToUsers);
        userTeamCounts.set(user, uniqueCount);
    }
    console.log(`  ✅ 已计算 ${userList.length} 个用户的唯一团队成员数\n`);

    // 步骤 3: 获取合约中的 teamCount
    console.log("📋 步骤 3: 获取合约中的 teamCount...");
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
    console.log(`  ✅ 已获取 ${userList.length} 个用户的合约 teamCount\n`);

    // 步骤 4: 找出需要修复的用户
    console.log("📋 步骤 4: 生成差异表...");
    const issues = [];
    for (const user of userList) {
        const uniqueCount = userTeamCounts.get(user) || 0;
        const contractCount = contractTeamCounts.get(user) || 0;
        if (uniqueCount !== contractCount) {
            issues.push({
                user,
                uniqueCount,
                contractCount,
                diff: uniqueCount - contractCount,
                absDiff: Math.abs(uniqueCount - contractCount)
            });
        }
    }
    
    // 按差异大小排序
    issues.sort((a, b) => b.absDiff - a.absDiff);
    
    console.log(`  ✅ 找到 ${issues.length} 个需要修复的用户\n`);

    // 输出差异表
    console.log("=".repeat(100));
    console.log("📊 团队人数差异表");
    console.log("=".repeat(100));
    console.log(`总用户数: ${userList.length.toLocaleString()}`);
    console.log(`匹配用户数: ${userList.length - issues.length} (${((userList.length - issues.length) / userList.length * 100).toFixed(2)}%)`);
    console.log(`需要修复的用户数: ${issues.length} (${(issues.length / userList.length * 100).toFixed(2)}%)\n`);

    if (issues.length === 0) {
        console.log("✅ 没有需要修复的用户！");
        return;
    }

    // 输出表格格式
    console.log("┌─────┬──────────────────────────────────────────────────────────────┬──────────────┬──────────────┬──────────────┐");
    console.log("│序号 │ 用户地址                                                    │ 唯一成员数   │ 合约teamCount│ 差异         │");
    console.log("├─────┼──────────────────────────────────────────────────────────────┼──────────────┼──────────────┼──────────────┤");
    
    issues.forEach((issue, index) => {
        const sign = issue.diff > 0 ? '+' : '';
        const address = issue.user.substring(0, 60).padEnd(60);
        const uniqueCount = issue.uniqueCount.toLocaleString().padStart(12);
        const contractCount = issue.contractCount.toLocaleString().padStart(12);
        const diff = `${sign}${issue.diff.toLocaleString()}`.padStart(12);
        const num = (index + 1).toString().padStart(3);
        
        console.log(`│ ${num} │ ${address} │ ${uniqueCount} │ ${contractCount} │ ${diff} │`);
    });
    
    console.log("└─────┴──────────────────────────────────────────────────────────────┴──────────────┴──────────────┴──────────────┘");
    
    // 输出详细列表
    console.log("\n" + "=".repeat(100));
    console.log("📋 详细差异列表");
    console.log("=".repeat(100) + "\n");
    
    issues.forEach((issue, index) => {
        const sign = issue.diff > 0 ? '+' : '';
        console.log(`${index + 1}. ${issue.user}`);
        console.log(`   唯一团队成员数: ${issue.uniqueCount.toLocaleString()}`);
        console.log(`   合约 teamCount: ${issue.contractCount.toLocaleString()}`);
        console.log(`   差异: ${sign}${issue.diff.toLocaleString()}`);
        console.log(`   状态: ${issue.absDiff > 100 ? '❌ 严重错误' : issue.absDiff > 10 ? '⚠️ 需要修复' : '⚠️ 轻微差异'}\n`);
    });

    console.log("=".repeat(100));
    console.log("✅ 差异表生成完成");
    console.log("=".repeat(100));
}

if (require.main === module) {
    getAllTeamCountDifferences().catch(console.error);
}
