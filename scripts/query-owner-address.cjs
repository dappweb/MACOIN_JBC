const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 查询协议合约拥有者地址...\n");
    
    // 协议合约地址 (V4 Native MC Version)
    const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
    
    console.log("📋 协议合约地址:", PROTOCOL_ADDRESS);
    console.log("🌐 网络: MC Chain (88813)\n");
    
    try {
        // 获取合约实例
        const protocolContract = await ethers.getContractAt("JinbaoProtocol", PROTOCOL_ADDRESS);
        
        // 查询合约拥有者
        console.log("⏳ 查询中...");
        const owner = await protocolContract.owner();
        
        console.log("✅ 查询成功！\n");
        console.log("🏠 合约拥有者地址:", owner);
        console.log("🔗 区块浏览器:", `https://mcerscan.com/address/${owner}`);
        
        // 检查当前签名者是否是拥有者
        const [signer] = await ethers.getSigners();
        const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
        console.log("\n👤 当前签名者:", signer.address);
        console.log("🔐 是否为拥有者:", isOwner ? "✅ 是" : "❌ 否");
        
    } catch (error) {
        console.error("❌ 查询失败:", error.message);
        if (error.message.includes("could not decode result")) {
            console.log("\n💡 提示: 可能是合约地址不正确或网络连接问题");
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

