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
    "function jbcToken() view returns (address)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
    "event DifferentialRewardCalculated(address indexed user, uint256 totalAmount, uint256 mcPart, uint256 jbcValuePart, uint256 jbcPrice, uint256 jbcAmount)",
    "event DifferentialRewardFailed(address indexed user, uint256 totalAmount, uint256 mcAmount, uint256 jbcAmount, string reason)",
    "event RewardTransferFailed(address indexed user, uint256 mcAmount, uint256 jbcAmount, string reason)",
    "event PartialRewardTransfer(address indexed user, uint256 requestedMC, uint256 transferredMC, uint256 requestedJBC, uint256 transferredJBC)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
];

const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
];

async function checkUserJBCRewards(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const jbcToken = new ethers.Contract(JBC_ADDRESS, JBC_ABI, provider);

    console.log("🔍 检查用户 JBC 奖励问题\n");
    console.log("=".repeat(60));
    console.log(`用户地址: ${userAddress}`);
    console.log("=".repeat(60) + "\n");

    try {
        // 1. 检查当前协议合约 JBC 余额
        console.log("💰 当前协议合约状态:");
        const protocolJBCBalance = await jbcToken.balanceOf(PROTOCOL_ADDRESS);
        const swapReserveMC = await protocol.swapReserveMC();
        const swapReserveJBC = await protocol.swapReserveJBC();
        console.log(`  协议 JBC 余额: ${ethers.formatEther(protocolJBCBalance)} JBC`);
        console.log(`  交换储备 MC: ${ethers.formatEther(swapReserveMC)} MC`);
        console.log(`  交换储备 JBC: ${ethers.formatEther(swapReserveJBC)} JBC`);
        if (swapReserveMC > 0n && swapReserveJBC > 0n) {
            const jbcPrice = (swapReserveMC * ethers.parseEther("1")) / swapReserveJBC;
            console.log(`  当前 JBC 价格: ${ethers.formatEther(jbcPrice)} MC/JBC`);
        }
        console.log("");

        // 2. 查询 DifferentialRewardDistributed 事件（用户作为接收者）
        console.log("📜 DifferentialRewardDistributed 事件（用户收到的级差奖励）:");
        try {
            const diffRewardEvents = await protocol.queryFilter(
                protocol.filters.DifferentialRewardDistributed(userAddress)
            );
            if (diffRewardEvents.length > 0) {
                console.log(`  共找到 ${diffRewardEvents.length} 笔级差奖励:`);
                let totalMC = 0n;
                let totalJBC = 0n;
                for (const event of diffRewardEvents) {
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    const jbcPrice = event.args.jbcPrice || 0n;
                    totalMC += mcAmount;
                    totalJBC += jbcAmount;
                    const block = await provider.getBlock(event.blockNumber);
                    console.log(`    - 区块 ${event.blockNumber} (${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}):`);
                    console.log(`      MC: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`      JBC: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`      JBC 价格: ${ethers.formatEther(jbcPrice)} MC/JBC`);
                    console.log(`      交易哈希: ${event.transactionHash}`);
                }
                console.log(`  累计收到: MC ${ethers.formatEther(totalMC)}, JBC ${ethers.formatEther(totalJBC)}`);
            } else {
                console.log("  ⚠️  未找到 DifferentialRewardDistributed 事件");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 3. 查询 DifferentialRewardCalculated 事件
        console.log("📊 DifferentialRewardCalculated 事件（计算的级差奖励）:");
        try {
            const calculatedEvents = await protocol.queryFilter(
                protocol.filters.DifferentialRewardCalculated(userAddress)
            );
            if (calculatedEvents.length > 0) {
                console.log(`  共找到 ${calculatedEvents.length} 笔计算的奖励:`);
                for (const event of calculatedEvents) {
                    const totalAmount = event.args.totalAmount || 0n;
                    const mcPart = event.args.mcPart || 0n;
                    const jbcValuePart = event.args.jbcValuePart || 0n;
                    const jbcPrice = event.args.jbcPrice || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    const block = await provider.getBlock(event.blockNumber);
                    console.log(`    - 区块 ${event.blockNumber} (${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}):`);
                    console.log(`      总奖励: ${ethers.formatEther(totalAmount)} MC`);
                    console.log(`      MC 部分: ${ethers.formatEther(mcPart)} MC`);
                    console.log(`      JBC 价值部分: ${ethers.formatEther(jbcValuePart)} MC`);
                    console.log(`      JBC 价格: ${ethers.formatEther(jbcPrice)} MC/JBC`);
                    console.log(`      计算的 JBC 数量: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`      交易哈希: ${event.transactionHash}`);
                }
            } else {
                console.log("  ⚠️  未找到 DifferentialRewardCalculated 事件");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 4. 查询 DifferentialRewardFailed 事件
        console.log("❌ DifferentialRewardFailed 事件（失败的级差奖励）:");
        try {
            const failedEvents = await protocol.queryFilter(
                protocol.filters.DifferentialRewardFailed(userAddress)
            );
            if (failedEvents.length > 0) {
                console.log(`  共找到 ${failedEvents.length} 笔失败的奖励:`);
                for (const event of failedEvents) {
                    const totalAmount = event.args.totalAmount || 0n;
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    const reason = event.args.reason || "未知原因";
                    const block = await provider.getBlock(event.blockNumber);
                    console.log(`    - 区块 ${event.blockNumber} (${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}):`);
                    console.log(`      总奖励: ${ethers.formatEther(totalAmount)} MC`);
                    console.log(`      MC: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`      JBC: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`      失败原因: ${reason}`);
                    console.log(`      交易哈希: ${event.transactionHash}`);
                }
            } else {
                console.log("  ✅ 未找到失败的奖励事件");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 5. 查询 RewardTransferFailed 事件
        console.log("⚠️  RewardTransferFailed 事件（转账失败的奖励）:");
        try {
            const transferFailedEvents = await protocol.queryFilter(
                protocol.filters.RewardTransferFailed(userAddress)
            );
            if (transferFailedEvents.length > 0) {
                console.log(`  共找到 ${transferFailedEvents.length} 笔转账失败的奖励:`);
                for (const event of transferFailedEvents) {
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    const reason = event.args.reason || "未知原因";
                    const block = await provider.getBlock(event.blockNumber);
                    console.log(`    - 区块 ${event.blockNumber} (${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}):`);
                    console.log(`      MC: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`      JBC: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`      失败原因: ${reason}`);
                    console.log(`      交易哈希: ${event.transactionHash}`);
                }
            } else {
                console.log("  ✅ 未找到转账失败的奖励事件");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 6. 查询 PartialRewardTransfer 事件
        console.log("📉 PartialRewardTransfer 事件（部分转账的奖励）:");
        try {
            const partialEvents = await protocol.queryFilter(
                protocol.filters.PartialRewardTransfer(userAddress)
            );
            if (partialEvents.length > 0) {
                console.log(`  共找到 ${partialEvents.length} 笔部分转账的奖励:`);
                for (const event of partialEvents) {
                    const requestedMC = event.args.requestedMC || 0n;
                    const transferredMC = event.args.transferredMC || 0n;
                    const requestedJBC = event.args.requestedJBC || 0n;
                    const transferredJBC = event.args.transferredJBC || 0n;
                    const block = await provider.getBlock(event.blockNumber);
                    console.log(`    - 区块 ${event.blockNumber} (${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}):`);
                    console.log(`      请求 MC: ${ethers.formatEther(requestedMC)} MC, 实际转账: ${ethers.formatEther(transferredMC)} MC`);
                    console.log(`      请求 JBC: ${ethers.formatEther(requestedJBC)} JBC, 实际转账: ${ethers.formatEther(transferredJBC)} JBC`);
                    console.log(`      交易哈希: ${event.transactionHash}`);
                }
            } else {
                console.log("  ✅ 未找到部分转账的奖励事件");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 7. 检查区块 2040720 时的协议合约 JBC 余额（用户购买门票的区块）
        console.log("🔍 检查区块 2040720 时的协议合约状态（用户购买门票时）:");
        try {
            const targetBlock = 2040720;
            const protocolJBCBalanceAtBlock = await jbcToken.balanceOf(PROTOCOL_ADDRESS, { blockTag: targetBlock });
            console.log(`  协议 JBC 余额（区块 ${targetBlock}）: ${ethers.formatEther(protocolJBCBalanceAtBlock)} JBC`);
            
            // 尝试获取该区块的储备池状态（如果可能）
            try {
                const swapReserveMCAtBlock = await protocol.swapReserveMC({ blockTag: targetBlock });
                const swapReserveJBCAtBlock = await protocol.swapReserveJBC({ blockTag: targetBlock });
                console.log(`  交换储备 MC（区块 ${targetBlock}）: ${ethers.formatEther(swapReserveMCAtBlock)} MC`);
                console.log(`  交换储备 JBC（区块 ${targetBlock}）: ${ethers.formatEther(swapReserveJBCAtBlock)} JBC`);
                if (swapReserveMCAtBlock > 0n && swapReserveJBCAtBlock > 0n) {
                    const jbcPriceAtBlock = (swapReserveMCAtBlock * ethers.parseEther("1")) / swapReserveJBCAtBlock;
                    console.log(`  JBC 价格（区块 ${targetBlock}）: ${ethers.formatEther(jbcPriceAtBlock)} MC/JBC`);
                }
            } catch (e) {
                console.log(`  ⚠️  无法获取区块 ${targetBlock} 的储备池状态: ${e.message}`);
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 8. 查询 ReferralRewardPaid 事件（用户作为接收者）
        console.log("📜 ReferralRewardPaid 事件（用户收到的推荐奖励）:");
        try {
            const referralEvents = await protocol.queryFilter(
                protocol.filters.ReferralRewardPaid(userAddress)
            );
            if (referralEvents.length > 0) {
                console.log(`  共找到 ${referralEvents.length} 笔推荐奖励:`);
                let totalMC = 0n;
                let totalJBC = 0n;
                for (const event of referralEvents) {
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    totalMC += mcAmount;
                    totalJBC += jbcAmount;
                    const block = await provider.getBlock(event.blockNumber);
                    console.log(`    - 区块 ${event.blockNumber} (${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}):`);
                    console.log(`      MC: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`      JBC: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`      来自: ${event.args.from}`);
                    console.log(`      类型: ${event.args.rewardType === 0 ? '直推' : '层级'}`);
                    console.log(`      交易哈希: ${event.transactionHash}`);
                }
                console.log(`  累计收到: MC ${ethers.formatEther(totalMC)}, JBC ${ethers.formatEther(totalJBC)}`);
            } else {
                console.log("  ⚠️  未找到推荐奖励事件");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 9. 检查用户当前的 JBC 余额
        console.log("💰 用户当前 JBC 余额:");
        try {
            const userJBCBalance = await jbcToken.balanceOf(userAddress);
            console.log(`  ${ethers.formatEther(userJBCBalance)} JBC`);
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 总结
        console.log("=".repeat(60));
        console.log("📊 分析总结:");
        console.log("=".repeat(60));
        console.log("1. 检查是否有 DifferentialRewardDistributed 事件");
        console.log("2. 检查是否有 DifferentialRewardFailed 事件");
        console.log("3. 检查是否有 RewardTransferFailed 事件");
        console.log("4. 检查是否有 PartialRewardTransfer 事件");
        console.log("5. 检查购买门票时协议合约的 JBC 余额");
        console.log("=".repeat(60));

    } catch (error) {
        console.error("❌ 查询失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

// 从命令行参数获取地址
const userAddress = process.argv[2] || "0x178A565B9c44e09EC96F6e52f7314110980c8C80";

// 执行查询
checkUserJBCRewards(userAddress).catch(console.error);
