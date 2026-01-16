const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ 错误: 未设置 PRIVATE_KEY 环境变量");
    process.exit(1);
}

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function owner() view returns (address)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

/**
 * 从事件构建推荐关系图并计算正确的 teamCount
 */
async function buildReferralMapAndCalculateTeamCount(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    
    const referrerMap = new Map(); // user -> referrer
    const allUsers = new Set();
    
    // 从新旧合约获取所有 BoundReferrer 事件
    for (const protocol of [newProtocol, oldProtocol]) {
        try {
            const events = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock
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
            console.error(`   查询事件失败: ${error.message}`);
        }
    }
    
    // 构建反向映射：referrer -> [users]
    const referrerToUsers = new Map();
    referrerMap.forEach((data, user) => {
        const referrer = data.referrer;
        if (!referrerToUsers.has(referrer)) {
            referrerToUsers.set(referrer, []);
        }
        referrerToUsers.get(referrer).push(user);
    });
    
    // 递归计算每个用户的 teamCount
    const teamCountCache = new Map();
    const visited = new Set();
    
    function calculateTeamCount(user) {
        if (teamCountCache.has(user)) {
            return teamCountCache.get(user);
        }
        
        if (visited.has(user)) {
            return 0; // 防止循环
        }
        visited.add(user);
        
        const directReferrals = referrerToUsers.get(user) || [];
        let count = directReferrals.length;
        
        for (const referral of directReferrals) {
            count += calculateTeamCount(referral);
        }
        
        visited.delete(user);
        teamCountCache.set(user, count);
        return count;
    }
    
    // 计算所有用户的 teamCount
    const calculatedTeamCounts = new Map();
    for (const user of allUsers) {
        calculatedTeamCounts.set(user, calculateTeamCount(user));
    }
    
    return calculatedTeamCounts;
}

