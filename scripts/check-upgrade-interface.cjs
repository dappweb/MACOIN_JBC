const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    
    try {
        console.log("🔍 检查合约升级接口...");
        
        // 连接到当前合约
        const contract = await ethers.getContractAt("JinbaoProtocolV3Standalone", PROXY_ADDRESS);
        
        // 检查是否有upgradeTo函数
        try {
            const upgradeToSelector = "0x3659cfe6"; // upgradeTo(address)的函数选择器
            const code = await ethers.provider.getCode(PROXY_ADDRESS);
            console.log(`📄 合约代码长度: ${code.length}`);
            
            // 尝试调用upgradeTo（只是检查是否存在）
            const iface = new ethers.Interface([
                "function upgradeTo(address newImplementation) external",
                "function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"
            ]);
            
            console.log("🔍 检查UUPS升级函数...");
            
            // 检查合约是否支持UUPS
            const proxyContract = new ethers.Contract(PROXY_ADDRESS, iface, await ethers.getSigners()[0]);
            
            console.log("✅ 合约支持UUPS升级模式");
            
            return proxyContract;
            
        } catch (error) {
            console.log("❌ 合约不支持UUPS升级模式:", error.message);
        }
        
        // 检查其他可能的升级函数
        console.log("🔍 检查其他升级方法...");
        
        // 检查是否是透明代理
        try {
            const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
            const admin = await ethers.provider.getStorage(PROXY_ADDRESS, adminSlot);
            console.log(`📋 代理管理员: ${admin}`);
        } catch (error) {
            console.log("ℹ️  不是透明代理");
        }
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
    }
}

main().catch(console.error);