const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 强制执行P-prod环境时间单位修复升级...");
    
    const PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    
    try {
        // 获取合约工厂
        const JinbaoProtocolV3TimeUnitFix = await ethers.getContractFactory("JinbaoProtocolV3TimeUnitFix");
        
        console.log("📦 强制导入现有代理...");
        
        // 强制导入现有代理
        await upgrades.forceImport(PROXY_ADDRESS, JinbaoProtocolV3TimeUnitFix, {
            kind: 'uups'
        });
        
        console.log("🔧 执行强制升级...");
        
        // 执行升级，跳过所有安全检查
        const upgradedContract = await upgrades.upgradeProxy(
            PROXY_ADDRESS, 
            JinbaoProtocolV3TimeUnitFix,
            {
                unsafeAllow: ['missing-public-upgradeto', 'delegatecall', 'constructor', 'state-variable-assignment', 'state-variable-immutable', 'external-library-linking'],
                unsafeSkipStorageCheck: true,
                timeout: 300000
            }
        );
        
        await upgradedContract.waitForDeployment();
        
        console.log("✅ 强制升级完成！");
        
        // 初始化V4
        console.log("🔧 初始化V4功能...");
        const tx = await upgradedContract.initializeV4();
        const receipt = await tx.wait();
        
        console.log(`✅ V4初始化完成，交易哈希: ${receipt.hash}`);
        
        // 验证升级结果
        const version = await upgradedContract.getVersionV4();
        const timeUnitFixed = await upgradedContract.timeUnitFixed();
        const effectiveSecondsInUnit = await upgradedContract.getEffectiveSecondsInUnit();
        
        console.log(`📋 合约版本: ${version}`);
        console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        console.log(`⏰ 当前时间单位: ${effectiveSecondsInUnit}秒`);
        
        if (timeUnitFixed && effectiveSecondsInUnit === 86400n) {
            console.log("🎉 P-prod时间单位修复升级成功完成！");
        } else {
            console.log("⚠️  升级完成但验证失败");
        }
        
    } catch (error) {
        console.error("❌ 强制升级失败:", error.message);
        process.exit(1);
    }
}

main().catch(console.error);