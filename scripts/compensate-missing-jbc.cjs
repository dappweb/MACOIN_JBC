const { ethers } = require("ethers");
require('dotenv').config();

// MC Chain 配置
const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const JBC_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";

// JBC Token ABI
const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
];

// 用户地址和应补偿的 JBC 数量
const COMPENSATION_DATA = {
    "0x178A565B9c44e09EC96F6e52f7314110980c8C80": {
        missingJBC: ethers.parseEther("37"), // 37 JBC
        reason: "在区块 2040720 购买门票时，协议合约 JBC 余额为 0，导致推荐奖励中的 JBC 部分未发放"
    }
};

// 是否执行实际转账（设置为 false 进行干运行）
const DRY_RUN = process.env.DRY_RUN !== "false";

async function compensateMissingJBC() {
    console.log("🔧 JBC 奖励补偿工具\n");
    console.log("=".repeat(60));
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会执行实际转账\n");
    } else {
        console.log("✅ 实际执行模式 - 将执行转账\n");
    }
    
    console.log("=".repeat(60) + "\n");

    // 检查私钥
    if (!process.env.PRIVATE_KEY && !DRY_RUN) {
        console.error("❌ 错误: 需要设置 PRIVATE_KEY 环境变量");
        console.log("\n使用方法:");
        console.log("1. 在 .env 文件中设置 PRIVATE_KEY=你的私钥");
        console.log("2. 确保该私钥对应的地址有权限操作协议合约或 JBC 代币");
        console.log("3. 运行: node scripts/compensate-missing-jbc.cjs");
        process.exit(1);
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const jbcToken = new ethers.Contract(JBC_ADDRESS, JBC_ABI, provider);

        // 获取签名者（如果需要实际转账）
        let signer = null;
        if (!DRY_RUN && process.env.PRIVATE_KEY) {
            signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            console.log(`📝 使用账户: ${signer.address}\n`);
        }

        // 检查协议合约 JBC 余额
        console.log("💰 检查协议合约 JBC 余额...");
        const protocolBalance = await jbcToken.balanceOf(PROTOCOL_ADDRESS);
        console.log(`   协议合约 JBC 余额: ${ethers.formatEther(protocolBalance)} JBC\n`);

        // 处理每个需要补偿的用户
        let totalCompensation = 0n;
        const compensationList = [];

        for (const [userAddress, data] of Object.entries(COMPENSATION_DATA)) {
            totalCompensation += data.missingJBC;
            compensationList.push({
                userAddress,
                missingJBC: data.missingJBC,
                reason: data.reason
            });
        }

        console.log("📋 补偿列表:");
        console.log("-".repeat(60));
        for (let i = 0; i < compensationList.length; i++) {
            const item = compensationList[i];
            console.log(`\n${i + 1}. 用户: ${item.userAddress}`);
            console.log(`   缺失 JBC: ${ethers.formatEther(item.missingJBC)} JBC`);
            console.log(`   原因: ${item.reason}`);
        }

        console.log(`\n总计需要补偿: ${ethers.formatEther(totalCompensation)} JBC\n`);

        // 检查余额是否足够
        if (protocolBalance < totalCompensation) {
            console.error(`❌ 错误: 协议合约 JBC 余额不足！`);
            console.error(`   需要: ${ethers.formatEther(totalCompensation)} JBC`);
            console.error(`   可用: ${ethers.formatEther(protocolBalance)} JBC`);
            console.error(`   缺少: ${ethers.formatEther(totalCompensation - protocolBalance)} JBC`);
            process.exit(1);
        }

        console.log("✅ 协议合约余额充足\n");

        // 执行补偿
        if (DRY_RUN) {
            console.log("🔍 干运行 - 不会执行实际转账");
            console.log("\n如果要执行实际转账，请:");
            console.log("1. 设置环境变量 DRY_RUN=false");
            console.log("2. 确保 PRIVATE_KEY 环境变量已设置");
            console.log("3. 确保私钥对应的地址有权限:");
            console.log("   - 如果是 JBC 代币的 owner，可以直接转账");
            console.log("   - 或者需要协议合约有补偿函数");
        } else {
            console.log("⚠️  注意: 此脚本需要协议合约有补偿函数，或者需要 JBC 代币的 owner 权限");
            console.log("\n当前实现方式:");
            console.log("1. 如果协议合约有补偿函数，使用协议合约");
            console.log("2. 如果 JBC 代币 owner 有权限，可以直接从协议合约转账");
            console.log("3. 或者需要手动通过其他方式补偿\n");

            // 这里需要根据实际情况实现
            // 选项 1: 如果协议合约有补偿函数
            // const protocolContract = new ethers.Contract(PROTOCOL_ADDRESS, [...], signer);
            // const tx = await protocolContract.compensateMissingJBC(userAddress, missingJBC);
            
            // 选项 2: 如果 JBC owner 可以直接转账（需要协议合约地址有权限）
            // 注意: 这通常需要协议合约本身调用 transfer，或者 owner 有特殊权限
            
            console.log("💡 建议:");
            console.log("1. 检查协议合约是否有补偿函数");
            console.log("2. 如果没有，需要添加补偿函数到协议合约");
            console.log("3. 或者使用 JBC 代币的 owner 权限手动转账");
            console.log("\n补偿数据已准备好，请根据实际情况选择补偿方式。");
        }

        // 生成补偿报告
        console.log("\n" + "=".repeat(60));
        console.log("📊 补偿报告");
        console.log("=".repeat(60));
        console.log(`需要补偿的用户数: ${compensationList.length}`);
        console.log(`总补偿 JBC: ${ethers.formatEther(totalCompensation)} JBC`);
        console.log(`协议合约当前余额: ${ethers.formatEther(protocolBalance)} JBC`);
        console.log(`补偿后剩余余额: ${ethers.formatEther(protocolBalance - totalCompensation)} JBC`);
        console.log("=".repeat(60));

    } catch (error) {
        console.error("❌ 执行失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// 执行补偿
compensateMissingJBC().catch(console.error);
