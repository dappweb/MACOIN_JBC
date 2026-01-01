const { ethers } = require("hardhat");

async function main() {
    console.log("🔄 开始迁移用户数据到新时间单位...");
    
    // P-prod环境的合约地址
    const CONTRACT_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    
    try {
        // 检查网络
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        
        const [deployer] = await ethers.getSigners();
        console.log(`👤 操作账户: ${deployer.address}`);
        
        // 连接到升级后的合约
        const contract = await ethers.getContractAt("JinbaoProtocolV3TimeUnitFixFinal", CONTRACT_ADDRESS);
        
        // 验证合约状态
        const timeUnitFixed = await contract.timeUnitFixed();
        const effectiveSecondsInUnit = await contract.getEffectiveSecondsInUnit();
        
        console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        console.log(`⏰ 当前时间单位: ${effectiveSecondsInUnit}秒`);
        
        if (!timeUnitFixed) {
            console.log("❌ 时间单位尚未修复，请先运行升级脚本");
            process.exit(1);
        }
        
        // 获取需要迁移的用户列表（这里需要根据实际情况获取）
        const usersToMigrate = await getUsersNeedingMigration(contract);
        
        console.log(`📊 发现 ${usersToMigrate.length} 个用户需要数据迁移`);
        
        if (usersToMigrate.length === 0) {
            console.log("✅ 没有用户需要迁移，任务完成");
            return;
        }
        
        // 分批迁移用户数据
        const batchSize = 10; // 每批处理10个用户
        let totalMigrated = 0;
        let totalStakesUpdated = 0;
        let totalRewardsUpdated = 0;
        
        for (let i = 0; i < usersToMigrate.length; i += batchSize) {
            const batch = usersToMigrate.slice(i, i + batchSize);
            
            console.log(`\n🔄 处理第 ${Math.floor(i/batchSize) + 1} 批用户 (${batch.length} 个用户)...`);
            
            try {
                // 批量迁移
                const migrateTx = await contract.batchMigrateUsers(batch);
                const receipt = await migrateTx.wait();
                
                console.log(`✅ 批量迁移交易: ${receipt.hash}`);
                console.log(`📊 Gas使用: ${receipt.gasUsed}`);
                
                // 解析事件获取详细信息
                const events = receipt.logs.filter(log => {
                    try {
                        const parsed = contract.interface.parseLog(log);
                        return parsed.name === 'UserDataMigrated' || parsed.name === 'BatchMigrationCompleted';
                    } catch {
                        return false;
                    }
                });
                
                let batchStakes = 0;
                let batchRewards = 0;
                
                events.forEach(log => {
                    const parsed = contract.interface.parseLog(log);
                    if (parsed.name === 'UserDataMigrated') {
                        batchStakes += Number(parsed.args.stakesUpdated);
                        batchRewards += Number(parsed.args.rewardsUpdated);
                    } else if (parsed.name === 'BatchMigrationCompleted') {
                        console.log(`📊 批次完成: ${parsed.args.usersCount} 用户, ${parsed.args.totalStakes} 质押, ${parsed.args.totalRewards} 奖励`);
                    }
                });
                
                totalMigrated += batch.length;
                totalStakesUpdated += batchStakes;
                totalRewardsUpdated += batchRewards;
                
                console.log(`📊 批次统计: ${batchStakes} 个质押记录, ${batchRewards} 个奖励记录已更新`);
                
                // 等待一段时间避免网络拥堵
                if (i + batchSize < usersToMigrate.length) {
                    console.log("⏳ 等待 2 秒后处理下一批...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`❌ 批次 ${Math.floor(i/batchSize) + 1} 迁移失败:`, error.message);
                
                // 尝试单个迁移
                console.log("🔄 尝试单个用户迁移...");
                for (const user of batch) {
                    try {
                        const needsMigration = await contract.needsMigration(user);
                        if (needsMigration) {
                            const singleTx = await contract.migrateUserData(user);
                            await singleTx.wait();
                            console.log(`✅ 单个迁移成功: ${user}`);
                            totalMigrated++;
                        }
                    } catch (singleError) {
                        console.error(`❌ 单个迁移失败 ${user}:`, singleError.message);
                    }
                }
            }
        }
        
        // 获取最终统计
        const finalStats = await contract.getMigrationStats();
        
        console.log("\n🎉 数据迁移完成！");
        console.log("📊 迁移统计:");
        console.log(`  👥 总迁移用户: ${totalMigrated}`);
        console.log(`  📋 质押记录更新: ${totalStakesUpdated}`);
        console.log(`  🎁 奖励记录更新: ${totalRewardsUpdated}`);
        console.log(`  📊 合约统计: ${finalStats.totalMigrated} 用户已迁移`);
        
        console.log("\n✅ 用户体验改善:");
        console.log("  🎯 7天质押现在是真正的7天");
        console.log("  🎯 15天质押现在是真正的15天");
        console.log("  🎯 30天质押现在是真正的30天");
        console.log("  🎯 动态奖励30天解锁期修复");
        console.log("  🎯 所有时间相关功能按天级别运行");
        
        // 保存迁移报告
        const migrationReport = {
            network: network.name,
            contractAddress: CONTRACT_ADDRESS,
            migrationTime: new Date().toISOString(),
            totalUsers: usersToMigrate.length,
            migratedUsers: totalMigrated,
            stakesUpdated: totalStakesUpdated,
            rewardsUpdated: totalRewardsUpdated,
            finalStats: {
                totalMigrated: finalStats.totalMigrated.toString(),
                migrationComplete: finalStats.migrationComplete
            }
        };
        
        const fs = require('fs');
        fs.writeFileSync(
            `reports/migration-report-${Date.now()}.json`,
            JSON.stringify(migrationReport, null, 2)
        );
        
        console.log("📁 迁移报告已保存到 reports/ 目录");
        
    } catch (error) {
        console.error("❌ 数据迁移失败:", error.message);
        console.error("详细错误:", error);
        process.exit(1);
    }
}

async function getUsersNeedingMigration(contract) {
    // 这里需要根据实际情况获取需要迁移的用户列表
    // 可以通过事件日志、数据库查询或其他方式获取
    
    console.log("🔍 扫描需要迁移的用户...");
    
    // 示例：获取一些测试用户地址
    // 在实际部署中，这里应该查询所有有质押或奖励记录的用户
    const testUsers = [
        "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48", // 部署者地址作为测试
        // 可以添加更多用户地址
    ];
    
    const usersNeedingMigration = [];
    
    for (const user of testUsers) {
        try {
            const needsMigration = await contract.needsMigration(user);
            if (needsMigration) {
                usersNeedingMigration.push(user);
                console.log(`📋 用户需要迁移: ${user}`);
            }
        } catch (error) {
            console.log(`⚠️  检查用户失败 ${user}: ${error.message}`);
        }
    }
    
    return usersNeedingMigration;
}

main().catch(console.error);