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
    // 获取合约工厂 - 尝试使用 JinbaoProtocolV4
    console.log("📦 获取合约工厂...");
    let JinbaoProtocol;
    let contractName = "JinbaoProtocolV4";
    
    try {
      JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocolV4");
    } catch (error) {
      console.log("⚠️  JinbaoProtocolV4 未找到，尝试使用 JinbaoProtocol...");
      contractName = "JinbaoProtocol";
      JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocol");
    }
    
    console.log(`🔄 开始升级合约 (${contractName})...`);
    
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
    const upgradedContract = await hre.ethers.getContractAt(contractName, proxyAddress);
    
    try {
      // 测试基本功能
      const mcToken = await upgradedContract.mcToken();
      const jbcToken = await upgradedContract.jbcToken();
      console.log("✅ 合约验证成功:");
      console.log("   MC Token:", mcToken);
      console.log("   JBC Token:", jbcToken);
      
      // 测试等级功能（如果存在）
      try {
        const testLevel = await upgradedContract.calculateLevel(100);
        console.log("   100人团队 → V" + testLevel.level.toString() + " (" + testLevel.percent.toString() + "%)");
        
        const testLevel2 = await upgradedContract.calculateLevel(1000);
        console.log("   1000人团队 → V" + testLevel2.level.toString() + " (" + testLevel2.percent.toString() + "%)");
      } catch (error) {
        // 等级功能可能不存在，忽略
      }
      
    } catch (error) {
      console.log("⚠️  验证测试失败:", error.message);
    }

    // 保存升级信息
    const fs = require('fs');
    const path = require('path');
    const upgradeInfo = {
      network: "MC Chain",
      chainId: 88813,
      type: "upgrade",
      timestamp: new Date().toISOString(),
      proxyAddress: proxyAddress,
      implementationAddress: newImplAddress,
      contractName: contractName,
      deployer: (await hre.ethers.getSigners())[0].address,
        changes: [
          "级差奖励计算逻辑更新: 基于赎回时的静态收益计算，而不是质押金额",
          "移除质押时的级差奖励计算",
          "在赎回时基于静态收益计算并分配级差奖励",
          "级差奖励的MC和JBC从静态奖励的MC和JBC中按比例分配",
          "级差奖励的MC和JBC比例与静态奖励一致（50% MC + 50% JBC）",
          "如果JBC余额不足，通过AMM交换MC获得JBC"
        ]
    };

    const deploymentDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    const upgradePath = path.join(deploymentDir, `mc-chain-upgrade-${Date.now()}.json`);
    fs.writeFileSync(upgradePath, JSON.stringify(upgradeInfo, null, 2));
    console.log(`\n📄 升级信息已保存到: ${upgradePath}`);

    console.log("\n🎉 MC链合约升级完成!");
    console.log("📋 更新内容:");
    console.log("   ✅ 级差奖励基于静态收益计算");
    console.log("   ✅ 移除质押时的级差奖励计算");
    console.log("   ✅ 在赎回时计算并分配级差奖励");
    console.log("   ✅ 级差奖励的MC和JBC从静态奖励中按比例分配");
    console.log("   ✅ 级差奖励保持50% MC + 50% JBC比例");
    console.log("   ✅ JBC通过AMM交换获得（如果余额不足）");
    if (contractName === "JinbaoProtocolV4") {
      console.log("   ✅ V1-V9等级要求已更新");
      console.log("   ✅ 极差收益比例 5%-45%");
      console.log("   ✅ 增强的等级查询功能");
    }

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