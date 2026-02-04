const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false"; // 默认为干运行

const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
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
 * 修复所有用户的 teamCount
 */
async function fixAllTeamCountIssues() {
    if (!PRIVATE_KEY) {
        console.error("❌ 错误: 请设置 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🔧 修复所有用户的 teamCount");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行修复\n");
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log(`部署者地址: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`部署者余额: ${ethers.formatEther(balance)} MC`);

    // 验证 Owner
    const owner = await newProtocol.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`❌ 错误: 部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${wallet.address}`);
        process.exit(1);
    }
    console.log(`✅ Owner 验证通过\n`);

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
    console.log("📋 步骤 4: 找出需要修复的用户...");
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

    // 输出统计结果
    console.log("=".repeat(80));
    console.log("📊 统计结果");
    console.log("=".repeat(80));
    console.log(`总用户数: ${userList.length.toLocaleString()}`);
    console.log(`匹配用户数: ${userList.length - issues.length} (${((userList.length - issues.length) / userList.length * 100).toFixed(2)}%)`);
    console.log(`需要修复的用户数: ${issues.length} (${(issues.length / userList.length * 100).toFixed(2)}%)\n`);

    if (issues.length === 0) {
        console.log("✅ 没有需要修复的用户！");
        return;
    }

    // 输出问题用户列表
    console.log("📋 需要修复的用户列表（按差异大小排序）:\n");
    issues.slice(0, 20).forEach((issue, index) => {
        const sign = issue.diff > 0 ? '+' : '';
        console.log(`${index + 1}. ${issue.user}`);
        console.log(`   唯一团队成员数: ${issue.uniqueCount.toLocaleString()}`);
        console.log(`   合约 teamCount: ${issue.contractCount.toLocaleString()}`);
        console.log(`   差异: ${sign}${issue.diff.toLocaleString()}\n`);
    });
    if (issues.length > 20) {
        console.log(`   ... 还有 ${issues.length - 20} 个用户需要修复\n`);
    }

    // 执行修复
    if (DRY_RUN) {
        console.log("⚠️  干运行模式，跳过实际修复");
        console.log(`   如果执行，将修复 ${issues.length} 个用户`);
        return;
    }

    console.log("\n" + "=".repeat(80));
    console.log("📝 开始修复...");
    console.log("=".repeat(80));

    const fixResults = {
        timestamp: new Date().toISOString(),
        totalUsers: issues.length,
        fixed: [],
        failed: []
    };

    for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        console.log(`\n[${i + 1}/${issues.length}] 修复用户: ${issue.user}`);
        console.log(`  唯一团队成员数: ${issue.uniqueCount.toLocaleString()}`);
        console.log(`  当前 teamCount: ${issue.contractCount.toLocaleString()}`);
        console.log(`  目标 teamCount: ${issue.uniqueCount.toLocaleString()}`);

        try {
            const tx = await newProtocol.adminSetTeamCount(issue.user, issue.uniqueCount);
            console.log(`  ✅ 交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  ✅ 交易已确认！区块号: ${receipt.blockNumber}`);
            
            // 验证修复结果
            const updatedInfo = await newProtocol.userInfo(issue.user);
            const updatedCount = Number(updatedInfo.teamCount);
            
            if (updatedCount === issue.uniqueCount) {
                console.log(`  ✅ 修复成功！teamCount 已更新为 ${updatedCount.toLocaleString()}`);
                fixResults.fixed.push({
                    user: issue.user,
                    oldCount: issue.contractCount,
                    newCount: updatedCount,
                    txHash: tx.hash
                });
            } else {
                console.log(`  ⚠️  警告: teamCount 更新为 ${updatedCount.toLocaleString()}，但目标值是 ${issue.uniqueCount.toLocaleString()}`);
            }
        } catch (error) {
            console.error(`  ❌ 修复失败: ${error.message}`);
            fixResults.failed.push({
                user: issue.user,
                error: error.message
            });
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 修复结果");
    console.log("=".repeat(80));
    console.log(`成功修复: ${fixResults.fixed.length} 个用户`);
    console.log(`修复失败: ${fixResults.failed.length} 个用户`);
    console.log("=".repeat(80));
    console.log("✅ 修复完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    fixAllTeamCountIssues().catch(console.error);
}
