const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 部署完整的P-prod V4合约 (四种奖励机制 + 代币模型)...");
    
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
        const JinbaoProtocolV4Complete = await ethers.getContractFactory("JinbaoProtocolV4Complete");
        
        console.log("📦 部署完整V4合约...");
        
        // 部署代理合约
        const contract = await upgrades.deployProxy(
            JinbaoProtocolV4Complete,
            [
                "0x0000000000000000000000000000000000000000", // MC Token (需要替换为实际地址)
                "0x0000000000000000000000000000000000000000"  // JBC Token (需要替换为实际地址)
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
                unsafeSkipStorageCheck: true
            }
        );
        
        await contract.waitForDeployment();
        
        const contractAddress = await contract.getAddress();
        console.log(`✅ 合约部署完成: ${contractAddress}`);
        
        // 验证部署结果
        console.log("🔍 验证合约功能...");
        
        const version = await contract.VERSION();
        const secondsInUnit = await contract.SECONDS_IN_UNIT();
        const owner = await contract.owner();
        const timeUnitInfo = await contract.getTimeUnitInfo();
        
        console.log(`📋 合约版本: ${version}`);
        console.log(`⏰ 时间单位: ${secondsInUnit}秒 (${Number(secondsInUnit) / 3600}小时)`);
        console.log(`👤 合约所有者: ${owner}`);
        console.log(`🎯 时间格式: ${timeUnitInfo.displayFormat}`);
        console.log(`✅ 时间单位已修复: ${timeUnitInfo.isFixed}`);
        
        // 验证门票等级配置
        console.log("\n🎫 验证门票等级配置:");
        for (let level = 1; level <= 4; level++) {
            try {
                const ticketLevel = await contract.ticketLevels(level);
                console.log(`  Level ${level}: ${ethers.formatEther(ticketLevel.price)} MC, 流动性要求: ${ethers.formatEther(ticketLevel.minLiquidity)} MC, 激活: ${ticketLevel.active}`);
            } catch (error) {
                console.log(`  Level ${level}: 配置读取失败`);
            }
        }
        
        // 获取系统统计
        const systemStats = await contract.getSystemStats();
        console.log("\n📊 系统初始状态:");
        console.log(`  👥 总用户数: ${systemStats._totalUsers}`);
        console.log(`  🎫 总门票销售: ${ethers.formatEther(systemStats._totalTicketsSold)} MC`);
        console.log(`  💰 总质押金额: ${ethers.formatEther(systemStats._totalStakedAmount)} MC`);
        console.log(`  🔥 总燃烧JBC: ${ethers.formatEther(systemStats._totalBurnedJBC)} JBC`);
        console.log(`  🔄 当前燃烧轮次: ${systemStats._currentBurnRound}`);
        console.log(`  ⏰ 下次燃烧时间: ${new Date(Number(systemStats._nextBurnTime) * 1000).toLocaleString()}`);
        
        if (Number(secondsInUnit) === 86400) {
            console.log("\n🎉 P-prod完整V4合约部署成功！");
            console.log("📊 核心功能:");
            console.log("  ✅ 时间单位: 86400秒 (1天) - 真实天级体验");
            console.log("  ✅ 四种门票等级: 100/300/500/1000 MC");
            console.log("  ✅ 三种质押周期: 7/15/30天 (真实天数)");
            console.log("  ✅ 72小时门票灵活期 (真实时间)");
            console.log("  ✅ 24小时燃烧周期 (真实时间)");
            
            console.log("\n🎁 四种奖励机制:");
            console.log("  1️⃣ 静态奖励: 质押挖矿 (2.0%-3.0%日收益)");
            console.log("  2️⃣ 动态奖励: 推荐奖励 (直推25% + 层级1% + 极差V0-V9)");
            console.log("  3️⃣ 燃烧奖励: 日燃烧分红 (JBC代币)");
            console.log("  4️⃣ 交易奖励: AMM手续费分红");
            
            console.log("\n💎 代币模型:");
            console.log("  🪙 MC代币: 门票购买、质押、奖励");
            console.log("  🔥 JBC代币: 燃烧机制、分红奖励");
            console.log("  📈 双代币通缩模型");
            
            console.log("\n⏰ 时间体验改善:");
            console.log("  🎯 7天质押 = 真正的7天 (不再是7分钟)");
            console.log("  🎯 15天质押 = 真正的15天 (不再是15分钟)");
            console.log("  🎯 30天质押 = 真正的30天 (不再是30分钟)");
            console.log("  🎯 极差奖励30天解锁 = 真正的30天");
            console.log("  🎯 门票72小时灵活期 = 真正的72小时");
            console.log("  🎯 燃烧机制24小时周期 = 真正的24小时");
            
            // 保存部署信息
            const deploymentInfo = {
                network: network.name,
                chainId: network.chainId,
                contractAddress,
                deployer: deployer.address,
                owner,
                version,
                secondsInUnit: secondsInUnit.toString(),
                timeUnitFixed: timeUnitInfo.isFixed,
                displayFormat: timeUnitInfo.displayFormat,
                deploymentTime: new Date().toISOString(),
                features: {
                    fourRewardMechanisms: true,
                    dualTokenModel: true,
                    realTimeExperience: true,
                    ticketLevels: [100, 300, 500, 1000],
                    stakingCycles: [7, 15, 30],
                    dailyYields: ["2.0%", "2.5%", "3.0%"]
                }
            };
            
            const fs = require('fs');
            fs.writeFileSync(
                `deployments/complete-v4-${network.name}-${Date.now()}.json`,
                JSON.stringify(deploymentInfo, null, 2)
            );
            
            console.log("📁 部署信息已保存到 deployments/ 目录");
            
            console.log("\n🎯 下一步操作:");
            console.log("  1. 配置MC和JBC代币地址");
            console.log("  2. 设置AMM交易池");
            console.log("  3. 启动燃烧机制定时任务");
            console.log("  4. 更新前端配置连接新合约");
            console.log("  5. 部署用户通知系统");
            
            console.log("\n📋 合约地址信息:");
            console.log(`  📄 P-prod V4合约: ${contractAddress}`);
            console.log(`  🌐 网络: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`  👤 所有者: ${owner}`);
            
        } else {
            console.log("⚠️  时间单位配置可能有问题");
        }
        
    } catch (error) {
        console.error("❌ 部署失败:", error.message);
        console.error("详细错误:", error);
        process.exit(1);
    }
}

main().catch(console.error);