const { ethers } = require("hardhat");

// 配置
const OWNER_PRIVATE_KEY = "0x13bc1e87a912bbf40629057c816807ea2939ca8f133695ddf64cebe49a442373";
const USER_ADDRESS = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

async function main() {
    console.log("🧪 测试管理员修改用户团队大小功能 (使用 Hardhat)\n");
    console.log("=".repeat(80));
    
    // 使用 Hardhat 的 signer
    const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, ethers.provider);
    console.log("👤 钱包地址:", wallet.address);
    const balance = await ethers.provider.getBalance(wallet.address);
    console.log("💰 余额:", ethers.formatEther(balance), "MC");
    
    // 获取合约实例
    const ContractFactory = await ethers.getContractFactory("JinbaoProtocolV4");
    const protocolContract = ContractFactory.attach(PROTOCOL_ADDRESS).connect(wallet);
    
    // 验证权限
    console.log("\n🔐 验证权限...");
    const contractOwner = await protocolContract.owner();
    console.log("合约所有者:", contractOwner);
    
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error("❌ 错误: 当前钱包不是合约所有者");
        return;
    }
    console.log("✅ 权限验证通过");
    
    // 获取用户当前信息
    console.log("\n📊 获取用户当前信息...");
    const userInfo = await protocolContract.userInfo(USER_ADDRESS);
    const currentTeamCount = Number(userInfo.teamCount);
    const currentLevel = await protocolContract.getUserLevel(USER_ADDRESS);
    
    console.log("\n当前数据:");
    console.log("  团队人数:", currentTeamCount);
    console.log("  用户等级: V" + currentLevel.level, `(${currentLevel.percent}%)`);
    
    // 设置新的团队大小
    const args = process.argv.slice(2);
    let newTeamCount;
    if (args.length > 0 && !isNaN(parseInt(args[0]))) {
        newTeamCount = parseInt(args[0]);
    } else {
        newTeamCount = currentTeamCount + 10;
    }
    
    console.log("\n🎯 准备修改团队大小:");
    console.log("  当前值:", currentTeamCount);
    console.log("  新值:", newTeamCount);
    
    if (newTeamCount === currentTeamCount) {
        console.log("\n⚠️  新值与当前值相同，无需修改");
        return;
    }
    
    console.log("\n🚀 执行修改...");
    try {
        // 使用 staticCall 先测试（这会给出 revert 原因）
        console.log("🔍 使用 staticCall 测试...");
        try {
            await protocolContract.adminSetTeamCount.staticCall(USER_ADDRESS, newTeamCount);
            console.log("✅ staticCall 成功，可以执行");
        } catch (error) {
            console.error("❌ staticCall 失败:");
            console.error("   错误信息:", error.message);
            if (error.reason) {
                console.error("   原因:", error.reason);
            }
            if (error.data) {
                console.error("   数据:", error.data);
            }
            // 尝试解析 revert 原因
            try {
                const decoded = protocolContract.interface.parseError(error.data);
                console.error("   解析的错误:", decoded);
            } catch (e) {
                // 忽略解析错误
            }
            throw error;
        }
        
        // 发送交易
        console.log("📤 发送交易...");
        const tx = await protocolContract.adminSetTeamCount(USER_ADDRESS, newTeamCount, {
            gasLimit: 200000
        });
        console.log("✅ 交易已发送!");
        console.log("   交易哈希:", tx.hash);
        
        // 等待确认
        const receipt = await tx.wait();
        console.log("\n✅ 交易已确认!");
        console.log("   区块号:", receipt.blockNumber);
        console.log("   Gas 使用:", receipt.gasUsed.toString());
        
        // 验证结果
        const updatedUserInfo = await protocolContract.userInfo(USER_ADDRESS);
        const updatedLevel = await protocolContract.getUserLevel(USER_ADDRESS);
        
        console.log("\n更新后的数据:");
        console.log("  团队人数:", Number(updatedUserInfo.teamCount));
        console.log("  用户等级: V" + updatedLevel.level, `(${updatedLevel.percent}%)`);
        
        console.log("\n✅ 修改成功!");
        
    } catch (error) {
        console.error("\n❌ 错误:", error.message);
        if (error.reason) {
            console.error("原因:", error.reason);
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


// 配置
const OWNER_PRIVATE_KEY = "0x13bc1e87a912bbf40629057c816807ea2939ca8f133695ddf64cebe49a442373";
const USER_ADDRESS = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

async function main() {
    console.log("🧪 测试管理员修改用户团队大小功能 (使用 Hardhat)\n");
    console.log("=".repeat(80));
    
    // 使用 Hardhat 的 signer
    const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, ethers.provider);
    console.log("👤 钱包地址:", wallet.address);
    const balance = await ethers.provider.getBalance(wallet.address);
    console.log("💰 余额:", ethers.formatEther(balance), "MC");
    
    // 获取合约实例
    const ContractFactory = await ethers.getContractFactory("JinbaoProtocolV4");
    const protocolContract = ContractFactory.attach(PROTOCOL_ADDRESS).connect(wallet);
    
    // 验证权限
    console.log("\n🔐 验证权限...");
    const contractOwner = await protocolContract.owner();
    console.log("合约所有者:", contractOwner);
    
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error("❌ 错误: 当前钱包不是合约所有者");
        return;
    }
    console.log("✅ 权限验证通过");
    
    // 获取用户当前信息
    console.log("\n📊 获取用户当前信息...");
    const userInfo = await protocolContract.userInfo(USER_ADDRESS);
    const currentTeamCount = Number(userInfo.teamCount);
    const currentLevel = await protocolContract.getUserLevel(USER_ADDRESS);
    
    console.log("\n当前数据:");
    console.log("  团队人数:", currentTeamCount);
    console.log("  用户等级: V" + currentLevel.level, `(${currentLevel.percent}%)`);
    
    // 设置新的团队大小
    const args = process.argv.slice(2);
    let newTeamCount;
    if (args.length > 0 && !isNaN(parseInt(args[0]))) {
        newTeamCount = parseInt(args[0]);
    } else {
        newTeamCount = currentTeamCount + 10;
    }
    
    console.log("\n🎯 准备修改团队大小:");
    console.log("  当前值:", currentTeamCount);
    console.log("  新值:", newTeamCount);
    
    if (newTeamCount === currentTeamCount) {
        console.log("\n⚠️  新值与当前值相同，无需修改");
        return;
    }
    
    console.log("\n🚀 执行修改...");
    try {
        // 使用 staticCall 先测试（这会给出 revert 原因）
        console.log("🔍 使用 staticCall 测试...");
        try {
            await protocolContract.adminSetTeamCount.staticCall(USER_ADDRESS, newTeamCount);
            console.log("✅ staticCall 成功，可以执行");
        } catch (error) {
            console.error("❌ staticCall 失败:");
            console.error("   错误信息:", error.message);
            if (error.reason) {
                console.error("   原因:", error.reason);
            }
            if (error.data) {
                console.error("   数据:", error.data);
            }
            // 尝试解析 revert 原因
            try {
                const decoded = protocolContract.interface.parseError(error.data);
                console.error("   解析的错误:", decoded);
            } catch (e) {
                // 忽略解析错误
            }
            throw error;
        }
        
        // 发送交易
        console.log("📤 发送交易...");
        const tx = await protocolContract.adminSetTeamCount(USER_ADDRESS, newTeamCount, {
            gasLimit: 200000
        });
        console.log("✅ 交易已发送!");
        console.log("   交易哈希:", tx.hash);
        
        // 等待确认
        const receipt = await tx.wait();
        console.log("\n✅ 交易已确认!");
        console.log("   区块号:", receipt.blockNumber);
        console.log("   Gas 使用:", receipt.gasUsed.toString());
        
        // 验证结果
        const updatedUserInfo = await protocolContract.userInfo(USER_ADDRESS);
        const updatedLevel = await protocolContract.getUserLevel(USER_ADDRESS);
        
        console.log("\n更新后的数据:");
        console.log("  团队人数:", Number(updatedUserInfo.teamCount));
        console.log("  用户等级: V" + updatedLevel.level, `(${updatedLevel.percent}%)`);
        
        console.log("\n✅ 修改成功!");
        
    } catch (error) {
        console.error("\n❌ 错误:", error.message);
        if (error.reason) {
            console.error("原因:", error.reason);
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

