const { ethers } = require("hardhat");

// V3 vs V4 收益率对比分析脚本
async function compareV3V4Yields() {
    console.log("📊 V3 vs V4 版本收益率模式对比分析");
    console.log("=" .repeat(80));
    
    // 测试参数
    const stakeAmount = 1000; // 1000 MC质押
    const referralAmount = 1000; // 1000 MC门票购买 (用于推荐奖励计算)
    
    console.log(`💰 测试参数:`);
    console.log(`├── 质押金额: ${stakeAmount} MC`);
    console.log(`└── 推荐门票: ${referralAmount} MC`);
    
    // V3版本 (推测的设置)
    const v3Rates = {
        7: { rate: 2.0, timeUnit: 60 }, // 2.0%日收益，但60秒时间单位
        15: { rate: 2.5, timeUnit: 60 }, // 2.5%日收益，但60秒时间单位
        30: { rate: 3.0, timeUnit: 60 }  // 3.0%日收益，但60秒时间单位
    };
    
    // V4版本 (基于流动性计算)
    const v4Rates = {
        7: { rate: 1.33333, timeUnit: 86400 }, // 1.33333%日收益，86400秒时间单位
        15: { rate: 1.666666, timeUnit: 86400 }, // 1.666666%日收益，86400秒时间单位
        30: { rate: 2.0, timeUnit: 86400 }  // 2.0%日收益，86400秒时间单位
    };
    
    console.log("\n" + "=".repeat(80));
    console.log("🔍 1. 静态奖励 (质押挖矿) 对比");
    console.log("=".repeat(80));
    
    console.log("\n📊 V3版本 (当前MC链上，存在问题):");
    console.log("├── 时间单位: 60秒 (1分钟) ❌");
    console.log("├── 用户体验: 设置7天实际7分钟 ❌");
    console.log("├── 收益率: 可能过高 ⚠️");
    console.log("└── 代币模型: 单一MC代币");
    
    Object.entries(v3Rates).forEach(([days, config]) => {
        const totalReward = stakeAmount * (config.rate / 100) * parseInt(days);
        const actualTime = parseInt(days) * (config.timeUnit / 60); // 转换为分钟
        
        console.log(`\n${days}天周期 (V3):`);
        console.log(`├── 设置收益率: ${config.rate}%日收益`);
        console.log(`├── 理论总收益: ${totalReward.toFixed(2)} MC`);
        console.log(`├── 实际到期时间: ${actualTime}分钟 ❌`);
        console.log(`└── 用户体验: 极差 (${days}天变${actualTime}分钟)`);
    });
    
    console.log("\n📊 V4版本 (修正后，完全改善):");
    console.log("├── 时间单位: 86400秒 (1天) ✅");
    console.log("├── 用户体验: 真实投资时间 ✅");
    console.log("├── 收益率: 基于流动性计算 ✅");
    console.log("└── 代币模型: MC + JBC双币模型 ✅");
    
    Object.entries(v4Rates).forEach(([days, config]) => {
        const totalReward = stakeAmount * (config.rate / 100) * parseInt(days);
        const mcReward = totalReward / 2; // 50% MC
        const jbcReward = totalReward / 2; // 50% MC等值的JBC
        const actualTime = parseInt(days); // 真实天数
        
        console.log(`\n${days}天周期 (V4):`);
        console.log(`├── 收益率: ${config.rate}%日收益`);
        console.log(`├── 总收益: ${totalReward.toFixed(2)} 代币等值`);
        console.log(`├── MC奖励: ${mcReward.toFixed(2)} MC`);
        console.log(`├── JBC奖励: ${jbcReward.toFixed(2)} MC等值JBC`);
        console.log(`├── 实际到期: ${actualTime}天 ✅`);
        console.log(`└── 用户体验: 符合投资预期 ✅`);
    });
    
    console.log("\n" + "=".repeat(80));
    console.log("🎯 2. 推荐奖励机制对比");
    console.log("=".repeat(80));
    
    console.log("\n📊 V3版本 (功能有限):");
    console.log("├── 直推奖励: 可能存在，比例不明确");
    console.log("├── 层级奖励: 可能有限的层级");
    console.log("├── 级差奖励: 不存在 ❌");
    console.log("└── 奖励形式: 单一MC代币");
    
    console.log("\n📊 V4版本 (完整机制):");
    
    // 计算V4推荐奖励
    const directReward = referralAmount * 0.25; // 25%直推
    const layerReward = referralAmount * 0.01 * 15; // 15层×1%
    const maxDifferentialReward = referralAmount * 0.45; // 最高45%级差 (V9用户)
    
    console.log("├── 直推奖励: 25% MC (即时解锁)");
    console.log(`│   └── ${referralAmount} MC门票 → ${directReward} MC奖励`);
    console.log("├── 层级奖励: 15层×1% MC (即时解锁)");
    console.log(`│   └── ${referralAmount} MC门票 → 最多${layerReward} MC奖励`);
    console.log("├── 级差奖励: V0-V9等级差额 (30天解锁)");
    console.log(`│   └── ${referralAmount} MC门票 → 最多${maxDifferentialReward} MC等值 (双币)`);
    console.log("└── 奖励形式: MC + JBC双币 (级差奖励)");
    
    console.log("\n" + "=".repeat(80));
    console.log("📈 3. 收益率数值对比表");
    console.log("=".repeat(80));
    
    console.log("\n质押1000 MC的收益对比:");
    console.log("┌─────────┬─────────────────┬─────────────────┬─────────────────┐");
    console.log("│  周期   │   V3版本收益    │   V4版本收益    │     体验差异    │");
    console.log("├─────────┼─────────────────┼─────────────────┼─────────────────┤");
    
    [7, 15, 30].forEach(days => {
        const v3Reward = stakeAmount * (v3Rates[days].rate / 100) * days;
        const v4Reward = stakeAmount * (v4Rates[days].rate / 100) * days;
        const v3Time = `${days}分钟`;
        const v4Time = `${days}天`;
        
        console.log(`│  ${days}天   │ ${v3Reward.toFixed(2).padStart(6)} MC (${v3Time.padStart(4)}) │ ${v4Reward.toFixed(2).padStart(6)} MC (${v4Time.padStart(4)}) │ 时间体验天壤之别 │`);
    });
    
    console.log("└─────────┴─────────────────┴─────────────────┴─────────────────┘");
    
    console.log("\n" + "=".repeat(80));
    console.log("🔄 4. 经济模型对比");
    console.log("=".repeat(80));
    
    console.log("\n📊 V3版本经济模型:");
    console.log("├── 代币模型: 单一MC代币");
    console.log("├── 通缩机制: 缺少 ❌");
    console.log("├── 时间价值: 错误的时间单位 ❌");
    console.log("├── 奖励机制: 1-2种基础奖励");
    console.log("└── 可持续性: 存在问题 ⚠️");
    
    console.log("\n📊 V4版本经济模型:");
    console.log("├── 代币模型: MC + JBC双币 + 兑换池");
    console.log("├── 通缩机制: 多重销毁机制 ✅");
    console.log("│   ├── JBC燃烧: 每24小时纯销毁");
    console.log("│   ├── MC→JBC: 25%销毁");
    console.log("│   └── JBC→MC: 50%销毁");
    console.log("├── 时间价值: 真实投资时间 ✅");
    console.log("├── 奖励机制: 4种完整奖励机制");
    console.log("└── 可持续性: 长期价值支撑 ✅");
    
    console.log("\n" + "=".repeat(80));
    console.log("🎯 5. 升级改善总结");
    console.log("=".repeat(80));
    
    console.log("\n✅ 关键改善:");
    console.log("├── 时间体验: 从分钟级别提升到天级别");
    console.log("├── 收益合理: 基于流动性计算的可持续收益率");
    console.log("├── 功能完整: 从1-2种奖励提升到4种完整奖励");
    console.log("├── 代币升级: 从单币模型升级到双币生态");
    console.log("├── 通缩机制: 新增多重销毁机制支撑价值");
    console.log("└── 用户体验: 从极差体验提升到符合投资预期");
    
    console.log("\n📊 数值改善:");
    const v3_30day = stakeAmount * (v3Rates[30].rate / 100) * 30;
    const v4_30day = stakeAmount * (v4Rates[30].rate / 100) * 30;
    const v4_mc = v4_30day / 2;
    const v4_jbc = v4_30day / 2;
    
    console.log(`├── V3 (30天): ${v3_30day} MC (但实际30分钟)`);
    console.log(`├── V4 (30天): ${v4_mc} MC + ${v4_jbc} MC等值JBC (真实30天)`);
    console.log(`├── 收益调整: 更合理的${((v4_30day/v3_30day)*100).toFixed(1)}%收益率`);
    console.log(`└── 体验提升: 从30分钟到30天的巨大改善`);
    
    console.log("\n🚀 升级建议:");
    console.log("├── 立即部署V4合约替换当前V3合约");
    console.log("├── 修复时间单位问题是最高优先级");
    console.log("├── 实现完整的四种奖励机制");
    console.log("├── 部署双币模型和兑换池");
    console.log("└── 提供真实的P-prod投资体验");
}

