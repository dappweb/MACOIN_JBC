const fs = require("fs");
require("dotenv").config();

const API_BASE_URL = process.env.API_BASE_URL || "https://macoin-jbc-api.suiyiwan1.workers.dev";
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || process.env.PRIVATE_KEY ? require("ethers").Wallet.fromPhrase(process.env.PRIVATE_KEY).address : null;
const DRY_RUN = process.env.DRY_RUN !== "false"; // 默认为干运行

/**
 * 从等级对比结果文件获取用户列表
 */
function getUsersFromLevelComparison() {
    const resultsDir = "output";
    const comparisonFiles = fs.readdirSync(resultsDir)
        .filter(f => f.startsWith("level-comparison-") && f.endsWith(".json"))
        .sort()
        .reverse();
    
    if (comparisonFiles.length === 0) {
        console.error("❌ 错误: 找不到等级对比结果文件，请先运行 compare-user-levels.cjs");
        process.exit(1);
    }
    
    const latestFile = `${resultsDir}/${comparisonFiles[0]}`;
    console.log(`📄 读取等级对比结果: ${latestFile}`);
    const data = JSON.parse(fs.readFileSync(latestFile, "utf8"));
    
    return data.results || [];
}

/**
 * 通过 API 设置等级覆盖
 */
async function setLevelOverride(address, level, adminAddress) {
    try {
        const response = await fetch(`${API_BASE_URL}/level-override`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address.toLowerCase(),
                level: level,
                adminAddress: adminAddress.toLowerCase()
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to set level override' };
        }

        return { success: true, data };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

async function updateLevelDisplayViaAPI() {
    if (!ADMIN_ADDRESS) {
        console.error("❌ 错误: 请设置 ADMIN_ADDRESS 或 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🔧 通过 API 更新用户页面显示的等级数据");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行更新\n");
    }

    console.log(`管理员地址: ${ADMIN_ADDRESS}`);
    console.log(`API 地址: ${API_BASE_URL}\n`);

    // 获取用户列表
    const users = getUsersFromLevelComparison();
    console.log(`📋 需要更新等级显示的用户数: ${users.length}\n`);

    if (users.length === 0) {
        console.log("⚠️  没有找到需要更新的用户");
        return;
    }

    const updateResults = {
        timestamp: new Date().toISOString(),
        totalUsers: users.length,
        updated: [],
        failed: [],
        skipped: []
    };

    console.log("📋 开始通过 API 更新等级显示...\n");
    console.log("=".repeat(80));

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const userAddress = user.address;
        const teamCount = user.teamCount;
        const expectedLevel = user.expectedLevel;
        const currentPageLevel = user.pageLevel;

        console.log(`\n[${i + 1}/${users.length}] 用户: ${userAddress}`);
        console.log(`  团队人数: ${teamCount.toLocaleString()}`);
        console.log(`  当前页面等级: ${currentPageLevel !== "未知" ? `V${currentPageLevel}` : "未知"}`);
        console.log(`  应该的等级: V${expectedLevel}`);

        // 如果等级已经匹配，跳过（或者可以选择清除覆盖）
        if (currentPageLevel === expectedLevel) {
            console.log(`  ✅ 等级已正确，跳过设置覆盖`);
            updateResults.skipped.push({
                address: userAddress,
                teamCount,
                currentLevel: currentPageLevel,
                expectedLevel,
                reason: "等级已正确"
            });
            continue;
        }

        if (DRY_RUN) {
            console.log(`  ⚠️  干运行模式，跳过实际更新`);
            updateResults.skipped.push({
                address: userAddress,
                teamCount,
                currentLevel: currentPageLevel,
                expectedLevel,
                reason: "干运行模式"
            });
            continue;
        }

        try {
            console.log(`  🔧 通过 API 设置等级覆盖为 V${expectedLevel}...`);
            const result = await setLevelOverride(userAddress, expectedLevel, ADMIN_ADDRESS);
            
            if (result.success) {
                console.log(`  ✅ 等级覆盖设置成功`);
                updateResults.updated.push({
                    address: userAddress,
                    teamCount,
                    oldLevel: currentPageLevel,
                    newLevel: expectedLevel,
                    expectedLevel
                });
            } else {
                console.error(`  ❌ 设置失败: ${result.error}`);
                updateResults.failed.push({
                    address: userAddress,
                    teamCount,
                    currentLevel: currentPageLevel,
                    expectedLevel,
                    error: result.error
                });
            }

        } catch (error) {
            console.error(`  ❌ 更新失败: ${error.message}`);
            updateResults.failed.push({
                address: userAddress,
                teamCount,
                currentLevel: currentPageLevel,
                expectedLevel,
                error: error.message
            });
        }

        // 避免API请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 输出结果
    console.log("\n" + "=".repeat(80));
    console.log("📊 更新结果");
    console.log("=".repeat(80));
    console.log(`总用户数: ${updateResults.totalUsers}`);
    console.log(`成功更新: ${updateResults.updated.length}`);
    console.log(`更新失败: ${updateResults.failed.length}`);
    console.log(`跳过用户: ${updateResults.skipped.length}`);

    // 保存结果
    const resultsDir = "output";
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsFile = `${resultsDir}/set-level-override-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(updateResults, null, 2));
    console.log(`\n📄 更新结果已保存: ${resultsFile}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ 更新完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    updateLevelDisplayViaAPI().catch(console.error);
}
