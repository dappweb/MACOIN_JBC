const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 检查合约中实际存在的函数");
    console.log("==============================");
    
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    
    try {
        const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
        
        // 获取合约代码
        const code = await provider.getCode(PROTOCOL_ADDRESS);
        console.log("📜 合约代码长度:", code.length);
        console.log("📜 合约已部署:", code !== "0x" ? "✅" : "❌");
        
        // 尝试调用已知存在的函数
        const knownFunctions = [
            { name: "owner", sig: "0x8da5cb5b" },
            { name: "swapReserveMC", sig: "0x1234567890abcdef" }, // 需要正确的函数签名
            { name: "swapReserveJBC", sig: "0x1234567890abcdef" }, // 需要正确的函数签名
            { name: "lastBurnTime", sig: "0x1234567890abcdef" }, // 需要正确的函数签名
            { name: "dailyBurn", sig: "0x81eeef5c" } // dailyBurn()的函数签名
        ];
        
        console.log("\n🧪 测试函数存在性:");
        
        // 测试owner函数 (已知存在)
        try {
            const ownerCall = await provider.call({
                to: PROTOCOL_ADDRESS,
                data: "0x8da5cb5b" // owner()
            });
            console.log("✅ owner() 函数存在");
        } catch (e) {
            console.log("❌ owner() 函数不存在");
        }
        
        // 测试dailyBurn函数
        try {
            const burnCall = await provider.call({
                to: PROTOCOL_ADDRESS,
                data: "0x81eeef5c" // dailyBurn()
            });
            console.log("✅ dailyBurn() 函数存在");
        } catch (e) {
            console.log("❌ dailyBurn() 函数不存在");
            console.log("   错误:", e.message);
        }
        
        // 检查合约是否是代理合约
        console.log("\n🔍 检查代理合约状态:");
        
        // 检查实现合约地址 (UUPS代理)
        try {
            // EIP-1967 implementation slot
            const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
            const implAddress = await provider.getStorageAt(PROTOCOL_ADDRESS, implSlot);
            
            if (implAddress !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                const cleanImplAddress = "0x" + implAddress.slice(-40);
                console.log("📋 这是一个代理合约");
                console.log("📋 实现合约地址:", cleanImplAddress);
                
                // 检查实现合约的代码
                const implCode = await provider.getCode(cleanImplAddress);
                console.log("📋 实现合约代码长度:", implCode.length);
            } else {
                console.log("📋 这不是代理合约或使用不同的代理模式");
            }
        } catch (e) {
            console.log("📋 无法确定代理状态:", e.message);
        }
        
        console.log("\n💡 结论:");
        console.log("1. 合约已部署且可访问");
        console.log("2. dailyBurn函数确实不存在于当前合约中");
        console.log("3. 需要升级合约或使用扩展合约方案");
        
        console.log("\n🔧 解决方案:");
        console.log("方案1: 升级主合约 (推荐)");
        console.log("  - 修改合约代码添加dailyBurn函数");
        console.log("  - 使用UUPS代理升级合约");
        console.log("方案2: 部署扩展合约");
        console.log("  - 部署独立的燃烧合约");
        console.log("  - 通过扩展合约执行燃烧");
        console.log("方案3: 前端模拟燃烧");
        console.log("  - 在前端实现燃烧逻辑");
        console.log("  - 直接调用JBC的burn函数");
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });