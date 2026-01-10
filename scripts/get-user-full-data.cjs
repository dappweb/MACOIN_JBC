const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const JBC_ADDRESS = "0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function getDirectReferrals(address) view returns (address[])",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function calculateStakeRewards(address) view returns (uint256)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event RewardCapped(address indexed user, uint256 requested, uint256 paid)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 stakeId, uint256 cycleDays)",
    "event RewardsClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount)",
    "event Redeemed(address indexed user, uint256 returnAmount, uint256 yieldAmount)",
];

// JBC Token ABI
const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)"
];

async function getUserFullData(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const jbcToken = new ethers.Contract(JBC_ADDRESS, JBC_ABI, provider);

    console.log("🔍 获取用户完整数据报告\n");
    console.log("=".repeat(70));
    console.log(`用户地址: ${userAddress}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(70) + "\n");

    try {
        // 获取用户MC和JBC余额
        console.log("💰 用户钱包余额:");
        const mcBalance = await provider.getBalance(userAddress);
        const jbcBalance = await jbcToken.balanceOf(userAddress);
        console.log(`  MC余额: ${ethers.formatEther(mcBalance)} MC`);
        console.log(`  JBC余额: ${ethers.formatEther(jbcBalance)} JBC`);
        console.log("");

        // 1. 获取用户基本信息
        console.log("📋 用户基本信息 (userInfo):");
        console.log("-".repeat(50));
        const userInfo = await protocol.userInfo(userAddress);
        console.log(`  推荐人: ${userInfo.referrer}`);
        console.log(`  是否激活: ${userInfo.isActive}`);
        console.log(`  活跃直推数: ${userInfo.activeDirects.toString()}`);
        console.log(`  团队人数: ${userInfo.teamCount.toString()}`);
        console.log(`  总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`  当前上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        console.log(`  剩余可用额度: ${ethers.formatEther(userInfo.currentCap - userInfo.totalRevenue)} MC`);
        console.log(`  团队总交易量: ${ethers.formatEther(userInfo.teamTotalVolume)} MC`);
        console.log(`  团队总上限: ${ethers.formatEther(userInfo.teamTotalCap)} MC`);
        console.log(`  最大门票金额: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);
        console.log(`  最大单次门票金额: ${ethers.formatEther(userInfo.maxSingleTicketAmount)} MC`);
        console.log(`  退款费用金额: ${ethers.formatEther(userInfo.refundFeeAmount)} MC`);
        console.log("");

        // 获取用户等级
        console.log("🏅 用户等级信息:");
        console.log("-".repeat(50));
        try {
            const levelInfo = await protocol.getUserLevel(userAddress);
            const levelNames = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5'];
            console.log(`  等级: ${levelNames[Number(levelInfo.level)] || `V${levelInfo.level}`}`);
            console.log(`  等级奖励比例: ${Number(levelInfo.percent) / 100}%`);
            console.log(`  团队数量: ${levelInfo.teamCount.toString()}`);
        } catch (e) {
            console.log("  (等级信息不可用)");
        }
        console.log("");

        // 2. 获取用户门票信息
        console.log("🎫 门票信息 (userTicket):");
        console.log("-".repeat(50));
        const userTicket = await protocol.userTicket(userAddress);
        console.log(`  门票ID: ${userTicket.ticketId.toString()}`);
        console.log(`  门票金额: ${ethers.formatEther(userTicket.amount)} MC`);
        if (userTicket.purchaseTime > 0n) {
            const purchaseDate = new Date(Number(userTicket.purchaseTime) * 1000);
            console.log(`  购买时间: ${purchaseDate.toLocaleString('zh-CN')}`);
        } else {
            console.log(`  购买时间: 无`);
        }
        console.log(`  是否退出: ${userTicket.exited}`);
        console.log("");

        // 3. 获取所有质押记录 (入金数据)
        console.log("📊 质押记录 (入金数据 - userStakes):");
        console.log("-".repeat(50));
        let stakes = [];
        let stakeIndex = 0;
        let totalStaked = 0n;
        let totalPaid = 0n;
        let activeStakeCount = 0;
        
        // 获取 SECONDS_IN_UNIT 以计算时间
        let secondsInUnit = 86400n; // 默认1天
        try {
            secondsInUnit = await protocol.SECONDS_IN_UNIT();
        } catch (e) {}

        while (true) {
            try {
                const stake = await protocol.userStakes(userAddress, stakeIndex);
                stakes.push({
                    index: stakeIndex,
                    id: stake.id,
                    amount: stake.amount,
                    startTime: stake.startTime,
                    cycleDays: stake.cycleDays,
                    active: stake.active,
                    paid: stake.paid
                });
                totalStaked += stake.amount;
                totalPaid += stake.paid;
                if (stake.active) activeStakeCount++;
                stakeIndex++;
            } catch (e) {
                break; // 没有更多质押记录
            }
        }

        if (stakes.length === 0) {
            console.log("  无质押记录");
        } else {
            console.log(`  质押记录数量: ${stakes.length}`);
            console.log(`  活跃质押数量: ${activeStakeCount}`);
            console.log(`  历史总质押金额: ${ethers.formatEther(totalStaked)} MC`);
            console.log(`  已领取收益总额: ${ethers.formatEther(totalPaid)} MC`);
            console.log("");
            console.log("  详细质押记录:");
            console.log("  " + "=".repeat(100));
            console.log(`  ${"序号".padEnd(6)} | ${"ID".padEnd(6)} | ${"金额(MC)".padEnd(18)} | ${"周期(天)".padEnd(10)} | ${"开始时间".padEnd(22)} | ${"状态".padEnd(8)} | ${"已领取(MC)".padEnd(18)}`);
            console.log("  " + "-".repeat(100));
            
            for (const stake of stakes) {
                const startDate = new Date(Number(stake.startTime) * 1000);
                const endTime = Number(stake.startTime) + (Number(stake.cycleDays) * Number(secondsInUnit));
                const endDate = new Date(endTime * 1000);
                const now = Date.now() / 1000;
                const isExpired = now >= endTime;
                
                let status = stake.active ? (isExpired ? "🟡已到期" : "🟢进行中") : "⚫已结束";
                
                console.log(`  ${String(stake.index).padEnd(6)} | ${String(stake.id).padEnd(6)} | ${ethers.formatEther(stake.amount).padEnd(18)} | ${String(stake.cycleDays).padEnd(10)} | ${startDate.toLocaleString('zh-CN').padEnd(22)} | ${status.padEnd(8)} | ${ethers.formatEther(stake.paid).padEnd(18)}`);
            }
            console.log("  " + "=".repeat(100));
            
            // 显示活跃质押的详细信息
            const activeStakes = stakes.filter(s => s.active);
            if (activeStakes.length > 0) {
                console.log("\n  活跃质押详情:");
                for (const stake of activeStakes) {
                    const startDate = new Date(Number(stake.startTime) * 1000);
                    const endTime = Number(stake.startTime) + (Number(stake.cycleDays) * Number(secondsInUnit));
                    const endDate = new Date(endTime * 1000);
                    const now = Date.now() / 1000;
                    const daysRemaining = Math.max(0, Math.ceil((endTime - now) / 86400));
                    const daysPassed = Math.floor((now - Number(stake.startTime)) / 86400);
                    
                    // 计算日收益率
                    let ratePerBillion = 0;
                    if (Number(stake.cycleDays) === 7) ratePerBillion = 13333334;
                    else if (Number(stake.cycleDays) === 15) ratePerBillion = 16666667;
                    else if (Number(stake.cycleDays) === 30) ratePerBillion = 20000000;
                    
                    const dailyReward = (stake.amount * BigInt(ratePerBillion)) / 1000000000n;
                    const totalExpectedReward = dailyReward * stake.cycleDays;
                    
                    console.log(`    质押 #${stake.index} (ID: ${stake.id}):`);
                    console.log(`      金额: ${ethers.formatEther(stake.amount)} MC`);
                    console.log(`      周期: ${stake.cycleDays} 天`);
                    console.log(`      开始时间: ${startDate.toLocaleString('zh-CN')}`);
                    console.log(`      结束时间: ${endDate.toLocaleString('zh-CN')}`);
                    console.log(`      已过天数: ${daysPassed} 天`);
                    console.log(`      剩余天数: ${daysRemaining} 天`);
                    console.log(`      日收益率: ${(ratePerBillion / 10000000).toFixed(4)}%`);
                    console.log(`      每日收益: ${ethers.formatEther(dailyReward)} MC`);
                    console.log(`      预期总收益: ${ethers.formatEther(totalExpectedReward)} MC`);
                    console.log(`      已领取: ${ethers.formatEther(stake.paid)} MC`);
                    console.log("");
                }
            }
        }
        console.log("");

        // 获取待领取收益
        console.log("🎁 待领取收益:");
        console.log("-".repeat(50));
        try {
            const pendingRewards = await protocol.calculateStakeRewards(userAddress);
            console.log(`  待领取质押收益: ${ethers.formatEther(pendingRewards)} MC`);
        } catch (e) {
            console.log(`  (待领取收益查询失败: ${e.message})`);
        }
        console.log("");

        // 4. 获取直推列表
        console.log("👥 直推列表 (getDirectReferrals):");
        console.log("-".repeat(50));
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        console.log(`  直推数量: ${directReferrals.length}`);
        if (directReferrals.length > 0) {
            console.log("  直推地址详情:");
            for (let i = 0; i < directReferrals.length; i++) {
                const referralAddr = directReferrals[i];
                try {
                    const referralInfo = await protocol.userInfo(referralAddr);
                    const referralTicket = await protocol.userTicket(referralAddr);
                    console.log(`    ${i + 1}. ${referralAddr}`);
                    console.log(`       激活: ${referralInfo.isActive}, 门票: ${ethers.formatEther(referralTicket.amount)} MC, 总收益: ${ethers.formatEther(referralInfo.totalRevenue)} MC`);
                } catch (e) {
                    console.log(`    ${i + 1}. ${referralAddr}`);
                }
            }
        }
        console.log("");

        // 5. 查询推荐奖励事件 (用户收到的)
        console.log("📜 推荐奖励历史 (收到的奖励):");
        console.log("-".repeat(50));
        try {
            const receivedRewardEvents = await protocol.queryFilter(protocol.filters.ReferralRewardPaid(userAddress));
            if (receivedRewardEvents.length > 0) {
                console.log(`  共收到 ${receivedRewardEvents.length} 笔推荐奖励:`);
                let totalMCReceived = 0n;
                let totalJBCReceived = 0n;
                
                const rewardTypeNames = {
                    0: '直推奖励',
                    1: '层级奖励',
                    2: '等级奖励'
                };
                
                for (const event of receivedRewardEvents) {
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    totalMCReceived += mcAmount;
                    totalJBCReceived += jbcAmount;
                    
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    
                    console.log(`    - [${blockTime}] 区块 ${event.blockNumber}:`);
                    console.log(`      MC: ${ethers.formatEther(mcAmount)}, JBC: ${ethers.formatEther(jbcAmount)}`);
                    console.log(`      来源: ${event.args.from}, 类型: ${rewardTypeNames[event.args.rewardType] || event.args.rewardType}`);
                }
                console.log(`  累计收到: MC ${ethers.formatEther(totalMCReceived)}, JBC ${ethers.formatEther(totalJBCReceived)}`);
            } else {
                console.log("  未找到收到的推荐奖励记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 6. 查询用户贡献的推荐奖励 (用户作为来源)
        console.log("📤 贡献的推荐奖励 (因购买门票给推荐人的奖励):");
        console.log("-".repeat(50));
        try {
            const allReferralEvents = await protocol.queryFilter(protocol.filters.ReferralRewardPaid());
            const contributedEvents = allReferralEvents.filter(event =>
                event.args.from?.toLowerCase() === userAddress.toLowerCase()
            );
            if (contributedEvents.length > 0) {
                console.log(`  共贡献 ${contributedEvents.length} 笔推荐奖励:`);
                let totalMCContributed = 0n;
                let totalJBCContributed = 0n;
                
                const rewardTypeNames = {
                    0: '直推奖励',
                    1: '层级奖励',
                    2: '等级奖励'
                };
                
                for (const event of contributedEvents) {
                    const mcAmount = event.args.mcAmount || 0n;
                    const jbcAmount = event.args.jbcAmount || 0n;
                    totalMCContributed += mcAmount;
                    totalJBCContributed += jbcAmount;
                    console.log(`    - 区块 ${event.blockNumber}: MC ${ethers.formatEther(mcAmount)}, JBC ${ethers.formatEther(jbcAmount)}`);
                    console.log(`      给: ${event.args.user}, 类型: ${rewardTypeNames[event.args.rewardType] || event.args.rewardType}`);
                }
                console.log(`  累计贡献: MC ${ethers.formatEther(totalMCContributed)}, JBC ${ethers.formatEther(totalJBCContributed)}`);
            } else {
                console.log("  未找到贡献的推荐奖励记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 7. 查询门票购买历史
        console.log("🎟️ 门票购买历史:");
        console.log("-".repeat(50));
        try {
            const ticketEvents = await protocol.queryFilter(protocol.filters.TicketPurchased(userAddress));
            if (ticketEvents.length > 0) {
                console.log(`  共购买 ${ticketEvents.length} 张门票:`);
                for (const event of ticketEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    console.log(`    - [${blockTime}] 区块 ${event.blockNumber}: ${ethers.formatEther(event.args.amount)} MC, 门票ID: ${event.args.ticketId}`);
                }
            } else {
                console.log("  未找到门票购买记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 8. 查询质押事件历史
        console.log("📈 质押事件历史 (LiquidityStaked):");
        console.log("-".repeat(50));
        try {
            const stakeEvents = await protocol.queryFilter(protocol.filters.LiquidityStaked(userAddress));
            if (stakeEvents.length > 0) {
                console.log(`  共 ${stakeEvents.length} 次质押:`);
                let totalStakeAmount = 0n;
                for (const event of stakeEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    totalStakeAmount += event.args.amount;
                    console.log(`    - [${blockTime}] 区块 ${event.blockNumber}: ${ethers.formatEther(event.args.amount)} MC`);
                    console.log(`      质押ID: ${event.args.stakeId}, 周期: ${event.args.cycleDays} 天`);
                }
                console.log(`  历史质押总额: ${ethers.formatEther(totalStakeAmount)} MC`);
            } else {
                console.log("  未找到质押事件记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 9. 查询收益领取历史
        console.log("💵 收益领取历史 (RewardsClaimed):");
        console.log("-".repeat(50));
        try {
            const claimEvents = await protocol.queryFilter(protocol.filters.RewardsClaimed(userAddress));
            if (claimEvents.length > 0) {
                console.log(`  共 ${claimEvents.length} 次领取:`);
                let totalMCClaimed = 0n;
                let totalJBCClaimed = 0n;
                for (const event of claimEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    totalMCClaimed += event.args.mcAmount;
                    totalJBCClaimed += event.args.jbcAmount;
                    console.log(`    - [${blockTime}] 区块 ${event.blockNumber}: MC ${ethers.formatEther(event.args.mcAmount)}, JBC ${ethers.formatEther(event.args.jbcAmount)}`);
                }
                console.log(`  累计领取: MC ${ethers.formatEther(totalMCClaimed)}, JBC ${ethers.formatEther(totalJBCClaimed)}`);
            } else {
                console.log("  未找到收益领取记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 10. 查询赎回历史
        console.log("🔓 赎回历史 (Redeemed):");
        console.log("-".repeat(50));
        try {
            const redeemEvents = await protocol.queryFilter(protocol.filters.Redeemed(userAddress));
            if (redeemEvents.length > 0) {
                console.log(`  共 ${redeemEvents.length} 次赎回:`);
                let totalReturned = 0n;
                let totalYield = 0n;
                for (const event of redeemEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    totalReturned += event.args.returnAmount;
                    totalYield += event.args.yieldAmount;
                    console.log(`    - [${blockTime}] 区块 ${event.blockNumber}: 返还 ${ethers.formatEther(event.args.returnAmount)} MC, 收益 ${ethers.formatEther(event.args.yieldAmount)} MC`);
                }
                console.log(`  累计返还: ${ethers.formatEther(totalReturned)} MC, 累计收益: ${ethers.formatEther(totalYield)} MC`);
            } else {
                console.log("  未找到赎回记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 11. 查询奖励封顶事件
        console.log("⚠️ 奖励封顶事件 (RewardCapped):");
        console.log("-".repeat(50));
        try {
            const cappedEvents = await protocol.queryFilter(protocol.filters.RewardCapped(userAddress));
            if (cappedEvents.length > 0) {
                console.log(`  共 ${cappedEvents.length} 次奖励被封顶:`);
                for (const event of cappedEvents) {
                    const block = await provider.getBlock(event.blockNumber);
                    const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                    console.log(`    - [${blockTime}] 区块 ${event.blockNumber}: 请求 ${ethers.formatEther(event.args.requested)} MC, 实际支付 ${ethers.formatEther(event.args.paid)} MC`);
                }
            } else {
                console.log("  未找到奖励封顶记录");
            }
        } catch (e) {
            console.log(`  查询失败: ${e.message}`);
        }
        console.log("");

        // 汇总
        console.log("=".repeat(70));
        console.log("📊 数据汇总:");
        console.log("=".repeat(70));
        console.log(`  钱包MC余额: ${ethers.formatEther(mcBalance)} MC`);
        console.log(`  钱包JBC余额: ${ethers.formatEther(jbcBalance)} JBC`);
        console.log(`  门票金额: ${ethers.formatEther(userTicket.amount)} MC`);
        console.log(`  历史质押总额: ${ethers.formatEther(totalStaked)} MC`);
        console.log(`  活跃质押数量: ${activeStakeCount}`);
        console.log(`  已领取质押收益: ${ethers.formatEther(totalPaid)} MC`);
        console.log(`  总收益 (userInfo): ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`  收益上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        console.log(`  剩余可用额度: ${ethers.formatEther(userInfo.currentCap - userInfo.totalRevenue)} MC`);
        console.log(`  直推数量: ${directReferrals.length}`);
        console.log(`  团队人数: ${userInfo.teamCount.toString()}`);
        console.log("=".repeat(70));
        console.log("✅ 查询完成");

    } catch (error) {
        console.error("❌ 查询失败:", error.message);
        if (error.data) {
            console.error("错误数据:", error.data);
        }
        console.error(error.stack);
    }
}

// 从命令行参数获取地址
const userAddress = process.argv[2] || "0x0F1868dA5C4Fe2Bf3a5fa56fFf51304aE3624d24";

// 执行查询
getUserFullData(userAddress).catch(console.error);

