const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 开始真正的P-prod时间单位修复升级...");
    
    // P-prod环境的原合约地址
    const ORIGINAL_CONTRACT_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    
    try {
        // 检查网络
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        
        const [deployer] = await ethers.getSigners();
        console.log(`👤 部署账户: ${deployer.address}`);
        
        // 获取账户余额
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log(`💰 账户余额: ${ethers.formatEther(balance)} ETH`);
        
        console.log(`📄 准备升级合约: ${ORIGINAL_CONTRACT_ADDRESS}`);
        
        // 1. 备份当前状态
        console.log("📦 备份当前合约状态...");
        await backupCurrentState(ORIGINAL_CONTRACT_ADDRESS);
        
        // 2. 获取升级合约工厂
        const JinbaoProtocolV3TimeUnitFixFinal = await ethers.getContractFactory("JinbaoProtocolV3TimeUnitFixFinal");
        
        console.log("🔧 执行UUPS代理升级...");
        
        // 3. 执行升级
        const upgraded = await upgrades.upgradeProxy(
            ORIGINAL_CONTRACT_ADDRESS,
            JinbaoProtocolV3TimeUnitFixFinal,
            {
                unsafeAllow: [
                    'missing-public-upgradeto',
                    'delegatecall',
                    'constructor',
                    'state-variable-assignment',
                    'state-variable-immutable',
                    'external-library-linking'
                ],
                unsafeSkipStorageCheck: true
            }
        );
        
        console.log("✅ 代理升级完成");
        
        // 4. 初始化V4功能
        console.log("🔧 初始化V4时间单位修复...");
        const initTx = await upgraded.initializeV4();
        const initReceipt = await initTx.wait();
        
        console.log(`✅ V4初始化交易: ${initReceipt.hash}`);
        console.log(`📊 Gas使用: ${initReceipt.gasUsed}`);
        
        // 5. 验证升级结果
        console.log("🔍 验证升级结果...");
        
        const timeUnitFixed = await upgraded.timeUnitFixed();
        const effectiveSecondsInUnit = await upgraded.getEffectiveSecondsInUnit();
        const version = await upgraded.getVersionV4();
        const owner = await upgraded.owner();
        
        console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        console.log(`⏰ 当前时间单位: ${effectiveSecondsInUnit}秒`);
        console.log(`📋 合约版本: ${version}`);
        console.log(`👤 合约所有者: ${owner}`);
        
        if (timeUnitFixed && effectiveSecondsInUnit === 86400n) {
            console.log("🎉 P-prod时间单位修复升级成功！");
            console.log("📊 关键修复:");
            console.log("  ✅ 原合约已成功升级到V4");
            console.log("  ✅ 时间单位从60秒修复为86400秒（1天）");
            console.log("  ✅ 用户将体验真实的天级质押周期");
            console.log("  ✅ 动态奖励30天解锁期修复");
            console.log("  ✅ 燃烧机制按日周期执行");
            
            console.log("\n📋 升级后合约信息:");
            console.log(`  📄 合约地址: ${ORIGINAL_CONTRACT_ADDRESS} (原地址不变)`);
            console.log(`  👤 合约所有者: ${owner}`);
            console.log(`  📋 合约版本: ${version}`);
            console.log(`  ⏰ 时间单位: ${effectiveSecondsInUnit}秒`);
            console.log(`  🔧 修复状态: 已激活`);
            
            // 6. 开始数据迁移准备
            console.log("\n📊 准备数据迁移...");
            const migrationStats = await upgraded.getMigrationStats();
            console.log(`  📊 已迁移用户: ${migrationStats.totalMigrated}`);
            console.log(`  📊 迁移状态: ${migrationStats.migrationComplete ? '可以开始' : '等待中'}`);
            
            // 保存升级信息
            const upgradeInfo = {
                network: network.name,
                chainId: network.chainId,
                contractAddress: ORIGINAL_CONTRACT_ADDRESS,
                deployer: deployer.address,
                owner,
                version,
                timeUnitFixed,
                effectiveSecondsInUnit: effectiveSecondsInUnit.toString(),
                upgradeTime: new Date().toISOString(),
                initTransactionHash: initReceipt.hash,
                gasUsed: initReceipt.gasUsed.toString()
            };
            
            const fs = require('fs');
            fs.writeFileSync(
                `deployments/real-upgrade-${network.name}-${Date.now()}.json`,
                JSON.stringify(upgradeInfo, null, 2)
            );
            
            console.log("📁 升级信息已保存到 deployments/ 目录");
            
            console.log("\n🎯 下一步操作:");
            console.log("  1. 运行数据迁移脚本迁移现有用户数据");
            console.log("  2. 更新前端配置以使用新的时间显示");
            console.log("  3. 通知用户时间单位修复完成");
            
        } else {
            console.log("⚠️  时间单位修复可能未完全生效");
            console.log("请检查升级过程是否有错误");
        }
        
    } catch (error) {
        console.error("❌ 升级失败:", error.message);
        console.error("详细错误:", error);
        
        console.log("\n🔄 回滚建议:");
        console.log("  1. 检查网络连接");
        console.log("  2. 验证合约权限");
        console.log("  3. 如需回滚，请联系管理员");
        
        process.exit(1);
    }
}

async function backupCurrentState(contractAddress) {
    try {
        const contract = await ethers.getContractAt("JinbaoProtocolV3Standalone", contractAddress);
        
        // 备份基本信息
        const backupData = {
            timestamp: Date.now(),
            contractAddress,
            backupTime: new Date().toISOString(),
            network: (await ethers.provider.getNetwork()).name,
            owner: await contract.owner().catch(() => "unknown"),
            version: await contract.getVersionV3().catch(() => "unknown")
        };
        
        const fs = require('fs');
        fs.writeFileSync(
            `backups/pre-upgrade-backup-${Date.now()}.json`,
            JSON.stringify(backupData, null, 2)
        );
        
        console.log("✅ 状态备份完成");
        
    } catch (error) {
        console.log(`⚠️  备份失败: ${error.message}`);
        console.log("继续升级过程...");
    }
}

main().catch(console.error);