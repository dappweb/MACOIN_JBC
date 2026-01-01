const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 部署基础时间单位修复合约...");
    
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
        const BasicTimeUnitFix = await ethers.getContractFactory("BasicTimeUnitFix");
        
        console.log("📦 部署合约...");
        
        // 部署合约
        const contract = await BasicTimeUnitFix.deploy();
        await contract.waitForDeployment();
        
        const contractAddress = await contract.getAddress();
        console.log(`✅ 合约部署完成: ${contractAddress}`);
        
        // 验证初始状态
        const owner = await contract.owner();
        const version = await contract.getVersion();
        const timeUnitFixed = await contract.timeUnitFixed();
        const effectiveSecondsInUnit = await contract.getEffectiveSecondsInUnit();
        
        console.log(`👤 合约所有者: ${owner}`);
        console.log(`📋 合约版本: ${version}`);
        console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        console.log(`⏰ 当前时间单位: ${effectiveSecondsInUnit}秒`);
        
        // 激活时间单位修复
        console.log("🔧 激活时间单位修复...");
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
            console.log("🎉 P-prod时间单位修复合约部署成功！");
            console.log("📊 关键修复:");
            console.log("  ✅ 时间单位从60秒修复为86400秒（1天）");
            console.log("  ✅ 质押周期现在按真实天数计算");
            console.log("  ✅ 动态奖励30天解锁期修复");
            console.log("  ✅ 燃烧机制按日周期执行");
            
            console.log("\n📋 合约信息:");
            console.log(`  📄 合约地址: ${contractAddress}`);
            console.log(`  👤 合约所有者: ${owner}`);
            console.log(`  📋 合约版本: ${version}`);
            console.log(`  ⏰ 时间单位: ${newEffectiveSecondsInUnit}秒`);
            console.log(`  🔧 修复状态: 已激活`);
            
            // 测试合约功能
            console.log("\n🧪 测试合约功能...");
            const status = await contract.getTimeUnitFixStatus();
            console.log(`  📊 修复状态: ${status.isFixed}`);
            console.log(`  📊 旧时间单位: ${status.oldUnit}秒`);
            console.log(`  📊 新时间单位: ${status.newUnit}秒`);
            console.log(`  📊 修复时间: ${new Date(Number(status.fixTime) * 1000).toLocaleString()}`);
            
            // 测试时间计算功能
            const stakeEndTime = await contract.calculateStakeEndTime(7); // 7天质押
            const rewardUnlockTime = await contract.calculateRewardUnlockTime(30); // 30天解锁
            
            console.log(`  📊 7天质押到期时间: ${new Date(Number(stakeEndTime) * 1000).toLocaleString()}`);
            console.log(`  📊 30天奖励解锁时间: ${new Date(Number(rewardUnlockTime) * 1000).toLocaleString()}`);
            
            // 保存部署信息
            const deploymentInfo = {
                network: network.name,
                chainId: network.chainId,
                contractAddress,
                deployer: deployer.address,
                owner,
                version,
                timeUnitFixed: newTimeUnitFixed,
                effectiveSecondsInUnit: newEffectiveSecondsInUnit.toString(),
                deploymentTime: new Date().toISOString(),
                transactionHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString(),
                fixTimestamp: status.fixTime.toString()
            };
            
            const fs = require('fs');
            fs.writeFileSync(
                `deployments/basic-time-unit-fix-${network.name}-${Date.now()}.json`,
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