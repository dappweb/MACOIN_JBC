const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 恢复质押数据脚本
 * 从备份文件中恢复用户的质押数据到新合约
 */
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || process.argv[2];
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "5");
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!NEW_PROTOCOL_ADDRESS) {
  console.error("❌ 请提供新协议合约地址");
  console.log("使用方法: NEW_PROTOCOL_ADDRESS=0x... node scripts/restore-stake-data.cjs");
  console.log("或: node scripts/restore-stake-data.cjs <新合约地址>");
  process.exit(1);
}

const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function adminAddUserStake(address user, uint256 stakeId, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid) external",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function restoreStakeData() {
  console.log("🚀 开始恢复质押数据\n");
  console.log("=".repeat(60));
  
  // 1. 读取备份数据
  console.log("📋 步骤 1: 读取备份数据");
  if (!fs.existsSync(BACKUP_FILE)) {
    throw new Error(`备份文件不存在: ${BACKUP_FILE}`);
  }
  
  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
  console.log(`    ✅ 已读取备份文件: ${BACKUP_FILE}`);
  console.log(`    用户数量: ${backupData.users.length}\n`);
  
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
  
  // 3. 筛选需要恢复质押数据的用户
  console.log("📋 步骤 3: 筛选需要恢复的用户");
  const usersToRestore = [];
  let totalStakes = 0;
  
  for (const user of backupData.users) {
    if (user.userStakes && user.userStakes.length > 0) {
      usersToRestore.push(user);
      totalStakes += user.userStakes.length;
    }
  }
  
  console.log(`    总用户数: ${backupData.users.length}`);
  console.log(`    有质押数据: ${usersToRestore.length}`);
  console.log(`    总质押记录: ${totalStakes}\n`);
  
  if (DRY_RUN) {
    console.log("⚠️  干运行模式 - 不会实际执行恢复\n");
  }
  
  // 4. 恢复质押数据
  console.log("📋 步骤 4: 恢复质押数据");
  console.log("=".repeat(60));
  
  const restoreResults = {
    timestamp: new Date().toISOString(),
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    totalUsers: usersToRestore.length,
    totalStakes: totalStakes,
    restored: [],
    failed: [],
    skipped: []
  };
  
  let processed = 0;
  let successCount = 0;
  let failCount = 0;
  let stakeCount = 0;
  
  // 按批次处理
  for (let i = 0; i < usersToRestore.length; i += BATCH_SIZE) {
    const batch = usersToRestore.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(usersToRestore.length / BATCH_SIZE);
    
    console.log(`\n📦 批次 ${batchNum}/${totalBatches} (${batch.length} 个用户)`);
    
    for (const user of batch) {
      try {
        const userAddr = user.address;
        const stakes = user.userStakes || [];
        
        if (stakes.length === 0) {
          console.log(`    ⏭️  跳过 ${userAddr} (无质押数据)`);
          restoreResults.skipped.push({
            address: userAddr,
            reason: "无质押数据"
          });
          continue;
        }
        
        if (DRY_RUN) {
          console.log(`    🔍 [干运行] 将恢复 ${userAddr} (${stakes.length} 条质押记录)`);
          for (const stake of stakes) {
            console.log(`        质押 ID: ${stake.id}, 金额: ${ethers.formatEther(stake.amount)} MC, 周期: ${stake.cycleDays} 天, 活跃: ${stake.active}`);
          }
          restoreResults.restored.push({
            address: userAddr,
            status: "dry_run",
            stakes: stakes.length,
            stakeData: stakes
          });
          successCount++;
          stakeCount += stakes.length;
        } else {
          // 恢复每个质押记录
          const txs = [];
          for (const stake of stakes) {
            try {
              const tx = await protocol.adminAddUserStake(
                userAddr,
                stake.id,
                stake.amount,
                stake.startTime,
                stake.cycleDays,
                stake.active,
                stake.paid
              );
              txs.push(tx);
              console.log(`    📤 ${userAddr} 添加质押 ID ${stake.id}: ${tx.hash}`);
            } catch (error) {
              console.log(`    ⚠️  ${userAddr} 质押 ID ${stake.id} 添加失败: ${error.message}`);
              // 继续处理其他质押记录
            }
          }
          
          // 等待所有交易确认
          if (txs.length > 0) {
            console.log(`    ⏳ 等待 ${txs.length} 个交易确认...`);
            await Promise.all(txs.map(tx => tx.wait()));
            console.log(`    ✅ ${userAddr} 恢复成功 (${txs.length} 条质押记录)`);
            restoreResults.restored.push({
              address: userAddr,
              status: "success",
              stakes: txs.length,
              stakeData: stakes.slice(0, txs.length)
            });
            successCount++;
            stakeCount += txs.length;
          } else {
            console.log(`    ⚠️  ${userAddr} 所有质押记录添加失败`);
            restoreResults.failed.push({
              address: userAddr,
              error: "所有质押记录添加失败",
              stakes: stakes
            });
            failCount++;
          }
        }
        
        processed++;
        
        // 每 10 个用户显示进度
        if (processed % 10 === 0) {
          console.log(`\n    进度: ${processed}/${usersToRestore.length} (成功: ${successCount}, 失败: ${failCount}, 质押记录: ${stakeCount})`);
        }
        
      } catch (error) {
        console.log(`    ❌ ${user.address} 恢复失败: ${error.message}`);
        restoreResults.failed.push({
          address: user.address,
          error: error.message
        });
        failCount++;
        processed++;
      }
    }
    
    // 批次间暂停，避免 RPC 限制
    if (i + BATCH_SIZE < usersToRestore.length && !DRY_RUN) {
      console.log(`\n    ⏸️  等待 2 秒后继续下一批次...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 5. 保存恢复结果
  console.log("\n" + "=".repeat(60));
  console.log("📊 恢复摘要");
  console.log("=".repeat(60));
  console.log(`\n总用户数: ${usersToRestore.length}`);
  console.log(`总质押记录: ${totalStakes}`);
  console.log(`成功恢复: ${successCount} 用户`);
  console.log(`恢复失败: ${failCount} 用户`);
  console.log(`跳过: ${restoreResults.skipped.length} 用户`);
  console.log(`恢复质押记录: ${stakeCount} 条`);
  
  // 保存结果
  const resultsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `stake-restore-results-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(restoreResults, null, 2));
  console.log(`\n📄 恢复结果已保存: ${resultsFile}`);
  
  return restoreResults;
}

restoreStakeData()
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







