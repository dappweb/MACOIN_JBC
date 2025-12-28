const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    PROTOCOL: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
};

const PROTOCOL_ABI = [
    "function owner() view returns (address)"
];

async function checkOwnerStatus(userAddress) {
    console.log(`🔍 检查用户 ${userAddress} 的所有者权限\n`);

    // Setup provider
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    try {
        // 获取合约所有者
        const contractOwner = await protocolContract.owner();
        
        console.log("📋 权限检查结果:");
        console.log(`   合约所有者: ${contractOwner}`);
        console.log(`   当前用户: ${userAddress}`);
        console.log(`   是否为所有者: ${contractOwner.toLowerCase() === userAddress.toLowerCase() ? '✅ 是' : '❌ 否'}`);
        
        if (contractOwner.toLowerCase() !== userAddress.toLowerCase()) {
            console.log("\n⚠️  权限问题:");
            console.log("   当前用户不是合约所有者，无法执行以下操作:");
            console.log("   - 添加流动性 (addLiquidity)");
            console.log("   - 设置钱包地址 (setWallets)");
            console.log("   - 修改分配配置 (setDistributionConfig)");
            console.log("   - 设置赎回手续费 (setRedemptionFeePercent)");
            console.log("   - 批量更新用户统计 (batchUpdateUserStats)");
            console.log("   - 管理员用户管理功能");
            
            console.log("\n💡 解决方案:");
            console.log("   1. 使用合约所有者钱包连接");
            console.log("   2. 或者联系合约所有者转移所有权");
            console.log("   3. 或者让合约所有者执行相关操作");
        } else {
            console.log("\n✅ 权限正常:");
            console.log("   当前用户是合约所有者，可以执行所有管理员操作");
        }
        
    } catch (error) {
        console.error("❌ 检查过程中出现错误:", error.message);
    }
}

async function main() {
    const userAddress = process.argv[2];
    
    if (!userAddress) {
        console.log("使用方法: node scripts/check-owner-status.cjs <用户地址>");
        console.log("示例: node scripts/check-owner-status.cjs 0x1234567890123456789012345678901234567890");
        return;
    }
    
    if (!ethers.isAddress(userAddress)) {
        console.error("❌ 无效的以太坊地址");
        return;
    }
    
    await checkOwnerStatus(userAddress);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { checkOwnerStatus };