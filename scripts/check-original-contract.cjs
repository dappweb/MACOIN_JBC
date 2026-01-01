const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 检查原P-prod合约状态...");
    
    // 原合约地址
    const ORIGINAL_CONTRACT = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    
    try {
        // 检查网络
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        
        // 连接到原合约
        const contract = await ethers.getContractAt("JinbaoProtocolV3Standalone", ORIGINAL_CONTRACT);
        
        console.log(`📄 检查合约: ${ORIGINAL_CONTRACT}`);
        
        // 检查合约基本信息
        try {
            const owner = await contract.owner();
            console.log(`👤 合约所有者: ${owner}`);
        } catch (error) {
            console.log(`❌ 无法获取所有者: ${error.message}`);
        }
        
        // 检查版本信息
        try {
            const version = await contract.getVersionV3();
            console.log(`📋 合约版本: ${version}`);
        } catch (error) {
            console.log(`❌ 无法获取版本: ${error.message}`);
        }
        
        // 检查是否有时间单位修复功能
        try {
            const timeUnitFixed = await contract.timeUnitFixed();
            console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        } catch (error) {
            console.log(`❌ 原合约没有时间单位修复功能: ${error.message}`);
        }
        
        // 尝试检查SECONDS_IN_UNIT（如果存在）
        try {
            const secondsInUnit = await contract.SECONDS_IN_UNIT();
            console.log(`⏰ 当前时间单位: ${secondsInUnit}秒`);
        } catch (error) {
            console.log(`❌ 无法获取时间单位: ${error.message}`);
        }
        
        console.log("\n📊 用户体验分析:");
        console.log("🔴 当前用户体验问题:");
        console.log("  • 7天质押 = 7分钟（不符合预期）");
        console.log("  • 15天质押 = 15分钟（不符合预期）");
        console.log("  • 30天质押 = 30分钟（不符合预期）");
        console.log("  • 动态奖励30天解锁 = 30分钟解锁（不符合预期）");
        console.log("  • 燃烧机制每分钟执行（不符合预期）");
        
        console.log("\n🎯 要求的用户体验:");
        console.log("  • 7天质押 = 真正的7天");
        console.log("  • 15天质押 = 真正的15天");
        console.log("  • 30天质押 = 真正的30天");
        console.log("  • 动态奖励30天解锁 = 真正的30天");
        console.log("  • 燃烧机制每24小时执行");
        
        console.log("\n⚠️  关键问题:");
        console.log("  ❌ 我们部署的新合约是独立的，没有替换原合约");
        console.log("  ❌ 用户仍然在使用原合约，体验没有改变");
        console.log("  ❌ 需要真正升级原合约或迁移用户数据");
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
    }
}

main().catch(console.error);