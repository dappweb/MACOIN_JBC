const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getLevelByTeamCount(uint256 teamCount) view returns (uint256 level, uint256 percent)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
    "event DifferentialRewardCalculated(address indexed user, uint256 totalAmount, uint256 mcPart, uint256 jbcValuePart, uint256 jbcPrice, uint256 jbcAmount)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event Redeemed(address indexed user, uint256 principal, uint256 fee)",
];

const USER_ADDRESS = "0x16534F0Dae6602c8E20d25000F9691C9b7A68462";
const REWARD_BLOCKS = [2513571, 2513845]; // 两笔奖励的区块号

// 等级配置
const DEFAULT_LEVELS = [
    { minTeam: 0, level: 0, percent: 0 },
    { minTeam: 10, level: 1, percent: 5 },
    { minTeam: 30, level: 2, percent: 10 },
    { minTeam: 100, level: 3, percent: 15 },
    { minTeam: 300, level: 4, percent: 20 },
    { minTeam: 1000, level: 5, percent: 25 },
    { minTeam: 3000, level: 6, percent: 30 },
    { minTeam: 10000, level: 7, percent: 35 },
    { minTeam: 30000, level: 8, percent: 40 },
    { minTeam: 100000, level: 9, percent: 45 }
];

function getLevel(teamCount) {
    for (let i = DEFAULT_LEVELS.length - 1; i >= 0; i--) {
        if (teamCount >= DEFAULT_LEVELS[i].minTeam) {
            return DEFAULT_LEVELS[i];
        }
    }
    return DEFAULT_LEVELS[0];
}

