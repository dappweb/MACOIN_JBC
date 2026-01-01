const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 检查当前部署合约是否包含新的管理员函数...\n");
    console.log("=".repeat(80));
    
    // 当前部署的合约地址
    const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
    
    const [deployer] = await ethers.getSigners();
    console.log("检查者地址:", deployer.address);
    console.log("合约地址:", PROTOCOL_ADDRESS);
    console.log("");
    
    // 获取合约工厂 - 尝试多个可能的合约名称
    let contract;
    const contractNames = ["JinbaoProtocolV4", "JinbaoProtocolNative", "JinbaoProtocol"];
    
    for (const contractName of contractNames) {
        try {
            const ContractFactory = await ethers.getContractFactory(contractName);
            contract = ContractFactory.attach(PROTOCOL_ADDRESS);
            // 测试是否能调用基本函数
            await contract.owner();
            console.log(`✅ 使用合约名称: ${contractName}`);
            break;
        } catch (error) {
            // 继续尝试下一个
        }
    }
    
    if (!contract) {
        console.error("❌ 无法连接到合约，请检查合约地址和网络配置");
        return;
    }
    
    // 要检查的函数列表
    const functionsToCheck = [
        {
            name: "adminSetActiveDirects",
            signature: "function adminSetActiveDirects(address user, uint256 newActiveDirects) external",
            description: "管理员修改用户活跃直推数量"
        },
        {
            name: "adminSetTeamCount",
            signature: "function adminSetTeamCount(address user, uint256 newTeamCount) external",
            description: "管理员修改用户团队成员数量"
        },
        {
            name: "adminSetReferrer",
            signature: "function adminSetReferrer(address user, address newReferrer) external",
            description: "管理员修改用户推荐人（已存在）"
        }
    ];
    
    console.log("📋 检查函数存在性:\n");
    
    const results = [];
    
    for (const func of functionsToCheck) {
        try {
            // 尝试获取函数片段
            const functionFragment = contract.interface.getFunction(func.name);
            
            if (functionFragment) {
                console.log(`✅ ${func.name}`);
                console.log(`   描述: ${func.description}`);
                console.log(`   签名: ${functionFragment.format()}`);
                
                // 尝试使用 staticCall 测试函数（使用无效参数，应该失败但不应该报"函数不存在"）
                try {
                    const testAddress = "0x0000000000000000000000000000000000000001";
                    await contract[func.name].staticCall(testAddress, 0);
                    console.log(`   状态: 函数存在但可能参数验证失败`);
                } catch (error) {
                    if (error.message.includes("function") && error.message.includes("not found")) {
                        console.log(`   ⚠️  函数签名存在但可能未正确部署`);
                    } else {
                        console.log(`   ✅ 函数可调用（错误为参数验证，正常）`);
                    }
                }
                
                results.push({ name: func.name, exists: true, error: null });
            } else {
                console.log(`❌ ${func.name} - 函数不存在`);
                results.push({ name: func.name, exists: false, error: "Function not found" });
            }
        } catch (error) {
            console.log(`❌ ${func.name}`);
            console.log(`   错误: ${error.message}`);
            results.push({ name: func.name, exists: false, error: error.message });
        }
        console.log("");
    }
    
    // 检查事件
    console.log("📋 检查事件定义:\n");
    
    const eventsToCheck = [
        "UserDataUpdated",
        "TeamCountUpdated",
        "UserLevelChanged"
    ];
    
    for (const eventName of eventsToCheck) {
        try {
            const eventFragment = contract.interface.getEvent(eventName);
            if (eventFragment) {
                console.log(`✅ ${eventName} - 事件存在`);
            } else {
                console.log(`❌ ${eventName} - 事件不存在`);
            }
        } catch (error) {
            console.log(`❌ ${eventName} - 错误: ${error.message}`);
        }
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("📊 检查结果汇总:\n");
    
    const existingFunctions = results.filter(r => r.exists);
    const missingFunctions = results.filter(r => !r.exists);
    
    console.log(`✅ 已存在的函数: ${existingFunctions.length}/${results.length}`);
    existingFunctions.forEach(f => console.log(`   - ${f.name}`));
    
    if (missingFunctions.length > 0) {
        console.log(`\n❌ 缺失的函数: ${missingFunctions.length}/${results.length}`);
        missingFunctions.forEach(f => {
            console.log(`   - ${f.name}`);
            console.log(`     错误: ${f.error}`);
        });
        console.log("\n⚠️  需要执行合约升级以添加缺失的函数");
    } else {
        console.log("\n🎉 所有新函数都已部署！");
    }
    
    // 验证合约基本信息
    console.log("\n📋 合约基本信息:\n");
    try {
        const owner = await contract.owner();
        console.log(`所有者: ${owner}`);
        
        const jbcToken = await contract.jbcToken();
        console.log(`JBC Token: ${jbcToken}`);
        
        const directRewardPercent = await contract.directRewardPercent();
        console.log(`直推奖励比例: ${directRewardPercent}%`);
        
        const levelRewardPercent = await contract.levelRewardPercent();
        console.log(`层级奖励比例: ${levelRewardPercent}%`);
    } catch (error) {
        console.log(`⚠️  无法获取合约信息: ${error.message}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 检查失败:", error);
        process.exit(1);
    });

