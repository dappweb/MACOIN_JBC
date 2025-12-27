const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 开始团队统计数据迁移...");
    
    // 获取合约地址
    const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "0x7a216BeA62eF7629904E0d30b24F6842c9b0d660";
    
    if (!PROXY_ADDRESS || PROXY_ADDRESS === "YOUR_PROXY_ADDRESS_HERE") {
        console.error("❌ 请在 .env 文件中设置 PROXY_ADDRESS");
        process.exit(1);
    }
    
    console.log("📍 合约地址:", PROXY_ADDRESS);
    
    // 连接到合约
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const contract = JinbaoProtocol.attach(PROXY_ADDRESS);
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 部署者地址:", deployer.address);
    
    try {
        // 这里需要获取所有用户地址
        // 在实际部署中，你需要从事件日志或其他方式获取所有用户地址
        console.log("📋 获取用户列表...");
        
        // 示例用户列表 - 在实际使用中需要替换为真实的用户地址
        const sampleUsers = [
            deployer.address,
            // 添加更多用户地址...
        ];
        
        console.log(`📊 找到 ${sampleUsers.length} 个用户需要迁移`);
        
        // 批量处理用户，每次处理10个以避免gas限制
        const batchSize = 10;
        let totalMigrated = 0;
        
        for (let i = 0; i < sampleUsers.length; i += batchSize) {
            const batch = sampleUsers.slice(i, i + batchSize);
            console.log(`🔄 处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(sampleUsers.length/batchSize)}...`);
            
            try {
                // 为每个用户计算团队人数
                const teamCounts = [];
                for (const user of batch) {
                    try {
                        // 调用合约的recalculateTeamCount函数
                        const tx = await contract.recalculateTeamCount(user);
                        const receipt = await tx.wait();
                        
                        // 从事件中获取新的团队人数
                        const teamCountEvent = receipt.logs.find(log => {
                            try {
                                const parsed = contract.interface.parseLog(log);
                                return parsed.name === 'TeamCountUpdated';
                            } catch {
                                return false;
                            }
                        });
                        
                        if (teamCountEvent) {
                            const parsed = contract.interface.parseLog(teamCountEvent);
                            console.log(`  ✅ ${user}: ${parsed.args.oldCount} → ${parsed.args.newCount}`);
                        } else {
                            console.log(`  ✅ ${user}: 团队统计已更新`);
                        }
                        
                        totalMigrated++;
                    } catch (error) {
                        console.log(`  ⚠️  ${user}: ${error.message}`);
                    }
                }
                
                // 等待一下避免网络拥堵
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ 批次处理失败:`, error.message);
            }
        }
        
        console.log(`\n📊 迁移统计:`);
        console.log(`  • 总用户数: ${sampleUsers.length}`);
        console.log(`  • 成功迁移: ${totalMigrated}`);
        console.log(`  • 失败数量: ${sampleUsers.length - totalMigrated}`);
        
        // 验证一些用户的团队统计
        console.log("\n🔍 验证团队统计...");
        for (let i = 0; i < Math.min(3, sampleUsers.length); i++) {
            const user = sampleUsers[i];
            try {
                const teamCount = await contract.getTeamCount(user);
                const isValid = await contract.validateTeamCount(user);
                console.log(`  ${user}: 团队人数=${teamCount}, 验证=${isValid ? '✅' : '❌'}`);
            } catch (error) {
                console.log(`  ${user}: 验证失败 - ${error.message}`);
            }
        }
        
        console.log("\n🎉 团队统计数据迁移完成!");
        console.log("\n📋 后续步骤:");
        console.log("  1. 验证所有用户的团队统计数据");
        console.log("  2. 测试基于团队数的极差奖励计算");
        console.log("  3. 监控系统运行状态");
        
    } catch (error) {
        console.error("❌ 迁移失败:", error);
        process.exit(1);
    }
}

// 获取所有用户地址的辅助函数
async function getAllUsers(contract) {
    console.log("📋 从事件日志获取用户列表...");
    
    try {
        // 获取所有BoundReferrer事件来找到用户
        const filter = contract.filters.BoundReferrer();
        const events = await contract.queryFilter(filter, 0, 'latest');
        
        const users = new Set();
        events.forEach(event => {
            users.add(event.args.user);
            users.add(event.args.referrer);
        });
        
        // 获取所有TicketPurchased事件
        const ticketFilter = contract.filters.TicketPurchased();
        const ticketEvents = await contract.queryFilter(ticketFilter, 0, 'latest');
        
        ticketEvents.forEach(event => {
            users.add(event.args.user);
        });
        
        return Array.from(users).filter(addr => addr !== ethers.ZeroAddress);
        
    } catch (error) {
        console.log("⚠️  无法从事件获取用户列表:", error.message);
        console.log("请手动提供用户地址列表");
        return [];
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });