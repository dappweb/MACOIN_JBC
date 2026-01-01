const { ethers } = require("hardhat");

async function main() {
    const NEW_IMPL = "0xD8269F067b8B9571D12d2225f8e0B1F90f288Bb6";
    
    try {
        console.log("🔍 测试新实现合约...");
        
        // 检查合约代码
        const code = await ethers.provider.getCode(NEW_IMPL);
        console.log(`📄 合约代码长度: ${code.length}`);
        
        if (code === "0x") {
            console.log("❌ 合约不存在");
            return;
        }
        
        // 尝试连接到合约
        const contract = await ethers.getContractAt("JinbaoProtocolV3TimeUnitFixSimple", NEW_IMPL);
        
        // 测试基本函数
        try {
            const version = await contract.getVersionV4();
            console.log(`📋 版本: ${version}`);
        } catch (error) {
            console.log("❌ 无法获取版本:", error.message);
        }
        
        try {
            const secondsInUnit = await contract.getEffectiveSecondsInUnit();
            console.log(`⏰ 时间单位: ${secondsInUnit}`);
        } catch (error) {
            console.log("❌ 无法获取时间单位:", error.message);
        }
        
        try {
            const timeUnitFixed = await contract.timeUnitFixed();
            console.log(`🔧 时间单位已修复: ${timeUnitFixed}`);
        } catch (error) {
            console.log("❌ 无法获取修复状态:", error.message);
        }
        
        // 检查是否有_authorizeUpgrade函数
        try {
            // 这个函数应该存在但不能直接调用
            console.log("🔍 检查_authorizeUpgrade函数...");
            const iface = contract.interface;
            const hasAuthorizeUpgrade = iface.fragments.some(f => f.name === '_authorizeUpgrade');
            console.log(`📋 有_authorizeUpgrade函数: ${hasAuthorizeUpgrade}`);
        } catch (error) {
            console.log("❌ 检查_authorizeUpgrade失败:", error.message);
        }
        
    } catch (error) {
        console.error("❌ 测试失败:", error.message);
    }
}

main().catch(console.error);