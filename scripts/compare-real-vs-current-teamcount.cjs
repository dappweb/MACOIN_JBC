const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

/**
 * 从事件获取所有用户
 */
async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = 0;

    const allUsers = new Set();

    // 从新合约获取
    try {
        const newBoundEvents = await newProtocol.queryFilter(
            newProtocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        const newTicketEvents = await newProtocol.queryFilter(
            newProtocol.filters.TicketPurchased(),
            fromBlock,
            currentBlock
        );

        [...newBoundEvents, ...newTicketEvents].forEach(event => {
            if (event.args && event.args.user) {
                allUsers.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                allUsers.add(event.args.referrer.toLowerCase());
            }
        });
    } catch (error) {
        console.warn(`⚠️ 新合约事件查询失败: ${error.message}`);
    }

    // 从旧合约获取
    try {
        const oldBoundEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        const oldTicketEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.TicketPurchased(),
            fromBlock,
            currentBlock
        );

        [...oldBoundEvents, ...oldTicketEvents].forEach(event => {
            if (event.args && event.args.user) {
                allUsers.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                allUsers.add(event.args.referrer.toLowerCase());
            }
        });
    } catch (error) {
        console.warn(`⚠️ 旧合约事件查询失败: ${error.message}`);
    }

    return Array.from(allUsers);
}

/**
 * 构建推荐关系图
 */
async function buildReferralMap(newProtocol, oldProtocol, allUsers) {
    const referrerMap = new Map();
    const referrerToUsers = new Map();

    console.log("  构建推荐关系图...");
    
    // 查询每个用户的推荐人
    let processedCount = 0;
    for (const userAddress of allUsers) {
        let referrer = ethers.ZeroAddress;
        
        // 先查新合约
        try {
            const userInfo = await newProtocol.userInfo(userAddress);
            if (userInfo.referrer && userInfo.referrer !== ethers.ZeroAddress) {
                referrer = userInfo.referrer.toLowerCase();
            }
        } catch (error) {
            // 用户不在新合约中
        }
        
        // 如果新合约没有，查旧合约
        if (referrer === ethers.ZeroAddress) {
            try {
                const userInfo = await oldProtocol.userInfo(userAddress);
                if (userInfo.referrer && userInfo.referrer !== ethers.ZeroAddress) {
                    referrer = userInfo.referrer.toLowerCase();
                }
            } catch (error) {
                // 用户不在旧合约中
            }
        }
        
        referrerMap.set(userAddress, { referrer });
        
        if (referrer !== ethers.ZeroAddress) {
            if (!referrerToUsers.has(referrer)) {
                referrerToUsers.set(referrer, []);
            }
            referrerToUsers.get(referrer).push(userAddress);
        }
        
        processedCount++;
        if (processedCount % 100 === 0) {
            console.log(`    已处理: ${processedCount}/${allUsers.length}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50)); // 避免RPC请求过快
    }
    
    return { referrerMap, referrerToUsers };
}

/**
 * 递归计算真实的 teamCount
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
    let count = directReferrals.length;
    
    for (const referral of directReferrals) {
        count += calculateRealTeamCount(referral, referrerToUsers, cache, new Set(visited));
    }
    
    visited.delete(userAddress);
    cache.set(userAddress, count);
    return count;
}

/**
 * 获取用户当前的 teamCount（从合约）
 */
async function getCurrentTeamCount(userAddress, newProtocol, oldProtocol) {
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
    
    return Number(maxTeamCount);
}

async function compareRealVsCurrentTeamCount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 对比所有账户的真实 teamCount 和当前 teamCount");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 获取所有用户
    console.log("📋 步骤 1: 获取所有用户地址...");
    const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 找到 ${allUsers.length} 个用户地址\n`);

    // 步骤 2: 构建推荐关系图
    console.log("📋 步骤 2: 构建推荐关系图...");
    const { referrerMap, referrerToUsers } = await buildReferralMap(newProtocol, oldProtocol, allUsers);
    console.log(`  ✅ 构建完成，${referrerToUsers.size} 个用户有下线\n`);

    // 步骤 3: 计算真实的 teamCount
    console.log("📋 步骤 3: 计算真实的 teamCount...");
    const realTeamCounts = new Map();
    const cache = new Map();
    
    for (const userAddress of allUsers) {
        const realCount = calculateRealTeamCount(userAddress, referrerToUsers, cache);
        realTeamCounts.set(userAddress, realCount);
    }
    console.log(`  ✅ 已计算 ${realTeamCounts.size} 个用户的真实 teamCount\n`);

    // 步骤 4: 获取当前合约中的 teamCount
    console.log("📋 步骤 4: 获取当前合约中的 teamCount...");
    const currentTeamCounts = new Map();
    let processedCount = 0;
    
    for (const userAddress of allUsers) {
        const currentCount = await getCurrentTeamCount(userAddress, newProtocol, oldProtocol);
        currentTeamCounts.set(userAddress, currentCount);
        
        processedCount++;
        if (processedCount % 100 === 0) {
            console.log(`  ⏳ 已处理: ${processedCount}/${allUsers.length}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`  ✅ 已获取 ${currentTeamCounts.size} 个用户的当前 teamCount\n`);

    // 步骤 5: 对比分析
    console.log("📋 步骤 5: 对比分析...");
    const differences = [];
    let matchCount = 0;
    let mismatchCount = 0;
    let totalRealCount = 0;
    let totalCurrentCount = 0;

    for (const userAddress of allUsers) {
        const realCount = realTeamCounts.get(userAddress) || 0;
        const currentCount = currentTeamCounts.get(userAddress) || 0;
        
        totalRealCount += realCount;
        totalCurrentCount += currentCount;
        
        if (realCount !== currentCount) {
            differences.push({
                address: userAddress,
                realCount,
                currentCount,
                difference: realCount - currentCount
            });
            mismatchCount++;
        } else {
            matchCount++;
        }
    }

    // 输出结果
    console.log("\n📊 对比结果");
    console.log("=".repeat(80));
    console.log(`总用户数: ${allUsers.length}`);
    console.log(`匹配用户数: ${matchCount} (${((matchCount / allUsers.length) * 100).toFixed(2)}%)`);
    console.log(`不匹配用户数: ${mismatchCount} (${((mismatchCount / allUsers.length) * 100).toFixed(2)}%)`);
    console.log(`\n团队人数统计:`);
    console.log(`  真实团队人数总和: ${totalRealCount.toLocaleString()}`);
    console.log(`  当前团队人数总和: ${totalCurrentCount.toLocaleString()}`);
    console.log(`  差异: ${(totalRealCount - totalCurrentCount).toLocaleString()}`);

    if (differences.length > 0) {
        console.log(`\n📋 不匹配用户详情（前20个）:`);
        differences
            .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
            .slice(0, 20)
            .forEach((diff, index) => {
                console.log(`\n${index + 1}. ${diff.address}`);
                console.log(`   真实 teamCount: ${diff.realCount.toLocaleString()}`);
                console.log(`   当前 teamCount: ${diff.currentCount.toLocaleString()}`);
                console.log(`   差异: ${diff.difference > 0 ? '+' : ''}${diff.difference.toLocaleString()}`);
            });
    }

    // 保存结果到文件
    const fs = require("fs");
    const resultsDir = "output";
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsFile = `${resultsDir}/teamcount-comparison-${Date.now()}.json`;
    const results = {
        timestamp: new Date().toISOString(),
        totalUsers: allUsers.length,
        matchCount,
        mismatchCount,
        totalRealCount,
        totalCurrentCount,
        differences: differences.slice(0, 100) // 只保存前100个差异最大的
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 详细结果已保存: ${resultsFile}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ 对比完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    compareRealVsCurrentTeamCount().catch(console.error);
}
