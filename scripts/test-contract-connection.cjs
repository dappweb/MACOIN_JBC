const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
    PROTOCOL: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
};

const PROTOCOL_ABI = [
    "function redemptionFeePercent() view returns (uint256)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "function redeemEnabled() view returns (bool)",
    "function owner() view returns (address)",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)"
];

async function testConnection() {
    console.log("🔗 测试合约连接...\n");

    try {
        // Setup provider
        const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
        
        // Test network connection
        console.log("1. 测试网络连接:");
        const network = await provider.getNetwork();
        console.log(`   ✅ 网络ID: ${network.chainId}`);
        console.log(`   ✅ 网络名称: ${network.name || 'MC Chain'}`);
        
        // Test contract connection
        console.log("\n2. 测试合约连接:");
        const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
        
        // Test basic contract calls
        console.log("   测试基本合约调用...");
        
        const owner = await protocolContract.owner();
        console.log(`   ✅ 合约所有者: ${owner}`);
        
        const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
        console.log(`   ✅ 时间单位: ${secondsInUnit} 秒`);
        
        const redeemEnabled = await protocolContract.redeemEnabled();
        console.log(`   ✅ 赎回启用: ${redeemEnabled}`);
        
        // Test the problematic function
        console.log("\n3. 测试 redemptionFeePercent 函数:");
        try {
            const feePercent = await protocolContract.redemptionFeePercent();
            console.log(`   ✅ 赎回手续费率: ${feePercent}%`);
        } catch (error) {
            console.log(`   ❌ 调用失败: ${error.message}`);
            if (error.message.includes("is not a function")) {
                console.log("   💡 这是ABI问题，需要在前端ABI中添加此函数");
            }
        }
        
        // Test reserves
        console.log("\n4. 测试流动性池:");
        const reserveMC = await protocolContract.swapReserveMC();
        const reserveJBC = await protocolContract.swapReserveJBC();
        console.log(`   ✅ MC储备: ${ethers.formatEther(reserveMC)} MC`);
        console.log(`   ✅ JBC储备: ${ethers.formatEther(reserveJBC)} JBC`);
        
        if (reserveMC > 0n && reserveJBC > 0n) {
            const rate = Number(ethers.formatEther(reserveMC)) / Number(ethers.formatEther(reserveJBC));
            console.log(`   ✅ 汇率: 1 JBC ≈ ${rate.toFixed(4)} MC`);
        }
        
        console.log("\n✅ 所有测试通过！合约连接正常。");
        
    } catch (error) {
        console.error("❌ 测试失败:", error.message);
        console.error("详细错误:", error);
    }
}

if (require.main === module) {
    testConnection().catch(console.error);
}

module.exports = { testConnection };