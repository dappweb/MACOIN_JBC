const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 验证合约拥有者状态...");
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 当前签名者地址:", deployer.address);
    
    // 合约地址
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    
    try {
        // 获取合约实例
        const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
        const protocol = JinbaoProtocol.attach(PROTOCOL_ADDRESS);
        
        // 检查合约拥有者
        const contractOwner = await protocol.owner();
        console.log("🏠 合约拥有者地址:", contractOwner);
        
        // 比较地址
        const isOwner = contractOwner.toLowerCase() === deployer.address.toLowerCase();
        console.log("✅ 是否为合约拥有者:", isOwner);
        
        if (isOwner) {
            console.log("🎉 验证成功！您是合约拥有者，可以添加流动性");
            
            // 检查当前流动性池状态
            const mcReserve = await protocol.swapReserveMC();
            const jbcReserve = await protocol.swapReserveJBC();
            
            console.log("💰 当前池子状态:");
            console.log("   MC 储备:", ethers.formatEther(mcReserve), "MC");
            console.log("   JBC 储备:", ethers.formatEther(jbcReserve), "JBC");
            
            // 检查拥有者代币余额
            const MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
            const JBC_TOKEN = "0xA743cB357a9f59D349efB7985072779a094658dD";
            
            const mcToken = await ethers.getContractAt("IERC20", MC_TOKEN);
            const jbcToken = await ethers.getContractAt("IERC20", JBC_TOKEN);
            
            const mcBalance = await mcToken.balanceOf(deployer.address);
            const jbcBalance = await jbcToken.balanceOf(deployer.address);
            
            console.log("💳 您的代币余额:");
            console.log("   MC 余额:", ethers.formatEther(mcBalance), "MC");
            console.log("   JBC 余额:", ethers.formatEther(jbcBalance), "JBC");
            
        } else {
            console.log("❌ 验证失败！您不是合约拥有者");
            console.log("📋 解决方案:");
            console.log("   1. 使用正确的拥有者钱包连接");
            console.log("   2. 或联系当前拥有者:", contractOwner);
        }
        
    } catch (error) {
        console.error("❌ 验证过程中出错:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });