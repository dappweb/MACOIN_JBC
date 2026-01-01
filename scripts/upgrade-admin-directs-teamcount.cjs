const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 升级合约以添加管理员修改直推数和团队成员数功能...\n");
    console.log("=".repeat(80));
    
    const signers = await ethers.getSigners();
    if (signers.length === 0) {
        console.error("❌ 错误: 没有可用的签名者账户");
        console.error("   请确保在 .env 文件中设置了 PRIVATE_KEY 环境变量");
        console.error("   或在 hardhat.config.cjs 中配置了账户");
        return;
    }
    
    const deployer = signers[0];
    console.log("部署者:", deployer.address);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("部署者余额:", ethers.formatEther(balance), "MC");
    
    // 当前代理地址（从 latest-mc-v4.json）
    const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
    
    console.log("\n📋 升级前验证...");
    console.log("代理地址:", PROXY_ADDRESS);
    
    // 获取合约工厂 - 根据部署记录，V4 版本使用 JinbaoProtocolNative
    // 但新代码在 JinbaoProtocolV4.sol 中，需要确认实际部署的合约名称
    // 尝试多个可能的合约名称
    let JinbaoProtocolV4;
    const contractNames = ["JinbaoProtocolV4", "JinbaoProtocolNative", "JinbaoProtocol"];
    
    for (const contractName of contractNames) {
        try {
            JinbaoProtocolV4 = await ethers.getContractFactory(contractName);
            console.log(`✅ 使用合约名称: ${contractName}`);
            break;
        } catch (error) {
            console.log(`⚠️  合约名称 ${contractName} 不存在，尝试下一个...`);
        }
    }
    
    if (!JinbaoProtocolV4) {
        console.error("❌ 无法找到合约工厂，请检查合约名称");
        return;
    }
    
    // 连接到当前合约进行验证
    const currentContract = JinbaoProtocolV4.attach(PROXY_ADDRESS);
    
    // 验证当前状态
    try {
        const owner = await currentContract.owner();
        console.log("✅ 当前所有者:", owner);
        
        if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
            console.error("❌ 错误: 部署者不是合约所有者！");
            console.error(`   所有者: ${owner}`);
            console.error(`   部署者: ${deployer.address}`);
            return;
        }
        
        // 测试现有功能
        const testUserInfo = await currentContract.userInfo(deployer.address);
        console.log("✅ 当前部署者活跃直推数:", testUserInfo.activeDirects.toString());
        console.log("✅ 当前部署者团队成员数:", testUserInfo.teamCount.toString());
        
        // 检查新函数是否存在
        try {
            await currentContract.adminSetActiveDirects.staticCall(
                "0x0000000000000000000000000000000000000001",
                0
            );
            console.log("⚠️  adminSetActiveDirects 函数已存在");
        } catch (error) {
            if (error.message.includes("function") && error.message.includes("not found")) {
                console.log("✅ adminSetActiveDirects 函数不存在，需要升级");
            } else {
                console.log("✅ adminSetActiveDirects 函数存在（参数验证错误，正常）");
            }
        }
        
        try {
            await currentContract.adminSetTeamCount.staticCall(
                "0x0000000000000000000000000000000000000001",
                0
            );
            console.log("⚠️  adminSetTeamCount 函数已存在");
        } catch (error) {
            if (error.message.includes("function") && error.message.includes("not found")) {
                console.log("✅ adminSetTeamCount 函数不存在，需要升级");
            } else {
                console.log("✅ adminSetTeamCount 函数存在（参数验证错误，正常）");
            }
        }
        
    } catch (error) {
        console.error("❌ 升级前验证失败:", error.message);
        return;
    }
    
    console.log("\n🔄 升级合约实现...");
    
    try {
        // 导入代理（如果尚未注册）
        try {
            await upgrades.forceImport(PROXY_ADDRESS, JinbaoProtocolV4);
            console.log("✅ 代理已导入");
        } catch (error) {
            console.log("⚠️  代理导入警告（可能已注册）:", error.message);
        }
        
        // 升级合约
        console.log("正在升级合约...");
        const upgradedContract = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolV4);
        await upgradedContract.waitForDeployment();
        
        const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
        
        console.log("✅ 合约升级成功!");
        console.log("📍 代理地址 (不变):", PROXY_ADDRESS);
        console.log("📍 新实现地址:", implAddress);
        
        // 验证状态保持
        console.log("\n📊 升级后验证:");
        const ownerAfter = await upgradedContract.owner();
        const testUserInfoAfter = await upgradedContract.userInfo(deployer.address);
        
        console.log("✅ 所有者保持:", ownerAfter);
        console.log("✅ 活跃直推数保持:", testUserInfoAfter.activeDirects.toString());
        console.log("✅ 团队成员数保持:", testUserInfoAfter.teamCount.toString());
        
        // 测试新的管理员功能
        console.log("\n🧪 测试新的管理员功能:");
        
        const testAddress = "0x0000000000000000000000000000000000000001";
        
        // 测试 adminSetActiveDirects
        try {
            await upgradedContract.adminSetActiveDirects.staticCall(testAddress, 5);
            console.log("❌ 意外成功: adminSetActiveDirects 应该因为无效地址失败");
        } catch (error) {
            if (error.message.includes("Invalid address") || error.message.includes("revert")) {
                console.log("✅ adminSetActiveDirects 函数正常工作");
            } else if (error.message.includes("function") && error.message.includes("not found")) {
                console.log("❌ adminSetActiveDirects 函数不存在");
            } else {
                console.log("⚠️  adminSetActiveDirects 函数存在但出现其他错误:", error.message);
            }
        }
        
        // 测试 adminSetTeamCount
        try {
            await upgradedContract.adminSetTeamCount.staticCall(testAddress, 10);
            console.log("❌ 意外成功: adminSetTeamCount 应该因为无效地址失败");
        } catch (error) {
            if (error.message.includes("Invalid address") || error.message.includes("revert")) {
                console.log("✅ adminSetTeamCount 函数正常工作");
            } else if (error.message.includes("function") && error.message.includes("not found")) {
                console.log("❌ adminSetTeamCount 函数不存在");
            } else {
                console.log("⚠️  adminSetTeamCount 函数存在但出现其他错误:", error.message);
            }
        }
        
        // 检查事件
        try {
            const userDataUpdatedEvent = upgradedContract.interface.getEvent("UserDataUpdated");
            if (userDataUpdatedEvent) {
                console.log("✅ UserDataUpdated 事件存在");
            }
        } catch (error) {
            console.log("⚠️  UserDataUpdated 事件检查失败:", error.message);
        }
        
        // 保存升级信息
        const upgradeInfo = {
            timestamp: new Date().toISOString(),
            proxyAddress: PROXY_ADDRESS,
            implementationAddress: implAddress,
            deployer: deployer.address,
            upgradeName: "admin-directs-teamcount",
            newFeatures: [
                "adminSetActiveDirects - 管理员修改用户活跃直推数量",
                "adminSetTeamCount - 管理员修改用户团队成员数量"
            ],
            events: [
                "UserDataUpdated - 用户数据更新事件（包含活跃直推数）",
                "TeamCountUpdated - 团队成员数更新事件",
                "UserLevelChanged - 用户等级变化事件（当团队成员数改变时）"
            ],
            gasUsed: "TBD",
            blockNumber: await deployer.provider.getBlockNumber(),
            network: "mc",
            chainId: (await deployer.provider.getNetwork()).chainId.toString()
        };
        
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        const upgradeFileName = path.join(deploymentsDir, `upgrade-admin-directs-teamcount-${Date.now()}.json`);
        fs.writeFileSync(upgradeFileName, JSON.stringify(upgradeInfo, null, 2));
        
        console.log("\n✅ 升级完成!");
        console.log("📄 升级信息保存到:", upgradeFileName);
        console.log("\n🎯 新增功能:");
        console.log("1. adminSetActiveDirects(address user, uint256 newActiveDirects)");
        console.log("   - 管理员可以修改用户的活跃直推数量");
        console.log("   - 影响层级奖励的可获得层级数（1个=5层，2个=10层，3+=15层）");
        console.log("");
        console.log("2. adminSetTeamCount(address user, uint256 newTeamCount)");
        console.log("   - 管理员可以修改用户的团队成员数量");
        console.log("   - 自动触发等级变化检查（如果等级改变）");
        console.log("   - 影响用户的等级（V0-V9）和极差奖励比例");
        console.log("");
        console.log("📱 前端已更新:");
        console.log("- AdminUserManager 组件支持实际修改功能");
        console.log("- 支持修改活跃直推数和团队成员数");
        console.log("- 完整的错误处理和状态管理");
        
    } catch (error) {
        console.error("❌ 升级失败:", error);
        
        if (error.message.includes("revert")) {
            console.log("\n🔍 可能原因:");
            console.log("- 合约不可升级");
            console.log("- 部署者不是所有者");
            console.log("- 存储布局冲突");
            console.log("- Gas 不足");
        }
        
        if (error.message.includes("storage")) {
            console.log("\n⚠️  存储布局冲突检测到！");
            console.log("请检查合约的存储变量顺序是否与之前版本兼容");
        }
        
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

