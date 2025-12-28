const { ethers } = require("hardhat");

async function main() {
    console.log("💧 合约拥有者添加流动性工具");
    console.log("=====================================");
    
    // 合约地址
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    const MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    const JBC_TOKEN = "0xA743cB357a9f59D349efB7985072779a094658dD";
    
    // 要添加的流动性数量（可以修改这些值）
    const MC_AMOUNT = "1000"; // 1000 MC
    const JBC_AMOUNT = "1000"; // 1000 JBC
    
    const [signer] = await ethers.getSigners();
    console.log("👤 使用账户:", signer.address);
    
    try {
        // 获取合约实例
        const protocol = await ethers.getContractAt("JinbaoProtocol", PROTOCOL_ADDRESS);
        const mcToken = await ethers.getContractAt("IERC20", MC_TOKEN);
        const jbcToken = await ethers.getContractAt("IERC20", JBC_TOKEN);
        
        console.log("📊 检查当前状态...");
        
        // 检查余额
        const mcBalance = await mcToken.balanceOf(signer.address);
        const jbcBalance = await jbcToken.balanceOf(signer.address);
        
        console.log("💳 您的余额:");
        console.log("   MC:", ethers.formatEther(mcBalance));
        console.log("   JBC:", ethers.formatEther(jbcBalance));
        
        // 检查当前池子
        const mcReserve = await protocol.swapReserveMC();
        const jbcReserve = await protocol.swapReserveJBC();
        
        console.log("🏊 当前池子:");
        console.log("   MC 储备:", ethers.formatEther(mcReserve));
        console.log("   JBC 储备:", ethers.formatEther(jbcReserve));
        
        // 转换为 Wei
        const mcAmountWei = ethers.parseEther(MC_AMOUNT);
        const jbcAmountWei = ethers.parseEther(JBC_AMOUNT);
        
        console.log("💧 准备添加流动性:");
        console.log("   MC 数量:", MC_AMOUNT);
        console.log("   JBC 数量:", JBC_AMOUNT);
        
        // 检查余额是否足够
        if (mcBalance < mcAmountWei) {
            console.log("❌ MC 余额不足");
            return;
        }
        if (jbcBalance < jbcAmountWei) {
            console.log("❌ JBC 余额不足");
            return;
        }
        
        // 检查并授权 MC
        console.log("🔐 检查 MC 授权...");
        const mcAllowance = await mcToken.allowance(signer.address, PROTOCOL_ADDRESS);
        if (mcAllowance < mcAmountWei) {
            console.log("📝 授权 MC 代币...");
            const approveTx = await mcToken.approve(PROTOCOL_ADDRESS, ethers.MaxUint256);
            await approveTx.wait();
            console.log("✅ MC 授权完成");
        } else {
            console.log("✅ MC 已授权");
        }
        
        // 检查并授权 JBC
        console.log("🔐 检查 JBC 授权...");
        const jbcAllowance = await jbcToken.allowance(signer.address, PROTOCOL_ADDRESS);
        if (jbcAllowance < jbcAmountWei) {
            console.log("📝 授权 JBC 代币...");
            const approveTx = await jbcToken.approve(PROTOCOL_ADDRESS, ethers.MaxUint256);
            await approveTx.wait();
            console.log("✅ JBC 授权完成");
        } else {
            console.log("✅ JBC 已授权");
        }
        
        // 添加流动性
        console.log("💧 添加流动性...");
        const addLiquidityTx = await protocol.addLiquidity(mcAmountWei, jbcAmountWei);
        console.log("📝 交易哈希:", addLiquidityTx.hash);
        
        console.log("⏳ 等待交易确认...");
        await addLiquidityTx.wait();
        
        console.log("🎉 流动性添加成功！");
        
        // 检查更新后的池子状态
        const newMcReserve = await protocol.swapReserveMC();
        const newJbcReserve = await protocol.swapReserveJBC();
        
        console.log("🏊 更新后的池子:");
        console.log("   MC 储备:", ethers.formatEther(newMcReserve));
        console.log("   JBC 储备:", ethers.formatEther(newJbcReserve));
        
        console.log("📈 增加量:");
        console.log("   MC 增加:", ethers.formatEther(newMcReserve - mcReserve));
        console.log("   JBC 增加:", ethers.formatEther(newJbcReserve - jbcReserve));
        
    } catch (error) {
        console.error("❌ 操作失败:", error);
        
        // 解析常见错误
        if (error.message.includes("OwnableUnauthorizedAccount")) {
            console.log("🚨 权限错误：您不是合约拥有者");
            console.log("💡 解决方案：");
            console.log("   1. 确认使用正确的钱包地址");
            console.log("   2. 检查网络连接");
            console.log("   3. 验证合约地址是否正确");
        } else if (error.message.includes("insufficient")) {
            console.log("🚨 余额不足");
        } else if (error.message.includes("allowance")) {
            console.log("🚨 授权问题");
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main };