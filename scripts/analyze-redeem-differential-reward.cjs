const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getLevelByTeamCount(uint256 teamCount) view returns (uint256 level, uint256 percent)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
    "event Redeemed(address indexed user, uint256 principal, uint256 fee)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

const USER_ADDRESS = "0x16534F0Dae6602c8E20d25000F9691C9b7A68462";
const REWARD_BLOCKS = [2513571, 2513845];

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

async function analyzeRedeemDifferentialReward() {
    console.log("🔍 分析赎回触发的极差奖励\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${USER_ADDRESS}`);
    console.log("=".repeat(80) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    try {
        // 1. 获取用户团队信息
        const userInfo = await protocol.userInfo(USER_ADDRESS);
        const teamCount = Number(userInfo.teamCount);
        const userLevel = getLevel(teamCount);
        
        console.log(`用户等级: V${userLevel.level} (${userLevel.percent}%)`);
        console.log(`团队人数: ${teamCount}\n`);

        // 2. 构建推荐关系图
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
        
        // 获取该用户的所有下级
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
        console.log(`团队成员数: ${teamMembers.length}\n`);

        // 3. 分析每个奖励事件
        for (let i = 0; i < REWARD_BLOCKS.length; i++) {
            const rewardBlock = REWARD_BLOCKS[i];
            const expectedReward = i === 0 ? 22.5 : 45.0; // MC
            
            console.log(`\n${"=".repeat(80)}`);
            console.log(`📊 分析奖励事件 ${i + 1} (区块 ${rewardBlock}, 奖励 ${expectedReward} MC)`);
            console.log("=".repeat(80));
            
            // 4. 查找该区块的赎回事件
            console.log(`\n🔍 查找赎回事件 (区块 ${rewardBlock - 50} - ${rewardBlock + 10})...`);
            const redeemEvents = await protocol.queryFilter(
                protocol.filters.Redeemed(),
                rewardBlock - 50,
                rewardBlock + 10
            );
            
            console.log(`  找到 ${redeemEvents.length} 个赎回事件`);
            
            // 查找团队成员的赎回
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
                    console.log(`\n    📦 赎回详情:`);
                    console.log(`      赎回用户: ${redeem.user}`);
                    console.log(`      本金: ${ethers.formatEther(redeem.principal)} MC`);
                    console.log(`      手续费: ${ethers.formatEther(redeem.fee)} MC`);
                    console.log(`      区块: ${redeem.blockNumber}`);
                    console.log(`      时间: ${new Date(redeem.timestamp).toLocaleString('zh-CN')}`);
                    console.log(`      交易: ${redeem.transactionHash}`);
                    
                    // 5. 查找对应的原始质押（7天前，假设是7天质押）
                    const SECONDS_PER_BLOCK = 15; // 假设15秒一个区块
                    const DAYS_IN_SECONDS = 7 * 24 * 60 * 60;
                    const BLOCKS_PER_7_DAYS = Math.floor(DAYS_IN_SECONDS / SECONDS_PER_BLOCK);
                    const estimatedStakeBlock = redeem.blockNumber - BLOCKS_PER_7_DAYS;
                    
                    console.log(`\n    🔍 查找原始质押 (大约区块 ${estimatedStakeBlock}, 7天前)...`);
                    
                    const stakeEvents = await protocol.queryFilter(
                        protocol.filters.LiquidityStaked(redeem.user),
                        estimatedStakeBlock - 2000,
                        estimatedStakeBlock + 500
                    );
                    
                    console.log(`      找到 ${stakeEvents.length} 个可能的质押事件`);
                    
                    for (const stake of stakeEvents) {
                        const stakeAmount = stake.args.amount || 0n;
                        const cycleDays = Number(stake.args.cycleDays || 0n);
                        const stakeId = stake.args.stakeId?.toString() || "N/A";
                        const block = await provider.getBlock(stake.blockNumber);
                        
                        console.log(`\n      📌 质押详情:`);
                        console.log(`        质押金额: ${ethers.formatEther(stakeAmount)} MC`);
                        console.log(`        质押周期: ${cycleDays} 天`);
                        console.log(`        质押ID: ${stakeId}`);
                        console.log(`        区块: ${stake.blockNumber}`);
                        console.log(`        时间: ${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}`);
                        console.log(`        交易: ${stake.transactionHash}`);
                        
                        // 6. 计算应该获得的极差奖励
                        if (cycleDays === 7) {
                            console.log(`\n      🧮 计算极差奖励:`);
                            
                            const stakeAmountMC = Number(ethers.formatEther(stakeAmount));
                            
                            // 获取推荐链上该用户的级差
                            let current = USER_ADDRESS.toLowerCase();
                            let previousPercent = 0;
                            let totalDifferentialReward = 0;
                            const referralChain = [];
                            
                            // 向上查找推荐链（在质押时的状态）
                            while (current && referralChain.length < 20) {
                                let currentInfo;
                                try {
                                    // 尝试在质押区块查询历史状态
                                    const blockTag = { blockTag: stake.blockNumber };
                                    currentInfo = await protocol.userInfo(current, blockTag);
                                } catch (e) {
                                    // 如果不支持历史查询，使用当前状态
                                    currentInfo = await protocol.userInfo(current);
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
                                    
                                    console.log(`\n        推荐链级差:`);
                                    console.log(`          用户: ${current.substring(0, 10)}...`);
                                    console.log(`          等级: V${currentLevel.level} (${currentLevel.percent}%)`);
                                    console.log(`          级差: ${diffPercent}%`);
                                    console.log(`          级差奖励: ${diffReward.toFixed(4)} MC`);
                                    
                                    previousPercent = currentLevel.percent;
                                }
                                
                                if (currentInfo.referrer === ethers.ZeroAddress) break;
                                current = currentInfo.referrer.toLowerCase();
                            }
                            
                            console.log(`\n      📊 计算结果:`);
                            console.log(`        质押金额: ${stakeAmountMC} MC`);
                            console.log(`        应该获得的极差奖励: ${totalDifferentialReward.toFixed(4)} MC`);
                            console.log(`        实际获得的极差奖励: ${expectedReward} MC`);
                            console.log(`        差异: ${(expectedReward - totalDifferentialReward).toFixed(4)} MC`);
                            
                            if (Math.abs(expectedReward - totalDifferentialReward) > 0.01) {
                                console.log(`\n      ⚠️ 奖励金额不匹配！`);
                                if (expectedReward > totalDifferentialReward) {
                                    console.log(`        多发放了: ${(expectedReward - totalDifferentialReward).toFixed(4)} MC`);
                                } else {
                                    console.log(`        少发放了: ${(totalDifferentialReward - expectedReward).toFixed(4)} MC`);
                                }
                            } else {
                                console.log(`\n      ✅ 奖励金额匹配`);
                            }
                        }
                    }
                }
            } else {
                console.log(`\n  ⚠️ 未找到相关赎回事件`);
            }
        }

        console.log("\n" + "=".repeat(80));
        console.log("📊 分析完成");
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 分析失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

analyzeRedeemDifferentialReward().catch(console.error);
