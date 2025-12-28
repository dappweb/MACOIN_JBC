const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
    PROTOCOL: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
};

const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

async function checkJBCStatus(userAddress, jbcAmount = "10") {
    console.log(`🔍 检查JBC代币状态\n`);
    console.log(`用户地址: ${userAddress}`);
    console.log(`检查数量: ${jbcAmount} JBC\n`);

    // Setup provider
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const jbcContract = new ethers.Contract(ADDRESSES.JBC_TOKEN, JBC_ABI, provider);
    const jbcContractWithSigner = new ethers.Contract(ADDRESSES.JBC_TOKEN, JBC_ABI, wallet);

    try {
        console.log("📋 JBC代币信息:");
        console.log("-".repeat(50));
        
        const symbol = await jbcContract.symbol();
        const decimals = await jbcContract.decimals();
        console.log(`   代币符号: ${symbol}`);
        console.log(`   小数位数: ${decimals}`);
        
        console.log("\n💰 余额检查:");
        console.log("-".repeat(50));
        
        const jbcBalance = await jbcContract.balanceOf(userAddress);
        const walletBalance = await jbcContract.balanceOf(wallet.address);
        const amount = ethers.parseEther(jbcAmount);
        
        console.log(`   用户JBC余额: ${ethers.formatEther(jbcBalance)} JBC`);
        console.log(`   钱包JBC余额: ${ethers.formatEther(walletBalance)} JBC`);
        console.log(`   需要数量: ${jbcAmount} JBC`);
        console.log(`   用户余额足够: ${jbcBalance >= amount ? '✅' : '❌'}`);
        console.log(`   钱包余额足够: ${walletBalance >= amount ? '✅' : '❌'}`);
        
        console.log("\n🔐 授权检查:");
        console.log("-".repeat(50));
        
        const userAllowance = await jbcContract.allowance(userAddress, ADDRESSES.PROTOCOL);
        const walletAllowance = await jbcContract.allowance(wallet.address, ADDRESSES.PROTOCOL);
        
        console.log(`   用户授权额度: ${ethers.formatEther(userAllowance)} JBC`);
        console.log(`   钱包授权额度: ${ethers.formatEther(walletAllowance)} JBC`);
        console.log(`   用户授权足够: ${userAllowance >= amount ? '✅' : '❌'}`);
        console.log(`   钱包授权足够: ${walletAllowance >= amount ? '✅' : '❌'}`);
        
        console.log("\n🔧 问题诊断:");
        console.log("-".repeat(50));
        
        if (walletBalance < amount) {
            console.log("❌ 主要问题: JBC余额不足");
            console.log("💡 解决方案:");
            console.log("   1. 获取更多JBC代币");
            console.log("   2. 或者减少添加数量");
            console.log(`   3. 当前余额: ${ethers.formatEther(walletBalance)} JBC`);
        } else if (walletAllowance < amount) {
            console.log("❌ 主要问题: JBC授权不足");
            console.log("💡 解决方案:");
            console.log("   1. 需要先授权JBC代币给合约");
            console.log(`   2. 需要授权数量: ${jbcAmount} JBC`);
            
            // 提供授权命令
            console.log("\n🚀 自动授权JBC代币:");
            try {
                console.log("   正在授权...");
                const approveTx = await jbcContractWithSigner.approve(ADDRESSES.PROTOCOL, amount);
                console.log(`   授权交易哈希: ${approveTx.hash}`);
                await approveTx.wait();
                console.log("   ✅ JBC代币授权成功!");
                
                // 重新检查授权
                const newAllowance = await jbcContract.allowance(wallet.address, ADDRESSES.PROTOCOL);
                console.log(`   新授权额度: ${ethers.formatEther(newAllowance)} JBC`);
            } catch (error) {
                console.log(`   ❌ 授权失败: ${error.message}`);
            }
        } else {
            console.log("✅ JBC代币状态正常");
            console.log("   余额和授权都充足，可以添加流动性");
        }
        
    } catch (error) {
        console.error("❌ 检查过程中出现错误:", error.message);
    }
}

async function main() {
    const userAddress = process.argv[2] || process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY).address : null;
    const jbcAmount = process.argv[3] || "10";
    
    if (!userAddress) {
        console.log("使用方法: node scripts/check-jbc-status.cjs [用户地址] [JBC数量]");
        console.log("示例: node scripts/check-jbc-status.cjs 0x1234567890123456789012345678901234567890 10");
        console.log("如果不提供地址，将使用环境变量中的钱包地址");
        return;
    }
    
    if (!ethers.isAddress(userAddress)) {
        console.error("❌ 无效的以太坊地址");
        return;
    }
    
    await checkJBCStatus(userAddress, jbcAmount);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { checkJBCStatus };