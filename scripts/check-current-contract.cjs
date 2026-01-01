const { ethers, upgrades } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    
    try {
        console.log("🔍 检查当前合约状态...");
        
        // 获取当前实现地址
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
        console.log(`📄 当前实现合约: ${implementationAddress}`);
        
        // 连接到当前合约
        const currentContract = await ethers.getContractAt("JinbaoProtocolV3Standalone", PROXY_ADDRESS);
        
        // 检查当前版本
        try {
            const version = await currentContract.VERSION_V3();
            console.log(`📋 当前版本: ${version}`);
        } catch (error) {
            console.log("⚠️  无法获取V3版本");
        }
        
        // 检查是否已经是V4
        try {
            const versionV4 = await currentContract.getVersionV4();
            console.log(`📋 V4版本: ${versionV4}`);
            
            const timeUnitFixed = await currentContract.timeUnitFixed();
            const effectiveSecondsInUnit = await currentContract.getEffectiveSecondsInUnit();
            
            console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
            console.log(`⏰ 当前时间单位: ${effectiveSecondsInUnit}秒`);
            
            if (timeUnitFixed && effectiveSecondsInUnit === 86400n) {
                console.log("✅ 合约已经是V4且时间单位已修复！");
                return;
            }
        } catch (error) {
            console.log("ℹ️  当前合约不是V4版本");
        }
        
        // 检查所有者
        const owner = await currentContract.owner();
        console.log(`👤 合约所有者: ${owner}`);
        
        // 检查是否暂停
        const paused = await currentContract.paused();
        console.log(`⏸️  合约暂停状态: ${paused}`);
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
    }
}

main().catch(console.error);