// 计算具体案例
async function calculateSpecificCases() {
    console.log("\n" + "=".repeat(80));
    console.log("📋 6. 具体案例计算");
    console.log("=".repeat(80));
    
    console.log("\n🎯 案例1: 用户A质押1000 MC，选择30天周期");
    
    console.log("\nV3版本体验:");
    console.log("├── 设置: 30天质押，3.0%日收益");
    console.log("├── 实际: 30分钟后到期 ❌");
    console.log("├── 收益: 900 MC (理论值，但体验极差)");
    console.log("└── 问题: 用户期望30天投资，实际30分钟");
    
    console.log("\nV4版本体验:");
    console.log("├── 设置: 30天质押，2.0%日收益");
    console.log("├── 实际: 真实30天后到期 ✅");
    console.log("├── MC收益: 300 MC (50%直接获得)");
    console.log("├── JBC收益: 300 MC等值JBC (50%兑换获得)");
    console.log("├── 总价值: 600 MC等值");
    console.log("└── 体验: 符合长期投资预期 ✅");
    
    console.log("\n🎯 案例2: 用户B推荐用户C购买1000 MC门票");
    
    console.log("\nV3版本奖励:");
    console.log("├── 直推奖励: 可能存在，数额不明确");
    console.log("├── 层级奖励: 有限");
    console.log("├── 级差奖励: 不存在");
    console.log("└── 总奖励: 估计100-300 MC");
    
    console.log("\nV4版本奖励 (假设B是V5用户):");
    console.log("├── 直推奖励: 250 MC (25%，即时)");
    console.log("├── 层级奖励: 最多150 MC (15层×1%，即时)");
    console.log("├── 级差奖励: 100 MC等值 (V5-V0差额10%，30天后)");
    console.log("│   ├── MC部分: 50 MC");
    console.log("│   └── JBC部分: 50 MC等值JBC");
    console.log("└── 总奖励: 最多500 MC等值");
    
    console.log("\n📊 改善幅度:");
    console.log("├── 奖励数量: 提升67%-400%");
    console.log("├── 奖励类型: 从单币到双币");
    console.log("├── 奖励层次: 从2种到4种机制");
    console.log("└── 长期价值: 级差奖励鼓励团队建设");
}

async function main() {
    await compareV3V4Yields();
    await calculateSpecificCases();
    
    console.log("\n" + "=".repeat(80));
    console.log("📋 最终结论");
    console.log("=".repeat(80));
    console.log("🎯 V4版本是V3版本的全面升级:");
    console.log("├── ✅ 修复了时间单位的致命问题");
    console.log("├── ✅ 提供了基于流动性的合理收益率");
    console.log("├── ✅ 实现了完整的四种奖励机制");
    console.log("├── ✅ 引入了双币模型和通缩机制");
    console.log("├── ✅ 提供了真实的P-prod投资体验");
    console.log("└── ✅ 建立了可持续的经济模型");
    
    console.log("\n🚀 强烈建议立即升级到V4版本！");
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { compareV3V4Yields, calculateSpecificCases };