async function fixTeamCountErrorsBatch(errorUsers, calculatedTeamCounts) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔧 批量修复 teamCount 错误");
    console.log("=".repeat(80));
    console.log(`新合约地址: ${NEW_PROTOCOL_ADDRESS}`);
    console.log(`操作账户: ${wallet.address}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 验证 owner
        const owner = await newProtocol.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ 错误: 当前账户 ${wallet.address} 不是合约 owner`);
            console.error(`   Owner: ${owner}`);
            process.exit(1);
        }
        console.log(`✅ 验证通过: 当前账户是合约 owner`);
        console.log("");

        // 按严重程度排序：先修复严重错误
        const sortedErrors = errorUsers.sort((a, b) => {
            const severityOrder = { "严重": 0, "中等": 1, "轻微": 2 };
            return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
        });

        const results = {
            total: sortedErrors.length,
            fixed: [],
            failed: [],
            skipped: []
        };

        for (let i = 0; i < sortedErrors.length; i++) {
            const error = sortedErrors[i];
            const userAddress = error.address;
            console.log(`[${i + 1}/${sortedErrors.length}] 处理: ${userAddress} (${error.severity})`);
            console.log("-".repeat(80));

            try {
                // 获取当前数据
                const userInfo = await newProtocol.userInfo(userAddress);
                const contractTeamCount = Number(userInfo.teamCount);
                
                // 从计算结果中获取正确的 teamCount
                const calculatedTeamCount = calculatedTeamCounts.get(userAddress.toLowerCase()) || 0;

                if (calculatedTeamCount === 0 && contractTeamCount > 0) {
                    console.log(`   ⚠️  计算值为 0 但合约值 > 0，可能需要进一步检查，跳过`);
                    results.skipped.push({
                        address: userAddress,
                        reason: "计算值为0但合约值>0，需要进一步检查"
                    });
                    console.log("");
                    continue;
                }

                if (contractTeamCount === calculatedTeamCount) {
                    console.log(`   ✅ teamCount 已正确: ${contractTeamCount}`);
                    results.skipped.push({
                        address: userAddress,
                        reason: "数据已正确"
                    });
                    console.log("");
                    continue;
                }

                console.log(`   当前值: ${contractTeamCount.toLocaleString()}`);
                console.log(`   正确值: ${calculatedTeamCount.toLocaleString()}`);
                console.log(`   差异: ${(contractTeamCount - calculatedTeamCount).toLocaleString()}`);

                // 发送交易修复
                console.log(`   📝 发送修复交易...`);
                const tx = await newProtocol.adminSetTeamCount(userAddress, calculatedTeamCount);
                console.log(`   ⏳ 交易已发送: ${tx.hash}`);
                console.log(`   ⏳ 等待确认...`);
                
                const receipt = await tx.wait();
                console.log(`   ✅ 交易已确认: 区块 ${receipt.blockNumber}, Gas 使用: ${receipt.gasUsed.toString()}`);

                // 验证修复结果
                const updatedInfo = await newProtocol.userInfo(userAddress);
                const updatedTeamCount = Number(updatedInfo.teamCount);
                if (updatedTeamCount === calculatedTeamCount) {
                    console.log(`   ✅ 修复成功！新的 teamCount: ${updatedTeamCount.toLocaleString()}`);
                    results.fixed.push({
                        address: userAddress,
                        oldValue: contractTeamCount,
                        newValue: calculatedTeamCount,
                        txHash: tx.hash,
                        severity: error.severity
                    });
                } else {
                    console.log(`   ⚠️  修复后验证失败: 期望 ${calculatedTeamCount}, 实际 ${updatedTeamCount}`);
                    results.failed.push({
                        address: userAddress,
                        reason: `修复后验证失败: 期望 ${calculatedTeamCount}, 实际 ${updatedTeamCount}`
                    });
                }

                console.log("");

                // 等待一段时间避免 RPC 限流
                if (i < sortedErrors.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                console.error(`   ❌ 处理失败: ${error.message}`);
                results.failed.push({
                    address: userAddress,
                    reason: error.message
                });
                console.log("");
            }
        }

        // 总结
        console.log("=".repeat(80));
        console.log("📊 修复总结");
        console.log("=".repeat(80));
        console.log(`总用户数: ${results.total}`);
        console.log(`修复成功: ${results.fixed.length} ✅`);
        console.log(`修复失败: ${results.failed.length} ❌`);
        console.log(`跳过: ${results.skipped.length} ⏭️`);
        console.log("");

        if (results.fixed.length > 0) {
            console.log("✅ 修复成功的用户:");
            results.fixed.forEach((item, idx) => {
                console.log(`   ${idx + 1}. ${item.address} (${item.severity})`);
                console.log(`      旧值: ${item.oldValue.toLocaleString()} → 新值: ${item.newValue.toLocaleString()}`);
                console.log(`      交易: ${item.txHash}`);
                console.log("");
            });
        }

        if (results.failed.length > 0) {
            console.log("❌ 修复失败的用户:");
            results.failed.forEach((item, idx) => {
                console.log(`   ${idx + 1}. ${item.address}: ${item.reason}`);
            });
            console.log("");
        }

        if (results.skipped.length > 0) {
            console.log("⏭️  跳过的用户:");
            results.skipped.forEach((item, idx) => {
                console.log(`   ${idx + 1}. ${item.address}: ${item.reason}`);
            });
            console.log("");
        }

        // 保存结果
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(__dirname, '..', 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputFile = path.join(outputDir, `fix-team-count-results-${timestamp}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        console.log(`📄 结果已保存: ${outputFile}`);
        console.log("");

        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("❌ 修复失败:", error);
        throw error;
    }
}

// 主函数
async function main() {
    // 从验证结果文件中读取错误用户
    const verificationFile = process.argv[2];
    
    if (!verificationFile) {
        console.error("❌ 错误: 请提供验证结果文件路径");
        console.error("   用法: node scripts/fix-team-count-errors-batch.cjs <verification-file.json>");
        console.error("   示例: node scripts/fix-team-count-errors-batch.cjs output/team-count-verification-2026-01-16T02-43-51-657Z.json");
        process.exit(1);
    }

    if (!fs.existsSync(verificationFile)) {
        console.error(`❌ 错误: 文件不存在: ${verificationFile}`);
        process.exit(1);
    }

    try {
        const verificationData = JSON.parse(fs.readFileSync(verificationFile, 'utf8'));
        const errorUsers = verificationData.errors || [];
        
        if (errorUsers.length === 0) {
            console.log("✅ 没有需要修复的用户");
            return;
        }

        console.log(`📋 从验证结果文件读取到 ${errorUsers.length} 个错误用户`);
        console.log("");

        // 构建推荐关系图并计算正确的 teamCount
        console.log("🔍 构建推荐关系图并计算正确的 teamCount...");
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
        const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
        
        const calculatedTeamCounts = await buildReferralMapAndCalculateTeamCount(newProtocol, oldProtocol, provider);
        console.log(`✅ 已计算 ${calculatedTeamCounts.size} 个用户的 teamCount`);
        console.log("");

        // 开始修复
        await fixTeamCountErrorsBatch(errorUsers, calculatedTeamCounts);

    } catch (error) {
        console.error("❌ 执行失败:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { fixTeamCountErrorsBatch, buildReferralMapAndCalculateTeamCount };
