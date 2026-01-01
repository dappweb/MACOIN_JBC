const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 手动执行P-prod环境时间单位修复升级...");
    
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
        
        // 1. 部署新的实现合约
        console.log("📦 部署新的实现合约...");
        const JinbaoProtocolV3TimeUnitFixSimple = await ethers.getContractFactory("JinbaoProtocolV3TimeUnitFixSimple");
        const newImplementation = await JinbaoProtocolV3TimeUnitFixSimple.deploy();
        await newImplementation.waitForDeployment();
        
        const newImplementationAddress = await newImplementation.getAddress();
        console.log(`✅ 新实现合约部署完成: ${newImplementationAddress}`);
        
        // 2. 连接到代理合约并执行升级
        console.log("🔧 执行手动升级...");
        
        // 使用UUPS升级接口
        const uupsInterface = new ethers.Interface([
            "function upgradeTo(address newImplementation) external",
            "function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"
        ]);
        
        const proxyContract = new ethers.Contract(PROXY_ADDRESS, uupsInterface, deployer);
        
        // 调用upgradeTo函数
        const upgradeTx = await proxyContract.upgradeTo(newImplementationAddress);
        const upgradeReceipt = await upgradeTx.wait();
        
        console.log(`✅ 升级交易完成: ${upgradeReceipt.hash}`);
        
        // 3. 连接到升级后的合约
        console.log("🔧 连接到升级后的合约...");
        const upgradedContract = await ethers.getContractAt("JinbaoProtocolV3TimeUnitFixSimple", PROXY_ADDRESS);
        
        // 4. 修复时间单位
        console.log("🔧 修复时间单位...");
        const fixTx = await upgradedContract.fixTimeUnit();
        const fixReceipt = await fixTx.wait();
        
        console.log(`✅ 时间单位修复完成: ${fixReceipt.hash}`);
        
        // 5. 验证升级结果
        console.log("✅ 验证升级结果...");
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
            
            console.log("\n📋 升级摘要:");
            console.log(`  🔗 代理合约: ${PROXY_ADDRESS}`);
            console.log(`  📄 新实现合约: ${newImplementationAddress}`);
            console.log(`  🔧 升级交易: ${upgradeReceipt.hash}`);
            console.log(`  ⏰ 修复交易: ${fixReceipt.hash}`);
        } else {
            console.log("⚠️  升级完成但验证失败");
        }
        
    } catch (error) {
        console.error("❌ 手动升级失败:", error.message);
        console.error("详细错误:", error);
        process.exit(1);
    }
}

main().catch(console.error);