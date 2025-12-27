const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 开始升级合约以支持基于团队总人数的极差奖励...");
    
    // 获取当前部署的合约地址
    const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "0x7a216BeA62eF7629904E0d30b24F6842c9b0d660";
    
    if (!PROXY_ADDRESS || PROXY_ADDRESS === "YOUR_PROXY_ADDRESS_HERE") {
        console.error("❌ 请在 .env 文件中设置 PROXY_ADDRESS");
        process.exit(1);
    }
    
    console.log("📍 代理合约地址:", PROXY_ADDRESS);
    
    // 获取新的合约工厂
    const JinbaoProtocolV3 = await ethers.getContractFactory("JinbaoProtocol");
    
    console.log("📝 升级合约到支持团队统计的版本...");
    
    try {
        // 升级合约
        const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolV3);
        await upgraded.waitForDeployment();
        
        console.log("✅ 合约升级成功!");
        console.log("📍 合约地址:", await upgraded.getAddress());
        
        // 验证新功能是否可用
        console.log("🔍 验证新功能...");
        
        const [deployer] = await ethers.getSigners();
        
        try {
            // 测试新的团队统计函数
            const teamCount = await upgraded.getTeamCount(deployer.address);
            console.log("✅ getTeamCount 函数可用，当前值:", teamCount.toString());
            
            // 测试基于团队数的层级查询
            const [level, percent] = await upgraded.getLevelByTeamCount(100);
            console.log("✅ getLevelByTeamCount 函数可用，100人团队对应:", `${level}级 ${percent}%`);
            
            // 测试团队统计验证
            const isValid = await upgraded.validateTeamCount(deployer.address);
            console.log("✅ validateTeamCount 函数可用，验证结果:", isValid);
            
        } catch (error) {
            console.log("⚠️  新函数测试:", error.message);
        }
        
        console.log("\n📋 升级后的新功能:");
        console.log("  • 基于团队总人数的极差奖励计算");
        console.log("  • 更合理的层级配置（20-10000人团队）");
        console.log("  • 自动团队统计更新");
        console.log("  • 管理员团队数据管理工具");
        console.log("  • 数据验证和修正功能");
        
        console.log("\n⚠️  重要提醒:");
        console.log("  1. 需要运行数据迁移脚本初始化现有用户的团队统计");
        console.log("  2. 新的极差奖励将基于团队总人数而非直接推荐人数");
        console.log("  3. 层级奖励仍然基于直接推荐人数（保持向后兼容）");
        
        console.log("🎉 升级完成!");
        
    } catch (error) {
        console.error("❌ 升级失败:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });