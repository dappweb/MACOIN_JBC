const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E"; // 新协议合约地址

// 协议合约 ABI - 包含所有奖励相关事件
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    // 奖励相关事件
    "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
    "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
    "event LevelRewardReleased(uint256 indexed ticketId, address indexed upline, uint256 amount)",
];

async function getUserRewardHashes(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 查询用户奖励发放交易哈希\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 获取当前区块号
        const currentBlock = await provider.getBlockNumber();
        // 扩大查询范围，从合约部署开始查询
        const fromBlock = Math.max(0, currentBlock - 500000); // 查询最近50万个区块
        
        console.log(`📊 查询范围: 区块 ${fromBlock} 到 ${currentBlock} (共 ${currentBlock - fromBlock} 个区块)\n`);

        const allRewardHashes = [];

        // 1. 查询奖励领取事件 (RewardClaimed)
        console.log("💰 奖励领取事件 (RewardClaimed):");
        console.log("-".repeat(80));
        try {
            const claimEvents = await protocol.queryFilter(
                protocol.filters.RewardClaimed(userAddress),
                fromBlock
            );
            
            if (claimEvents.length > 0) {
                for (const event of claimEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    领取 MC: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`    领取 JBC: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                    
                    allRewardHashes.push({
                        type: "奖励领取",
                        hash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        timestamp: block ? Number(block.timestamp) : 0,
                        mcAmount: ethers.formatEther(mcAmount),
                        jbcAmount: ethers.formatEther(jbcAmount)
                    });
                }
            } else {
                console.log("  未找到奖励领取记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 2. 查询推荐奖励事件 (ReferralRewardPaid)
        console.log("🎁 推荐奖励事件 (ReferralRewardPaid):");
        console.log("-".repeat(80));
        try {
            const referralEvents = await protocol.queryFilter(
                protocol.filters.ReferralRewardPaid(userAddress),
                fromBlock
            );
            
            if (referralEvents.length > 0) {
                for (const event of referralEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    const rewardType = event.args.rewardType === 0 ? '直推' : '层级';
                    const from = event.args.from;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    类型: ${rewardType}奖励`);
                    console.log(`    来源: ${from}`);
                    console.log(`    MC 奖励: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`    JBC 奖励: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`    门票ID: ${event.args.ticketId?.toString() || 'N/A'}`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                    
                    allRewardHashes.push({
                        type: `推荐奖励(${rewardType})`,
                        hash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        timestamp: block ? Number(block.timestamp) : 0,
                        mcAmount: ethers.formatEther(mcAmount),
                        jbcAmount: ethers.formatEther(jbcAmount),
                        from: from
                    });
                }
            } else {
                console.log("  未找到推荐奖励记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 3. 查询极差奖励释放事件 (DifferentialRewardReleased)
        console.log("📈 极差奖励释放事件 (DifferentialRewardReleased):");
        console.log("-".repeat(80));
        try {
            // 注意：这个事件的第一个参数是 stakeId，第二个是 upline (接收者)
            // 我们需要查询所有事件，然后过滤出 upline 是该用户的
            const allDiffReleaseEvents = await protocol.queryFilter(
                protocol.filters.DifferentialRewardReleased(),
                fromBlock
            );
            
            const userDiffReleaseEvents = allDiffReleaseEvents.filter(
                event => event.args.upline?.toLowerCase() === userAddress.toLowerCase()
            );
            
            if (userDiffReleaseEvents.length > 0) {
                for (const event of userDiffReleaseEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const amount = event.args.amount || 0n;
                    const stakeId = event.args.stakeId?.toString() || 'N/A';
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    质押ID: ${stakeId}`);
                    console.log(`    金额: ${ethers.formatEther(amount)} MC`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                    
                    allRewardHashes.push({
                        type: "极差奖励释放",
                        hash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        timestamp: block ? Number(block.timestamp) : 0,
                        amount: ethers.formatEther(amount),
                        stakeId: stakeId
                    });
                }
            } else {
                console.log("  未找到极差奖励释放记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 4. 查询极差奖励分发事件 (DifferentialRewardDistributed)
        console.log("📊 极差奖励分发事件 (DifferentialRewardDistributed):");
        console.log("-".repeat(80));
        try {
            const diffDistEvents = await protocol.queryFilter(
                protocol.filters.DifferentialRewardDistributed(userAddress),
                fromBlock
            );
            
            if (diffDistEvents.length > 0) {
                for (const event of diffDistEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    const jbcPrice = event.args.jbcPrice || 0n;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    MC 奖励: ${ethers.formatEther(mcAmount)} MC`);
                    console.log(`    JBC 奖励: ${ethers.formatEther(jbcAmount)} JBC`);
                    console.log(`    JBC 价格: ${ethers.formatEther(jbcPrice)}`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                    
                    allRewardHashes.push({
                        type: "极差奖励分发",
                        hash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        timestamp: block ? Number(block.timestamp) : 0,
                        mcAmount: ethers.formatEther(mcAmount),
                        jbcAmount: ethers.formatEther(jbcAmount)
                    });
                }
            } else {
                console.log("  未找到极差奖励分发记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 5. 查询层级奖励释放事件 (LevelRewardReleased)
        console.log("🏆 层级奖励释放事件 (LevelRewardReleased):");
        console.log("-".repeat(80));
        try {
            const allLevelReleaseEvents = await protocol.queryFilter(
                protocol.filters.LevelRewardReleased(),
                fromBlock
            );
            
            const userLevelReleaseEvents = allLevelReleaseEvents.filter(
                event => event.args.upline?.toLowerCase() === userAddress.toLowerCase()
            );
            
            if (userLevelReleaseEvents.length > 0) {
                for (const event of userLevelReleaseEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const amount = event.args.amount || 0n;
                    const ticketId = event.args.ticketId?.toString() || 'N/A';
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    门票ID: ${ticketId}`);
                    console.log(`    金额: ${ethers.formatEther(amount)} MC`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                    
                    allRewardHashes.push({
                        type: "层级奖励释放",
                        hash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        timestamp: block ? Number(block.timestamp) : 0,
                        amount: ethers.formatEther(amount),
                        ticketId: ticketId
                    });
                }
            } else {
                console.log("  未找到层级奖励释放记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 6. 查询奖励支付事件 (RewardPaid)
        console.log("💵 奖励支付事件 (RewardPaid):");
        console.log("-".repeat(80));
        try {
            const rewardPaidEvents = await protocol.queryFilter(
                protocol.filters.RewardPaid(userAddress),
                fromBlock
            );
            
            if (rewardPaidEvents.length > 0) {
                for (const event of rewardPaidEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    const amount = event.args.amount || 0n;
                    const rewardType = event.args.rewardType || 0;
                    
                    console.log(`  [${blockTime}] 区块 ${event.blockNumber}`);
                    console.log(`    金额: ${ethers.formatEther(amount)} MC`);
                    console.log(`    奖励类型: ${rewardType}`);
                    console.log(`    交易哈希: ${event.transactionHash}`);
                    console.log("");
                    
                    allRewardHashes.push({
                        type: "奖励支付",
                        hash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        timestamp: block ? Number(block.timestamp) : 0,
                        amount: ethers.formatEther(amount),
                        rewardType: rewardType
                    });
                }
            } else {
                console.log("  未找到奖励支付记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 7. 汇总所有交易哈希（去重）
        console.log("📋 所有奖励发放交易哈希汇总:");
        console.log("=".repeat(80));
        if (allRewardHashes.length > 0) {
            // 按时间排序
            allRewardHashes.sort((a, b) => b.timestamp - a.timestamp);
            
            // 去重：使用 Set 存储唯一的交易哈希
            const uniqueHashes = new Set();
            const uniqueRewards = [];
            
            for (const reward of allRewardHashes) {
                if (!uniqueHashes.has(reward.hash)) {
                    uniqueHashes.add(reward.hash);
                    uniqueRewards.push(reward);
                }
            }
            
            console.log(`\n共找到 ${uniqueRewards.length} 笔唯一的奖励发放交易 (共 ${allRewardHashes.length} 个事件):\n`);
            for (let i = 0; i < uniqueRewards.length; i++) {
                const reward = uniqueRewards[i];
                const time = reward.timestamp > 0 ? new Date(reward.timestamp * 1000).toLocaleString('zh-CN') : 'N/A';
                console.log(`${i + 1}. [${time}] ${reward.type}`);
                console.log(`   区块: ${reward.blockNumber}`);
                console.log(`   交易哈希: ${reward.hash}`);
                if (reward.mcAmount) console.log(`   MC: ${reward.mcAmount} MC`);
                if (reward.jbcAmount) console.log(`   JBC: ${reward.jbcAmount} JBC`);
                if (reward.amount) console.log(`   金额: ${reward.amount} MC`);
                if (reward.from) console.log(`   来源: ${reward.from}`);
                console.log("");
            }
            
            // 只输出唯一的交易哈希列表
            console.log("\n🔗 唯一交易哈希列表 (按时间倒序):");
            console.log("-".repeat(80));
            uniqueRewards.forEach((reward, index) => {
                console.log(`${index + 1}. ${reward.hash}`);
            });
        } else {
            console.log("未找到任何奖励发放记录");
        }
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 查询失败:", error);
    }
}

// 运行脚本
const userAddress = process.argv[2] || "0x056f617D93E7f8865dCb6e075aa7cb49B837927c";
getUserRewardHashes(userAddress).catch(console.error);
