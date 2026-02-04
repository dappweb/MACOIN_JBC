const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function getLevelByTeamCount(uint256 teamCount) view returns (uint256 level, uint256 percent)",
    "function levelConfigs(uint256) view returns (uint256 minDirects, uint256 level, uint256 percent)",
    "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
    "event DifferentialRewardCalculated(address indexed user, uint256 totalAmount, uint256 mcPart, uint256 jbcValuePart, uint256 jbcPrice, uint256 jbcAmount)",
    "event DifferentialRewardFailed(address indexed user, uint256 totalAmount, uint256 mcPart, uint256 jbcAmount, string reason)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

const USER_ADDRESS = "0x16534F0Dae6602c8E20d25000F9691C9b7A68462";

async function checkUserDifferentialRewards() {
    console.log("🔍 检查用户极差奖励记录\n");
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
        let isFromOldContract = false;
        
        try {
            userInfo = await newProtocol.userInfo(USER_ADDRESS);
        } catch (error) {
            userInfo = await oldProtocol.userInfo(USER_ADDRESS);
            isFromOldContract = true;
        }
        
        console.log(`  合约: ${isFromOldContract ? '旧合约' : '新合约'}`);
        console.log(`  推荐人: ${userInfo.referrer}`);
        console.log(`  活跃直推数: ${userInfo.activeDirects.toString()}`);
        console.log(`  团队人数: ${userInfo.teamCount.toString()}`);
        console.log(`  是否活跃: ${userInfo.isActive}`);
        console.log(`  累计收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log("");

        // 2. 获取用户等级（优先 getUserLevel，否则 getLevelByTeamCount）
        console.log("📊 获取用户等级...");
        try {
            let levelResult;
            if (typeof newProtocol.getUserLevel === "function") {
                levelResult = await newProtocol.getUserLevel(USER_ADDRESS);
            } else {
                levelResult = await newProtocol.getLevelByTeamCount(userInfo.teamCount);
            }
            console.log(`  等级: V${levelResult.level.toString()}`);
            console.log(`  极差奖励比例: ${levelResult.percent.toString()}%`);
        } catch (error) {
            console.log(`  ⚠️ 无法获取等级信息: ${error.message}`);
        }
        console.log("");

        // 3. 获取所有极差奖励事件
        console.log("📜 获取极差奖励事件...");
        const fromBlock = 0;
        const currentBlock = await provider.getBlockNumber();
        
        // 从新合约获取
        const newDiffRewardEvents = await newProtocol.queryFilter(
            newProtocol.filters.DifferentialRewardDistributed(USER_ADDRESS),
            fromBlock,
            currentBlock
        );
        
        const newDiffCalcEvents = await newProtocol.queryFilter(
            newProtocol.filters.DifferentialRewardCalculated(USER_ADDRESS),
            fromBlock,
            currentBlock
        );
        
        const newDiffFailedEvents = await newProtocol.queryFilter(
            newProtocol.filters.DifferentialRewardFailed(USER_ADDRESS),
            fromBlock,
            currentBlock
        );
        
        // 从旧合约获取
        let oldDiffRewardEvents = [];
        let oldDiffCalcEvents = [];
        let oldDiffFailedEvents = [];
        
        try {
            oldDiffRewardEvents = await oldProtocol.queryFilter(
                oldProtocol.filters.DifferentialRewardDistributed(USER_ADDRESS),
                fromBlock,
                currentBlock
            );
            oldDiffCalcEvents = await oldProtocol.queryFilter(
                oldProtocol.filters.DifferentialRewardCalculated(USER_ADDRESS),
                fromBlock,
                currentBlock
            );
            oldDiffFailedEvents = await oldProtocol.queryFilter(
                oldProtocol.filters.DifferentialRewardFailed(USER_ADDRESS),
                fromBlock,
                currentBlock
            );
        } catch (e) {
            // 旧合约可能没有这些事件
        }
        
        const allDiffRewardEvents = [...newDiffRewardEvents, ...oldDiffRewardEvents];
        const allDiffCalcEvents = [...newDiffCalcEvents, ...oldDiffCalcEvents];
        const allDiffFailedEvents = [...newDiffFailedEvents, ...oldDiffFailedEvents];
        
        console.log(`  极差奖励发放事件: ${allDiffRewardEvents.length}`);
        console.log(`  极差奖励计算事件: ${allDiffCalcEvents.length}`);
        console.log(`  极差奖励失败事件: ${allDiffFailedEvents.length}`);
        console.log("");

        // 4. 分析极差奖励事件
        if (allDiffRewardEvents.length > 0) {
            console.log("💰 极差奖励发放记录:");
            console.log("-".repeat(80));
            
            let totalMC = 0n;
            let totalJBC = 0n;
            
            for (let i = 0; i < allDiffRewardEvents.length; i++) {
                const event = allDiffRewardEvents[i];
                const mcAmount = event.args.mcAmount || 0n;
                const jbcAmount = event.args.jbcAmount || 0n;
                const jbcPrice = event.args.jbcPrice || 0n;
                const timestamp = event.args.timestamp || 0n;
                
                totalMC += mcAmount;
                totalJBC += jbcAmount;
                
                const block = await provider.getBlock(event.blockNumber);
                const date = new Date(Number(timestamp) * 1000);
                
                console.log(`\n  记录 ${i + 1}:`);
                console.log(`    区块: ${event.blockNumber}`);
                console.log(`    时间: ${date.toLocaleString('zh-CN')}`);
                console.log(`    MC金额: ${ethers.formatEther(mcAmount)} MC`);
                console.log(`    JBC金额: ${ethers.formatEther(jbcAmount)} JBC`);
                console.log(`    JBC价格: ${ethers.formatEther(jbcPrice)} MC/JBC`);
                
                if (jbcPrice > 0n) {
                    const jbcValue = (jbcAmount * jbcPrice) / ethers.parseEther("1");
                    const totalValue = mcAmount + jbcValue;
                    const mcRatio = Number(mcAmount) / Number(totalValue);
                    const jbcRatio = Number(jbcValue) / Number(totalValue);
                    console.log(`    JBC等值: ${ethers.formatEther(jbcValue)} MC`);
                    console.log(`    总价值: ${ethers.formatEther(totalValue)} MC`);
                    console.log(`    MC比例: ${(mcRatio * 100).toFixed(2)}%`);
                    console.log(`    JBC比例: ${(jbcRatio * 100).toFixed(2)}%`);
                }
            }
            
            console.log("\n" + "-".repeat(80));
            console.log(`总计:`);
            console.log(`  总MC: ${ethers.formatEther(totalMC)} MC`);
            console.log(`  总JBC: ${ethers.formatEther(totalJBC)} JBC`);
            console.log("-".repeat(80));
        }

        // 5. 分析极差奖励计算事件
        if (allDiffCalcEvents.length > 0) {
            console.log("\n📊 极差奖励计算记录:");
            console.log("-".repeat(80));
            
            for (let i = 0; i < allDiffCalcEvents.length; i++) {
                const event = allDiffCalcEvents[i];
                const totalAmount = event.args.totalAmount || 0n;
                const mcPart = event.args.mcPart || 0n;
                const jbcValuePart = event.args.jbcValuePart || 0n;
                const jbcPrice = event.args.jbcPrice || 0n;
                const jbcAmount = event.args.jbcAmount || 0n;
                
                const block = await provider.getBlock(event.blockNumber);
                
                console.log(`\n  计算记录 ${i + 1}:`);
                console.log(`    区块: ${event.blockNumber}`);
                console.log(`    时间: ${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}`);
                console.log(`    总金额: ${ethers.formatEther(totalAmount)} MC`);
                console.log(`    MC部分: ${ethers.formatEther(mcPart)} MC`);
                console.log(`    JBC价值部分: ${ethers.formatEther(jbcValuePart)} MC`);
                console.log(`    JBC价格: ${ethers.formatEther(jbcPrice)} MC/JBC`);
                console.log(`    JBC数量: ${ethers.formatEther(jbcAmount)} JBC`);
            }
        }

        // 6. 检查失败事件
        if (allDiffFailedEvents.length > 0) {
            console.log("\n⚠️ 极差奖励失败记录:");
            console.log("-".repeat(80));
            
            for (let i = 0; i < allDiffFailedEvents.length; i++) {
                const event = allDiffFailedEvents[i];
                const totalAmount = event.args.totalAmount || 0n;
                const mcPart = event.args.mcPart || 0n;
                const jbcAmount = event.args.jbcAmount || 0n;
                const reason = event.args.reason || "未知原因";
                
                const block = await provider.getBlock(event.blockNumber);
                
                console.log(`\n  失败记录 ${i + 1}:`);
                console.log(`    区块: ${event.blockNumber}`);
                console.log(`    时间: ${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}`);
                console.log(`    总金额: ${ethers.formatEther(totalAmount)} MC`);
                console.log(`    MC部分: ${ethers.formatEther(mcPart)} MC`);
                console.log(`    JBC数量: ${ethers.formatEther(jbcAmount)} JBC`);
                console.log(`    失败原因: ${reason}`);
            }
        }

        // 7. 获取质押事件（极差奖励通常由质押触发）
        console.log("\n📈 获取相关质押事件...");
        const stakeEvents = await newProtocol.queryFilter(
            newProtocol.filters.LiquidityStaked(),
            fromBlock,
            currentBlock
        );
        
        // 查找可能触发该用户极差奖励的质押事件（下级用户的质押）
        console.log(`  总质押事件数: ${stakeEvents.length}`);
        console.log("  查找可能触发该用户极差奖励的质押事件...");
        
        // 获取推荐关系
        const referrerMap = new Map();
        const allBoundEvents = await newProtocol.queryFilter(
            newProtocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        
        allBoundEvents.forEach(event => {
            if (event.args && event.args.referrer && event.args.user) {
                referrerMap.set(event.args.user.toLowerCase(), event.args.referrer.toLowerCase());
            }
        });
        
        // 查找该用户的下级
        const directReferrals = [];
        referrerMap.forEach((referrer, user) => {
            if (referrer === USER_ADDRESS.toLowerCase()) {
                directReferrals.push(user);
            }
        });
        
        console.log(`  该用户的直推数: ${directReferrals.length}`);
        if (directReferrals.length > 0) {
            console.log("  直推用户:");
            directReferrals.forEach((ref, index) => {
                console.log(`    ${index + 1}. ${ref}`);
            });
        }

        // 8. 总结
        console.log("\n" + "=".repeat(80));
        console.log("📊 总结");
        console.log("=".repeat(80));
        console.log(`用户地址: ${USER_ADDRESS}`);
        console.log(`团队人数: ${userInfo.teamCount.toString()}`);
        console.log(`极差奖励发放次数: ${allDiffRewardEvents.length}`);
        console.log(`极差奖励计算次数: ${allDiffCalcEvents.length}`);
        console.log(`极差奖励失败次数: ${allDiffFailedEvents.length}`);
        
        if (allDiffRewardEvents.length === 0 && allDiffCalcEvents.length > 0) {
            console.log("\n⚠️ 发现问题: 有计算记录但没有发放记录，可能奖励发放失败");
        }
        
        if (allDiffFailedEvents.length > 0) {
            console.log("\n⚠️ 发现问题: 存在极差奖励失败记录");
        }
        
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 检查失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

checkUserDifferentialRewards().catch(console.error);
