const { ethers } = require("ethers");
const fs = require("fs");
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
 * 按照推荐关系重新计算所有用户的 teamCount
 */
async function recalculateTeamCountByReferral() {
    if (!PRIVATE_KEY) {
        console.error("❌ 错误: 请设置 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔧 按照推荐关系重新计算所有用户的 teamCount");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行修复\n");
    }

    console.log(`部署者地址: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`部署者余额: ${ethers.formatEther(balance)} MC`);

    const owner = await newProtocol.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`❌ 错误: 部署者不是合约 Owner`);
        process.exit(1);
    }
    console.log(`✅ Owner 验证通过\n`);

    // 步骤 1: 获取所有用户和推荐关系
    console.log("📋 步骤 1: 获取所有用户和推荐关系...");
    const { referrerMap, referrerToUsers, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 找到 ${allUsers.size} 个用户`);
    console.log(`  ✅ 构建了 ${referrerToUsers.size} 个推荐关系\n`);

    // 步骤 2: 按照推荐关系重新计算所有用户的 teamCount
    console.log("📋 步骤 2: 按照推荐关系重新计算 teamCount...");
    const calculatedTeamCounts = new Map();
    const cache = new Map();
    
    for (const userAddress of allUsers) {
        const calculatedCount = calculateTeamCountRecursive(userAddress, referrerToUsers, cache);
        calculatedTeamCounts.set(userAddress, calculatedCount);
    }
    console.log(`  ✅ 已计算 ${calculatedTeamCounts.size} 个用户的 teamCount\n`);

    // 步骤 3: 获取当前合约中的 teamCount
    console.log("📋 步骤 3: 获取当前合约中的 teamCount...");
    const currentTeamCounts = new Map();
    let processedCount = 0;
    
    for (const userAddress of allUsers) {
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
        
        currentTeamCounts.set(userAddress, Number(maxTeamCount));
        
        processedCount++;
        if (processedCount % 100 === 0) {
            console.log(`  ⏳ 已处理: ${processedCount}/${allUsers.size}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`  ✅ 已获取 ${currentTeamCounts.size} 个用户的当前 teamCount\n`);

    // 步骤 4: 找出需要修复的用户
    console.log("📋 步骤 4: 找出需要修复的用户...");
    const usersToFix = [];
    
    for (const userAddress of allUsers) {
        const calculatedCount = calculatedTeamCounts.get(userAddress) || 0;
        const currentCount = currentTeamCounts.get(userAddress) || 0;
        
        if (calculatedCount !== currentCount) {
            usersToFix.push({
                address: userAddress,
                calculatedCount,
                currentCount,
                difference: calculatedCount - currentCount
            });
        }
    }
    
    console.log(`  ✅ 找到 ${usersToFix.length} 个需要修复的用户\n`);

    if (usersToFix.length === 0) {
        console.log("✅ 所有用户的 teamCount 都已正确，无需修复！");
        return;
    }

    // 步骤 5: 修复用户
    console.log("📋 步骤 5: 修复用户的 teamCount...");
    console.log("=".repeat(80));

    const fixResults = {
        timestamp: new Date().toISOString(),
        totalUsers: usersToFix.length,
        fixed: [],
        failed: [],
        skipped: []
    };

    // 按差异大小排序（优先修复差异最大的）
    usersToFix.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    for (let i = 0; i < usersToFix.length; i++) {
        const user = usersToFix[i];
        console.log(`\n[${i + 1}/${usersToFix.length}] 修复用户: ${user.address}`);
        console.log(`  当前 teamCount: ${user.currentCount.toLocaleString()}`);
        console.log(`  计算 teamCount: ${user.calculatedCount.toLocaleString()}`);
        console.log(`  差异: ${user.difference > 0 ? '+' : ''}${user.difference.toLocaleString()}`);

        if (DRY_RUN) {
            console.log(`  ⚠️  干运行模式，跳过实际修复`);
            fixResults.skipped.push(user);
            continue;
        }

        try {
            // 验证用户在新合约中存在
            let userExists = false;
            try {
                await newProtocol.userInfo(user.address);
                userExists = true;
            } catch (error) {
                console.log(`  ⚠️  用户不在新合约中，跳过`);
                fixResults.skipped.push({ ...user, reason: "用户不在新合约中" });
                continue;
            }

            if (!userExists) {
                continue;
            }

            // 执行修复
            console.log(`  🔧 修复 teamCount 为 ${user.calculatedCount.toLocaleString()}...`);
            const tx = await newProtocol.adminSetTeamCount(user.address, user.calculatedCount);
            console.log(`  📝 交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  ✅ 修复成功 (区块: ${receipt.blockNumber})`);
            
            fixResults.fixed.push({
                address: user.address,
                oldCount: user.currentCount,
                newCount: user.calculatedCount,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            });

        } catch (error) {
            console.error(`  ❌ 修复失败: ${error.message}`);
            fixResults.failed.push({
                address: user.address,
                error: error.message
            });
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 输出结果
    console.log("\n" + "=".repeat(80));
    console.log("📊 修复结果");
    console.log("=".repeat(80));
    console.log(`总用户数: ${fixResults.totalUsers}`);
    console.log(`成功修复: ${fixResults.fixed.length}`);
    console.log(`修复失败: ${fixResults.failed.length}`);
    console.log(`跳过用户: ${fixResults.skipped.length}`);

    // 保存结果
    const resultsDir = "output";
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsFile = `${resultsDir}/recalculate-teamcount-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(fixResults, null, 2));
    console.log(`\n📄 修复结果已保存: ${resultsFile}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ 修复完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    recalculateTeamCountByReferral().catch(console.error);
}
