const { ethers, upgrades } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    const UPGRADE_TX = "0x7e4695fc16389d45301974e64f1ea39a65201ae5b34bf7c8a139f9baba907a88";
    
    try {
        console.log("🔍 检查升级交易结果...");
        
        // 获取交易详情
        const tx = await ethers.provider.getTransaction(UPGRADE_TX);
        console.log(`📋 交易状态: ${tx ? '找到' : '未找到'}`);
        
        if (tx) {
            console.log(`📋 交易发送者: ${tx.from}`);
            console.log(`📋 交易接收者: ${tx.to}`);
            console.log(`📋 交易数据长度: ${tx.data.length}`);
        }
        
        // 获取交易收据
        const receipt = await ethers.provider.getTransactionReceipt(UPGRADE_TX);
        console.log(`📋 交易收据状态: ${receipt ? '成功' : '失败'}`);
        
        if (receipt) {
            console.log(`📋 Gas使用: ${receipt.gasUsed}`);
            console.log(`📋 事件数量: ${receipt.logs.length}`);
            
            // 解析事件
            for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i];
                console.log(`📋 事件 ${i}: ${log.topics[0]}`);
            }
        }
        
        // 检查当前实现地址
        const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
        console.log(`📄 当前实现合约: ${currentImpl}`);
        
        // 检查新部署的合约地址
        const NEW_IMPL = "0xD8269F067b8B9571D12d2225f8e0B1F90f288Bb6";
        const newImplCode = await ethers.provider.getCode(NEW_IMPL);
        console.log(`📄 新实现合约代码长度: ${newImplCode.length}`);
        
        // 尝试直接连接到新实现合约
        try {
            const newImpl = await ethers.getContractAt("JinbaoProtocolV3TimeUnitFixSimple", NEW_IMPL);
            const version = await newImpl.getVersionV4();
            console.log(`📋 新实现合约版本: ${version}`);
        } catch (error) {
            console.log("❌ 无法连接到新实现合约:", error.message);
        }
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
    }
}

main().catch(console.error);