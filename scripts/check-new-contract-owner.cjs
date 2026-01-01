const { ethers } = require("hardhat");

async function main() {
    const NEW_CONTRACT_ADDRESS = "0x6B32e3bd93b4dCe26C361b0B1425B06B03A8b8B9";
    
    try {
        console.log("🔍 检查新合约所有者权限...");
        
        const [deployer] = await ethers.getSigners();
        console.log(`👤 当前账户: ${deployer.address}`);
        
        // 连接到新合约
        const contract = await ethers.getContractAt("JinbaoProtocolV3TimeUnitFixSimple", NEW_CONTRACT_ADDRESS);
        
        // 检查所有者
        const owner = await contract.owner();
        console.log(`👤 合约所有者: ${owner}`);
        console.log(`🔍 是否为所有者: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);
        
        // 检查当前状态
        const timeUnitFixed = await contract.timeUnitFixed();
        console.log(`⏰ 时间单位已修复: ${timeUnitFixed}`);
        
        // 尝试估算gas
        try {
            const gasEstimate = await contract.fixTimeUnit.estimateGas();
            console.log(`⛽ Gas估算: ${gasEstimate}`);
        } catch (error) {
            console.log(`❌ Gas估算失败: ${error.message}`);
            
            // 检查是否是权限问题
            if (error.message.includes("Ownable")) {
                console.log("⚠️  这是权限问题，当前账户不是合约所有者");
            } else if (error.message.includes("already fixed")) {
                console.log("ℹ️  时间单位可能已经修复");
            } else {
                console.log("⚠️  其他错误，需要进一步调查");
            }
        }
        
        // 检查合约是否已初始化
        try {
            const version = await contract.getVersionV4();
            console.log(`📋 合约版本: ${version}`);
        } catch (error) {
            console.log("❌ 无法获取版本，合约可能未正确初始化");
        }
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
    }
}

main().catch(console.error);