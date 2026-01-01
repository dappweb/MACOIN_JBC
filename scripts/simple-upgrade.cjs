const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 执行P-prod环境时间单位修复升级（简化版）...");
    
    const PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    
    try {
        // 检查网络
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        
        if (network.chainId !== 88813n) {
            throw new Error("错误的网络！请确保连接到MC Chain (88813)");
        }
        
        // 检查账户
        const [deployer] = await ethers.getSigners();
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log(`💰 部署账户: ${deployer.address}`);
        console.log(`💰 账户余额: ${ethers.formatEther(balance)} MC`);
        
        // 获取合约工厂
        const JinbaoProtocolV3TimeUnitFixSimple = await ethers.getContractFactory("JinbaoProtocolV3TimeUnitFixSimple");
        
        console.log("🔧 执行升级...");
        
        // 执行升级
        const upgradedContract = await upgrades.upgradeProxy(
            PROXY_ADDRESS, 
            JinbaoProtocolV3TimeUnitFixSimple,
            {
                timeout: 300000,
                pollingInterval: 5000
            }
        );
        
        await upgradedContract.waitForDeployment();
        
        console.log("✅ 升级完成！");
        
        // 修复时间单位
        console.log("🔧 修复时间单位...");
        const fixTx = await upgradedContract.fixTimeUnit();
        const receipt = await fixTx.wait();
        
        console.log(`✅ 时间单位修复完成，交易哈希: ${receipt.hash}`);
        
        // 验证升级结果
        const version = await upgradedContract.getVersionV4();
        const timeUnitFixed = await upgradedContract.timeUnitFixed();
        const effectiveSecondsInUnit = await upgradedContract.getEffectiveSecondsInUnit();
        
        console.log(`📋 合约版本: ${version}`);
        console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        console.log(`⏰ 当前时间单位: ${effectiveSecondsInUnit}秒`);
        
        if (timeUnitFixed && effectiveSecondsInUnit === 86400n) {
            console.log("🎉 P-prod时间单位修复升级成功完成！");
            console.log("📊 关键修复:");
            console.log("  ✅ 时间单位从60秒修复为86400秒（1天）");
            console.log("  ✅ 质押周期现在按真实天数计算");
            console.log("  ✅ 动态奖励30天解锁期修复");
            console.log("  ✅ 燃烧机制按日周期执行");
        } else {
            console.log("⚠️  升级完成但验证失败");
        }
        
    } catch (error) {
        console.error("❌ 升级失败:", error.message);
        process.exit(1);
    }
}

main().catch(console.error);