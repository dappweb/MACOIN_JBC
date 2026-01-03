const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔥 部署 DailyBurnManager 合约\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "MC\n");

  // V4 合约地址
  const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
  const JBC_TOKEN_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";

  console.log("协议合约:", PROTOCOL_ADDRESS);
  console.log("JBC 代币:", JBC_TOKEN_ADDRESS);

  try {
    // 部署 DailyBurnManager
    console.log("\n🚀 部署 DailyBurnManager...");
    const DailyBurnManager = await ethers.getContractFactory("DailyBurnManager");
    const dailyBurnManager = await DailyBurnManager.deploy(
      PROTOCOL_ADDRESS,
      JBC_TOKEN_ADDRESS
    );
    
    await dailyBurnManager.waitForDeployment();
    const managerAddress = await dailyBurnManager.getAddress();
    console.log("✅ DailyBurnManager 部署成功:", managerAddress);

    // 测试功能
    console.log("\n🧪 验证合约功能...");
    const canBurn = await dailyBurnManager.canBurn();
    const nextBurnTime = await dailyBurnManager.nextBurnTime();
    console.log("   可以燃烧:", canBurn ? "是" : "否");
    console.log("   下次燃烧:", new Date(Number(nextBurnTime) * 1000).toLocaleString());

    // 更新部署文件
    const deploymentPath = path.join(__dirname, '..', 'deployments', 'latest-mc-v4.json');
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    deployment.contracts.DailyBurnManager = managerAddress;
    deployment.lastUpdate = new Date().toISOString();
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\n📄 部署信息已更新");

    console.log("\n═══════════════════════════════════════════");
    console.log("🎉 DailyBurnManager 部署完成!");
    console.log("═══════════════════════════════════════════");
    console.log("\n合约地址:", managerAddress);
    console.log("\n⚠️ 请更新前端 CONTRACT_ADDRESSES:");
    console.log(`  DAILY_BURN_MANAGER: "${managerAddress}"`);

    return managerAddress;

  } catch (error) {
    console.error("\n❌ 部署失败:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
