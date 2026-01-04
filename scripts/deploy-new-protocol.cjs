const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 从备份文件读取配置
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_OWNER = process.env.NEW_OWNER || "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48"; // JBC Token Owner

async function deployNewProtocol() {
  console.log("🚀 开始部署新协议合约\n");
  console.log("=" .repeat(60));
  
  // 1. 读取备份数据
  console.log("📋 步骤 1: 读取备份数据");
  if (!fs.existsSync(BACKUP_FILE)) {
    throw new Error(`备份文件不存在: ${BACKUP_FILE}`);
  }
  
  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
  console.log(`    ✅ 已读取备份文件: ${BACKUP_FILE}`);
  console.log(`    用户数量: ${backupData.users.length}`);
  console.log(`    配置参数: ${Object.keys(backupData.config).length} 项\n`);
  
  // 2. 获取部署者
  console.log("📋 步骤 2: 获取部署者信息");
  const [deployer] = await ethers.getSigners();
  console.log(`    部署者地址: ${deployer.address}`);
  console.log(`    部署者余额: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MC\n`);
  
  // 3. 部署协议合约（UUPS 代理）
  console.log("📋 步骤 3: 部署协议合约（UUPS 代理）");
  const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
  
  const protocol = await upgrades.deployProxy(
    JinbaoProtocolNative,
    [
      backupData.config.jbcToken,
      backupData.config.marketingWallet,
      backupData.config.treasuryWallet,
      backupData.config.lpInjectionWallet,
      backupData.config.buybackWallet
    ],
    {
      kind: 'uups',
      initializer: 'initialize'
    }
  );
  
  await protocol.waitForDeployment();
  const proxyAddress = await protocol.getAddress();
  console.log(`    ✅ 代理合约已部署: ${proxyAddress}\n`);
  
  // 获取实现合约地址
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`    📝 实现合约地址: ${implementationAddress}\n`);
  
  // 4. 验证初始化
  console.log("📋 步骤 4: 验证初始化");
  
  // 5. 设置配置参数
  console.log("📋 步骤 5: 设置配置参数");
  const owner = await protocol.owner();
  const jbcToken = await protocol.jbcToken();
  
  console.log(`    当前 Owner: ${owner}`);
  console.log(`    JBC Token: ${jbcToken}`);
  console.log(`    预期 Owner: ${NEW_OWNER}`);
  console.log(`    预期 JBC Token: ${backupData.config.jbcToken}\n`);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Owner 不匹配: 预期 ${deployer.address}, 实际 ${owner}`);
  }
  
  if (jbcToken.toLowerCase() !== backupData.config.jbcToken.toLowerCase()) {
    throw new Error(`JBC Token 不匹配: 预期 ${backupData.config.jbcToken}, 实际 ${jbcToken}`);
  }
  
  console.log(`    ✅ 初始化验证通过\n`);
  
  const configTx = await protocol.setDistributionConfig(
    backupData.config.directRewardPercent,
    backupData.config.levelRewardPercent,
    backupData.config.marketingPercent,
    backupData.config.buybackPercent,
    backupData.config.lpInjectionPercent,
    backupData.config.treasuryPercent
  );
  await configTx.wait();
  console.log(`    ✅ 分配比例已设置\n`);
  
  const walletTx = await protocol.setWallets(
    backupData.config.marketingWallet,
    backupData.config.treasuryWallet,
    backupData.config.lpInjectionWallet,
    backupData.config.buybackWallet
  );
  await walletTx.wait();
  console.log(`    ✅ 钱包地址已设置\n`);
  
  const feeTx = await protocol.setRedemptionFeePercent(backupData.config.redemptionFeePercent);
  await feeTx.wait();
  console.log(`    ✅ 赎回费用已设置\n`);
  
  const taxTx = await protocol.setSwapTaxes(
    backupData.config.swapBuyTax,
    backupData.config.swapSellTax
  );
  await taxTx.wait();
  console.log(`    ✅ 交换税费已设置\n`);
  
  const durationTx = await protocol.setTicketFlexibilityDuration(backupData.config.ticketFlexibilityDuration);
  await durationTx.wait();
  console.log(`    ✅ 门票灵活性时长已设置\n`);
  
  const statusTx = await protocol.setOperationalStatus(
    backupData.config.liquidityEnabled,
    backupData.config.redeemEnabled
  );
  await statusTx.wait();
  console.log(`    ✅ 操作状态已设置\n`);
  
  // 6. 转移 Owner
  console.log("📋 步骤 6: 转移 Owner");
  const transferTx = await protocol.transferOwnership(NEW_OWNER);
  await transferTx.wait();
  
  const newOwner = await protocol.owner();
  if (newOwner.toLowerCase() !== NEW_OWNER.toLowerCase()) {
    throw new Error(`Owner 转移失败: 预期 ${NEW_OWNER}, 实际 ${newOwner}`);
  }
  console.log(`    ✅ Owner 已转移: ${NEW_OWNER}\n`);
  
  // 7. 保存部署信息
  console.log("📋 步骤 7: 保存部署信息");
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    newOwner: NEW_OWNER,
    contracts: {
      implementation: implementationAddress,
      proxy: proxyAddress
    },
    backupFile: BACKUP_FILE,
    config: backupData.config
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `new-protocol-deployment-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`    ✅ 部署信息已保存: ${filepath}\n`);
  
  // 8. 输出摘要
  console.log("=" .repeat(60));
  console.log("✅ 新协议合约部署完成！");
  console.log("=" .repeat(60));
  console.log(`\n📋 部署信息:`);
  console.log(`    实现合约: ${implementationAddress}`);
  console.log(`    代理合约: ${proxyAddress}`);
  console.log(`    新 Owner: ${NEW_OWNER}`);
  console.log(`    配置参数: 已设置`);
  console.log(`\n⚠️  下一步:`);
  console.log(`    1. 验证合约功能: node scripts/verify-contract-functions.cjs ${proxyAddress}`);
  console.log(`    2. 对比新旧合约: node scripts/verify-contract-functions.cjs ${backupData.protocolAddress} ${proxyAddress}`);
  console.log(`    3. 测试业务功能: node scripts/test-contract-functions.cjs ${proxyAddress}`);
  console.log(`    4. 迁移用户数据: node scripts/migrate-user-data.cjs ${proxyAddress}`);
  console.log(`    5. 更新前端引用: 更新 src/Web3Context.tsx 中的合约地址`);
  console.log(`    6. 更新 JBC Token: 调用 JBC Token 的 setProtocol(${proxyAddress})`);
  
  return {
    implementationAddress,
    proxyAddress,
    deploymentInfo
  };
}

// 执行部署
if (require.main === module) {
  deployNewProtocol()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ 部署失败:", error);
      process.exit(1);
    });
}

module.exports = { deployNewProtocol };

