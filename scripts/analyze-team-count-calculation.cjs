const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
];

/**
 * 分析 teamCount 的计算逻辑
 * 根据合约代码，_updateTeamCount 只是简单地在推荐人链上 +1
 * 所以 teamCount 应该等于：所有直接或间接推荐的用户总数
 */
async function analyzeTeamCountCalculation(protocol, userAddress) {
    console.log(`\n📊 分析用户 ${userAddress} 的 teamCount 计算逻辑\n`);
    
    try {
        const userInfo = await protocol.userInfo(userAddress);
        const currentTeamCount = Number(userInfo.teamCount);
        const activeDirects = Number(userInfo.activeDirects);
        
        console.log(`当前数据:`);
        console.log(`  teamCount: ${currentTeamCount}`);
        console.log(`  activeDirects: ${activeDirects}`);
        
        // 方法1: 递归计算（修复脚本的方法 - 可能是错误的）
        console.log(`\n方法1: 递归累加计算（修复脚本的方法）`);
        const recursiveCount = await calculateRecursive(protocol, userAddress);
        console.log(`  结果: ${recursiveCount}`);
        
        // 方法2: 简单计数（合约的实际逻辑）
        console.log(`\n方法2: 简单计数（合约的实际逻辑）`);
        const simpleCount = await calculateSimple(protocol, userAddress);
        console.log(`  结果: ${simpleCount}`);
        
        // 方法3: 从事件统计
        console.log(`\n方法3: 从 BoundReferrer 事件统计`);
        const eventCount = await countFromEvents(protocol, userAddress);
        console.log(`  结果: ${eventCount}`);
        
        console.log(`\n对比:`);
        console.log(`  合约中的值: ${currentTeamCount}`);
        console.log(`  递归计算: ${recursiveCount} (差异: ${recursiveCount - currentTeamCount})`);
        console.log(`  简单计数: ${simpleCount} (差异: ${simpleCount - currentTeamCount})`);
        console.log(`  事件统计: ${eventCount} (差异: ${eventCount - currentTeamCount})`);
        
        return {
            currentTeamCount,
            activeDirects,
            recursiveCount,
            simpleCount,
            eventCount
        };
    } catch (error) {
        console.error(`❌ 分析失败:`, error.message);
        return null;
    }
}

/**
 * 递归计算（修复脚本的方法）
 * teamCount = activeDirects + Σ(每个直推的 teamCount)
 */
async function calculateRecursive(protocol, userAddress, visited = new Set(), depth = 0) {
    if (visited.has(userAddress.toLowerCase()) || depth > 20) {
        return 0;
    }
    visited.add(userAddress.toLowerCase());
    
    try {
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        if (directReferrals.length === 0) {
            return 0;
        }
        
        let totalTeamCount = directReferrals.length;
        
        for (const referral of directReferrals) {
            try {
                const referralInfo = await protocol.userInfo(referral);
                const referralTeamCount = Number(referralInfo.teamCount || 0);
                
                const referralCalculatedCount = await calculateRecursive(
                    protocol, 
                    referral, 
                    new Set(visited), 
                    depth + 1
                );
                
                const referralActualCount = Math.max(referralTeamCount, referralCalculatedCount);
                totalTeamCount += referralActualCount;
            } catch (e) {
                // 忽略错误
            }
        }
        
        return totalTeamCount;
    } catch (error) {
        return 0;
    }
}

/**
 * 简单计数（合约的实际逻辑）
 * teamCount = 所有直接或间接推荐的用户总数（不包括自己）
 * 这个值应该等于：从所有 BoundReferrer 事件中，referrer = userAddress 的数量
 */
async function calculateSimple(protocol, userAddress) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000000);
        
        // 从 BoundReferrer 事件统计
        const boundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(null, userAddress),
            fromBlock
        );
        
        return boundEvents.length;
    } catch (error) {
        console.error(`  统计失败:`, error.message);
        return 0;
    }
}

/**
 * 从事件统计
 */
async function countFromEvents(protocol, userAddress) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000000);
        
        const boundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(),
            fromBlock
        );
        
        // 统计所有以 userAddress 为推荐人的用户
        let count = 0;
        const visited = new Set();
        
        function countRecursive(referrer) {
            if (visited.has(referrer.toLowerCase())) {
                return;
            }
            visited.add(referrer.toLowerCase());
            
            boundEvents.forEach(event => {
                if (event.args && 
                    event.args.referrer && 
                    event.args.referrer.toLowerCase() === referrer.toLowerCase()) {
                    count++;
                    countRecursive(event.args.user);
                }
            });
        }
        
        countRecursive(userAddress);
        return count;
    } catch (error) {
        console.error(`  统计失败:`, error.message);
        return 0;
    }
}

async function main() {
    console.log("🔍 分析 teamCount 计算逻辑\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // 分析修复过的推荐人
    const referrers = [
        "0x3E436e9ef8A44cb65b00FcEFe4Ac1952384Ed21e", // 修复后: 52113
        "0xC26731f7b6521B9ddF58B2Ef3F70658Dc28A5513", // 修复后: 101708
    ];

    for (const referrer of referrers) {
        await analyzeTeamCountCalculation(protocol, referrer);
        console.log("\n" + "=".repeat(80) + "\n");
    }
}

main().catch(error => {
    console.error("❌ 脚本执行异常:", error);
    process.exit(1);
});
