const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "function getUserStakingInfo(address) view returns (uint256 stakedAmount, uint256 dailyReward, uint256 lastClaimTime, uint256 totalClaimed)",
    "function pendingRewards(address) view returns (uint256)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event RewardCapped(address indexed user, uint256 requested, uint256 paid)",
];

async function getUserRewardData(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 获取用户代币奖励数据\n");
    console.log("=".repeat(60));
    console.log(`用户地址: ${userAddress}`);
    console.log("=".repeat(60) + "\n");

    try {
        // 1. 获取用户基本信息
        console.log("📋 用户基本信息:");
        const userInfo = await protocol.userInfo(userAddress);
        console.log(`  推荐人: ${userInfo.referrer}`);
        console.log(`  是否激活: ${userInfo.isActive}`);
        console.log(`  活跃直推数: ${userInfo.activeDirects.toString()}`);
        console.log(`  团队人数: ${userInfo.teamCount.toString()}`);
        console.log(`  总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`  当前上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        console.log(`  可用收益额度: ${ethers.formatEther(userInfo.currentCap - userInfo.totalRevenue)} MC`);
        console.log(`  团队总交易量: ${ethers.formatEther(userInfo.teamTotalVolume)} MC`);
        console.log(`  团队总上限: ${ethers.formatEther(userInfo.teamTotalCap)} MC`);
        console.log(`  最大门票金额: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);
        console.log(`  最大单次门票金额: ${ethers.formatEther(userInfo.maxSingleTicketAmount)} MC`);
        console.log(`  退款费用金额: ${ethers.formatEther(userInfo.refundFeeAmount)} MC`);
        console.log("");

        // 2. 获取用户门票信息
        console.log("🎫 门票信息:");
        const userTicket = await protocol.userTicket(userAddress);
        console.log(`  门票ID: ${userTicket.ticketId.toString()}`);
        console.log(`  门票金额: ${ethers.formatEther(userTicket.amount)} MC`);
        if (userTicket.purchaseTime > 0n) {
            console.log(`  购买时间: ${new Date(Number(userTicket.purchaseTime) * 1000).toLocaleString('zh-CN')}`);
        } else {
            console.log(`  购买时间: 无`);
        }
        console.log(`  是否退出: ${userTicket.exited}`);
        console.log("");

        // 3. 获取直推列表
        console.log("📝 直推列表:");
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        console.log(`  直推数量: ${directReferrals.length}`);
        if (directReferrals.length > 0) {
            console.log("  直推地址列表:");
            for (let i = 0; i < directReferrals.length; i++) {
                const referralAddr = directReferrals[i];
                try {
                    const referralInfo = await protocol.userInfo(referralAddr);
                    console.log(`    ${i + 1}. ${referralAddr} (激活: ${referralInfo.isActive}, 总收益: ${ethers.formatEther(referralInfo.totalRevenue)} MC)`);
                } catch (e) {
                    console.log(`    ${i + 1}. ${referralAddr}`);
                }
            }
        }
        console.log("");

        // 4. 尝试获取质押信息（如果合约支持）
        console.log("💰 质押信息:");
        try {
            const stakingInfo = await protocol.getUserStakingInfo(userAddress);
            console.log(`  质押金额: ${ethers.formatEther(stakingInfo.stakedAmount)} MC`);
            console.log(`  每日奖励: ${ethers.formatEther(stakingInfo.dailyReward)} MC`);
            if (stakingInfo.lastClaimTime > 0n) {
                console.log(`  最后领取时间: ${new Date(Number(stakingInfo.lastClaimTime) * 1000).toLocaleString('zh-CN')}`);
            }
            console.log(`  已领取总额: ${ethers.formatEther(stakingInfo.totalClaimed)} MC`);
        } catch (e) {
            console.log("  (质押信息不可用或合约不支持此功能)");
        }
        console.log("");

        // 5. 尝试获取待领取奖励
        console.log("🎁 待领取奖励:");
        try {
            const pending = await protocol.pendingRewards(userAddress);
            console.log(`  待领取奖励: ${ethers.formatEther(pending)} MC`);
        } catch (e) {
            console.log("  (待领取奖励信息不可用或合约不支持此功能)");
        }
        console.log("");

        // 6. 查询推荐奖励事件（用户作为接收者）
        console.log("📜 推荐奖励历史（用户收到的推荐奖励）:");
        try {
            const receivedRewardEvents = await protocol.queryFilter(protocol.filters.ReferralRewardPaid(userAddress));
            if (receivedRewardEvents.length > 0) {
                console.log(`  共收到 ${receivedRewardEvents.length} 笔推荐奖励:`);
                let totalMCReceived = 0n;
                let totalJBCReceived = 0n;
                for (const event of receivedRewardEvents) {
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    totalMCReceived += mcAmount;
                    totalJBCReceived += jbcAmount;
                    console.log(`    - 区块 ${event.blockNumber}: MC ${ethers.formatEther(mcAmount)}, JBC ${ethers.formatEther(jbcAmount)} (来自 ${event.args.from}, 类型: ${event.args.rewardType === 0 ? '直推' : '层级'})`);
                }
                console.log(`  累计收到: MC ${ethers.formatEther(totalMCReceived)}, JBC ${ethers.formatEther(totalJBCReceived)}`);
            } else {
                console.log("  未找到收到的推荐奖励记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 7. 查询用户贡献的推荐奖励（用户作为来源）
        console.log("📤 用户贡献的推荐奖励（因用户购买门票而给推荐人的奖励）:");
        try {
            const allReferralEvents = await protocol.queryFilter(protocol.filters.ReferralRewardPaid());
            const contributedEvents = allReferralEvents.filter(event =>
                event.args.from?.toLowerCase() === userAddress.toLowerCase()
            );
            if (contributedEvents.length > 0) {
                console.log(`  共贡献 ${contributedEvents.length} 笔推荐奖励:`);
                let totalMCContributed = 0n;
                let totalJBCContributed = 0n;
                for (const event of contributedEvents) {
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    totalMCContributed += mcAmount;
                    totalJBCContributed += jbcAmount;
                    console.log(`    - 区块 ${event.blockNumber}: MC ${ethers.formatEther(mcAmount)}, JBC ${ethers.formatEther(jbcAmount)} (给 ${event.args.user}, 类型: ${event.args.rewardType === 0 ? '直推' : '层级'})`);
                }
                console.log(`  累计贡献: MC ${ethers.formatEther(totalMCContributed)}, JBC ${ethers.formatEther(totalJBCContributed)}`);
            } else {
                console.log("  未找到贡献的推荐奖励记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 8. 查询门票购买事件
        console.log("🎟️ 门票购买历史:");
        try {
            const ticketEvents = await protocol.queryFilter(protocol.filters.TicketPurchased(userAddress));
            if (ticketEvents.length > 0) {
                console.log(`  共购买 ${ticketEvents.length} 张门票:`);
                for (const event of ticketEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    console.log(`    - 区块 ${event.blockNumber} (${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}): ${ethers.formatEther(event.args.amount)} MC, 门票ID: ${event.args.ticketId}`);
                }
            } else {
                console.log("  未找到门票购买记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 9. 查询奖励被封顶的事件
        console.log("⚠️ 奖励封顶事件:");
        try {
            const cappedEvents = await protocol.queryFilter(protocol.filters.RewardCapped(userAddress));
            if (cappedEvents.length > 0) {
                console.log(`  共有 ${cappedEvents.length} 次奖励被封顶:`);
                for (const event of cappedEvents) {
                    console.log(`    - 区块 ${event.blockNumber}: 请求 ${ethers.formatEther(event.args.requested)} MC, 实际支付 ${ethers.formatEther(event.args.paid)} MC`);
                }
            } else {
                console.log("  未找到奖励封顶记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 汇总
        console.log("=".repeat(60));
        console.log("📊 奖励数据汇总:");
        console.log(`  总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`  收益上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        console.log(`  剩余可用额度: ${ethers.formatEther(userInfo.currentCap - userInfo.totalRevenue)} MC`);
        console.log("=".repeat(60));
        console.log("✅ 查询完成");

    } catch (error) {
        console.error("❌ 查询失败:", error.message);
        if (error.data) {
            console.error("错误数据:", error.data);
        }
        console.error(error.stack);
    }
}

// 从命令行参数获取地址，或使用默认地址
const userAddress = process.argv[2] || "0x0F1868dA5C4Fe2Bf3a5fa56fFf51304aE3624d24";

// 执行查询
getUserRewardData(userAddress).catch(console.error);
