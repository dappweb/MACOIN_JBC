const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const JBC_TOKEN_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da"; // 正确的JBC合约地址

// JBC Token ABI
const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
];

async function checkUserJBCApproval(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const jbcContract = new ethers.Contract(JBC_TOKEN_ADDRESS, JBC_ABI, provider);

    console.log("🔍 检查用户 JBC 授权状态\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log(`协议地址: ${PROTOCOL_ADDRESS}`);
    console.log(`JBC合约地址: ${JBC_TOKEN_ADDRESS}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 1. 获取用户 JBC 余额
        const jbcBalance = await jbcContract.balanceOf(userAddress);
        const jbcBalanceFormatted = ethers.formatEther(jbcBalance);
        console.log("🪙 用户 JBC 余额:");
        console.log(`  ${jbcBalanceFormatted} JBC\n`);

        // 2. 获取用户 MC 余额（原生代币）
        const mcBalance = await provider.getBalance(userAddress);
        const mcBalanceFormatted = ethers.formatEther(mcBalance);
        console.log("💰 用户 MC 余额（原生代币）:");
        console.log(`  ${mcBalanceFormatted} MC\n`);

        // 3. 检查授权额度
        const allowance = await jbcContract.allowance(userAddress, PROTOCOL_ADDRESS);
        const allowanceFormatted = ethers.formatEther(allowance);
        console.log("🔐 JBC 授权状态:");
        console.log(`  授权额度: ${allowanceFormatted} JBC`);
        console.log(`  原始值: ${allowance.toString()}\n`);

        // 4. 测试不同数量的授权检查
        const testAmounts = [
            ethers.parseEther("1"),
            ethers.parseEther("10"),
            ethers.parseEther("100"),
            ethers.parseEther("1000"),
            jbcBalance > 0n ? jbcBalance : ethers.parseEther("1")
        ];

        console.log("📊 授权检查（不同数量）:");
        console.log("-".repeat(80));
        for (const amount of testAmounts) {
            if (amount > jbcBalance) continue;
            const isApproved = allowance >= amount;
            const status = isApproved ? "✅ 已授权" : "❌ 未授权";
            console.log(`  ${ethers.formatEther(amount)} JBC: ${status}`);
        }
        console.log("");

        // 5. 总结
        console.log("=".repeat(80));
        console.log("📊 总结:");
        console.log("=".repeat(80));
        console.log(`  JBC 余额: ${jbcBalanceFormatted} JBC`);
        console.log(`  MC 余额: ${mcBalanceFormatted} MC`);
        console.log(`  授权额度: ${allowanceFormatted} JBC`);
        
        if (allowance === 0n) {
            console.log(`  ⚠️  警告: 未授权 JBC 代币，无法进行 JBC 兑换 MC`);
            console.log(`  建议: 请先授权 JBC 代币使用权限`);
        } else if (allowance < jbcBalance) {
            console.log(`  ⚠️  警告: 授权额度小于 JBC 余额`);
            console.log(`  建议: 重新授权以覆盖所有 JBC 余额`);
        } else {
            console.log(`  ✅ 授权充足，可以进行 JBC 兑换 MC`);
        }
        
        if (parseFloat(mcBalanceFormatted) < 0.01) {
            console.log(`  ⚠️  警告: MC 余额低于 0.01 MC，可能不足以支付 Gas 费用`);
        } else {
            console.log(`  ✅ MC 余额充足，可以支付 Gas 费用`);
        }
        
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 查询失败:", error);
        process.exit(1);
    }
}

// 运行脚本
const userAddress = process.argv[2] || "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
checkUserJBCApproval(userAddress).catch(console.error);
