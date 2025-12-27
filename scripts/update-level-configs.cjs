const { ethers } = require("hardhat");

async function main() {
    console.log("🔧 更新层级配置为基于团队人数的合理数值...");
    
    const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "0x7a216BeA62eF7629904E0d30b24F6842c9b0d660";
    
    console.log("📍 合约地址:", PROXY_ADDRESS);
    
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const contract = JinbaoProtocol.attach(PROXY_ADDRESS);
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 管理员地址:", deployer.address);
    
    try {
        // 检查当前层级配置
        console.log("\n📋 当前层级配置:");
        const currentConfigs = [];
        for (let i = 0; i < 10; i++) {
            try {
                const config = await contract.levelConfigs(i);
                currentConfigs.push({
                    minDirects: config.minDirects.toString(),
                    level: config.level.toString(),
                    percent: config.percent.toString()
                });
                console.log(`   ${config.level}级: ${config.minDirects}人团队, ${config.percent}%奖励`);
            } catch (error) {
                break;
            }
        }
        
        // 新的基于团队人数的层级配置
        const newConfigs = [
            { minDirects: 10000, level: 9, percent: 45 },  // 10K team
            { minDirects: 5000, level: 8, percent: 40 },   // 5K team
            { minDirects: 2000, level: 7, percent: 35 },   // 2K team
            { minDirects: 1000, level: 6, percent: 30 },   // 1K team
            { minDirects: 500, level: 5, percent: 25 },    // 500 team
            { minDirects: 200, level: 4, percent: 20 },    // 200 team
            { minDirects: 100, level: 3, percent: 15 },    // 100 team
            { minDirects: 50, level: 2, percent: 10 },     // 50 team
            { minDirects: 20, level: 1, percent: 5 }       // 20 team
        ];
        
        console.log("\n🔄 更新为新的层级配置:");
        for (const config of newConfigs) {
            console.log(`   ${config.level}级: ${config.minDirects}人团队, ${config.percent}%奖励`);
        }
        
        // 确认更新
        console.log("\n⚠️  即将更新层级配置，这将影响所有未来的极差奖励计算");
        console.log("继续更新...");
        
        // 执行更新
        console.log("📝 提交层级配置更新交易...");
        const tx = await contract.setLevelConfigs(newConfigs);
        console.log(`📋 交易哈希: ${tx.hash}`);
        
        console.log("⏳ 等待交易确认...");
        const receipt = await tx.wait();
        console.log(`✅ 交易确认! Gas使用: ${receipt.gasUsed}`);
        
        // 验证更新结果
        console.log("\n🔍 验证更新结果:");
        for (let i = 0; i < newConfigs.length; i++) {
            try {
                const config = await contract.levelConfigs(i);
                const expected = newConfigs[i];
                
                const isCorrect = 
                    config.minDirects.toString() === expected.minDirects.toString() &&
                    config.level.toString() === expected.level.toString() &&
                    config.percent.toString() === expected.percent.toString();
                
                console.log(`   ${config.level}级: ${config.minDirects}人团队, ${config.percent}%奖励 ${isCorrect ? '✅' : '❌'}`);
            } catch (error) {
                console.log(`   配置 ${i}: 读取失败`);
            }
        }
        
        // 测试新配置
        console.log("\n🧪 测试新的层级配置:");
        const testTeamSizes = [0, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 15000];
        
        for (const size of testTeamSizes) {
            const [level, percent] = await contract.getLevelByTeamCount(size);
            if (level > 0) {
                console.log(`   ${size}人团队 → ${level}级 (${percent}%奖励)`);
            } else {
                console.log(`   ${size}人团队 → 无层级 (0%奖励)`);
            }
        }
        
        console.log("\n🎉 层级配置更新完成!");
        
        console.log("\n📋 更新总结:");
        console.log("  • 层级配置已更新为基于团队人数的合理数值");
        console.log("  • 最低层级要求: 20人团队 (1级, 5%奖励)");
        console.log("  • 最高层级要求: 10,000人团队 (9级, 45%奖励)");
        console.log("  • 新配置将立即应用于所有极差奖励计算");
        
        console.log("\n⚡ 影响:");
        console.log("  • 极差奖励现在基于更合理的团队规模要求");
        console.log("  • 更多用户能够达到相应层级并获得奖励");
        console.log("  • 激励深度团队建设而非仅仅直接推荐");
        
    } catch (error) {
        console.error("❌ 更新失败:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });