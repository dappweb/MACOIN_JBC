const { ethers } = require("hardhat");

async function main() {
    console.log("🔄 测试前端后端一致性");
    console.log("========================");
    
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    const MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    const JBC_TOKEN = "0xA743cB357a9f59D349efB7985072779a094658dD";
    
    try {
        // 使用与前端相同的配置
        const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log("👤 钱包地址:", wallet.address);
        console.log("🌐 网络:", await provider.getNetwork());
        
        // 使用与前端相同的ABI
        const PROTOCOL_ABI = [
            "function owner() view returns (address)",
            "function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external",
            "function swapReserveMC() view returns (uint256)",
            "function swapReserveJBC() view returns (uint256)"
        ];
        
        const MC_ABI = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) external view returns (uint256)",
            "function balanceOf(address account) external view returns (uint256)",
        ];
        
        const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
        const mcToken = new ethers.Contract(MC_TOKEN, MC_ABI, wallet);
        const jbcToken = new ethers.Contract(JBC_TOKEN, MC_ABI, wallet);
        
        // 1. 验证拥有者
        const owner = await protocol.owner();
        console.log("🏠 合约拥有者:", owner);
        console.log("✅ 拥有者匹配:", owner.toLowerCase() === wallet.address.toLowerCase());
        
        // 2. 检查余额
        const mcBalance = await mcToken.balanceOf(wallet.address);
        const jbcBalance = await jbcToken.balanceOf(wallet.address);
        console.log("💰 MC 余额:", ethers.formatEther(mcBalance));
        console.log("💰 JBC 余额:", ethers.formatEther(jbcBalance));
        
        // 3. 检查授权
        const mcAllowance = await mcToken.allowance(wallet.address, PROTOCOL_ADDRESS);
        const jbcAllowance = await jbcToken.allowance(wallet.address, PROTOCOL_ADDRESS);
        console.log("🔐 MC 授权:", ethers.formatEther(mcAllowance));
        console.log("🔐 JBC 授权:", ethers.formatEther(jbcAllowance));
        
        // 4. 模拟前端调用
        console.log("\n🧪 模拟前端调用流程:");
        const testMcAmount = ethers.parseEther("10");
        const testJbcAmount = ethers.parseEther("10");
        
        console.log("   测试数量: 10 MC + 10 JBC");
        console.log("   MC Wei:", testMcAmount.toString());
        console.log("   JBC Wei:", testJbcAmount.toString());
        
        // 静态调用测试
        try {
            await protocol.addLiquidity.staticCall(testMcAmount, testJbcAmount);
            console.log("✅ 静态调用成功");
        } catch (error) {
            console.log("❌ 静态调用失败:", error.message);
            return;
        }
        
        // 5. 检查当前池子状态
        const mcReserve = await protocol.swapReserveMC();
        const jbcReserve = await protocol.swapReserveJBC();
        console.log("🏊 当前池子:");
        console.log("   MC 储备:", ethers.formatEther(mcReserve));
        console.log("   JBC 储备:", ethers.formatEther(jbcReserve));
        
        // 6. 实际执行测试（小额）
        console.log("\n💧 执行小额测试 (1 MC + 1 JBC):");
        const smallAmount = ethers.parseEther("1");
        
        try {
            const tx = await protocol.addLiquidity(smallAmount, smallAmount);
            console.log("📝 交易哈希:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("✅ 交易成功，Gas 使用:", receipt.gasUsed.toString());
            
            // 检查更新后的池子
            const newMcReserve = await protocol.swapReserveMC();
            const newJbcReserve = await protocol.swapReserveJBC();
            console.log("🏊 更新后池子:");
            console.log("   MC 储备:", ethers.formatEther(newMcReserve));
            console.log("   JBC 储备:", ethers.formatEther(newJbcReserve));
            
        } catch (error) {
            console.log("❌ 实际执行失败:", error.message);
            console.log("   错误详情:", error);
        }
        
    } catch (error) {
        console.error("❌ 测试失败:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });