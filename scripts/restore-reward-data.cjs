const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 恢复奖励数据脚本
 * 从备份文件中恢复奖励相关数据到新合约
 */
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || process.argv[2];
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!NEW_PROTOCOL_ADDRESS) {
  console.error("❌ 请提供新协议合约地址");
  console.log("使用方法: NEW_PROTOCOL_ADDRESS=0x... node scripts/restore-reward-data.cjs");
  console.log("或: node scripts/restore-reward-data.cjs <新合约地址>");
  process.exit(1);
}

const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function adminSetLevelRewardPool(uint256 newLevelRewardPool) external",
  "function levelRewardPool() view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
];

async function restoreRewardData() {
  console.log("🚀 开始恢复奖励数据\n");
  console.log("=".repeat(60));
  
  // 1. 读取备份数据
  console.log("📋 步骤 1: 读取备份数据");
  if (!fs.existsSync(BACKUP_FILE)) {
    throw new Error(`备份文件不存在: ${BACKUP_FILE}`);
  }
  
  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
  console.log(`    ✅ 已读取备份文件: ${BACKUP_FILE}`);
  console.log(`    备份时间: ${backupData.timestamp}\n`);
  
  // 2. 连接到新合约
  console.log("📋 步骤 2: 连接到新合约");
  const [deployer] = await ethers.getSigners();
  const protocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
  
  console.log(`    部署者地址: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`    部署者余额: ${ethers.formatEther(balance)} MC`);
  
  // 验证 Owner
  const owner = await protocol.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${deployer.address}`);
  }
  console.log(`    ✅ Owner 验证通过\n`);
  
  // 3. 检查需要恢复的奖励数据
  console.log("📋 步骤 3: 检查奖励数据");
  const backupLevelRewardPool = backupData.balances?.levelRewardPool || "0";
  const currentLevelRewardPool = await protocol.levelRewardPool();
  
  console.log(`    备份等级奖励池: ${ethers.formatEther(backupLevelRewardPool)} MC`);
  console.log(`    当前等级奖励池: ${ethers.formatEther(currentLevelRewardPool)} MC`);
  
  if (backupLevelRewardPool === "0" || backupLevelRewardPool === 0) {
    console.log(`    ⚠️  备份文件中等级奖励池为 0，无需恢复\n`);
  } else if (currentLevelRewardPool.toString() === backupLevelRewardPool) {
    console.log(`    ⚠️  等级奖励池已是最新值，无需恢复\n`);
  } else {
    console.log(`    ✅ 需要恢复等级奖励池\n`);
  }
  
  if (DRY_RUN) {
    console.log("⚠️  干运行模式 - 不会实际执行恢复\n");
  }
  
  // 4. 恢复奖励数据
  console.log("📋 步骤 4: 恢复奖励数据");
  console.log("=".repeat(60));
  
  const restoreResults = {
    timestamp: new Date().toISOString(),
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    restored: {},
    failed: []
  };
  
  // 恢复等级奖励池
  if (backupLevelRewardPool !== "0" && backupLevelRewardPool !== 0 && 
      currentLevelRewardPool.toString() !== backupLevelRewardPool) {
    try {
      if (DRY_RUN) {
        console.log(`    🔍 [干运行] 将设置等级奖励池为: ${ethers.formatEther(backupLevelRewardPool)} MC`);
        restoreResults.restored.levelRewardPool = {
          status: "dry_run",
          oldValue: ethers.formatEther(currentLevelRewardPool),
          newValue: ethers.formatEther(backupLevelRewardPool)
        };
      } else {
        console.log(`    📤 设置等级奖励池: ${ethers.formatEther(backupLevelRewardPool)} MC`);
        const tx = await protocol.adminSetLevelRewardPool(backupLevelRewardPool);
        console.log(`    交易哈希: ${tx.hash}`);
        await tx.wait();
        
        // 验证恢复
        const restoredLevelRewardPool = await protocol.levelRewardPool();
        if (restoredLevelRewardPool.toString() === backupLevelRewardPool) {
          console.log(`    ✅ 等级奖励池恢复成功`);
          restoreResults.restored.levelRewardPool = {
            status: "success",
            oldValue: ethers.formatEther(currentLevelRewardPool),
            newValue: ethers.formatEther(restoredLevelRewardPool)
          };
        } else {
          console.log(`    ⚠️  等级奖励池恢复验证失败`);
          restoreResults.failed.push({
            item: "levelRewardPool",
            error: "验证失败",
            expected: backupLevelRewardPool,
            actual: restoredLevelRewardPool.toString()
          });
        }
      }
    } catch (error) {
      console.log(`    ❌ 等级奖励池恢复失败: ${error.message}`);
      restoreResults.failed.push({
        item: "levelRewardPool",
        error: error.message
      });
    }
  } else {
    console.log(`    ⏭️  跳过等级奖励池恢复（无需恢复）`);
    restoreResults.restored.levelRewardPool = {
      status: "skipped",
      reason: "无需恢复"
    };
  }
  
  // 5. 保存恢复结果
  console.log("\n" + "=".repeat(60));
  console.log("📊 恢复摘要");
  console.log("=".repeat(60));
  
  const restoredCount = Object.keys(restoreResults.restored).length;
  const failedCount = restoreResults.failed.length;
  
  console.log(`\n恢复项: ${restoredCount}`);
  console.log(`失败项: ${failedCount}`);
  
  // 保存结果
  const resultsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `reward-restore-results-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(restoreResults, null, 2));
  console.log(`\n📄 恢复结果已保存: ${resultsFile}`);
  
  // 6. 说明待发放奖励数据
  console.log("\n" + "=".repeat(60));
  console.log("ℹ️  关于待发放奖励数据");
  console.log("=".repeat(60));
  console.log(`
待发放的奖励数据（stakePendingRewards 和 ticketPendingRewards）在备份文件中没有存储，
因为这些奖励是在用户操作时动态计算的。

如果需要恢复待发放的奖励，需要：
1. 根据质押数据重新计算极差奖励（stakePendingRewards）
2. 根据门票数据重新计算等级奖励（ticketPendingRewards）

这需要知道当时的团队状态、等级等信息，比较复杂。

建议：
- 已恢复的质押数据会在用户下次领取奖励时自动计算极差奖励
- 已恢复的门票数据会在用户下次购买门票时自动计算等级奖励
- 或者等待用户正常操作时自动生成奖励数据
  `);
  
  return restoreResults;
}

restoreRewardData()
  .then(() => {
    console.log("\n" + "=".repeat(60));
    console.log("✅ 脚本执行完成");
    console.log("=".repeat(60));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n" + "=".repeat(60));
    console.error("❌ 脚本执行失败");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  });







