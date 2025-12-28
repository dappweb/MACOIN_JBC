const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 快速拥有者身份验证和流动性添加测试");
    console.log("===========================================");
    
    // 合约地址
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    const MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    const JBC_TOKEN = "0xA743cB357a9f59D349efB7985072779a094658dD";
    
    const [signer] = await ethers.getSigners();
    console.log("👤 当前账户:", signer.address);
    
    try {
        // 连接到MC Chain网络
        console.log("🌐 连接到MC Chain网络...");
        
        // 使用自定义RPC提供者
        const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
        
        console.log("🔗 使用钱包地址:", wallet.address);
        
        // 获取合约实例
        const protocolAbi = [
            "function owner() view returns (address)",
            "function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external",
            "function swapReserveMC() view returns (uint256)",
            "function swapReserveJBC() view returns (uint256)"
        ];
        
        const tokenAbi = [
            "function balanceOf(address) view returns (uint256)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) external returns (bool)"
        ];
        
        const protocol = new ethers.Contract(PROTOCOL_ADDRESS, protocolAbi, wallet);
        const mcToken = new ethers.Contract(MC_TOKEN, tokenAbi, wallet);
        const jbcToken = new ethers.Contract(JBC_TOKEN, tokenAbi, wallet);
        
        // 检查拥有者身份
        console.log("🔍 检查合约拥有者...");
        const contractOwner = await protocol.owner();
        console.log("🏠 合约拥有者:", contractOwner);
        console.log("👤 您的地址:", wallet.address);
        
        const isOwner = contractOwner.toLowerCase() === wallet.address.toLowerCase();
        console.log("✅ 是否为拥有者:", isOwner ? "是" : "否");
        
        if (!isOwner) {
            console.log("❌ 您不是合约拥有者，无法添加流动性");
            console.log("💡 请使用拥有者地址:", contractOwner);
            return;
        }
        
        // 检查余额
        console.log("💰 检查代币余额...");
        const mcBalance = await mcToken.balanceOf(wallet.address);
        const jbcBalance = await jbcToken.balanceOf(wallet.address);
        
        console.log("   MC 余额:", ethers.formatEther(mcBalance));
        console.log("   JBC 余额:", ethers.formatEther(jbcBalance));
        
        // 检查当前池子
        console.log("🏊 检查当前池子状态...");
        const mcReserve = await protocol.swapReserveMC();
        const jbcReserve = await protocol.swapReserveJBC();
        
        console.log("   MC 储备:", ethers.formatEther(mcReserve));
        console.log("   JBC 储备:", ethers.formatEther(jbcReserve));
        
        // 如果余额足够，尝试添加少量流动性进行测试
        const testAmount = ethers.parseEther("100"); // 100 tokens
        
        if (mcBalance >= testAmount && jbcBalance >= testAmount) {
            console.log("🧪 尝试添加测试流动性 (100 MC + 100 JBC)...");
            
            // 检查授权
            const mcAllowance = await mcToken.allowance(wallet.address, PROTOCOL_ADDRESS);
            const jbcAllowance = await jbcToken.allowance(wallet.address, PROTOCOL_ADDRESS);
            
            if (mcAllowance < testAmount) {
                console.log("📝 授权 MC...");
                const tx = await mcToken.approve(PROTOCOL_ADDRESS, ethers.MaxUint256);
                await tx.wait();
                console.log("✅ MC 授权完成");
            }
            
            if (jbcAllowance < testAmount) {
                console.log("📝 授权 JBC...");
                const tx = await jbcToken.approve(PROTOCOL_ADDRESS, ethers.MaxUint256);
                await tx.wait();
                console.log("✅ JBC 授权完成");
            }
            
            // 添加流动性
            console.log("💧 添加流动性...");
            const tx = await protocol.addLiquidity(testAmount, testAmount);
            console.log("📝 交易哈希:", tx.hash);
            
            await tx.wait();
            console.log("🎉 流动性添加成功！");
            
            // 检查更新后的状态
            const newMcReserve = await protocol.swapReserveMC();
            const newJbcReserve = await protocol.swapReserveJBC();
            
            console.log("🏊 更新后的池子:");
            console.log("   MC 储备:", ethers.formatEther(newMcReserve));
            console.log("   JBC 储备:", ethers.formatEther(newJbcReserve));
            
        } else {
            console.log("⚠️ 余额不足，无法进行测试");
            console.log("💡 您仍然是合约拥有者，可以在前端界面添加流动性");
        }
        
    } catch (error) {
        console.error("❌ 测试失败:", error.message);
        
        if (error.message.includes("OwnableUnauthorizedAccount")) {
            console.log("🚨 这确认了权限错误");
            console.log("💡 解决方案:");
            console.log("   1. 检查 .env 文件中的 PRIVATE_KEY");
            console.log("   2. 确认使用正确的拥有者钱包");
            console.log("   3. 验证网络连接");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });