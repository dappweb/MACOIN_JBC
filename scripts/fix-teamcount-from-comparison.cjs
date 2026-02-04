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
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
];

async function fixTeamCountFromComparison() {
    if (!PRIVATE_KEY) {
        console.error("❌ 错误: 请设置 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    // 读取对比结果文件
    const comparisonFiles = fs.readdirSync("output")
        .filter(f => f.startsWith("teamcount-comparison-") && f.endsWith(".json"))
        .sort()
        .reverse();
    
    if (comparisonFiles.length === 0) {
        console.error("❌ 错误: 找不到对比结果文件，请先运行 compare-real-vs-current-teamcount.cjs");
        process.exit(1);
    }
    
    const latestFile = `output/${comparisonFiles[0]}`;
    console.log(`📄 读取对比结果: ${latestFile}`);
    const comparisonData = JSON.parse(fs.readFileSync(latestFile, "utf8"));
    
    console.log("\n" + "=".repeat(80));
    console.log("🔧 修复 teamCount 错误");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行修复\n");
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

    const differences = comparisonData.differences || [];
    console.log(`📋 需要修复的用户数: ${differences.length}\n`);

    if (differences.length === 0) {
        console.log("✅ 没有需要修复的用户！");
        return;
    }

    // 按差异大小排序（优先修复差异最大的）
    differences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    const fixResults = {
        timestamp: new Date().toISOString(),
        totalUsers: differences.length,
        fixed: [],
        failed: [],
        skipped: []
    };

    console.log("📋 开始修复（按差异大小排序）...\n");
    console.log("=".repeat(80));

    for (let i = 0; i < differences.length; i++) {
        const diff = differences[i];
        const userAddress = diff.address;
        const realCount = diff.realCount;
        const currentCount = diff.currentCount;
        const difference = diff.difference;

        console.log(`\n[${i + 1}/${differences.length}] 修复用户: ${userAddress}`);
        console.log(`  当前 teamCount: ${currentCount.toLocaleString()}`);
        console.log(`  真实 teamCount: ${realCount.toLocaleString()}`);
        console.log(`  差异: ${difference > 0 ? '+' : ''}${difference.toLocaleString()}`);

        if (DRY_RUN) {
            console.log(`  ⚠️  干运行模式，跳过实际修复`);
            fixResults.skipped.push({
                address: userAddress,
                realCount,
                currentCount,
                difference
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
                fixResults.skipped.push({
                    address: userAddress,
                    realCount,
                    currentCount,
                    difference,
                    reason: "用户不在新合约中"
                });
                continue;
            }

            if (!userExists) {
                continue;
            }

            // 执行修复
            console.log(`  🔧 执行修复...`);
            const tx = await protocolContract.adminSetTeamCount(userAddress, realCount);
            console.log(`  📝 交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  ✅ 修复成功 (区块: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()})`);
            
            fixResults.fixed.push({
                address: userAddress,
                realCount,
                currentCount,
                difference,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            });

            // 验证修复结果
            const updatedUserInfo = await protocolContract.userInfo(userAddress);
            const updatedTeamCount = Number(updatedUserInfo.teamCount);
            if (updatedTeamCount === realCount) {
                console.log(`  ✅ 验证通过: teamCount 已更新为 ${updatedTeamCount}`);
            } else {
                console.log(`  ⚠️  验证失败: teamCount = ${updatedTeamCount}, 期望 = ${realCount}`);
            }

        } catch (error) {
            console.error(`  ❌ 修复失败: ${error.message}`);
            fixResults.failed.push({
                address: userAddress,
                realCount,
                currentCount,
                difference,
                error: error.message
            });
        }

        // 避免RPC请求过快
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
    
    const resultsFile = `${resultsDir}/fix-teamcount-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(fixResults, null, 2));
    console.log(`\n📄 修复结果已保存: ${resultsFile}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ 修复完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    fixTeamCountFromComparison().catch(console.error);
}
