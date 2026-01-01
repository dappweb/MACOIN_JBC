const { ethers } = require("hardhat");

async function main() {
    console.log("🔧 激活时间单位修复功能...");
    
    // 使用新部署的合约地址
    const NEW_CONTRACT_ADDRESS = "0x6B32e3bd93b4dCe26C361b0B1425B06B03A8b8B9";
    
    try {
        // 检查网络
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        
        // 连接到新合约
        const contract = await ethers.getContractAt("JinbaoProtocolV3TimeUnitFixSimple", NEW_CONTRACT_ADDRESS);
        
        // 检查当前状态
        const timeUnitFixed = await contract.timeUnitFixed();
        const effectiveSecondsInUnit = await contract.getEffectiveSecondsInUnit();
        
        console.log(`⏰ 当前时间单位已修复: ${timeUnitFixed}`);
        console.log(`⏰ 当前有效时间单位: ${effectiveSecondsInUnit}秒`);
        
        if (!timeUnitFixed) {
            console.log("🔧 执行时间单位修复...");
            
            // 激活时间单位修复
            const fixTx = await contract.fixTimeUnit();
            const receipt = await fixTx.wait();
            
            console.log(`✅ 时间单位修复交易: ${receipt.hash}`);
            console.log(`📊 Gas使用: ${receipt.gasUsed}`);
            
            // 验证修复结果
            const newTimeUnitFixed = await contract.timeUnitFixed();
            const newEffectiveSecondsInUnit = await contract.getEffectiveSecondsInUnit();
            
            console.log(`⏰ 修复后时间单位已修复: ${newTimeUnitFixed}`);
            console.log(`⏰ 修复后有效时间单位: ${newEffectiveSecondsInUnit}秒`);
            
            if (newTimeUnitFixed && newEffectiveSecondsInUnit === 86400n) {
                console.log("🎉 时间单位修复成功激活！");
                console.log("📊 关键修复:");
                console.log("  ✅ 时间单位从60秒修复为86400秒（1天）");
                console.log("  ✅ 质押周期现在按真实天数计算");
                console.log("  ✅ 动态奖励30天解锁期修复");
                console.log("  ✅ 燃烧机制按日周期执行");
            } else {
                console.log("⚠️  时间单位修复可能未完全生效");
            }
        } else {
            console.log("ℹ️  时间单位已经修复，无需重复操作");
        }
        
        // 获取合约基本信息
        const version = await contract.getVersionV4();
        const owner = await contract.owner();
        
        console.log("\n📋 合约信息摘要:");
        console.log(`  📄 合约地址: ${NEW_CONTRACT_ADDRESS}`);
        console.log(`  📋 合约版本: ${version}`);
        console.log(`  👤 合约所有者: ${owner}`);
        console.log(`  ⏰ 时间单位: ${newEffectiveSecondsInUnit || effectiveSecondsInUnit}秒`);
        console.log(`  🔧 修复状态: ${newTimeUnitFixed || timeUnitFixed ? '已修复' : '未修复'}`);
        
    } catch (error) {
        console.error("❌ 激活时间单位修复失败:", error.message);
        process.exit(1);
    }
}

main().catch(console.error);