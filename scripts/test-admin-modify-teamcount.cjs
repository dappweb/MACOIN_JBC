const { ethers } = require("ethers");

// 配置
const OWNER_PRIVATE_KEY = "0x13bc1e87a912bbf40629057c816807ea2939ca8f133695ddf64cebe49a442373";
const USER_ADDRESS = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";

// 合约 ABI (最小化，只包含需要的函数)
const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "event TeamCountUpdated(address indexed user, uint256 oldCount, uint256 newCount)",
    "event UserLevelChanged(address indexed user, uint256 oldLevel, uint256 newLevel, uint256 teamCount)"
];

async function main() {
    console.log("🧪 测试管理员修改用户团队大小功能\n");
    console.log("=".repeat(80));
    
    // 设置 provider 和 wallet
    console.log("\n📡 连接到 MC Chain...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    
    console.log("👤 钱包地址:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 余额:", ethers.formatEther(balance), "MC");
    
    // 创建合约实例
    const protocolContract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
    
    // 验证权限
    console.log("\n🔐 验证权限...");
    const contractOwner = await protocolContract.owner();
    console.log("合约所有者:", contractOwner);
    
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error("❌ 错误: 当前钱包不是合约所有者");
        console.error(`   合约所有者: ${contractOwner}`);
        console.error(`   当前钱包: ${wallet.address}`);
        return;
    }
    console.log("✅ 权限验证通过");
    
    // 获取用户当前信息
    console.log("\n📊 获取用户当前信息...");
    console.log("用户地址:", USER_ADDRESS);
    
    const userInfo = await protocolContract.userInfo(USER_ADDRESS);
    const currentTeamCount = Number(userInfo.teamCount);
    const currentLevel = await protocolContract.getUserLevel(USER_ADDRESS);
    
    console.log("\n当前数据:");
    console.log("  团队人数:", currentTeamCount);
    console.log("  用户等级: V" + currentLevel.level, `(${currentLevel.percent}%)`);
    console.log("  活跃直推数:", Number(userInfo.activeDirects));
    console.log("  总收益:", ethers.formatEther(userInfo.totalRevenue), "MC");
    
    // 询问新的团队大小（这里设置为当前值 + 10 作为测试）
    // 或者从命令行参数获取
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
    console.log("  变化:", newTeamCount - currentTeamCount);
    
    if (newTeamCount === currentTeamCount) {
        console.log("\n⚠️  新值与当前值相同，无需修改");
        return;
    }
    
    // 计算新等级
    const newLevel = await protocolContract.getUserLevel.staticCall(USER_ADDRESS);
    // 注意：这里我们需要手动计算，因为 getUserLevel 是基于当前 teamCount 的
    // 我们可以通过调用 calculateLevel 函数（如果存在）或直接调用合约
    
    console.log("\n🚀 执行修改...");
    try {
        // 检查函数是否存在
        console.log("🔍 检查函数是否存在...");
        const functionFragment = protocolContract.interface.getFunction("adminSetTeamCount");
        if (!functionFragment) {
            console.error("❌ 错误: adminSetTeamCount 函数不存在于合约 ABI 中");
            return;
        }
        console.log("✅ 函数存在:", functionFragment.format());
        
        // 编码函数调用数据
        console.log("📤 编码函数调用数据...");
        const functionData = protocolContract.interface.encodeFunctionData("adminSetTeamCount", [USER_ADDRESS, newTeamCount]);
        console.log("   函数数据:", functionData);
        console.log("   数据长度:", functionData.length, "字符");
        
        // 尝试直接调用（不使用 estimateGas，因为可能会失败）
        console.log("📤 发送交易（跳过 Gas 估算）...");
        const tx = await protocolContract.adminSetTeamCount(USER_ADDRESS, newTeamCount, {
            gasLimit: 200000 // 设置一个合理的 gas limit
        });
        console.log("   交易对象:", {
            to: tx.to,
            from: tx.from,
            data: tx.data,
            value: tx.value?.toString()
        });
        console.log("✅ 交易已发送!");
        console.log("   交易哈希:", tx.hash);
        console.log("   等待确认...");
        
        // 等待交易确认
        const receipt = await tx.wait();
        console.log("\n✅ 交易已确认!");
        console.log("   区块号:", receipt.blockNumber);
        console.log("   Gas 使用:", receipt.gasUsed.toString());
        
        // 检查事件
        console.log("\n📋 检查事件...");
        const teamCountUpdatedEvents = receipt.logs.filter(log => {
            try {
                const parsed = protocolContract.interface.parseLog(log);
                return parsed && parsed.name === "TeamCountUpdated";
            } catch (e) {
                return false;
            }
        });
        
        const levelChangedEvents = receipt.logs.filter(log => {
            try {
                const parsed = protocolContract.interface.parseLog(log);
                return parsed && parsed.name === "UserLevelChanged";
            } catch (e) {
                return false;
            }
        });
        
        if (teamCountUpdatedEvents.length > 0) {
            const event = protocolContract.interface.parseLog(teamCountUpdatedEvents[0]);
            console.log("✅ TeamCountUpdated 事件:");
            console.log("   用户:", event.args.user);
            console.log("   旧值:", event.args.oldCount.toString());
            console.log("   新值:", event.args.newCount.toString());
        }
        
        if (levelChangedEvents.length > 0) {
            const event = protocolContract.interface.parseLog(levelChangedEvents[0]);
            console.log("✅ UserLevelChanged 事件:");
            console.log("   用户:", event.args.user);
            console.log("   旧等级: V" + event.args.oldLevel.toString());
            console.log("   新等级: V" + event.args.newLevel.toString());
            console.log("   团队人数:", event.args.teamCount.toString());
        }
        
        // 验证修改结果
        console.log("\n🔍 验证修改结果...");
        const updatedUserInfo = await protocolContract.userInfo(USER_ADDRESS);
        const updatedLevel = await protocolContract.getUserLevel(USER_ADDRESS);
        
        console.log("\n更新后的数据:");
        console.log("  团队人数:", Number(updatedUserInfo.teamCount));
        console.log("  用户等级: V" + updatedLevel.level, `(${updatedLevel.percent}%)`);
        
        if (Number(updatedUserInfo.teamCount) === newTeamCount) {
            console.log("\n✅ 修改成功! 团队大小已更新为", newTeamCount);
        } else {
            console.log("\n⚠️  警告: 团队大小可能未正确更新");
            console.log("   期望值:", newTeamCount);
            console.log("   实际值:", Number(updatedUserInfo.teamCount));
        }
        
        console.log("\n" + "=".repeat(80));
        console.log("🎉 测试完成!");
        
    } catch (error) {
        console.error("\n❌ 错误:", error.message);
        if (error.data) {
            console.error("错误数据:", error.data);
        }
        if (error.reason) {
            console.error("错误原因:", error.reason);
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
const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";

// 合约 ABI (最小化，只包含需要的函数)
const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "event TeamCountUpdated(address indexed user, uint256 oldCount, uint256 newCount)",
    "event UserLevelChanged(address indexed user, uint256 oldLevel, uint256 newLevel, uint256 teamCount)"
];

async function main() {
    console.log("🧪 测试管理员修改用户团队大小功能\n");
    console.log("=".repeat(80));
    
    // 设置 provider 和 wallet
    console.log("\n📡 连接到 MC Chain...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    
    console.log("👤 钱包地址:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 余额:", ethers.formatEther(balance), "MC");
    
    // 创建合约实例
    const protocolContract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
    
    // 验证权限
    console.log("\n🔐 验证权限...");
    const contractOwner = await protocolContract.owner();
    console.log("合约所有者:", contractOwner);
    
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error("❌ 错误: 当前钱包不是合约所有者");
        console.error(`   合约所有者: ${contractOwner}`);
        console.error(`   当前钱包: ${wallet.address}`);
        return;
    }
    console.log("✅ 权限验证通过");
    
    // 获取用户当前信息
    console.log("\n📊 获取用户当前信息...");
    console.log("用户地址:", USER_ADDRESS);
    
    const userInfo = await protocolContract.userInfo(USER_ADDRESS);
    const currentTeamCount = Number(userInfo.teamCount);
    const currentLevel = await protocolContract.getUserLevel(USER_ADDRESS);
    
    console.log("\n当前数据:");
    console.log("  团队人数:", currentTeamCount);
    console.log("  用户等级: V" + currentLevel.level, `(${currentLevel.percent}%)`);
    console.log("  活跃直推数:", Number(userInfo.activeDirects));
    console.log("  总收益:", ethers.formatEther(userInfo.totalRevenue), "MC");
    
    // 询问新的团队大小（这里设置为当前值 + 10 作为测试）
    // 或者从命令行参数获取
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
    console.log("  变化:", newTeamCount - currentTeamCount);
    
    if (newTeamCount === currentTeamCount) {
        console.log("\n⚠️  新值与当前值相同，无需修改");
        return;
    }
    
    // 计算新等级
    const newLevel = await protocolContract.getUserLevel.staticCall(USER_ADDRESS);
    // 注意：这里我们需要手动计算，因为 getUserLevel 是基于当前 teamCount 的
    // 我们可以通过调用 calculateLevel 函数（如果存在）或直接调用合约
    
    console.log("\n🚀 执行修改...");
    try {
        // 检查函数是否存在
        console.log("🔍 检查函数是否存在...");
        const functionFragment = protocolContract.interface.getFunction("adminSetTeamCount");
        if (!functionFragment) {
            console.error("❌ 错误: adminSetTeamCount 函数不存在于合约 ABI 中");
            return;
        }
        console.log("✅ 函数存在:", functionFragment.format());
        
        // 编码函数调用数据
        console.log("📤 编码函数调用数据...");
        const functionData = protocolContract.interface.encodeFunctionData("adminSetTeamCount", [USER_ADDRESS, newTeamCount]);
        console.log("   函数数据:", functionData);
        console.log("   数据长度:", functionData.length, "字符");
        
        // 尝试直接调用（不使用 estimateGas，因为可能会失败）
        console.log("📤 发送交易（跳过 Gas 估算）...");
        const tx = await protocolContract.adminSetTeamCount(USER_ADDRESS, newTeamCount, {
            gasLimit: 200000 // 设置一个合理的 gas limit
        });
        console.log("   交易对象:", {
            to: tx.to,
            from: tx.from,
            data: tx.data,
            value: tx.value?.toString()
        });
        console.log("✅ 交易已发送!");
        console.log("   交易哈希:", tx.hash);
        console.log("   等待确认...");
        
        // 等待交易确认
        const receipt = await tx.wait();
        console.log("\n✅ 交易已确认!");
        console.log("   区块号:", receipt.blockNumber);
        console.log("   Gas 使用:", receipt.gasUsed.toString());
        
        // 检查事件
        console.log("\n📋 检查事件...");
        const teamCountUpdatedEvents = receipt.logs.filter(log => {
            try {
                const parsed = protocolContract.interface.parseLog(log);
                return parsed && parsed.name === "TeamCountUpdated";
            } catch (e) {
                return false;
            }
        });
        
        const levelChangedEvents = receipt.logs.filter(log => {
            try {
                const parsed = protocolContract.interface.parseLog(log);
                return parsed && parsed.name === "UserLevelChanged";
            } catch (e) {
                return false;
            }
        });
        
        if (teamCountUpdatedEvents.length > 0) {
            const event = protocolContract.interface.parseLog(teamCountUpdatedEvents[0]);
            console.log("✅ TeamCountUpdated 事件:");
            console.log("   用户:", event.args.user);
            console.log("   旧值:", event.args.oldCount.toString());
            console.log("   新值:", event.args.newCount.toString());
        }
        
        if (levelChangedEvents.length > 0) {
            const event = protocolContract.interface.parseLog(levelChangedEvents[0]);
            console.log("✅ UserLevelChanged 事件:");
            console.log("   用户:", event.args.user);
            console.log("   旧等级: V" + event.args.oldLevel.toString());
            console.log("   新等级: V" + event.args.newLevel.toString());
            console.log("   团队人数:", event.args.teamCount.toString());
        }
        
        // 验证修改结果
        console.log("\n🔍 验证修改结果...");
        const updatedUserInfo = await protocolContract.userInfo(USER_ADDRESS);
        const updatedLevel = await protocolContract.getUserLevel(USER_ADDRESS);
        
        console.log("\n更新后的数据:");
        console.log("  团队人数:", Number(updatedUserInfo.teamCount));
        console.log("  用户等级: V" + updatedLevel.level, `(${updatedLevel.percent}%)`);
        
        if (Number(updatedUserInfo.teamCount) === newTeamCount) {
            console.log("\n✅ 修改成功! 团队大小已更新为", newTeamCount);
        } else {
            console.log("\n⚠️  警告: 团队大小可能未正确更新");
            console.log("   期望值:", newTeamCount);
            console.log("   实际值:", Number(updatedUserInfo.teamCount));
        }
        
        console.log("\n" + "=".repeat(80));
        console.log("🎉 测试完成!");
        
    } catch (error) {
        console.error("\n❌ 错误:", error.message);
        if (error.data) {
            console.error("错误数据:", error.data);
        }
        if (error.reason) {
            console.error("错误原因:", error.reason);
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

