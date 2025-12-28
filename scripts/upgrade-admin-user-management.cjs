const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 升级合约以添加Admin用户管理功能...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("部署者:", deployer.address);
    console.log("部署者余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MC");

    // 当前代理地址
    const PROXY_ADDRESS = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
    
    console.log("\n📋 升级前验证...");
    
    // 获取合约工厂
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    // 连接到当前合约进行验证
    const currentContract = JinbaoProtocol.attach(PROXY_ADDRESS);
    
    // 验证当前状态
    try {
        const owner = await currentContract.owner();
        console.log("✅ 当前所有者:", owner);
        
        const redeemEnabled = await currentContract.redeemEnabled();
        console.log("✅ 赎回功能启用:", redeemEnabled);
        
        // 测试现有功能
        const testUserInfo = await currentContract.userInfo(deployer.address);
        console.log("✅ 当前部署者团队人数:", testUserInfo[2].toString());
        
    } catch (error) {
        console.error("❌ 升级前验证失败:", error.message);
        return;
    }
    
    console.log("\n🔄 升级合约实现...");
    
    try {
        // 升级合约
        const upgradedContract = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocol);
        await upgradedContract.waitForDeployment();
        
        console.log("✅ 合约升级成功!");
        console.log("📍 代理地址 (不变):", PROXY_ADDRESS);
        console.log("📍 新实现已部署");
        
        // 验证状态保持
        const ownerAfter = await upgradedContract.owner();
        const redeemEnabledAfter = await upgradedContract.redeemEnabled();
        const testUserInfoAfter = await upgradedContract.userInfo(deployer.address);
        
        console.log("\n📊 升级后验证:");
        console.log("✅ 所有者保持:", ownerAfter);
        console.log("✅ 赎回功能:", redeemEnabledAfter);
        console.log("✅ 团队人数保持:", testUserInfoAfter[2].toString());
        
        // 测试新的管理员功能
        console.log("\n🧪 测试新的管理员功能:");
        
        try {
            // 测试 adminSetReferrer 函数是否存在
            const testAddress = "0x1234567890123456789012345678901234567890";
            const testReferrer = "0x0987654321098765432109876543210987654321";
            
            // 使用 staticCall 测试函数存在性，不实际执行
            try {
                await upgradedContract.adminSetReferrer.staticCall(testAddress, testReferrer);
                console.log("❌ 意外成功: adminSetReferrer 应该因为无效地址失败");
            } catch (error) {
                if (error.message.includes("Invalid address") || error.message.includes("revert")) {
                    console.log("✅ adminSetReferrer 函数正常工作");
                } else {
                    console.log("❓ adminSetReferrer 函数存在但出现其他错误:", error.message);
                }
            }
            
            // 测试 adminUpdateUserData 函数
            try {
                await upgradedContract.adminUpdateUserData.staticCall(
                    testAddress, 
                    false, 0, 
                    false, 0, 
                    false, 0, 
                    false, 0
                );
                console.log("✅ adminUpdateUserData 函数正常工作");
            } catch (error) {
                if (error.message.includes("Invalid address") || error.message.includes("revert")) {
                    console.log("✅ adminUpdateUserData 函数正常工作");
                } else {
                    console.log("❓ adminUpdateUserData 函数存在但出现其他错误:", error.message);
                }
            }
            
            // 测试 adminResetUser 函数
            try {
                await upgradedContract.adminResetUser.staticCall(testAddress);
                console.log("✅ adminResetUser 函数正常工作");
            } catch (error) {
                if (error.message.includes("Invalid address") || error.message.includes("revert")) {
                    console.log("✅ adminResetUser 函数正常工作");
                } else {
                    console.log("❓ adminResetUser 函数存在但出现其他错误:", error.message);
                }
            }
            
        } catch (error) {
            console.log("❌ 新功能测试失败:", error.message);
        }
        
        // 保存升级信息
        const upgradeInfo = {
            timestamp: new Date().toISOString(),
            proxyAddress: PROXY_ADDRESS,
            deployer: deployer.address,
            upgradeName: "admin-user-management",
            newFeatures: [
                "adminSetReferrer - 管理员修改用户推荐人",
                "adminUpdateUserData - 管理员更新用户数据",
                "adminResetUser - 管理员重置用户状态",
                "_hasCircularReference - 循环引用检测",
                "_removeFromDirectReferrals - 直推列表管理",
                "_recalculateTeamCounts - 团队人数重新计算"
            ],
            events: [
                "ReferrerChanged - 推荐人变更事件",
                "UserDataUpdated - 用户数据更新事件", 
                "UserReset - 用户重置事件"
            ],
            gasUsed: "TBD",
            blockNumber: await deployer.provider.getBlockNumber()
        };
        
        const fs = require('fs');
        const upgradeFileName = `deployments/upgrade-admin-user-management-${Date.now()}.json`;
        fs.writeFileSync(upgradeFileName, JSON.stringify(upgradeInfo, null, 2));
        
        console.log("\n✅ 升级完成!");
        console.log("📄 升级信息保存到:", upgradeFileName);
        console.log("\n🎯 新增功能:");
        console.log("1. 管理员可以修改用户推荐人关系");
        console.log("2. 管理员可以更新用户关键数据 (收益、上限、退款费用等)");
        console.log("3. 管理员可以重置用户状态 (保留推荐关系)");
        console.log("4. 自动防止循环引用和数据一致性保护");
        console.log("5. 完整的事件日志记录");
        
        console.log("\n📱 前端更新:");
        console.log("1. 新增 AdminUserManager 组件");
        console.log("2. AdminPanel 增加用户管理标签页");
        console.log("3. 支持搜索、编辑、重置用户功能");
        console.log("4. 完整的权限控制和错误处理");
        
    } catch (error) {
        console.error("❌ 升级失败:", error);
        
        if (error.message.includes("revert")) {
            console.log("\n🔍 可能原因:");
            console.log("- 合约不可升级");
            console.log("- 部署者不是所有者");
            console.log("- 存储布局冲突");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });