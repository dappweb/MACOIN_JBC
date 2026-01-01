const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    const NEW_IMPL = "0xD8269F067b8B9571D12d2225f8e0B1F90f288Bb6";
    
    try {
        console.log("🔍 调试升级问题...");
        
        const [deployer] = await ethers.getSigners();
        console.log(`👤 当前账户: ${deployer.address}`);
        
        // 连接到代理合约
        const proxyContract = await ethers.getContractAt("JinbaoProtocolV3Standalone", PROXY_ADDRESS);
        
        // 检查所有者
        const owner = await proxyContract.owner();
        console.log(`👤 合约所有者: ${owner}`);
        console.log(`🔍 是否为所有者: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);
        
        // 检查当前实现
        const currentImpl = await ethers.provider.getStorage(
            PROXY_ADDRESS, 
            "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" // EIP-1967 implementation slot
        );
        console.log(`📄 当前实现存储槽: ${currentImpl}`);
        
        // 尝试再次升级
        console.log("🔧 尝试再次升级...");
        
        const uupsInterface = new ethers.Interface([
            "function upgradeTo(address newImplementation) external"
        ]);
        
        const proxyUUPS = new ethers.Contract(PROXY_ADDRESS, uupsInterface, deployer);
        
        // 估算gas
        try {
            const gasEstimate = await proxyUUPS.upgradeTo.estimateGas(NEW_IMPL);
            console.log(`⛽ Gas估算: ${gasEstimate}`);
            
            // 执行升级
            const upgradeTx = await proxyUUPS.upgradeTo(NEW_IMPL, {
                gasLimit: gasEstimate * 2n // 增加gas限制
            });
            const receipt = await upgradeTx.wait();
            
            console.log(`✅ 升级交易: ${receipt.hash}`);
            console.log(`📋 Gas使用: ${receipt.gasUsed}`);
            console.log(`📋 状态: ${receipt.status}`);
            
            // 检查升级后的实现
            const newImpl = await ethers.provider.getStorage(
                PROXY_ADDRESS, 
                "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
            );
            console.log(`📄 新实现存储槽: ${newImpl}`);
            
        } catch (error) {
            console.error("❌ 升级失败:", error.message);
            
            // 检查是否是权限问题
            if (error.message.includes("Ownable")) {
                console.log("⚠️  可能是权限问题");
            }
        }
        
    } catch (error) {
        console.error("❌ 调试失败:", error.message);
    }
}

main().catch(console.error);