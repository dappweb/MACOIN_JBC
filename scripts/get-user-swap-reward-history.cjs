const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E"; // 新协议合约地址

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount)",
    "event SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount)",
    "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

async function getUserSwapRewardHistory(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 查询用户出入金奖励历史数据\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 获取当前区块号
        const currentBlock = await provider.getBlockNumber();
        // 扩大查询范围，从合约部署开始查询（合约部署在区块约 2000000 左右）
        const fromBlock = Math.max(0, currentBlock - 500000); // 查询最近50万个区块
        
        console.log(`📊 查询范围: 区块 ${fromBlock} 到 ${currentBlock} (共 ${currentBlock - fromBlock} 个区块)\n`);

        // 1. 查询 MC -> JBC 兑换（入金）
        console.log("💵 MC 兑换 JBC (入金) 历史:");
        console.log("-".repeat(80));
        try {
            const mcToJbcEvents = await protocol.queryFilter(
                protocol.filters.SwappedMCToJBC(userAddress),
                fromBlock
            );
            
            if (mcToJbcEvents.length > 0) {
                let totalMCIn = 0n;
                let totalJBCOut = 0n;
                
                for (const event of mcToJbcEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    
                    totalMCIn += mcAmount;
                    totalJBCOut += jbcAmount;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    MC 支付: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`    JBC 获得: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                }
                
                console.log(`  总计: 支付 ${ethers.formatEther(totalMCIn)} MC, 获得 ${ethers.formatEther(totalJBCOut)} JBC`);
            } else {
                console.log("  未找到 MC -> JBC 兑换记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 2. 查询 JBC -> MC 兑换（出金）
        console.log("💸 JBC 兑换 MC (出金) 历史:");
        console.log("-".repeat(80));
        try {
            const jbcToMcEvents = await protocol.queryFilter(
                protocol.filters.SwappedJBCToMC(userAddress),
                fromBlock
            );
            
            if (jbcToMcEvents.length > 0) {
                let totalJBCIn = 0n;
                let totalMCOut = 0n;
                
                for (const event of jbcToMcEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const jbcAmount = event.args.jbcAmount || 0n;
                    const mcAmount = event.args.mcAmount || 0n;
                    
                    totalJBCIn += jbcAmount;
                    totalMCOut += mcAmount;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    JBC 支付: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`    MC 获得: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                }
                
                console.log(`  总计: 支付 ${ethers.formatEther(totalJBCIn)} JBC, 获得 ${ethers.formatEther(totalMCOut)} MC`);
            } else {
                console.log("  未找到 JBC -> MC 兑换记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 3. 查询推荐奖励（收到的奖励）
        console.log("🎁 推荐奖励历史 (收到的奖励):");
        console.log("-".repeat(80));
        try {
            const referralEvents = await protocol.queryFilter(
                protocol.filters.ReferralRewardPaid(userAddress),
                fromBlock
            );
            
            if (referralEvents.length > 0) {
                let totalMCReceived = 0n;
                let totalJBCReceived = 0n;
                
                for (const event of referralEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    const rewardType = event.args.rewardType === 0 ? '直推' : '层级';
                    const from = event.args.from;
                    
                    totalMCReceived += mcAmount;
                    totalJBCReceived += jbcAmount;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    类型: ${rewardType}奖励`);
                    console.log(`    来源: ${from}`);
                    console.log(`    MC 奖励: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`    JBC 奖励: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`    门票ID: ${event.args.ticketId?.toString() || 'N/A'}`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                }
                
                console.log(`  总计收到: MC ${ethers.formatEther(totalMCReceived)}, JBC ${ethers.formatEther(totalJBCReceived)}`);
            } else {
                console.log("  未找到推荐奖励记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 4. 查询奖励领取历史
        console.log("💰 奖励领取历史:");
        console.log("-".repeat(80));
        try {
            const claimEvents = await protocol.queryFilter(
                protocol.filters.RewardClaimed(userAddress),
                fromBlock
            );
            
            if (claimEvents.length > 0) {
                let totalMCClaimed = 0n;
                let totalJBCClaimed = 0n;
                
                for (const event of claimEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    
                    totalMCClaimed += mcAmount;
                    totalJBCClaimed += jbcAmount;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    领取 MC: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`    领取 JBC: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                }
                
                console.log(`  总计领取: MC ${ethers.formatEther(totalMCClaimed)}, JBC ${ethers.formatEther(totalJBCClaimed)}`);
            } else {
                console.log("  未找到奖励领取记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 5. 查询门票购买历史
        console.log("🎫 门票购买历史:");
        console.log("-".repeat(80));
        try {
            const ticketEvents = await protocol.queryFilter(
                protocol.filters.TicketPurchased(userAddress),
                fromBlock
            );
            
            if (ticketEvents.length > 0) {
                let totalTickets = 0n;
                
                for (const event of ticketEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const amount = event.args.amount || 0n;
                    const ticketId = event.args.ticketId?.toString() || 'N/A';
                    
                    totalTickets += amount;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    门票ID: ${ticketId}`);
                    console.log(`    购买金额: ${ethers.formatEther(amount)} MC`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                }
                
                console.log(`  总计购买: ${ethers.formatEther(totalTickets)} MC`);
            } else {
                console.log("  未找到门票购买记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 6. 汇总统计
        console.log("📊 汇总统计:");
        console.log("=".repeat(80));
        const userInfo = await protocol.userInfo(userAddress);
        console.log(`  总收益 (合约状态): ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`  当前上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        console.log(`  团队人数: ${userInfo.teamCount.toString()}`);
        console.log(`  活跃直推数: ${userInfo.activeDirects.toString()}`);
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 查询失败:", error);
    }
}

// 运行脚本
const userAddress = process.argv[2] || "0xe5e9A2A9FCab62576C9b8bDEEA559E10FBD437A3";
getUserSwapRewardHistory(userAddress).catch(console.error);
