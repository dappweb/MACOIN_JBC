const { ethers } = require("hardhat");

async function main() {
    try {
        console.log("🔍 测试网络连接...");
        
        // 获取网络信息
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 网络名称: ${network.name}`);
        console.log(`🔗 Chain ID: ${network.chainId}`);
        
        // 获取最新区块
        const blockNumber = await ethers.provider.getBlockNumber();
        console.log(`📦 最新区块: ${blockNumber}`);
        
        // 获取账户信息
        const [signer] = await ethers.getSigners();
        console.log(`👤 账户地址: ${signer.address}`);
        
        const balance = await ethers.provider.getBalance(signer.address);
        console.log(`💰 账户余额: ${ethers.formatEther(balance)} MC`);
        
        console.log("✅ 网络连接测试成功");
        
    } catch (error) {
        console.error("❌ 网络连接测试失败:", error.message);
    }
}

main().catch(console.error);