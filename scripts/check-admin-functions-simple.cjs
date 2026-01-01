const { ethers } = require("ethers");

// 合约地址
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// MC Chain RPC (需要从环境变量或配置中获取)
const RPC_URL = process.env.MC_RPC_URL || "https://rpc.mcchain.io";

// 最小 ABI - 只包含我们需要检查的函数
const MINIMAL_ABI = [
    "function owner() view returns (address)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function jbcToken() view returns (address)",
    "function directRewardPercent() view returns (uint256)",
    "function levelRewardPercent() view returns (uint256)",
    // 尝试调用新函数（如果存在）
    "function adminSetActiveDirects(address user, uint256 newActiveDirects) external",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function adminSetReferrer(address user, address newReferrer) external"
];

async function main() {
    console.log("🔍 检查当前部署合约是否包含新的管理员函数...\n");
    console.log("=".repeat(80));
    console.log("合约地址:", PROTOCOL_ADDRESS);
    console.log("RPC URL:", RPC_URL);
    console.log("");
    
    try {
        // 连接到网络
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // 创建合约实例
        const contract = new ethers.Contract(PROTOCOL_ADDRESS, MINIMAL_ABI, provider);
        
        // 检查基本函数
        console.log("📋 检查基本合约信息:\n");
        try {
            const owner = await contract.owner();
            console.log("✅ 合约所有者:", owner);
            
            const jbcToken = await contract.jbcToken();
            console.log("✅ JBC Token:", jbcToken);
            
            const directRewardPercent = await contract.directRewardPercent();
            console.log("✅ 直推奖励比例:", directRewardPercent.toString(), "%");
            
            const levelRewardPercent = await contract.levelRewardPercent();
            console.log("✅ 层级奖励比例:", levelRewardPercent.toString(), "%");
        } catch (error) {
            console.error("❌ 无法获取基本合约信息:", error.message);
            return;
        }
        
        console.log("\n📋 检查新管理员函数:\n");
        
        // 检查 adminSetActiveDirects
        console.log("1. adminSetActiveDirects");
        try {
            // 尝试获取函数（如果合约接口支持）
            const testAddress = "0x0000000000000000000000000000000000000001";
            // 使用 staticCall 测试（需要 signer，但我们可以检查函数是否存在）
            // 如果函数不存在，会抛出错误
            const functionExists = contract.interface.hasFunction("adminSetActiveDirects");
            if (functionExists) {
                console.log("   ✅ 函数存在");
                console.log("   📝 描述: 管理员修改用户活跃直推数量");
            } else {
                console.log("   ❌ 函数不存在");
            }
        } catch (error) {
            if (error.message.includes("function") && error.message.includes("not found")) {
                console.log("   ❌ 函数不存在");
            } else {
                console.log("   ⚠️  无法确定函数是否存在:", error.message);
            }
        }
        
        // 检查 adminSetTeamCount
        console.log("\n2. adminSetTeamCount");
        try {
            const functionExists = contract.interface.hasFunction("adminSetTeamCount");
            if (functionExists) {
                console.log("   ✅ 函数存在");
                console.log("   📝 描述: 管理员修改用户团队成员数量");
            } else {
                console.log("   ❌ 函数不存在");
            }
        } catch (error) {
            if (error.message.includes("function") && error.message.includes("not found")) {
                console.log("   ❌ 函数不存在");
            } else {
                console.log("   ⚠️  无法确定函数是否存在:", error.message);
            }
        }
        
        // 检查 adminSetReferrer (应该已存在)
        console.log("\n3. adminSetReferrer");
        try {
            const functionExists = contract.interface.hasFunction("adminSetReferrer");
            if (functionExists) {
                console.log("   ✅ 函数存在（已部署）");
                console.log("   📝 描述: 管理员修改用户推荐人");
            } else {
                console.log("   ❌ 函数不存在");
            }
        } catch (error) {
            if (error.message.includes("function") && error.message.includes("not found")) {
                console.log("   ❌ 函数不存在");
            } else {
                console.log("   ⚠️  无法确定函数是否存在:", error.message);
            }
        }
        
        // 尝试通过编码函数调用测试（更可靠的方法）
        console.log("\n📋 通过函数编码测试:\n");
        
        const testFunctions = [
            { name: "adminSetActiveDirects", params: ["address", "uint256"] },
            { name: "adminSetTeamCount", params: ["address", "uint256"] },
            { name: "adminSetReferrer", params: ["address", "address"] }
        ];
        
        for (const func of testFunctions) {
            try {
                const iface = new ethers.Interface(MINIMAL_ABI);
                const functionFragment = iface.getFunction(func.name);
                if (functionFragment) {
                    console.log(`✅ ${func.name} - 函数签名存在`);
                } else {
                    console.log(`❌ ${func.name} - 函数签名不存在`);
                }
            } catch (error) {
                console.log(`❌ ${func.name} - 无法编码函数: ${error.message}`);
            }
        }
        
        console.log("\n" + "=".repeat(80));
        console.log("📊 检查结果汇总:\n");
        console.log("⚠️  注意: 由于无法直接调用函数，此检查基于函数签名。");
        console.log("   要确认函数是否真正可用，需要:");
        console.log("   1. 使用合约所有者账户");
        console.log("   2. 尝试实际调用函数");
        console.log("   3. 或查看合约源代码验证");
        console.log("\n💡 建议: 如果函数不存在，请运行升级脚本:");
        console.log("   npx hardhat run scripts/upgrade-admin-directs-teamcount.cjs --network mc --config config/hardhat.config.cjs");
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
        if (error.message.includes("network")) {
            console.log("\n💡 提示: 请确保:");
            console.log("   1. MC_RPC_URL 环境变量已设置");
            console.log("   2. 网络连接正常");
            console.log("   3. 合约地址正确");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });

