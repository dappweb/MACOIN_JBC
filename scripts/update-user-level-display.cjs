const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false"; // 默认为干运行

const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getLevel(address) view returns (uint256)",
    "function calculateLevel(uint256 teamCount) view returns (uint256 level, uint256 requiredCount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
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

async function updateUserLevelDisplay() {
    if (!PRIVATE_KEY) {
        console.error("❌ 错误: 请设置 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🔧 更新用户页面显示的等级数据");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行更新\n");
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const protocolContract = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

    console.log(`部署者地址: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`部署者余额: ${ethers.formatEther(balance)} MC`);

    // 验证 Owner
    const owner = await protocolContract.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`❌ 错误: 部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${wallet.address}`);
        process.exit(1);
    }
    console.log(`✅ Owner 验证通过\n`);

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

    console.log("📋 开始更新等级显示...\n");
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

        // 如果等级已经匹配，跳过
        if (currentPageLevel === expectedLevel) {
            console.log(`  ✅ 等级已正确，跳过`);
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
            // 验证用户在新合约中存在
            let userExists = false;
            try {
                await protocolContract.userInfo(userAddress);
                userExists = true;
            } catch (error) {
                console.log(`  ⚠️  用户不在新合约中，跳过`);
                updateResults.skipped.push({
                    address: userAddress,
                    teamCount,
                    currentLevel: currentPageLevel,
                    expectedLevel,
                    reason: "用户不在新合约中"
                });
                continue;
            }

            if (!userExists) {
                continue;
            }

            // 通过重新设置 teamCount 来触发等级重新计算
            // 由于等级是根据 teamCount 自动计算的，重新设置相同的值会触发等级更新事件
            console.log(`  🔧 重新设置 teamCount 以触发等级更新...`);
            const tx = await protocolContract.adminSetTeamCount(userAddress, teamCount);
            console.log(`  📝 交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  ✅ 更新成功 (区块: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()})`);
            
            // 验证等级是否更新
            const updatedLevel = await protocolContract.getLevel(userAddress);
            const updatedLevelNum = Number(updatedLevel);
            console.log(`  📊 更新后等级: V${updatedLevelNum}`);
            
            if (updatedLevelNum === expectedLevel) {
                console.log(`  ✅ 等级验证通过`);
            } else {
                console.log(`  ⚠️  等级验证失败: 期望 V${expectedLevel}, 实际 V${updatedLevelNum}`);
            }
            
            updateResults.updated.push({
                address: userAddress,
                teamCount,
                oldLevel: currentPageLevel,
                newLevel: updatedLevelNum,
                expectedLevel,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            });

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

        // 避免RPC请求过快
        await new Promise(resolve => setTimeout(resolve, 2000));
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
    
    const resultsFile = `${resultsDir}/update-level-display-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(updateResults, null, 2));
    console.log(`\n📄 更新结果已保存: ${resultsFile}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ 更新完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    updateUserLevelDisplay().catch(console.error);
}
