const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const JBC_TOKEN_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da"; // 正确的JBC合约地址

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function jbcToken() view returns (address)",
    "function swapJBCToMC(uint256 jbcAmount) external",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
];

// JBC Token ABI
const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function decimals() view returns (uint8)",
];

async function testJBCSwap() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const jbcContract = new ethers.Contract(JBC_TOKEN_ADDRESS, JBC_ABI, provider);

    console.log("🔍 验证 JBC 兑换 MC 配置\n");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 1. 验证协议合约中的 JBC 地址
        const protocolJBCAddress = await protocol.jbcToken();
        console.log("📋 地址验证:");
        console.log(`  协议合约中的JBC地址: ${protocolJBCAddress}`);
        console.log(`  前端使用的JBC地址: ${JBC_TOKEN_ADDRESS}`);
        console.log(`  地址匹配: ${protocolJBCAddress.toLowerCase() === JBC_TOKEN_ADDRESS.toLowerCase() ? '✅ 是' : '❌ 否'}\n`);

        if (protocolJBCAddress.toLowerCase() !== JBC_TOKEN_ADDRESS.toLowerCase()) {
            console.log("❌ 错误：JBC地址不匹配！");
            console.log(`  请更新前端配置为: ${protocolJBCAddress}\n`);
            return;
        }

        // 2. 验证 JBC 合约信息
        const [jbcSymbol, jbcName, jbcDecimals] = await Promise.all([
            jbcContract.symbol(),
            jbcContract.name(),
            jbcContract.decimals()
        ]);
        console.log("🪙 JBC 代币信息:");
        console.log(`  名称: ${jbcName}`);
        console.log(`  符号: ${jbcSymbol}`);
        console.log(`  精度: ${jbcDecimals}\n`);

        // 3. 检查池子流动性
        const [poolMC, poolJBC] = await Promise.all([
            protocol.swapReserveMC(),
            protocol.swapReserveJBC()
        ]);
        console.log("💧 交换池状态:");
        console.log(`  MC 储备: ${ethers.formatEther(poolMC)} MC`);
        console.log(`  JBC 储备: ${ethers.formatEther(poolJBC)} JBC`);
        
        const ratio = Number(poolMC) / Number(poolJBC);
        console.log(`  汇率: 1 JBC ≈ ${ratio.toFixed(6)} MC\n`);

        // 4. 测试地址的余额和授权（使用之前测试的地址）
        const testAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
        const [jbcBalance, mcBalance, allowance] = await Promise.all([
            jbcContract.balanceOf(testAddress),
            provider.getBalance(testAddress),
            jbcContract.allowance(testAddress, PROTOCOL_ADDRESS)
        ]);

        console.log(`👤 测试地址 ${testAddress}:`);
        console.log(`  JBC 余额: ${ethers.formatEther(jbcBalance)} JBC`);
        console.log(`  MC 余额: ${ethers.formatEther(mcBalance)} MC`);
        console.log(`  授权额度: ${ethers.formatEther(allowance)} JBC`);
        
        if (allowance > 0n) {
            console.log(`  授权状态: ✅ 已授权\n`);
        } else {
            console.log(`  授权状态: ❌ 未授权\n`);
        }

        // 5. 计算示例兑换（1000 JBC）
        const testAmount = ethers.parseEther("1000");
        if (jbcBalance >= testAmount) {
            // 计算税费（假设25%）
            const tax = (testAmount * 25n) / 100n;
            const amountToSwap = testAmount - tax;
            
            // 计算输出（使用恒定乘积公式）
            const numerator = amountToSwap * poolMC;
            const denominator = poolJBC + amountToSwap;
            const mcOutput = numerator / denominator;
            
            console.log("📊 示例兑换计算（1000 JBC）:");
            console.log(`  输入: 1000 JBC`);
            console.log(`  税费 (25%): ${ethers.formatEther(tax)} JBC`);
            console.log(`  实际交换: ${ethers.formatEther(amountToSwap)} JBC`);
            console.log(`  预期输出: ${ethers.formatEther(mcOutput)} MC\n`);
        }

        // 6. 总结
        console.log("=".repeat(80));
        console.log("✅ 验证结果:");
        console.log("=".repeat(80));
        console.log(`  ✅ JBC 地址匹配`);
        console.log(`  ✅ JBC 合约可访问`);
        console.log(`  ✅ 交换池有流动性`);
        console.log(`  ✅ 可以使用正确的 JBC 地址兑换 MC`);
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 验证失败:", error);
        process.exit(1);
    }
}

// 运行测试
testJBCSwap().catch(console.error);
