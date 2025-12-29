const { ethers } = require("hardhat");

/**
 * JBC 代币迁移脚本
 * 从旧 JBC 代币迁移到新 JBCv2 代币
 */

async function main() {
  console.log("🔄 开始 JBC 代币迁移流程...");
  
  const [deployer] = await ethers.getSigners();
  console.log("操作账户:", deployer.address);
  
  // 合约地址 (需要根据实际部署更新)
  const OLD_JBC_ADDRESS = process.env.OLD_JBC_CONTRACT_ADDRESS;
  const NEW_JBC_ADDRESS = process.env.NEW_JBC_CONTRACT_ADDRESS;
  
  if (!OLD_JBC_ADDRESS || !NEW_JBC_ADDRESS) {
    throw new Error("请设置 OLD_JBC_CONTRACT_ADDRESS 和 NEW_JBC_CONTRACT_ADDRESS 环境变量");
  }
  
  console.log("旧 JBC 合约:", OLD_JBC_ADDRESS);
  console.log("新 JBC 合约:", NEW_JBC_ADDRESS);
  
  // 连接合约
  const oldJBC = await ethers.getContractAt("JBC", OLD_JBC_ADDRESS);
  const newJBC = await ethers.getContractAt("JBCv2", NEW_JBC_ADDRESS);
  
  // 部署迁移合约
  console.log("\n📄 部署迁移合约...");
  const JBCMigration = await ethers.getContractFactory("JBCMigration");
  const migration = await JBCMigration.deploy(OLD_JBC_ADDRESS, NEW_JBC_ADDRESS);
  await migration.waitForDeployment();
  
  const migrationAddress = await migration.getAddress();
  console.log("✅ 迁移合约地址:", migrationAddress);
  
  // 设置迁移合约为新代币的铸造者
  console.log("\n🔧 配置迁移权限...");
  await newJBC.setMinter(migrationAddress, true);
  console.log("✅ 迁移合约已获得铸造权限");
  
  // 获取迁移统计
  console.log("\n📊 迁移前状态:");
  
  const oldTotalSupply = await oldJBC.totalSupply();
  const newTotalSupply = await newJBC.totalSupply();
  
  console.log("旧 JBC 总供应量:", ethers.formatEther(oldTotalSupply));
  console.log("新 JBC 总供应量:", ethers.formatEther(newTotalSupply));
  
  // 检查用户余额 (示例)
  const userBalance = await oldJBC.balanceOf(deployer.address);
  console.log("用户旧 JBC 余额:", ethers.formatEther(userBalance));
  
  // 执行迁移 (如果用户有余额)
  if (userBalance > 0) {
    console.log("\n🔄 执行代币迁移...");
    
    // 授权迁移合约
    console.log("1. 授权迁移合约...");
    await oldJBC.approve(migrationAddress, userBalance);
    
    // 执行迁移
    console.log("2. 执行迁移...");
    await migration.migrate(userBalance);
    
    // 验证迁移结果
    const newUserBalance = await newJBC.balanceOf(deployer.address);
    console.log("✅ 迁移完成!");
    console.log("新 JBC 余额:", ethers.formatEther(newUserBalance));
  }
  
  // 保存迁移信息
  const migrationInfo = {
    timestamp: new Date().toISOString(),
    network: await deployer.provider.getNetwork(),
    contracts: {
      oldJBC: OLD_JBC_ADDRESS,
      newJBC: NEW_JBC_ADDRESS,
      migration: migrationAddress
    },
    statistics: {
      oldTotalSupply: ethers.formatEther(oldTotalSupply),
      newTotalSupply: ethers.formatEther(newTotalSupply),
      userMigrated: ethers.formatEther(userBalance)
    }
  };
  
  console.log("\n💾 保存迁移信息...");
  const fs = require('fs');
  const path = require('path');
  
  fs.writeFileSync(
    path.join(__dirname, '../deployments/jbc-migration.json'),
    JSON.stringify(migrationInfo, null, 2)
  );
  
  console.log("\n🎉 迁移流程完成!");
  console.log("📋 迁移合约:", migrationAddress);
  
  return migrationAddress;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ 迁移失败:", error);
      process.exit(1);
    });
}

module.exports = main;