async function findDifferentialRewardSource() {
    console.log("🔍 查找极差奖励的触发源\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${USER_ADDRESS}`);
    console.log(`奖励区块: ${REWARD_BLOCKS.join(", ")}`);
    console.log("=".repeat(80) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    try {
        // 1. 获取奖励事件详情
        console.log("📋 获取奖励事件详情...");
        const rewardEvents = [];
        for (const blockNum of REWARD_BLOCKS) {
            const events = await protocol.queryFilter(
                protocol.filters.DifferentialRewardDistributed(USER_ADDRESS),
                blockNum - 10,
                blockNum + 10
            );
            rewardEvents.push(...events.filter(e => e.blockNumber === blockNum));
        }
        
        console.log(`  找到 ${rewardEvents.length} 个奖励事件\n`);

        // 2. 获取用户团队信息
        console.log("👥 获取用户团队信息...");
        const userInfo = await protocol.userInfo(USER_ADDRESS);
        const teamCount = Number(userInfo.teamCount);
        const userLevel = getLevel(teamCount);
        
        console.log(`  团队人数: ${teamCount}`);
        console.log(`  用户等级: V${userLevel.level} (${userLevel.percent}%)\n`);

        // 3. 构建推荐关系图
        console.log("🔗 构建推荐关系图...");
        const referrerMap = new Map();
        const allBoundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(),
            0,
            Math.max(...REWARD_BLOCKS) + 100
        );
        
        allBoundEvents.forEach(event => {
            if (event.args && event.args.referrer && event.args.user) {
                referrerMap.set(event.args.user.toLowerCase(), event.args.referrer.toLowerCase());
            }
        });
        
        // 获取该用户的所有下级（递归）
        function getAllTeamMembers(user, visited = new Set()) {
            if (visited.has(user)) return [];
            visited.add(user);
            
            const members = [];
            referrerMap.forEach((referrer, member) => {
                if (referrer === user) {
                    members.push(member);
                    members.push(...getAllTeamMembers(member, visited));
                }
            });
            return members;
        }
        
        const teamMembers = getAllTeamMembers(USER_ADDRESS.toLowerCase());
        console.log(`  团队成员数: ${teamMembers.length}\n`);

        // 4. 分析每个奖励事件
        for (let i = 0; i < rewardEvents.length; i++) {
            const rewardEvent = rewardEvents[i];
            const blockNum = rewardEvent.blockNumber;
            
            console.log(`\n${"=".repeat(80)}`);
            console.log(`📊 分析奖励事件 ${i + 1} (区块 ${blockNum})`);
            console.log("=".repeat(80));
            
            const totalAmount = rewardEvent.args.totalAmount || 
                (rewardEvent.args.mcAmount + (rewardEvent.args.jbcAmount * rewardEvent.args.jbcPrice / ethers.parseEther("1")));
            const mcAmount = rewardEvent.args.mcAmount || 0n;
            const jbcAmount = rewardEvent.args.jbcAmount || 0n;
            
            console.log(`  总奖励金额: ${ethers.formatEther(mcAmount * 2n)} MC (MC: ${ethers.formatEther(mcAmount)}, JBC等值: ${ethers.formatEther(mcAmount)})`);
            console.log(`  交易哈希: ${rewardEvent.transactionHash}`);
            
            // 5. 查找触发该奖励的质押事件（在奖励之前）
            console.log(`\n  🔍 查找触发质押事件 (区块 ${blockNum - 200} - ${blockNum})...`);
            const stakeEvents = await protocol.queryFilter(
                protocol.filters.LiquidityStaked(),
                blockNum - 200,
                blockNum
            );
            
            console.log(`    找到 ${stakeEvents.length} 个质押事件`);
            
            // 查找团队成员或推荐链上的质押
            const relevantStakes = [];
            for (const stakeEvent of stakeEvents) {
                const staker = stakeEvent.args.user.toLowerCase();
                const stakeAmount = stakeEvent.args.amount || 0n;
                const cycleDays = Number(stakeEvent.args.cycleDays || 0n);
                const stakeId = stakeEvent.args.stakeId?.toString() || "N/A";
                
                // 检查是否是团队成员
                if (teamMembers.includes(staker)) {
                    const block = await provider.getBlock(stakeEvent.blockNumber);
                    relevantStakes.push({
                        user: staker,
                        amount: stakeAmount,
                        cycleDays,
                        stakeId,
                        blockNumber: stakeEvent.blockNumber,
                        timestamp: Number(block.timestamp) * 1000,
                        transactionHash: stakeEvent.transactionHash
                    });
                }
            }
            
            if (relevantStakes.length > 0) {
                console.log(`\n  ✅ 找到 ${relevantStakes.length} 个相关质押:`);
                for (const stake of relevantStakes) {
                    console.log(`\n    质押用户: ${stake.user}`);
                    console.log(`    质押金额: ${ethers.formatEther(stake.amount)} MC`);
                    console.log(`    质押周期: ${stake.cycleDays} 天`);
                    console.log(`    质押ID: ${stake.stakeId}`);
                    console.log(`    区块: ${stake.blockNumber}`);
                    console.log(`    时间: ${new Date(stake.timestamp).toLocaleString('zh-CN')}`);
                    console.log(`    交易: ${stake.transactionHash}`);
                    
                    // 计算应该获得的极差奖励
                    const stakeAmountMC = Number(ethers.formatEther(stake.amount));
                    
                    // 获取推荐链上该用户的级差
                    let current = USER_ADDRESS.toLowerCase();
                    let previousPercent = 0;
                    let totalDifferentialReward = 0;
                    const referralChain = [];
                    
                    // 向上查找推荐链
                    while (current && referralChain.length < 20) {
                        let currentInfo;
                        try {
                            currentInfo = await protocol.userInfo(current);
                        } catch (e) {
                            break;
                        }
                        
                        const currentTeamCount = Number(currentInfo.teamCount);
                        const currentLevel = getLevel(currentTeamCount);
                        
                        referralChain.push({
                            address: current,
                            teamCount: currentTeamCount,
                            level: currentLevel.level,
                            percent: currentLevel.percent,
                            isActive: currentInfo.isActive
                        });
                        
                        // 计算级差
                        if (currentLevel.percent > previousPercent && currentInfo.isActive) {
                            const diffPercent = currentLevel.percent - previousPercent;
                            // 级差奖励 = 质押金额 * 级差比例
                            const diffReward = stakeAmountMC * (diffPercent / 100);
                            totalDifferentialReward += diffReward;
                            
                            console.log(`\n      推荐链分析:`);
                            console.log(`        用户: ${current.substring(0, 10)}...`);
                            console.log(`        等级: V${currentLevel.level} (${currentLevel.percent}%)`);
                            console.log(`        级差: ${diffPercent}%`);
                            console.log(`        级差奖励: ${diffReward.toFixed(4)} MC`);
                            
                            previousPercent = currentLevel.percent;
                        }
                        
                        if (currentInfo.referrer === ethers.ZeroAddress) break;
                        current = currentInfo.referrer.toLowerCase();
                    }
                    
                    console.log(`\n      该质押应该产生的总极差奖励: ${totalDifferentialReward.toFixed(4)} MC`);
                }
            } else {
                console.log(`\n  ⚠️ 未找到相关质押事件`);
                
                // 检查是否有赎回事件（用户提到"7天到期赎回"）
                console.log(`\n  🔍 检查赎回事件...`);
                const redeemEvents = await protocol.queryFilter(
                    protocol.filters.Redeemed(),
                    blockNum - 200,
                    blockNum
                );
                
                console.log(`    找到 ${redeemEvents.length} 个赎回事件`);
                
                // 查找7天质押的赎回
                const relevantRedeems = [];
                for (const redeemEvent of redeemEvents) {
                    const redeemer = redeemEvent.args.user.toLowerCase();
                    const principal = redeemEvent.args.principal || 0n;
                    const fee = redeemEvent.args.fee || 0n;
                    
                    if (teamMembers.includes(redeemer)) {
                        const block = await provider.getBlock(redeemEvent.blockNumber);
                        relevantRedeems.push({
                            user: redeemer,
                            principal,
                            fee,
                            blockNumber: redeemEvent.blockNumber,
                            timestamp: Number(block.timestamp) * 1000,
                            transactionHash: redeemEvent.transactionHash
                        });
                    }
                }
                
                if (relevantRedeems.length > 0) {
                    console.log(`\n  ✅ 找到 ${relevantRedeems.length} 个相关赎回:`);
                    for (const redeem of relevantRedeems) {
                        console.log(`\n    赎回用户: ${redeem.user}`);
                        console.log(`    本金: ${ethers.formatEther(redeem.principal)} MC`);
                        console.log(`    手续费: ${ethers.formatEther(redeem.fee)} MC`);
                        console.log(`    区块: ${redeem.blockNumber}`);
                        console.log(`    时间: ${new Date(redeem.timestamp).toLocaleString('zh-CN')}`);
                        console.log(`    交易: ${redeem.transactionHash}`);
                        
                        // 查找对应的原始质押（可能在7天前）
                        const originalStakeBlock = redeem.blockNumber - Math.floor(7 * 24 * 60 * 60 / 15); // 假设15秒一个区块
                        console.log(`\n    查找原始质押 (大约区块 ${originalStakeBlock})...`);
                        
                        const originalStakes = await protocol.queryFilter(
                            protocol.filters.LiquidityStaked(redeem.user),
                            originalStakeBlock - 1000,
                            originalStakeBlock + 100
                        );
                        
                        if (originalStakes.length > 0) {
                            console.log(`      找到 ${originalStakes.length} 个可能的原始质押`);
                            for (const stake of originalStakes) {
                                const stakeAmount = stake.args.amount || 0n;
                                const cycleDays = Number(stake.args.cycleDays || 0n);
                                if (cycleDays === 7) {
                                    console.log(`\n      可能的原始质押:`);
                                    console.log(`        质押金额: ${ethers.formatEther(stakeAmount)} MC`);
                                    console.log(`        质押周期: ${cycleDays} 天`);
                                    console.log(`        区块: ${stake.blockNumber}`);
                                    console.log(`        交易: ${stake.transactionHash}`);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 6. 总结
        console.log("\n" + "=".repeat(80));
        console.log("📊 问题分析总结");
        console.log("=".repeat(80));
        console.log("请检查:");
        console.log("1. 极差奖励是否基于正确的质押金额计算");
        console.log("2. 级差比例是否正确（推荐链上的等级差异）");
        console.log("3. 是否有重复发放或计算错误");
        console.log("4. 7天质押赎回时是否触发了错误的奖励计算");
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 分析失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

findDifferentialRewardSource().catch(console.error);
