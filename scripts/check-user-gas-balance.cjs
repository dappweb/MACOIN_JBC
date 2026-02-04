const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function swapJBCToMC(uint256 jbcAmount) external",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
];

async function checkUserGasBalance(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 检查用户 Gas 余额和兑换条件\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 1. 获取用户 MC 余额（原生代币）
        const mcBalance = await provider.getBalance(userAddress);
        const mcBalanceFormatted = ethers.formatEther(mcBalance);
        console.log("💰 用户 MC 余额（原生代币）:");
        console.log(`  ${mcBalanceFormatted} MC`);
        console.log(`  原始值: ${mcBalance.toString()}\n`);

        // 2. 获取 JBC 余额
        const jbcTokenAddress = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da"; // 正确的JBC合约地址
        const jbcABI = ["function balanceOf(address) view returns (uint256)"];
        const jbcContract = new ethers.Contract(jbcTokenAddress, jbcABI, provider);
        const jbcBalance = await jbcContract.balanceOf(userAddress);
        const jbcBalanceFormatted = ethers.formatEther(jbcBalance);
        console.log("🪙 用户 JBC 余额:");
        console.log(`  ${jbcBalanceFormatted} JBC`);
        console.log(`  原始值: ${jbcBalance.toString()}\n`);

        // 3. 获取当前 Gas 价格
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || 0n;
        console.log("⛽ Gas 价格信息:");
        console.log(`  Gas Price: ${gasPrice.toString()} wei`);
        console.log(`  Gas Price: ${ethers.formatEther(gasPrice)} MC`);
        if (feeData.maxFeePerGas) {
            console.log(`  Max Fee Per Gas: ${feeData.maxFeePerGas.toString()} wei`);
        }
        if (feeData.maxPriorityFeePerGas) {
            console.log(`  Max Priority Fee: ${feeData.maxPriorityFeePerGas.toString()} wei`);
        }
        console.log("");

        // 4. 估算不同 JBC 数量的 Gas 费用
        console.log("📊 估算 JBC 兑换 MC 的 Gas 费用:");
        console.log("-".repeat(80));
        
        const testAmounts = [
            ethers.parseEther("1"),
            ethers.parseEther("10"),
            ethers.parseEther("100"),
            ethers.parseEther("1000"),
            jbcBalance > 0n ? jbcBalance : ethers.parseEther("1")
        ];

        for (const jbcAmount of testAmounts) {
            if (jbcAmount > jbcBalance) continue;
            
            try {
                const gasEstimate = await protocol.swapJBCToMC.estimateGas(jbcAmount);
                const gasCost = gasEstimate * gasPrice;
                const gasCostFormatted = ethers.formatEther(gasCost);
                
                console.log(`  JBC 数量: ${ethers.formatEther(jbcAmount)} JBC`);
                console.log(`    Gas 估算: ${gasEstimate.toString()}`);
                console.log(`    Gas 费用: ${gasCostFormatted} MC`);
                console.log(`    需要 MC 余额: ${gasCostFormatted} MC (仅Gas)`);
                console.log(`    当前 MC 余额: ${mcBalanceFormatted} MC`);
                
                // 预留10%缓冲
                const gasCostWithBuffer = (gasCost * 110n) / 100n;
                const gasCostWithBufferFormatted = ethers.formatEther(gasCostWithBuffer);
                
                if (mcBalance >= gasCostWithBuffer) {
                    console.log(`    ✅ 余额充足（含10%缓冲: ${gasCostWithBufferFormatted} MC）`);
                } else {
                    const shortfall = gasCostWithBuffer - mcBalance;
                    console.log(`    ❌ 余额不足，缺少: ${ethers.formatEther(shortfall)} MC`);
                }
                console.log("");
            } catch (error) {
                console.log(`  JBC 数量: ${ethers.formatEther(jbcAmount)} JBC`);
                console.log(`    ⚠️  Gas 估算失败: ${error.message}`);
                console.log("");
            }
        }

        // 5. 检查最小 Gas 储备
        const minGasReserve = ethers.parseEther("0.01");
        console.log("📋 最小 Gas 储备检查:");
        console.log(`  最小储备要求: ${ethers.formatEther(minGasReserve)} MC`);
        console.log(`  当前余额: ${mcBalanceFormatted} MC`);
        if (mcBalance >= minGasReserve) {
            console.log(`  ✅ 满足最小 Gas 储备要求`);
        } else {
            console.log(`  ❌ 不满足最小 Gas 储备要求`);
            const shortfall = minGasReserve - mcBalance;
            console.log(`  缺少: ${ethers.formatEther(shortfall)} MC`);
        }
        console.log("");

        // 6. 获取池子信息
        const poolMC = await protocol.swapReserveMC();
        const poolJBC = await protocol.swapReserveJBC();
        console.log("💧 交换池信息:");
        console.log(`  MC 储备: ${ethers.formatEther(poolMC)} MC`);
        console.log(`  JBC 储备: ${ethers.formatEther(poolJBC)} JBC`);
        console.log("");

        // 7. 总结
        console.log("=".repeat(80));
        console.log("📊 总结:");
        console.log("=".repeat(80));
        console.log(`  MC 余额: ${mcBalanceFormatted} MC`);
        console.log(`  JBC 余额: ${jbcBalanceFormatted} JBC`);
        
        if (mcBalance < minGasReserve) {
            console.log(`  ⚠️  警告: MC 余额低于最小 Gas 储备要求（0.01 MC）`);
            console.log(`  建议: 至少充值 ${ethers.formatEther(minGasReserve - mcBalance)} MC 用于支付 Gas 费用`);
        } else {
            console.log(`  ✅ MC 余额满足最小 Gas 储备要求`);
        }
        
        if (jbcBalance === 0n) {
            console.log(`  ⚠️  警告: JBC 余额为 0，无法进行兑换`);
        }
        
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 查询失败:", error);
        process.exit(1);
    }
}

// 运行脚本
const userAddress = process.argv[2] || "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
checkUserGasBalance(userAddress).catch(console.error);
