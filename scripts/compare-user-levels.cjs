const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getLevel(address) view returns (uint256)",
    "function calculateLevel(uint256 teamCount) view returns (uint256 level, uint256 requiredCount)",
];

/**
 * 根据 teamCount 计算应该的等级
 */
function calculateExpectedLevel(teamCount) {
    if (teamCount >= 1000) return 5;
    if (teamCount >= 300) return 4;
    if (teamCount >= 100) return 3;
    if (teamCount >= 30) return 2;
    if (teamCount >= 10) return 1;
    return 0;
}

/**
 * 从修复结果文件获取已修复的用户列表
 */
function getFixedUsers() {
    const resultsDir = "output";
    const fixFiles = fs.readdirSync(resultsDir)
        .filter(f => f.startsWith("fix-teamcount-results-") && f.endsWith(".json"))
        .sort()
        .reverse();
    
    const allFixedUsers = new Set();
    
    for (const file of fixFiles) {
        const data = JSON.parse(fs.readFileSync(`${resultsDir}/${file}`, "utf8"));
        if (data.fixed) {
            data.fixed.forEach(user => {
                allFixedUsers.add(user.address.toLowerCase());
            });
        }
    }
    
    return Array.from(allFixedUsers);
}

async function compareUserLevels() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 对比已修复用户的页面等级和实际等级");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 获取已修复的用户列表
    console.log("📋 步骤 1: 获取已修复的用户列表...");
    const fixedUsers = getFixedUsers();
    console.log(`  ✅ 找到 ${fixedUsers.length} 个已修复用户\n`);

    if (fixedUsers.length === 0) {
        console.log("⚠️  没有找到已修复的用户，请先运行修复脚本");
        return;
    }

    console.log("📋 步骤 2: 查询每个用户的等级信息...\n");
    console.log("=".repeat(80));

    const results = [];
    let matchCount = 0;
    let mismatchCount = 0;

    for (let i = 0; i < fixedUsers.length; i++) {
        const userAddress = fixedUsers[i];
        console.log(`\n[${i + 1}/${fixedUsers.length}] 用户: ${userAddress}`);

        try {
            // 查询用户信息
            let userInfo;
            let teamCount = 0;
            let isFromOldContract = false;

            // 先尝试新合约
            try {
                userInfo = await newProtocol.userInfo(userAddress);
                teamCount = Number(userInfo.teamCount);
            } catch (error) {
                // 尝试旧合约
                try {
                    userInfo = await oldProtocol.userInfo(userAddress);
                    teamCount = Number(userInfo.teamCount);
                    isFromOldContract = true;
                } catch (oldError) {
                    console.log(`  ❌ 无法从新旧合约获取用户数据`);
                    continue;
                }
            }

            // 查询页面等级（从合约）
            let pageLevel = null;
            try {
                if (!isFromOldContract) {
                    pageLevel = await newProtocol.getLevel(userAddress);
                    pageLevel = Number(pageLevel);
                } else {
                    // 旧合约可能没有 getLevel 方法
                    pageLevel = null;
                }
            } catch (error) {
                // 如果 getLevel 失败，尝试使用 calculateLevel
                try {
                    if (!isFromOldContract) {
                        const levelInfo = await newProtocol.calculateLevel(teamCount);
                        pageLevel = Number(levelInfo[0]);
                    }
                } catch (calcError) {
                    console.log(`  ⚠️  无法获取页面等级: ${calcError.message}`);
                }
            }

            // 计算实际应该的等级
            const expectedLevel = calculateExpectedLevel(teamCount);

            // 对比
            const isMatch = pageLevel !== null && pageLevel === expectedLevel;
            if (isMatch) {
                matchCount++;
            } else {
                mismatchCount++;
            }

            const result = {
                address: userAddress,
                teamCount,
                pageLevel: pageLevel !== null ? pageLevel : "未知",
                expectedLevel,
                isMatch,
                isFromOldContract
            };

            results.push(result);

            console.log(`  团队人数: ${teamCount.toLocaleString()}`);
            console.log(`  页面等级: ${pageLevel !== null ? `V${pageLevel}` : "未知"}`);
            console.log(`  实际等级: V${expectedLevel}`);
            if (isMatch) {
                console.log(`  ✅ 等级匹配`);
            } else {
                console.log(`  ⚠️  等级不匹配`);
                if (pageLevel !== null) {
                    console.log(`     差异: ${pageLevel > expectedLevel ? '+' : ''}${pageLevel - expectedLevel}`);
                }
            }

        } catch (error) {
            console.error(`  ❌ 查询失败: ${error.message}`);
        }

        // 避免RPC请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 输出总结
    console.log("\n" + "=".repeat(80));
    console.log("📊 对比结果总结");
    console.log("=".repeat(80));
    console.log(`总用户数: ${results.length}`);
    console.log(`等级匹配: ${matchCount} (${((matchCount / results.length) * 100).toFixed(2)}%)`);
    console.log(`等级不匹配: ${mismatchCount} (${((mismatchCount / results.length) * 100).toFixed(2)}%)`);

    if (mismatchCount > 0) {
        console.log("\n📋 等级不匹配的用户（前10个）:");
        results
            .filter(r => !r.isMatch)
            .slice(0, 10)
            .forEach((result, index) => {
                console.log(`\n${index + 1}. ${result.address}`);
                console.log(`   团队人数: ${result.teamCount.toLocaleString()}`);
                console.log(`   页面等级: ${result.pageLevel !== "未知" ? `V${result.pageLevel}` : "未知"}`);
                console.log(`   实际等级: V${result.expectedLevel}`);
                if (result.pageLevel !== "未知") {
                    const diff = result.pageLevel - result.expectedLevel;
                    console.log(`   差异: ${diff > 0 ? '+' : ''}${diff}`);
                }
            });
    }

    // 保存结果
    const resultsDir = "output";
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsFile = `${resultsDir}/level-comparison-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalUsers: results.length,
        matchCount,
        mismatchCount,
        results
    }, null, 2));
    console.log(`\n📄 详细结果已保存: ${resultsFile}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ 对比完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    compareUserLevels().catch(console.error);
}
