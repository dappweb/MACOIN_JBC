const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    PROTOCOL: process.env.PROXY_ADDRESS || "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const PROTOCOL_ABI = [
    "function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external",
    "function owner() view returns (address)",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)"
];

const MC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

async function quickAddLiquidity(mcAmount, jbcAmount = "0") {
    console.log(`🚀 快速添加流动性: ${mcAmount} MC, ${jbcAmount} JBC\n`);

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, wallet);
    const mcContract = new ethers.Contract(ADDRESSES.MC_TOKEN, MC_ABI, wallet);

    try {
        // 权限检查
        const owner = await protocolContract.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error("❌ 权限错误: 钱包不是合约所有者");
            console.error(`   合约所有者: ${owner}`);
            console.error(`   当前钱包: ${wallet.address}`);
            return;
        }
        
        console.log("✅ 权限检查通过");
        
        const mcAmountWei = ethers.parseEther(mcAmount);
        const jbcAmountWei = ethers.parseEther(jbcAmount);
        
        // 余额检查
        const mcBalance = await mcContract.balanceOf(wallet.address);
        if (mcBalance < mcAmountWei) {
            console.error(`❌ MC余额不足: 需要 ${mcAmount} MC, 当前 ${ethers.formatEther(mcBalance)} MC`);
            return;
        }
        
        console.log(`✅ MC余额充足: ${ethers.formatEther(mcBalance)} MC`);
        
        // 授权检查
        const allowance = await mcContract.allowance(wallet.address, ADDRESSES.PROTOCOL);
        if (allowance < mcAmountWei) {
            console.log("📝 需要授权MC代币...");
            const approveTx = await mcContract.approve(ADDRESSES.PROTOCOL, mcAmountWei);
            console.log(`   授权交易哈希: ${approveTx.hash}`);
            await approveTx.wait();
            console.log("✅ MC代币授权成功");
        } else {
            console.log("✅ MC代币授权充足");
        }
        
        // 获取当前储备
        const reserveMC = await protocolContract.swapReserveMC();
        const reserveJBC = await protocolContract.swapReserveJBC();
        console.log(`\n📊 当前流动性池:`);
        console.log(`   MC储备: ${ethers.formatEther(reserveMC)} MC`);
        console.log(`   JBC储备: ${ethers.formatEther(reserveJBC)} JBC`);
        
        // 添加流动性
        console.log(`\n🔄 添加流动性: ${mcAmount} MC, ${jbcAmount} JBC`);
        const tx = await protocolContract.addLiquidity(mcAmountWei, jbcAmountWei, { gasLimit: 500000 });
        console.log(`   交易哈希: ${tx.hash}`);
        console.log("   等待确认...");
        
        const receipt = await tx.wait();
        console.log(`✅ 流动性添加成功! Gas使用: ${receipt.gasUsed}`);
        
        // 获取更新后的储备
        const newReserveMC = await protocolContract.swapReserveMC();
        const newReserveJBC = await protocolContract.swapReserveJBC();
        console.log(`\n📊 更新后的流动性池:`);
        console.log(`   MC储备: ${ethers.formatEther(newReserveMC)} MC (+${ethers.formatEther(newReserveMC - reserveMC)})`);
        console.log(`   JBC储备: ${ethers.formatEther(newReserveJBC)} JBC (+${ethers.formatEther(newReserveJBC - reserveJBC)})`);
        
    } catch (error) {
        console.error("❌ 添加流动性失败:", error.message);
        
        if (error.message.includes("Ownable")) {
            console.error("💡 原因: 权限问题 - 只有合约所有者可以添加流动性");
        } else if (error.message.includes("insufficient")) {
            console.error("💡 原因: 余额或授权不足");
        } else if (error.message.includes("transfer")) {
            console.error("💡 原因: 代币转账失败");
        }
    }
}

async function main() {
    const mcAmount = process.argv[2];
    const jbcAmount = process.argv[3] || "0";
    
    if (!mcAmount) {
        console.log("使用方法: node scripts/quick-add-liquidity.cjs <MC数量> [JBC数量]");
        console.log("示例:");
        console.log("  添加1个MC: node scripts/quick-add-liquidity.cjs 1");
        console.log("  添加1个MC和2个JBC: node scripts/quick-add-liquidity.cjs 1 2");
        return;
    }
    
    await quickAddLiquidity(mcAmount, jbcAmount);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { quickAddLiquidity };