const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ 错误: 未设置 PRIVATE_KEY 环境变量");
    process.exit(1);
}

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function owner() view returns (address)",
];

/**
 * 计算正确的 teamCount
 */
async function calculateCorrectTeamCount(protocol, userAddress) {
    try {
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        let totalSubTeamCount = 0n;
        
        for (const ref of directReferrals) {
            try {
                const refInfo = await protocol.userInfo(ref);
                totalSubTeamCount += refInfo.teamCount;
            } catch (e) {
                // 忽略错误
            }
        }
        
        return BigInt(directReferrals.length) + totalSubTeamCount;
    } catch (error) {
        return null;
    }
}

async function fixDataErrorsBatch(userAddresses) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

    console.log("\n" + "=".repeat(80));
    console.log("🔧 批量修复数据错误");
    console.log("=".repeat(80));
    console.log(`合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`操作账户: ${wallet.address}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 验证 owner
        const owner = await protocol.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ 错误: 当前账户 ${wallet.address} 不是合约 owner`);
            console.error(`   Owner: ${owner}`);
            process.exit(1);
        }
        console.log(`✅ 验证通过: 当前账户是合约 owner`);
        console.log("");

        const results = {
            total: userAddresses.length,
            fixed: [],
            failed: [],
            skipped: []
        };

        for (let i = 0; i < userAddresses.length; i++) {
            const userAddress = userAddresses[i];
            console.log(`[${i + 1}/${userAddresses.length}] 处理: ${userAddress}`);
            console.log("-".repeat(80));

            try {
                // 获取当前数据
                const userInfo = await protocol.userInfo(userAddress);
                const contractTeamCount = userInfo.teamCount;

                // 计算正确的 teamCount
                const correctTeamCount = await calculateCorrectTeamCount(protocol, userAddress);
                
                if (correctTeamCount === null) {
                    console.log(`   ⚠️  无法计算正确的 teamCount，跳过`);
                    results.skipped.push({
                        address: userAddress,
                        reason: "无法计算正确的 teamCount"
                    });
                    console.log("");
                    continue;
                }

                if (contractTeamCount.toString() === correctTeamCount.toString()) {
                    console.log(`   ✅ teamCount 已正确: ${contractTeamCount}`);
                    results.skipped.push({
                        address: userAddress,
                        reason: "数据已正确"
                    });
                    console.log("");
                    continue;
                }

                console.log(`   当前值: ${contractTeamCount}`);
                console.log(`   正确值: ${correctTeamCount}`);
                console.log(`   差异: ${BigInt(contractTeamCount) - correctTeamCount}`);

                // 发送交易修复
                console.log(`   📝 发送修复交易...`);
                const tx = await protocol.adminSetTeamCount(userAddress, correctTeamCount);
                console.log(`   ⏳ 交易已发送: ${tx.hash}`);
                console.log(`   ⏳ 等待确认...`);
                
                const receipt = await tx.wait();
                console.log(`   ✅ 交易已确认: 区块 ${receipt.blockNumber}, Gas 使用: ${receipt.gasUsed.toString()}`);

                // 验证修复结果
                const updatedInfo = await protocol.userInfo(userAddress);
                if (updatedInfo.teamCount.toString() === correctTeamCount.toString()) {
                    console.log(`   ✅ 修复成功！新的 teamCount: ${updatedInfo.teamCount}`);
                    results.fixed.push({
                        address: userAddress,
                        oldValue: contractTeamCount.toString(),
                        newValue: correctTeamCount.toString(),
                        txHash: tx.hash
                    });
                } else {
                    console.log(`   ⚠️  修复后验证失败`);
                    results.failed.push({
                        address: userAddress,
                        reason: "修复后验证失败"
                    });
                }

                console.log("");

                // 等待一段时间避免 RPC 限流
                if (i < userAddresses.length - 1) {
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
                console.log(`   ${idx + 1}. ${item.address}`);
                console.log(`      旧值: ${item.oldValue} → 新值: ${item.newValue}`);
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

        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("❌ 修复失败:", error);
        throw error;
    }
}

// 主函数
async function main() {
    // 从检查报告中读取需要修复的用户地址
    const userAddresses = process.argv.slice(2);
    
    if (userAddresses.length === 0) {
        console.error("❌ 错误: 请提供需要修复的用户地址");
        console.error("   用法: node scripts/fix-data-errors-batch.cjs <address1> <address2> ...");
        console.error("   或从检查报告中读取:");
        console.error("   node scripts/fix-data-errors-batch.cjs 0x2d68a5850a4805c6fe6648e5870b68456e2a7c82 0xc418c1287c62cde6b8434e88e33f8d4feecf5e95");
        process.exit(1);
    }

    try {
        await fixDataErrorsBatch(userAddresses);
    } catch (error) {
        console.error("❌ 执行失败:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { fixDataErrorsBatch };
