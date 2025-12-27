const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 开始升级合约...");
    
    // 获取当前部署的合约地址（需要根据实际情况修改）
    const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "YOUR_PROXY_ADDRESS_HERE";
    
    if (PROXY_ADDRESS === "YOUR_PROXY_ADDRESS_HERE") {
        console.error("❌ 请在 .env 文件中设置 PROXY_ADDRESS");
        process.exit(1);
    }
    
    // 获取新的合约工厂
    const JinbaoProtocolV2 = await ethers.getContractFactory("JinbaoProtocol");
    
    console.log("📝 升级合约到新版本...");
    
    // 升级合约
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolV2);
    
    console.log("✅ 合约升级成功!");
    console.log("📍 合约地址:", upgraded.address);
    
    // 验证新字段是否可用
    console.log("🔍 验证新功能...");
    
    const [deployer] = await ethers.getSigners();
    
    try {
        // 测试新的getter函数
        const maxSingle = await upgraded.getUserMaxSingleTicketAmount(deployer.address);
        console.log("✅ getUserMaxSingleTicketAmount 函数可用，当前值:", maxSingle.toString());
    } catch (error) {
        console.log("⚠️  新函数测试:", error.message);
    }
    
    console.log("🎉 升级完成!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 升级失败:", error);
        process.exit(1);
    });