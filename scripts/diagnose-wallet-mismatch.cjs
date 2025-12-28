const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 诊断钱包地址不匹配问题");
    console.log("================================");
    
    // 合约地址
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    
    try {
        // 使用MC Chain RPC
        const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
        
        // 合约ABI
        const protocolAbi = [
            "function owner() view returns (address)"
        ];
        
        const protocol = new ethers.Contract(PROTOCOL_ADDRESS, protocolAbi, provider);
        
        // 获取合约拥有者
        console.log("📋 合约信息:");
        console.log("   合约地址:", PROTOCOL_ADDRESS);
        
        const contractOwner = await protocol.owner();
        console.log("   合约拥有者:", contractOwner);
        
        // 从错误信息解析用户地址
        const errorHex = "0x118cdaa7000000000000000000000000000000000000000000000000000000000000000000";
        console.log("   错误信息:", errorHex);
        
        // 解析地址 (取前42个字符，即20字节地址)
        const userAddress = "0x" + errorHex.slice(10, 50); // 去掉0x118cdaa7，取接下来的40个字符
        console.log("   用户地址:", userAddress);
        
        console.log("\n🔍 地址比较:");
        console.log("   合约拥有者:", contractOwner.toLowerCase());
        console.log("   连接地址:  ", userAddress.toLowerCase());
        console.log("   是否匹配:  ", contractOwner.toLowerCase() === userAddress.toLowerCase() ? "✅ 是" : "❌ 否");
        
        console.log("\n💡 解决方案:");
        if (contractOwner.toLowerCase() !== userAddress.toLowerCase()) {
            console.log("   1. 当前连接的钱包地址不是合约拥有者");
            console.log("   2. 请切换到拥有者钱包:", contractOwner);
            console.log("   3. 或者在钱包中导入拥有者私钥");
            console.log("   4. 确认网络是MC Chain (Chain ID: 88813)");
        }
        
        // 检查部署报告中的信息
        console.log("\n📄 部署报告信息:");
        console.log("   预期拥有者: 0x4C10831CBcF9884ba72051b5287b6c87E4F74A48");
        console.log("   实际拥有者:", contractOwner);
        console.log("   是否一致:  ", contractOwner.toLowerCase() === "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48".toLowerCase() ? "✅ 是" : "❌ 否");
        
    } catch (error) {
        console.error("❌ 诊断失败:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });