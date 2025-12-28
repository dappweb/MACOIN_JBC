const { ethers } = require("hardhat");

async function main() {
    console.log("🔥 测试每日燃烧功能");
    console.log("====================");
    
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    
    try {
        // 使用MC Chain RPC
        const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log("👤 测试账户:", wallet.address);
        
        // 合约ABI - 包含dailyBurn函数
        const protocolAbi = [
            "function dailyBurn() external",
            "function lastBurnTime() view returns (uint256)",
            "function swapReserveJBC() view returns (uint256)",
            "function owner() view returns (address)"
        ];
        
        const protocol = new ethers.Contract(PROTOCOL_ADDRESS, protocolAbi, wallet);
        
        // 1. 检查合约拥有者
        console.log("🔍 检查合约状态...");
        const owner = await protocol.owner();
        console.log("   合约拥有者:", owner);
        console.log("   是否为拥有者:", owner.toLowerCase() === wallet.address.toLowerCase());
        
        // 2. 检查燃烧状态
        const lastBurnTime = await protocol.lastBurnTime();
        const jbcReserve = await protocol.swapReserveJBC();
        
        const lastBurnDate = new Date(Number(lastBurnTime) * 1000);
        const now = Date.now() / 1000;
        const diffHours = (now - Number(lastBurnTime)) / 3600;
        
        console.log("📊 燃烧状态:");
        console.log("   上次燃烧时间:", lastBurnDate.toISOString());
        console.log("   距离上次燃烧:", diffHours.toFixed(2), "小时");
        console.log("   JBC 储备:", ethers.formatEther(jbcReserve), "JBC");
        console.log("   可燃烧数量:", ethers.formatEther(jbcReserve / 100n), "JBC");
        
        // 3. 检查是否可以燃烧
        const canBurn = diffHours >= 24 && jbcReserve > 0n;
        console.log("   可以燃烧:", canBurn ? "✅ 是" : "❌ 否");
        
        if (!canBurn) {
            if (diffHours < 24) {
                console.log("   原因: 距离上次燃烧不足24小时");
                console.log("   还需等待:", (24 - diffHours).toFixed(2), "小时");
            } else if (jbcReserve === 0n) {
                console.log("   原因: 没有JBC可燃烧");
            }
        }
        
        // 4. 测试静态调用
        console.log("\n🧪 测试静态调用...");
        try {
            await protocol.dailyBurn.staticCall();
            console.log("✅ 静态调用成功 - dailyBurn函数存在且可执行");
        } catch (error) {
            console.log("❌ 静态调用失败:", error.message);
            
            if (error.message.includes("Early")) {
                console.log("💡 原因: 时间限制 (正常)");
            } else if (error.message.includes("No JBC")) {
                console.log("💡 原因: 没有JBC可燃烧 (正常)");
            } else if (error.message.includes("function does not exist")) {
                console.log("💡 原因: dailyBurn函数不存在于合约中");
                console.log("🔧 解决方案: 需要升级合约添加dailyBurn函数");
            } else {
                console.log("💡 其他错误:", error);
            }
        }
        
        // 5. 如果可以燃烧，询问是否执行
        if (canBurn && jbcReserve > 0n) {
            console.log("\n🔥 条件满足，可以执行燃烧");
            console.log("💡 如需执行，请运行: node scripts/dailyBurn.cjs");
        }
        
    } catch (error) {
        console.error("❌ 测试失败:", error.message);
        
        if (error.message.includes("network")) {
            console.log("💡 网络连接问题，请检查RPC连接");
        } else if (error.message.includes("private key")) {
            console.log("💡 私钥问题，请检查.env文件");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });