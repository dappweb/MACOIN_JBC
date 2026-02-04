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
];

/**
 * 从事件获取所有用户及其推荐关系
 */
async function getAllUsersAndReferrers(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    
    const referrerMap = new Map(); // user -> referrer
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
    
    return { referrerMap, allUsers };
}

/**
 * 获取用户链上的 teamCount
 */
async function getUserTeamCount(userAddress, newProtocol, oldProtocol) {
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

/**
 * 递归计算推荐链上所有上级的 teamCount，确保层级关系正确
 */
async function fixHierarchyViolations() {
    if (!PRIVATE_KEY) {
        console.error("❌ 错误: 请设置 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔧 修复推荐关系层级中违反逻辑的用户");
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
    const { referrerMap, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 找到 ${allUsers.size} 个用户\n`);

    // 步骤 2: 获取所有用户的 teamCount
    console.log("📋 步骤 2: 获取所有用户的 teamCount...");
    const userTeamCounts = new Map();
    let processedCount = 0;
    
    for (const userAddress of allUsers) {
        const teamCount = await getUserTeamCount(userAddress, newProtocol, oldProtocol);
        userTeamCounts.set(userAddress, teamCount);
        
        processedCount++;
        if (processedCount % 100 === 0) {
            console.log(`  ⏳ 已处理: ${processedCount}/${allUsers.size}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`  ✅ 已获取 ${userTeamCounts.size} 个用户的 teamCount\n`);

    // 步骤 3: 找出违反逻辑的用户
    console.log("📋 步骤 3: 找出违反逻辑的用户...");
    const violations = [];

    for (const [userAddress, referrerData] of referrerMap.entries()) {
        const referrer = referrerData.referrer;
        
        if (referrer === ethers.ZeroAddress.toLowerCase()) {
            continue;
        }

        const userTeamCount = userTeamCounts.get(userAddress) || 0;
        const referrerTeamCount = userTeamCounts.get(referrer) || 0;

        if (referrerTeamCount < userTeamCount) {
            violations.push({
                user: userAddress,
                referrer: referrer,
                userTeamCount,
                referrerTeamCount,
                requiredTeamCount: userTeamCount // 推荐人的 teamCount 应该 >= 用户的 teamCount
            }
            );
        }
    }

    console.log(`  ✅ 找到 ${violations.length} 个违反逻辑的用户\n`);

    if (violations.length === 0) {
        console.log("✅ 没有违反逻辑的用户，无需修复！");
        return;
    }

    // 步骤 4: 修复违反逻辑的用户
    console.log("📋 步骤 4: 修复违反逻辑的用户...");
    console.log("=".repeat(80));

    const fixResults = {
        timestamp: new Date().toISOString(),
        totalViolations: violations.length,
        fixed: [],
        failed: []
    };

    for (let i = 0; i < violations.length; i++) {
        const violation = violations[i];
        console.log(`\n[${i + 1}/${violations.length}] 修复推荐人: ${violation.referrer}`);
        console.log(`  用户: ${violation.user}`);
        console.log(`  用户 teamCount: ${violation.userTeamCount.toLocaleString()}`);
        console.log(`  推荐人当前 teamCount: ${violation.referrerTeamCount.toLocaleString()}`);
        console.log(`  推荐人应该的 teamCount: >= ${violation.requiredTeamCount.toLocaleString()}`);

        if (DRY_RUN) {
            console.log(`  ⚠️  干运行模式，跳过实际修复`);
            fixResults.fixed.push({
                referrer: violation.referrer,
                user: violation.user,
                oldTeamCount: violation.referrerTeamCount,
                newTeamCount: violation.requiredTeamCount,
                status: "dry_run"
            });
            continue;
        }

        try {
            // 修复推荐人的 teamCount，使其 >= 用户的 teamCount
            // 为了安全，我们设置为用户 teamCount + 1（或者可以根据实际情况调整）
            const newTeamCount = violation.requiredTeamCount;
            
            console.log(`  🔧 修复推荐人 teamCount 为 ${newTeamCount.toLocaleString()}...`);
            const tx = await newProtocol.adminSetTeamCount(violation.referrer, newTeamCount);
            console.log(`  📝 交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  ✅ 修复成功 (区块: ${receipt.blockNumber})`);
            
            fixResults.fixed.push({
                referrer: violation.referrer,
                user: violation.user,
                oldTeamCount: violation.referrerTeamCount,
                newTeamCount: newTeamCount,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            });

        } catch (error) {
            console.error(`  ❌ 修复失败: ${error.message}`);
            fixResults.failed.push({
                referrer: violation.referrer,
                user: violation.user,
                error: error.message
            });
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 输出结果
    console.log("\n" + "=".repeat(80));
    console.log("📊 修复结果");
    console.log("=".repeat(80));
    console.log(`总违反数: ${fixResults.totalViolations}`);
    console.log(`成功修复: ${fixResults.fixed.length}`);
    console.log(`修复失败: ${fixResults.failed.length}`);

    // 保存结果
    const resultsDir = "output";
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsFile = `${resultsDir}/fix-hierarchy-violations-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(fixResults, null, 2));
    console.log(`\n📄 修复结果已保存: ${resultsFile}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ 修复完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    fixHierarchyViolations().catch(console.error);
}
