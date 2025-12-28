const { ethers } = require("hardhat");

async function main() {
    console.log("🔥 为JinbaoProtocol添加每日燃烧功能");
    console.log("=====================================");
    
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 部署者:", deployer.address);
    
    try {
        // 方案1: 直接在主合约中添加dailyBurn函数
        console.log("📝 准备添加dailyBurn函数到主合约...");
        
        const dailyBurnCode = `
    // 每日燃烧功能 - 燃烧池子中1%的JBC
    function dailyBurn() external {
        require(block.timestamp >= lastBurnTime + 24 hours, "Early");
        
        uint256 jbcReserve = swapReserveJBC;
        require(jbcReserve > 0, "No JBC to burn");
        
        uint256 burnAmount = jbcReserve / 100; // 1%
        require(burnAmount > 0, "Burn amount too small");
        
        // 更新储备
        swapReserveJBC -= burnAmount;
        
        // 燃烧代币
        jbcToken.burn(burnAmount);
        
        // 更新最后燃烧时间
        lastBurnTime = block.timestamp;
        
        emit BuybackAndBurn(0, burnAmount);
    }`;
        
        console.log("📋 需要添加的代码:");
        console.log(dailyBurnCode);
        
        console.log("\n💡 实施步骤:");
        console.log("1. 将上述代码添加到 contracts/JinbaoProtocol.sol");
        console.log("2. 重新编译合约");
        console.log("3. 升级合约 (使用UUPS代理模式)");
        console.log("4. 验证功能");
        
        // 方案2: 部署扩展合约
        console.log("\n🔧 或者部署扩展合约...");
        
        // 检查是否可以部署扩展合约
        const DailyBurnExtension = await ethers.getContractFactory("DailyBurnExtension");
        console.log("✅ DailyBurnExtension 合约工厂已准备");
        
        // 估算部署成本
        const deployTx = await DailyBurnExtension.getDeployTransaction(PROTOCOL_ADDRESS);
        const gasEstimate = await ethers.provider.estimateGas(deployTx);
        console.log("⛽ 预估Gas:", gasEstimate.toString());
        
        // 部署扩展合约
        console.log("🚀 部署 DailyBurnExtension...");
        const extension = await DailyBurnExtension.deploy(PROTOCOL_ADDRESS);
        await extension.waitForDeployment();
        
        const extensionAddress = await extension.getAddress();
        console.log("✅ DailyBurnExtension 部署成功:", extensionAddress);
        
        // 测试扩展合约功能
        console.log("\n🧪 测试扩展合约功能...");
        
        const canBurn = await extension.canBurn();
        console.log("   可以燃烧:", canBurn);
        
        const nextBurnTime = await extension.nextBurnTime();
        const nextBurnDate = new Date(Number(nextBurnTime) * 1000);
        console.log("   下次燃烧时间:", nextBurnDate.toISOString());
        
        const burnAmount = await extension.getBurnAmount();
        console.log("   可燃烧数量:", ethers.formatEther(burnAmount), "JBC");
        
        // 保存部署信息
        const deploymentInfo = {
            extensionAddress,
            protocolAddress: PROTOCOL_ADDRESS,
            deployer: deployer.address,
            deployTime: new Date().toISOString(),
            canBurn,
            nextBurnTime: nextBurnTime.toString(),
            burnAmount: burnAmount.toString()
        };
        
        const fs = require('fs');
        fs.writeFileSync(
            'deployments/daily-burn-extension.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        console.log("\n📄 部署信息已保存到 deployments/daily-burn-extension.json");
        
        console.log("\n🎯 使用方法:");
        console.log("1. 直接调用扩展合约的 dailyBurn() 函数");
        console.log("2. 使用脚本: node scripts/daily-burn-via-extension.cjs");
        console.log("3. 集成到前端管理面板");
        
    } catch (error) {
        console.error("❌ 操作失败:", error.message);
        
        if (error.message.includes("DailyBurnExtension")) {
            console.log("\n💡 解决方案:");
            console.log("1. 确保 contracts/DailyBurnExtension.sol 文件存在");
            console.log("2. 运行 npx hardhat compile");
            console.log("3. 重新运行此脚本");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });