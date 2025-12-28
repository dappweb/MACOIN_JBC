const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔥 部署每日燃烧管理合约");
    console.log("========================");
    
    const networkName = hre.network.name;
    
    // 获取部署信息
    const deploymentFile = path.join(__dirname, `../deployments/latest-${networkName}.json`);
    if (!fs.existsSync(deploymentFile)) {
        console.error(`❌ 找不到部署文件: ${deploymentFile}`);
        process.exit(1);
    }
    
    const deploymentData = JSON.parse(fs.readFileSync(deploymentFile));
    const PROTOCOL_ADDRESS = deploymentData.protocolProxy;
    const JBC_TOKEN_ADDRESS = deploymentData.jbcToken;
    
    if (!PROTOCOL_ADDRESS || !JBC_TOKEN_ADDRESS) {
        console.error("❌ 缺少必要的合约地址");
        console.log("Protocol:", PROTOCOL_ADDRESS);
        console.log("JBC Token:", JBC_TOKEN_ADDRESS);
        process.exit(1);
    }
    
    console.log("📋 部署参数:");
    console.log("   网络:", networkName);
    console.log("   协议合约:", PROTOCOL_ADDRESS);
    console.log("   JBC代币:", JBC_TOKEN_ADDRESS);
    
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("👤 部署者:", deployer.address);
    
    // 检查余额
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 余额:", ethers.formatEther(balance), "ETH");
    
    // 部署DailyBurnManager合约
    console.log("\n🚀 部署DailyBurnManager合约...");
    const DailyBurnManager = await ethers.getContractFactory("DailyBurnManager");
    
    // 预估gas
    const deploymentData_contract = await DailyBurnManager.getDeployTransaction(
        PROTOCOL_ADDRESS,
        JBC_TOKEN_ADDRESS
    );
    const estimatedGas = await deployer.estimateGas(deploymentData_contract);
    console.log("⛽ 预估Gas:", estimatedGas.toString());
    
    const dailyBurnManager = await DailyBurnManager.deploy(
        PROTOCOL_ADDRESS,
        JBC_TOKEN_ADDRESS
    );
    
    await dailyBurnManager.waitForDeployment();
    const managerAddress = await dailyBurnManager.getAddress();
    
    console.log("✅ DailyBurnManager 部署成功:", managerAddress);
    
    // 测试合约功能
    console.log("\n🧪 测试合约功能...");
    try {
        const canBurn = await dailyBurnManager.canBurn();
        const nextBurnTime = await dailyBurnManager.nextBurnTime();
        const burnAmount = await dailyBurnManager.getBurnAmount();
        const timeUntilNext = await dailyBurnManager.timeUntilNextBurn();
        
        console.log("   可以燃烧:", canBurn ? "✅ 是" : "❌ 否");
        console.log("   下次燃烧时间:", new Date(Number(nextBurnTime) * 1000).toISOString());
        console.log("   可燃烧数量:", ethers.formatEther(burnAmount), "JBC");
        console.log("   距离下次燃烧:", Math.floor(Number(timeUntilNext) / 3600), "小时");
        
        console.log("✅ 合约功能测试通过");
    } catch (error) {
        console.error("❌ 合约功能测试失败:", error.message);
    }
    
    // 更新部署文件
    deploymentData.dailyBurnManager = managerAddress;
    deploymentData.lastUpdate = new Date().toISOString();
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log(`📄 已更新部署文件: ${deploymentFile}`);
    
    // 创建使用说明
    const usageInstructions = `
# 每日燃烧管理合约使用说明

## 合约地址
- DailyBurnManager: ${managerAddress}
- Protocol: ${PROTOCOL_ADDRESS}
- JBC Token: ${JBC_TOKEN_ADDRESS}

## 使用方法

### 1. 检查燃烧状态
\`\`\`javascript
const canBurn = await dailyBurnManager.canBurn();
const burnAmount = await dailyBurnManager.getBurnAmount();
const timeUntilNext = await dailyBurnManager.timeUntilNextBurn();
\`\`\`

### 2. 执行燃烧
\`\`\`javascript
const tx = await dailyBurnManager.dailyBurn();
await tx.wait();
\`\`\`

### 3. 前端集成
更新 Web3Context.tsx 中的合约地址：
\`\`\`typescript
const DAILY_BURN_MANAGER = "${managerAddress}";
\`\`\`

## 注意事项
- 任何人都可以调用 dailyBurn() 函数
- 燃烧间隔：24小时
- 燃烧比例：池子JBC储备的1%
- 当前版本只记录事件，需要主合约支持才能实际燃烧
`;
    
    fs.writeFileSync(
        path.join(__dirname, `../DAILY_BURN_MANAGER_USAGE.md`),
        usageInstructions
    );
    
    console.log("\n🎉 部署完成！");
    console.log("📖 使用说明已保存到: DAILY_BURN_MANAGER_USAGE.md");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });