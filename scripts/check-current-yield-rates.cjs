const { ethers } = require("ethers");
require('dotenv').config();

// MC链配置
const MC_CHAIN_RPC = "https://chain.mcerscan.com/";
const CURRENT_CONTRACT = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5"; // P-prod环境当前合约

// 合约ABI - 包含收益率相关函数
const PROTOCOL_ABI = [
    "function getVersionV4() view returns (string)",
    "function timeUnitFixed() view returns (bool)",
    "function getEffectiveSecondsInUnit() view returns (uint256)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "function _getDailyYield(uint256 cycleDays) view returns (uint256)",
    "function ticketLevels(uint256) view returns (uint256 price, uint256 minLiquidity, bool active)",
    "function getSystemStats() view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
    "function owner() view returns (address)",
    "function paused() view returns (bool)"
];

// 简化ABI用于检查基础函数
const BASIC_ABI = [
    "function owner() view returns (address)",
    "function paused() view returns (bool)"
];

async function checkCurrentYieldRates() {
    console.log("🔍 检查MC链上当前合约的收益率设置");
    console.log("=" .repeat(60));
    
    const provider = new ethers.JsonRpcProvider(MC_CHAIN_RPC);
    
    try {
        // 首先用基础ABI检查合约是否可访问
        console.log(`📍 合约地址: ${CURRENT_CONTRACT}`);
        const basicContract = new ethers.Contract(CURRENT_CONTRACT, BASIC_ABI, provider);
        
        const owner = await basicContract.owner();
        console.log(`👤 合约所有者: ${owner}`);
        
        const paused = await basicContract.paused();
        console.log(`⏸️  合约暂停状态: ${paused}`);
        
        // 尝试使用完整ABI检查V4功能
        const contract = new ethers.Contract(CURRENT_CONTRACT, PROTOCOL_ABI, provider);
        
        console.log("\n📊 时间单位检查:");
        try {
            const timeUnitFixed = await contract.timeUnitFixed();
            console.log(`✅ 时间单位已修复: ${timeUnitFixed}`);
            
            const secondsInUnit = await contract.getEffectiveSecondsInUnit();
            console.log(`⏰ 有效时间单位: ${secondsInUnit} 秒`);
            
            if (secondsInUnit == 86400) {
                console.log(`✅ 时间单位正确: 1天 = 86400秒`);
            } else if (secondsInUnit == 60) {
                console.log(`❌ 时间单位错误: 仍为60秒 (1分钟)`);
            } else {
                console.log(`⚠️  时间单位异常: ${secondsInUnit}秒`);
            }
        } catch (error) {
            console.log(`❌ 无法检查时间单位: ${error.message}`);
        }
        
        console.log("\n💰 收益率检查:");
        try {
            // 检查门票等级配置
            for (let level = 1; level <= 4; level++) {
                try {
                    const ticketInfo = await contract.ticketLevels(level);
                    console.log(`🎫 门票等级${level}: ${ethers.formatEther(ticketInfo.price)} MC`);
                } catch (error) {
                    console.log(`❌ 无法获取门票等级${level}信息`);
                }
            }
        } catch (error) {
            console.log(`❌ 无法检查门票配置: ${error.message}`);
        }
        
        console.log("\n📈 系统统计:");
        try {
            const stats = await contract.getSystemStats();
            console.log(`👥 总用户数: ${stats[0]}`);
            console.log(`🎫 总门票销售: ${ethers.formatEther(stats[1])} MC`);
            console.log(`💎 总质押金额: ${ethers.formatEther(stats[2])} MC`);
            console.log(`🔥 总燃烧JBC: ${ethers.formatEther(stats[3])} JBC`);
            console.log(`🔄 当前燃烧轮次: ${stats[4]}`);
            console.log(`⏰ 下次燃烧时间: ${new Date(Number(stats[5]) * 1000).toLocaleString()}`);
        } catch (error) {
            console.log(`❌ 无法获取系统统计: ${error.message}`);
        }
        
        console.log("\n🔍 版本信息:");
        try {
            const version = await contract.getVersionV4();
            console.log(`📦 合约版本: ${version}`);
        } catch (error) {
            console.log(`❌ 无法获取版本信息: ${error.message}`);
        }
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
    }
}

// 检查收益率计算逻辑
async function analyzeYieldLogic() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 收益率逻辑分析");
    console.log("=".repeat(60));
    
    // 当前V4合约中的收益率设置
    console.log("🔧 当前V4合约收益率设置:");
    console.log("├── 7天周期: 2.0% 日收益");
    console.log("├── 15天周期: 2.5% 日收益");
    console.log("└── 30天周期: 3.0% 日收益");
    
    console.log("\n📈 用户提到的线上收益率:");
    console.log("├── 实际收益率: 1.33% 日收益");
    console.log("└── 需要调整: 从2.0%-3.0%改为1.33%");
    
    console.log("\n🎯 收益率对比分析:");
    
    // 计算不同收益率的实际收益
    const stakeAmount = 1000; // 1000 MC质押
    
    console.log(`\n💰 质押${stakeAmount} MC的收益对比:`);
    
    // 当前V4设置
    console.log("\n📊 当前V4合约设置:");
    const v4Yields = [
        { cycle: 7, rate: 2.0 },
        { cycle: 15, rate: 2.5 },
        { cycle: 30, rate: 3.0 }
    ];
    
    v4Yields.forEach(({ cycle, rate }) => {
        const totalReward = stakeAmount * (rate / 100) * cycle;
        console.log(`├── ${cycle}天周期 (${rate}%日收益): 总收益 ${totalReward.toFixed(2)} MC`);
    });
    
    // 线上实际收益率
    console.log("\n📊 线上实际收益率 (1.33%):");
    v4Yields.forEach(({ cycle }) => {
        const totalReward = stakeAmount * (1.33 / 100) * cycle;
        console.log(`├── ${cycle}天周期 (1.33%日收益): 总收益 ${totalReward.toFixed(2)} MC`);
    });
    
    // 收益差异分析
    console.log("\n📈 收益差异分析:");
    v4Yields.forEach(({ cycle, rate }) => {
        const v4Reward = stakeAmount * (rate / 100) * cycle;
        const actualReward = stakeAmount * (1.33 / 100) * cycle;
        const difference = v4Reward - actualReward;
        const percentDiff = ((difference / actualReward) * 100).toFixed(1);
        console.log(`├── ${cycle}天周期: V4高出 ${difference.toFixed(2)} MC (${percentDiff}%)`);
    });
}

async function main() {
    await checkCurrentYieldRates();
    await analyzeYieldLogic();
    
    console.log("\n" + "=".repeat(60));
    console.log("📋 总结和建议");
    console.log("=".repeat(60));
    console.log("🎯 需要调整的内容:");
    console.log("├── 1. 将V4合约中的收益率从2.0%-3.0%调整为1.33%");
    console.log("├── 2. 确保时间单位为86400秒 (1天)");
    console.log("├── 3. 保持四种奖励机制不变");
    console.log("└── 4. 更新前端显示以反映正确的收益率");
}

main().catch(console.error);