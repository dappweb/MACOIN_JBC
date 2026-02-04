const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getLevelByTeamCount(uint256 teamCount) view returns (uint256 level, uint256 percent)",
    "function levelConfigs(uint256) view returns (uint256 minDirects, uint256 level, uint256 percent)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
    "event DifferentialRewardCalculated(address indexed user, uint256 totalAmount, uint256 mcPart, uint256 jbcValuePart, uint256 jbcPrice, uint256 jbcAmount)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

const USER_ADDRESS = "0x16534F0Dae6602c8E20d25000F9691C9b7A68462";

// 等级配置（从合约获取或使用默认值）
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

async function analyzeUserDifferentialRewardIssue() {
    console.log("🔍 分析用户极差奖励问题\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${USER_ADDRESS}`);
    console.log("=".repeat(80) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    try {
        // 1. 获取用户基本信息
        console.log("📋 获取用户基本信息...");
        let userInfo;
        try {
            userInfo = await newProtocol.userInfo(USER_ADDRESS);
        } catch (error) {
            userInfo = await oldProtocol.userInfo(USER_ADDRESS);
        }
        
        const teamCount = Number(userInfo.teamCount);
        const userLevel = getLevel(teamCount);
        
        console.log(`  推荐人: ${userInfo.referrer}`);
        console.log(`  活跃直推数: ${userInfo.activeDirects.toString()}`);
        console.log(`  团队人数: ${teamCount}`);
        console.log(`  用户等级: V${userLevel.level} (${userLevel.percent}%)`);
        console.log(`  是否活跃: ${userInfo.isActive}`);
        console.log("");

        // 2. 获取推荐链（向上查找）
        console.log("🔗 构建推荐链...");
        const referralChain = [];
        let current = USER_ADDRESS.toLowerCase();
        const visited = new Set();
        
        while (current && !visited.has(current) && referralChain.length < 20) {
            visited.add(current);
            let currentInfo;
            try {
                currentInfo = await newProtocol.userInfo(current);
            } catch (e) {
                try {
                    currentInfo = await oldProtocol.userInfo(current);
                } catch (e2) {
                    break;
                }
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
            
            if (currentInfo.referrer === ethers.ZeroAddress) {
                break;
            }
            current = currentInfo.referrer.toLowerCase();
        }
        
        console.log(`  推荐链长度: ${referralChain.length}`);
        referralChain.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.address.substring(0, 10)}... - V${user.level} (${user.percent}%) - 团队: ${user.teamCount} - ${user.isActive ? '活跃' : '非活跃'}`);
        });
        console.log("");

        // 3. 获取极差奖励事件
        console.log("💰 获取极差奖励事件...");
        const fromBlock = 0;
        const currentBlock = await provider.getBlockNumber();
        
        const diffRewardEvents = await newProtocol.queryFilter(
            newProtocol.filters.DifferentialRewardDistributed(USER_ADDRESS),
            fromBlock,
            currentBlock
        );
        
        const diffCalcEvents = await newProtocol.queryFilter(
            newProtocol.filters.DifferentialRewardCalculated(USER_ADDRESS),
            fromBlock,
            currentBlock
        );
        
        console.log(`  极差奖励发放事件: ${diffRewardEvents.length}`);
        console.log(`  极差奖励计算事件: ${diffCalcEvents.length}`);
        console.log("");

        // 4. 分析每个极差奖励事件
        for (let i = 0; i < diffRewardEvents.length; i++) {
            const rewardEvent = diffRewardEvents[i];
            const calcEvent = diffCalcEvents[i];
            
            console.log(`\n📊 分析极差奖励记录 ${i + 1}:`);
            console.log("-".repeat(80));
            
            const block = await provider.getBlock(rewardEvent.blockNumber);
            const blockTime = new Date(Number(block.timestamp) * 1000);
            
            console.log(`  区块: ${rewardEvent.blockNumber}`);
            console.log(`  时间: ${blockTime.toLocaleString('zh-CN')}`);
            console.log(`  交易哈希: ${rewardEvent.transactionHash}`);
            
            const totalAmount = calcEvent.args.totalAmount || 0n;
            const mcAmount = rewardEvent.args.mcAmount || 0n;
            const jbcAmount = rewardEvent.args.jbcAmount || 0n;
            
            console.log(`  总奖励金额: ${ethers.formatEther(totalAmount)} MC`);
            console.log(`  实际发放MC: ${ethers.formatEther(mcAmount)} MC`);
            console.log(`  实际发放JBC: ${ethers.formatEther(jbcAmount)} JBC`);
            console.log("");

            // 5. 查找触发该奖励的质押事件（在奖励事件之前的质押）
            console.log("  🔍 查找触发该奖励的质押事件...");
            const stakeEvents = await newProtocol.queryFilter(
                newProtocol.filters.LiquidityStaked(),
                Math.max(0, rewardEvent.blockNumber - 100),
                rewardEvent.blockNumber
            );
            
            console.log(`    在区块 ${rewardEvent.blockNumber - 100} - ${rewardEvent.blockNumber} 之间找到 ${stakeEvents.length} 个质押事件`);
            
            // 查找该用户的下级质押
            const referrerMap = new Map();
            const allBoundEvents = await newProtocol.queryFilter(
                newProtocol.filters.BoundReferrer(),
                0,
                rewardEvent.blockNumber
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
            console.log(`    该用户的团队成员数: ${teamMembers.length}`);
            
            // 查找团队成员在奖励事件前的质押
            const relevantStakes = [];
            for (const stakeEvent of stakeEvents) {
                const staker = stakeEvent.args.user.toLowerCase();
                if (teamMembers.includes(staker) || staker === USER_ADDRESS.toLowerCase()) {
                    const stakeAmount = stakeEvent.args.amount || 0n;
                    const stakeBlock = await provider.getBlock(stakeEvent.blockNumber);
                    relevantStakes.push({
                        user: staker,
                        amount: stakeAmount,
                        blockNumber: stakeEvent.blockNumber,
                        timestamp: Number(stakeBlock.timestamp) * 1000,
                        stakeId: stakeEvent.args.stakeId?.toString() || "N/A"
                    });
                }
            }
            
            if (relevantStakes.length > 0) {
                console.log(`    找到 ${relevantStakes.length} 个相关质押:`);
                relevantStakes.forEach((stake, idx) => {
                    console.log(`      ${idx + 1}. ${stake.user.substring(0, 10)}... - ${ethers.formatEther(stake.amount)} MC - 区块 ${stake.blockNumber}`);
                });
            } else {
                console.log("    ⚠️ 未找到相关质押事件");
            }
            
            // 6. 分析极差奖励计算是否正确
            console.log("\n  🧮 分析极差奖励计算:");
            
            // 获取奖励事件时用户的团队人数和等级
            let userInfoAtBlock;
            try {
                // 尝试在历史区块查询（如果支持）
                const blockTag = { blockTag: rewardEvent.blockNumber };
                userInfoAtBlock = await newProtocol.userInfo(USER_ADDRESS, blockTag);
            } catch (e) {
                // 如果不支持历史查询，使用当前值
                userInfoAtBlock = userInfo;
                console.log("    ⚠️ 无法查询历史状态，使用当前状态");
            }
            
            const teamCountAtBlock = Number(userInfoAtBlock.teamCount);
            const levelAtBlock = getLevel(teamCountAtBlock);
            
            console.log(`    奖励时团队人数: ${teamCountAtBlock}`);
            console.log(`    奖励时用户等级: V${levelAtBlock.level} (${levelAtBlock.percent}%)`);
            
            // 计算应该获得的极差奖励
            // 需要知道触发质押的金额和推荐链上的级差
            if (relevantStakes.length > 0) {
                console.log("\n    计算应该获得的极差奖励:");
                
                // 假设每个质押都会触发极差奖励计算
                for (const stake of relevantStakes) {
                    const stakeAmount = Number(ethers.formatEther(stake.amount));
                    
                    // 查找推荐链上该用户应该获得的级差
                    // 这需要知道推荐链上每个用户的等级和级差
                    console.log(`      质押金额: ${stakeAmount} MC`);
                    console.log(`      质押用户: ${stake.user}`);
                    
                    // 这里需要更详细的分析，暂时输出基本信息
                }
            }
        }

        // 7. 总结
        console.log("\n" + "=".repeat(80));
        console.log("📊 问题分析总结");
        console.log("=".repeat(80));
        console.log(`用户地址: ${USER_ADDRESS}`);
        console.log(`当前团队人数: ${teamCount}`);
        console.log(`当前用户等级: V${userLevel.level} (${userLevel.percent}%)`);
        console.log(`极差奖励发放次数: ${diffRewardEvents.length}`);
        console.log("\n请检查以下可能的问题:");
        console.log("1. 极差奖励金额是否正确（基于质押金额和级差比例）");
        console.log("2. 奖励时的用户等级是否正确");
        console.log("3. 推荐链上的级差计算是否正确");
        console.log("4. 是否有重复发放或遗漏发放");
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 分析失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

analyzeUserDifferentialRewardIssue().catch(console.error);
