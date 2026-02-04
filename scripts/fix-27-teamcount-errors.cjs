const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ 错误: 未设置 PRIVATE_KEY 环境变量");
    console.log("请在 .env 文件中设置 PRIVATE_KEY=你的私钥");
    process.exit(1);
}

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function owner() view returns (address)",
];

// 从对比报告文件读取需要修复的用户
const COMPARISON_FILE = process.argv[2] || "output/teamcount-comparison-1768634385030.json";

async function main() {
    console.log("🔧 修复 teamCount 错误\n");
    console.log("=".repeat(60));
    console.log(`协议地址: ${PROTOCOL_ADDRESS}`);
    console.log(`对比报告: ${COMPARISON_FILE}`);
    console.log("=".repeat(60) + "\n");

    // 读取对比报告
    if (!fs.existsSync(COMPARISON_FILE)) {
        console.error(`❌ 错误: 找不到对比报告文件: ${COMPARISON_FILE}`);
        process.exit(1);
    }

    const comparisonData = JSON.parse(fs.readFileSync(COMPARISON_FILE, "utf8"));
    const mismatches = comparisonData.differences || [];

    if (mismatches.length === 0) {
        console.log("✅ 没有发现需要修复的用户");
        return;
    }

    console.log(`📋 发现 ${mismatches.length} 个需要修复的用户\n`);

    // 连接网络
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

    // 验证权限
    try {
        const owner = await protocol.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ 错误: 私钥对应的地址 ${wallet.address} 不是合约的 owner`);
            console.error(`   合约 owner: ${owner}`);
            process.exit(1);
        }
        console.log(`✅ 权限验证通过: ${wallet.address}\n`);
    } catch (error) {
        console.error(`❌ 权限验证失败: ${error.message}`);
        process.exit(1);
    }

    // 按差异大小排序（优先修复差异大的）
    const sortedMismatches = mismatches.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    const results = {
        timestamp: new Date().toISOString(),
        total: sortedMismatches.length,
        fixed: [],
        failed: [],
        skipped: []
    };

    console.log("开始修复...\n");

    for (let i = 0; i < sortedMismatches.length; i++) {
        const mismatch = sortedMismatches[i];
        const userAddress = mismatch.address;
        const realCount = mismatch.realCount;
        const currentCount = mismatch.currentCount;
        const difference = mismatch.difference;

        console.log(`[${i + 1}/${sortedMismatches.length}] ${userAddress}`);
        console.log(`   当前值: ${currentCount.toLocaleString()}`);
        console.log(`   正确值: ${realCount.toLocaleString()}`);
        console.log(`   差异: ${difference > 0 ? '+' : ''}${difference.toLocaleString()}`);

        try {
            // 验证当前值
            const userInfo = await protocol.userInfo(userAddress);
            const contractTeamCount = Number(userInfo.teamCount);

            if (contractTeamCount === realCount) {
                console.log(`   ✅ 数据已正确，跳过\n`);
                results.skipped.push({
                    address: userAddress,
                    reason: "数据已正确",
                    currentCount: contractTeamCount,
                    expectedCount: realCount
                });
                continue;
            }

            // 发送修复交易
            console.log(`   📝 发送修复交易...`);
            const tx = await protocol.adminSetTeamCount(userAddress, realCount);
            console.log(`   ⏳ 交易已发送: ${tx.hash}`);
            console.log(`   ⏳ 等待确认...`);

            const receipt = await tx.wait();
            console.log(`   ✅ 交易已确认: 区块 ${receipt.blockNumber}, Gas 使用: ${receipt.gasUsed.toString()}`);

            // 验证修复结果
            const updatedUserInfo = await protocol.userInfo(userAddress);
            const updatedTeamCount = Number(updatedUserInfo.teamCount);

            if (updatedTeamCount === realCount) {
                console.log(`   ✅ 修复成功: ${currentCount} -> ${updatedTeamCount}\n`);
                results.fixed.push({
                    address: userAddress,
                    oldCount: currentCount,
                    newCount: updatedTeamCount,
                    difference: difference,
                    transactionHash: tx.hash,
                    blockNumber: receipt.blockNumber
                });
            } else {
                console.log(`   ⚠️  修复后验证失败: 期望 ${realCount}, 实际 ${updatedTeamCount}\n`);
                results.failed.push({
                    address: userAddress,
                    reason: "验证失败",
                    expectedCount: realCount,
                    actualCount: updatedTeamCount,
                    transactionHash: tx.hash
                });
            }

            // 等待 2 秒，避免 RPC 限流
            if (i < sortedMismatches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } catch (error) {
            console.error(`   ❌ 修复失败: ${error.message}\n`);
            results.failed.push({
                address: userAddress,
                reason: error.message,
                expectedCount: realCount,
                currentCount: currentCount
            });
        }
    }

    // 保存结果
    const outputDir = path.join(__dirname, "..", "output");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFile = path.join(outputDir, `fix-27-teamcount-results-${timestamp}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

    // 显示总结
    console.log("=".repeat(60));
    console.log("📊 修复总结");
    console.log("=".repeat(60));
    console.log(`总用户数: ${results.total}`);
    console.log(`✅ 修复成功: ${results.fixed.length}`);
    console.log(`❌ 修复失败: ${results.failed.length}`);
    console.log(`⏭️  跳过: ${results.skipped.length}`);
    console.log(`\n结果已保存到: ${outputFile}`);
    console.log("=".repeat(60));
}

main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
