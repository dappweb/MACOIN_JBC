const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const JBC_TOKEN_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da"; // 正确的JBC合约地址

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function swapJBCToMC(uint256 jbcAmount) external",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
    "function paused() view returns (bool)",
    "function swapSellTax() view returns (uint256)",
    "function MAX_PRICE_IMPACT() view returns (uint256)",
    "function MIN_LIQUIDITY() view returns (uint256)",
];

// JBC Token ABI
const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
];

async function checkSwapConditions(userAddress, jbcAmount) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const jbcContract = new ethers.Contract(JBC_TOKEN_ADDRESS, JBC_ABI, provider);

    console.log("🔍 检查 JBC 兑换 MC 的条件\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log(`JBC 数量: ${jbcAmount} JBC`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        const amount = ethers.parseEther(jbcAmount);

        // 1. 检查合约是否暂停
        try {
            const isPaused = await protocol.paused();
            console.log("⏸️  合约状态:");
            console.log(`  是否暂停: ${isPaused ? '❌ 是（合约已暂停）' : '✅ 否（合约正常运行）'}\n`);
            if (isPaused) {
                console.log("❌ 合约已暂停，无法进行兑换");
                return;
            }
        } catch (error) {
            console.log("⚠️  无法检查合约暂停状态（可能合约不支持此函数）\n");
        }

        // 2. 检查用户余额
        const jbcBalance = await jbcContract.balanceOf(userAddress);
        const mcBalance = await provider.getBalance(userAddress);
        console.log("💰 用户余额:");
        console.log(`  JBC: ${ethers.formatEther(jbcBalance)} JBC`);
        console.log(`  MC: ${ethers.formatEther(mcBalance)} MC\n`);

        if (jbcBalance < amount) {
            console.log(`❌ JBC 余额不足，需要 ${jbcAmount} JBC，当前余额 ${ethers.formatEther(jbcBalance)} JBC`);
            return;
        }

        // 3. 检查授权
        const allowance = await jbcContract.allowance(userAddress, PROTOCOL_ADDRESS);
        console.log("🔐 授权状态:");
        console.log(`  授权额度: ${ethers.formatEther(allowance)} JBC\n`);

        if (allowance < amount) {
            console.log(`❌ 授权不足，需要授权至少 ${jbcAmount} JBC`);
            return;
        }

        // 4. 检查池子流动性
        const poolMC = await protocol.swapReserveMC();
        const poolJBC = await protocol.swapReserveJBC();
        console.log("💧 交换池状态:");
        console.log(`  MC 储备: ${ethers.formatEther(poolMC)} MC`);
        console.log(`  JBC 储备: ${ethers.formatEther(poolJBC)} JBC\n`);

        // 5. 检查最小流动性
        try {
            const minLiquidity = await protocol.MIN_LIQUIDITY();
            console.log("📊 最小流动性要求:");
            console.log(`  MIN_LIQUIDITY: ${ethers.formatEther(minLiquidity)} MC/JBC\n`);

            if (poolMC < minLiquidity || poolJBC < minLiquidity) {
                console.log(`❌ 流动性不足，池子储备低于最小要求`);
                return;
            }
        } catch (error) {
            console.log("⚠️  无法检查最小流动性要求\n");
        }

        // 6. 计算税费和价格影响
        try {
            const sellTax = await protocol.swapSellTax();
            const taxPercent = Number(sellTax);
            const tax = (amount * BigInt(taxPercent)) / 100n;
            const amountToSwap = amount - tax;

            console.log("📊 税费计算:");
            console.log(`  卖出税率: ${taxPercent}%`);
            console.log(`  税费: ${ethers.formatEther(tax)} JBC`);
            console.log(`  实际交换数量: ${ethers.formatEther(amountToSwap)} JBC\n`);

            // 计算价格影响
            const priceImpact = (amountToSwap * 10000n) / poolJBC;
            const priceImpactPercent = Number(priceImpact) / 100;

            console.log("📈 价格影响:");
            console.log(`  价格影响: ${priceImpactPercent.toFixed(4)}%\n`);

            // 检查价格影响限制
            try {
                const maxPriceImpact = await protocol.MAX_PRICE_IMPACT();
                const maxPriceImpactPercent = Number(maxPriceImpact) / 100;

                console.log("⚠️  价格影响限制:");
                console.log(`  MAX_PRICE_IMPACT: ${maxPriceImpactPercent.toFixed(2)}%\n`);

                if (priceImpact > maxPriceImpact) {
                    console.log(`❌ 价格影响过大（${priceImpactPercent.toFixed(4)}% > ${maxPriceImpactPercent.toFixed(2)}%）`);
                    console.log(`  建议: 减少兑换数量`);
                    return;
                }
            } catch (error) {
                console.log("⚠️  无法检查价格影响限制\n");
            }

            // 7. 计算预期输出
            const numerator = amountToSwap * poolMC;
            const denominator = poolJBC + amountToSwap;
            const mcOutput = numerator / denominator;

            console.log("💵 预期输出:");
            console.log(`  预期获得 MC: ${ethers.formatEther(mcOutput)} MC\n`);

            // 8. 检查协议合约 MC 余额
            const protocolMcBalance = await provider.getBalance(PROTOCOL_ADDRESS);
            console.log("🏦 协议合约 MC 余额:");
            console.log(`  ${ethers.formatEther(protocolMcBalance)} MC\n`);

            if (protocolMcBalance < mcOutput) {
                console.log(`❌ 协议合约 MC 余额不足，无法支付 ${ethers.formatEther(mcOutput)} MC`);
                return;
            }

        } catch (error) {
            console.log(`⚠️  计算税费或价格影响失败: ${error.message}\n`);
        }

        // 9. 尝试估算 Gas
        console.log("⛽ Gas 费用估算:");
        try {
            const gasEstimate = await protocol.swapJBCToMC.estimateGas(amount);
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || 0n;
            const gasCost = gasEstimate * gasPrice;

            console.log(`  Gas 估算: ${gasEstimate.toString()}`);
            console.log(`  Gas 价格: ${gasPrice.toString()} wei`);
            console.log(`  Gas 费用: ${ethers.formatEther(gasCost)} MC\n`);

            if (mcBalance < gasCost) {
                console.log(`❌ MC 余额不足支付 Gas 费用`);
                console.log(`  需要: ${ethers.formatEther(gasCost)} MC`);
                console.log(`  当前: ${ethers.formatEther(mcBalance)} MC`);
                return;
            }

            console.log(`✅ Gas 费用充足\n`);
        } catch (error) {
            console.log(`❌ Gas 估算失败: ${error.message}\n`);
            console.log(`  错误详情:`, error);
        }

        // 10. 总结
        console.log("=".repeat(80));
        console.log("📊 检查总结:");
        console.log("=".repeat(80));
        console.log(`  ✅ JBC 余额充足`);
        console.log(`  ✅ 授权充足`);
        console.log(`  ✅ 池子流动性充足`);
        console.log(`  ✅ MC 余额充足（用于 Gas）`);
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 检查失败:", error);
        process.exit(1);
    }
}

// 运行脚本
const userAddress = process.argv[2] || "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
const jbcAmount = process.argv[3] || "1000";
checkSwapConditions(userAddress, jbcAmount).catch(console.error);
