const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  console.log("🚀 MC链合约升级开始...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);
  
  // 获取账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC");

  // 使用环境变量中的代理地址
  const proxyAddress = process.env.PROXY_ADDRESS;
  
  if (!proxyAddress || proxyAddress === "0x...") {
    throw new Error("❌ 请在 .env 文件中设置 PROXY_ADDRESS");
  }

  console.log("🏠 代理合约地址:", proxyAddress);

  try {
    // 获取合约工厂
    console.log("📦 获取合约工厂...");
    const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocol");
    
    console.log("🔄 开始升级合约...");
    
    // 执行升级
    const upgraded = await upgrades.upgradeProxy(proxyAddress, JinbaoProtocol, {
      timeout: 300000, // 5分钟超时
    });
    
    console.log("⏳ 等待升级交易确认...");
    await upgraded.waitForDeployment();
    
    // 获取新的实现地址
    const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    
    console.log("\n✅ 升级成功!");
    console.log("📍 代理地址:", proxyAddress);
    console.log("📍 新实现地址:", newImplAddress);
    
    // 简单验证
    console.log("\n🔍 验证升级...");
    const upgradedContract = await hre.ethers.getContractAt("JinbaoProtocol", proxyAddress);
    
    try {
      // 测试新功能
      const testLevel = await upgradedContract.calculateLevel(100);
      console.log("✅ 新功能测试成功:");
      console.log("   100人团队 → V" + testLevel.level.toString() + " (" + testLevel.percent.toString() + "%)");
      
      const testLevel2 = await upgradedContract.calculateLevel(1000);
      console.log("   1000人团队 → V" + testLevel2.level.toString() + " (" + testLevel2.percent.toString() + "%)");
      
    } catch (error) {
      console.log("⚠️  新功能测试失败:", error.message);
    }

    console.log("\n🎉 MC链合约升级完成!");
    console.log("📋 新功能:");
    console.log("   ✅ V1-V9等级要求已更新");
    console.log("   ✅ 极差收益比例 5%-45%");
    console.log("   ✅ 增强的等级查询功能");

  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ 升级完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 升级失败:", error);
    process.exit(1);
  });