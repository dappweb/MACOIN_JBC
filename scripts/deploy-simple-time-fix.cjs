const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 部署简单时间单位修复合约...");
    
    try {
        // 检查网络
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        
        const [deployer] = await ethers.getSigners();
        console.log(`👤 部署账户: ${deployer.address}`);
        
        // 获取账户余额
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log(`💰 账户余额: ${ethers.formatEther(balance)} ETH`);
        
        // 获取合约工厂
        const JinbaoProtocolV3TimeUnitFixSimple = await ethers.getContractFactory("JinbaoProtocolV3TimeUnitFixSimple");
        
        console.log("📦 部署合约...");
        
        // 直接部署合约（不使用代理）
        const contract = await JinbaoProtocolV3TimeUnitFixSimple.deploy();
        await contract.waitForDeployment();
        
        const contractAddress = await contract.getAddress();
        console.log(`✅ 合约部署完成: ${contractAddress}`);
        
        // 初始化合约
        console.log("🔧 初始化合约...");
        const initTx = await contract.initialize(
            "0x0000000000000000000000000000000000000000", // MC Token (placeholder)
            "0x0000000000000000000000000000000000000000"  // JBC Token (placeholder)
        );
        await initTx.wait();
        console.log("✅ 合约初始化完成");
        
        // 激活时间单位修复
        console.log("🔧 激活时间单位修复...");
        const fixTx = await contract.initializeV4();
        const receipt = await fixTx.wait();
        
        console.log(`✅ 时间单位修复交易: ${receipt.hash}`);
        
        // 验证修复结果
        const timeUnitFixed = await contract.timeUnitFixed();
        const effectiveSecondsInUnit = await contract.getEffectiveSecondsInUnit();
        const version = await contract.getVersionV4();
        const owner = await contract.owner();
        
        console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        console.log(`⏰ 当前时间单位: ${effectiveSecondsInUnit}秒`);
        
        if (timeUnitFixed && effectiveSecondsInUnit === 86400n) {
            console.log("🎉 P-prod时间单位修复合约部署成功！");
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
            
            // 保存部署信息
            const deploymentInfo = {
                network: network.name,
                chainId: network.chainId,
                contractAddress,
                deployer: deployer.address,
                version,
                timeUnitFixed,
                effectiveSecondsInUnit: effectiveSecondsInUnit.toString(),
                deploymentTime: new Date().toISOString(),
                transactionHash: receipt.hash
            };
            
            const fs = require('fs');
            fs.writeFileSync(
                `deployments/time-unit-fix-${network.name}-${Date.now()}.json`,
                JSON.stringify(deploymentInfo, null, 2)
            );
            
            console.log("📁 部署信息已保存到 deployments/ 目录");
            
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