const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const JBC_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
];

const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
];

async function calculateMissingJBC(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const jbcToken = new ethers.Contract(JBC_ADDRESS, JBC_ABI, provider);

    console.log("🔍 计算用户缺失的 JBC 奖励\n");
    console.log("=".repeat(60));
    console.log(`用户地址: ${userAddress}`);
    console.log("=".repeat(60) + "\n");

    try {
        // 1. 查询所有推荐奖励事件（用户作为来源，即用户贡献的奖励）
        console.log("📜 查询用户贡献的推荐奖励事件...");
        const allReferralEvents = await protocol.queryFilter(protocol.filters.ReferralRewardPaid());
        const contributedEvents = allReferralEvents.filter(event =>
            event.args.from?.toLowerCase() === userAddress.toLowerCase()
        );

        console.log(`  找到 ${contributedEvents.length} 笔推荐奖励事件\n`);

        if (contributedEvents.length === 0) {
            console.log("⚠️  未找到任何推荐奖励事件");
            return;
        }

        // 2. 分析每笔奖励
        let totalMCContributed = 0n;
        let totalJBCContributed = 0n;
        let totalMCShouldHaveJBC = 0n;
        const rewardDetails = [];

        for (const event of contributedEvents) {
            const mcAmount = event.args.mcAmount || 0n;
            const jbcAmount = event.args.jbcAmount || 0n;
            const toUser = event.args.user;
            const rewardType = event.args.rewardType;
            const ticketId = event.args.ticketId;
            const block = await provider.getBlock(event.blockNumber);

            totalMCContributed += mcAmount;
            totalJBCContributed += jbcAmount;

            // 根据 50/50 分配机制，MC 部分应该对应等值的 JBC 部分
            // 所以如果 MC 是 25 MC，那么应该有 25 MC 等值的 JBC
            // 需要根据当时的 JBC 价格计算
            const jbcValuePart = mcAmount; // 50% 应该是 JBC 价值部分

            // 获取该区块的 JBC 价格
            let jbcPriceAtBlock = 1n * ethers.parseEther("1"); // 默认 1 MC = 1 JBC
            try {
                const swapReserveMCAtBlock = await protocol.swapReserveMC({ blockTag: event.blockNumber });
                const swapReserveJBCAtBlock = await protocol.swapReserveJBC({ blockTag: event.blockNumber });
                if (swapReserveMCAtBlock > 0n && swapReserveJBCAtBlock > 0n) {
                    jbcPriceAtBlock = (swapReserveMCAtBlock * ethers.parseEther("1")) / swapReserveJBCAtBlock;
                }
            } catch (e) {
                console.log(`    ⚠️  无法获取区块 ${event.blockNumber} 的 JBC 价格，使用默认价格 1 MC/JBC`);
            }

            const jbcAmountShouldHave = (jbcValuePart * ethers.parseEther("1")) / jbcPriceAtBlock;
            const missingJBC = jbcAmountShouldHave - jbcAmount;

            if (missingJBC > 0n) {
                totalMCShouldHaveJBC += mcAmount;
            }

            rewardDetails.push({
                blockNumber: event.blockNumber,
                timestamp: new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN'),
                toUser: toUser,
                rewardType: rewardType === 0 ? '直推' : '层级',
                ticketId: ticketId.toString(),
                mcAmount: mcAmount,
                jbcAmountReceived: jbcAmount,
                jbcAmountShouldHave: jbcAmountShouldHave,
                missingJBC: missingJBC,
                jbcPriceAtBlock: jbcPriceAtBlock,
                transactionHash: event.transactionHash
            });
        }

        // 3. 计算总缺失的 JBC
        let totalMissingJBC = 0n;
        for (const detail of rewardDetails) {
            if (detail.missingJBC > 0n) {
                totalMissingJBC += detail.missingJBC;
            }
        }

        // 4. 显示详细报告
        console.log("📊 详细奖励分析:");
        console.log("-".repeat(60));
        for (let i = 0; i < rewardDetails.length; i++) {
            const detail = rewardDetails[i];
            console.log(`\n${i + 1}. 区块 ${detail.blockNumber} (${detail.timestamp})`);
            console.log(`   给用户: ${detail.toUser}`);
            console.log(`   奖励类型: ${detail.rewardType}`);
            console.log(`   门票ID: ${detail.ticketId}`);
            console.log(`   MC 金额: ${ethers.formatEther(detail.mcAmount)} MC`);
            console.log(`   收到的 JBC: ${ethers.formatEther(detail.jbcAmountReceived)} JBC`);
            console.log(`   应该收到的 JBC: ${ethers.formatEther(detail.jbcAmountShouldHave)} JBC`);
            console.log(`   JBC 价格（当时）: ${ethers.formatEther(detail.jbcPriceAtBlock)} MC/JBC`);
            if (detail.missingJBC > 0n) {
                console.log(`   ❌ 缺失的 JBC: ${ethers.formatEther(detail.missingJBC)} JBC`);
            } else {
                console.log(`   ✅ JBC 已完整发放`);
            }
            console.log(`   交易哈希: ${detail.transactionHash}`);
        }

        // 5. 汇总
        console.log("\n" + "=".repeat(60));
        console.log("📊 汇总统计:");
        console.log("=".repeat(60));
        console.log(`总贡献 MC: ${ethers.formatEther(totalMCContributed)} MC`);
        console.log(`总收到 JBC: ${ethers.formatEther(totalJBCContributed)} JBC`);
        console.log(`应该有 JBC 的 MC 部分: ${ethers.formatEther(totalMCShouldHaveJBC)} MC`);
        console.log(`总缺失 JBC: ${ethers.formatEther(totalMissingJBC)} JBC`);
        console.log("=".repeat(60));

        // 6. 检查当前协议合约 JBC 余额
        console.log("\n💰 当前协议合约状态:");
        const protocolJBCBalance = await jbcToken.balanceOf(PROTOCOL_ADDRESS);
        console.log(`协议 JBC 余额: ${ethers.formatEther(protocolJBCBalance)} JBC`);
        if (totalMissingJBC > 0n) {
            if (protocolJBCBalance >= totalMissingJBC) {
                console.log(`✅ 协议合约有足够余额补偿缺失的 JBC`);
            } else {
                console.log(`⚠️  协议合约余额不足，需要补充 ${ethers.formatEther(totalMissingJBC - protocolJBCBalance)} JBC`);
            }
        }

        // 7. 检查用户当前 JBC 余额
        console.log("\n💰 用户当前 JBC 余额:");
        const userJBCBalance = await jbcToken.balanceOf(userAddress);
        console.log(`${ethers.formatEther(userJBCBalance)} JBC`);

        // 8. 生成补偿建议
        if (totalMissingJBC > 0n) {
            console.log("\n" + "=".repeat(60));
            console.log("💡 补偿建议:");
            console.log("=".repeat(60));
            console.log(`用户地址: ${userAddress}`);
            console.log(`应补偿 JBC 数量: ${ethers.formatEther(totalMissingJBC)} JBC`);
            console.log(`补偿原因: 在区块 2040720 购买门票时，协议合约 JBC 余额为 0，导致推荐奖励中的 JBC 部分未发放`);
            console.log("\n建议操作:");
            console.log("1. 确认协议合约当前有足够的 JBC 余额");
            console.log("2. 使用管理员权限直接向用户转账缺失的 JBC");
            console.log("3. 或者创建一个补偿函数来批量处理此类问题");
            console.log("=".repeat(60));
        } else {
            console.log("\n✅ 未发现缺失的 JBC 奖励");
        }

    } catch (error) {
        console.error("❌ 计算失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

// 从命令行参数获取地址
const userAddress = process.argv[2] || "0x178A565B9c44e09EC96F6e52f7314110980c8C80";

// 执行计算
calculateMissingJBC(userAddress).catch(console.error);
