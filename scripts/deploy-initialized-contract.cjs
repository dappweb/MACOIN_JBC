const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 部署并初始化时间单位修复合约...");
    
    try {
        // 检查网络
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        
        const [deployer] = await ethers.getSigners();
        console.log(`👤 部署账户: ${deployer.address}`);
        
        // 获取合约工厂
        const JinbaoProtocolV3TimeUnitFixSimple = await ethers.getContractFactory("JinbaoProtocolV3TimeUnitFixSimple");
        
        console.log("📦 部署新的代理合约...");
        
        // 部署代理合约并初始化
        const contract = await upgrades.deployProxy(
            JinbaoProtocolV3TimeUnitFixSimple,
            [
                "0x0000000000000000000000000000000000000000", // MC Token (placeholder)
                "0x0000000000000000000000000000000000000000"  // JBC Token (placeholder)
            ],
            {
                initializer: 'initialize',
                kind: 'uups',
                unsafeAllow: [
                    'missing-public-upgradeto',
                    'delegatecall',
                    'constructor',
                    'state-variable-assignment',
                    'state-variable-immutable',
                    'external-library-linking'
                ],
                unsafeSkipStorageCheck: true,
                unsafeAllowRenames: true,
                unsafeAllowLinkedLibraries: true
            }
        );
        
        await contract.waitForDeployment();
        
        const contractAddress = await contract.getAddress();
        console.log(`✅ 合约部署完成: ${contractAddress}`);
        
        // 验证初始化
        const owner = await contract.owner();
        const version = await contract.getVersionV4();
        
        console.log(`👤 合约所有者: ${owner}`);
        console.log(`📋 合约版本: ${version}`);
        
        // 激活时间单位修复
        console.log("🔧 激活时间单位修复...");
        const fixTx = await contract.fixTimeUnit();
        const receipt = await fixTx.wait();
        
        console.log(`✅ 时间单位修复交易: ${receipt.hash}`);
        
        // 验证修复结果
        const timeUnitFixed = await contract.timeUnitFixed();
        const effectiveSecondsInUnit = await contract.getEffectiveSecondsInUnit();
        
        console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        console.log(`⏰ 当前时间单位: ${effectiveSecondsInUnit}秒`);
        
        if (timeUnitFixed && effectiveSecondsInUnit === 86400n) {
            console.log("🎉 P-prod时间单位修复合约部署并激活成功！");
            console.log("📊 关键修复:");
            console.log("  ✅ 时间单位从60秒修复为86400秒（1天）");
            console.log("  ✅ 质押周期现在按真实天数计算");
            console.log("  ✅ 动态奖励30天解锁期修复");
            console.log("  ✅ 燃烧机制按日周期执行");
            
            console.log("\n📋 新合约信息:");
            console.log(`  📄 合约地址: ${contractAddress}`);
            console.log(`  👤 合约所有者: ${owner}`);
            console.log(`  📋 合约版本: ${version}`);
            console.log(`  ⏰ 时间单位: ${effectiveSecondsInUnit}秒`);
            console.log(`  🔧 修复状态: 已激活`);
        } else {
            console.log("⚠️  时间单位修复可能未完全生效");
        }
        
    } catch (error) {
        console.error("❌ 部署失败:", error.message);
        console.error("详细错误:", error);
        process.exit(1);
    }
}

main().catch(console.error);