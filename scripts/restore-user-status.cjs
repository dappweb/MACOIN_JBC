const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 恢复用户状态数据脚本
 * 从备份文件中恢复用户的完整状态数据到新合约
 */
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || process.argv[2];
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10");
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!NEW_PROTOCOL_ADDRESS) {
  console.error("❌ 请提供新协议合约地址");
  console.log("使用方法: NEW_PROTOCOL_ADDRESS=0x... node scripts/restore-user-status.cjs");
  console.log("或: node scripts/restore-user-status.cjs <新合约地址>");
  process.exit(1);
}

const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function adminSetActiveDirects(address user, uint256 newActiveDirects) external",
  "function adminSetTeamCount(address user, uint256 newTeamCount) external",
  "function adminSetTotalRevenue(address user, uint256 newTotalRevenue) external",
  "function adminSetCurrentCap(address user, uint256 newCurrentCap) external",
  "function adminSetMaxTicketAmounts(address user, uint256 newMaxTicketAmount, uint256 newMaxSingleTicketAmount) external",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function restoreUserStatus() {
  console.log("🚀 开始恢复用户状态数据\n");
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
  
  // 3. 筛选需要恢复的用户
  console.log("📋 步骤 3: 筛选需要恢复的用户");
  const usersToRestore = backupData.users.filter(user => {
    const info = user.userInfo;
    // 只恢复有状态数据的用户
    return info.activeDirects !== "0" || 
           info.teamCount !== "0" || 
           info.totalRevenue !== "0" ||
           info.currentCap !== "0" ||
           info.maxTicketAmount !== "0" ||
           info.maxSingleTicketAmount !== "0";
  });
  
  console.log(`    总用户数: ${backupData.users.length}`);
  console.log(`    需要恢复: ${usersToRestore.length}\n`);
  
  if (DRY_RUN) {
    console.log("⚠️  干运行模式 - 不会实际执行恢复\n");
  }
  
  // 4. 恢复用户状态数据
  console.log("📋 步骤 4: 恢复用户状态数据");
  console.log("=".repeat(60));
  
  const restoreResults = {
    timestamp: new Date().toISOString(),
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    totalUsers: usersToRestore.length,
    restored: [],
    failed: [],
    skipped: []
  };
  
  let processed = 0;
  let successCount = 0;
  let failCount = 0;
  
  // 按批次处理
  for (let i = 0; i < usersToRestore.length; i += BATCH_SIZE) {
    const batch = usersToRestore.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(usersToRestore.length / BATCH_SIZE);
    
    console.log(`\n📦 批次 ${batchNum}/${totalBatches} (${batch.length} 个用户)`);
    
    for (const user of batch) {
      try {
        const userAddr = user.address;
        const info = user.userInfo;
        
        // 检查当前状态
        const currentInfo = await protocol.userInfo(userAddr);
        
        // 检查是否需要恢复
        const needsRestore = 
          currentInfo.activeDirects.toString() !== info.activeDirects ||
          currentInfo.teamCount.toString() !== info.teamCount ||
          currentInfo.totalRevenue.toString() !== info.totalRevenue ||
          currentInfo.currentCap.toString() !== info.currentCap ||
          currentInfo.maxTicketAmount.toString() !== info.maxTicketAmount ||
          currentInfo.maxSingleTicketAmount.toString() !== info.maxSingleTicketAmount;
        
        if (!needsRestore) {
          console.log(`    ⏭️  跳过 ${userAddr} (状态已是最新)`);
          restoreResults.skipped.push({
            address: userAddr,
            reason: "状态已是最新"
          });
          continue;
        }
        
        if (DRY_RUN) {
          console.log(`    🔍 [干运行] 将恢复 ${userAddr}`);
          console.log(`        活跃直推: ${info.activeDirects} (当前: ${currentInfo.activeDirects})`);
          console.log(`        团队数量: ${info.teamCount} (当前: ${currentInfo.teamCount})`);
          console.log(`        总收益: ${ethers.formatEther(info.totalRevenue)} MC (当前: ${ethers.formatEther(currentInfo.totalRevenue)})`);
          console.log(`        收益上限: ${ethers.formatEther(info.currentCap)} MC (当前: ${ethers.formatEther(currentInfo.currentCap)})`);
          console.log(`        最大门票: ${ethers.formatEther(info.maxTicketAmount)} MC`);
          console.log(`        最大单次: ${ethers.formatEther(info.maxSingleTicketAmount)} MC`);
          restoreResults.restored.push({
            address: userAddr,
            status: "dry_run",
            data: info
          });
          successCount++;
        } else {
          // 恢复用户状态数据
          const txs = [];
          
          // 1. 恢复活跃直推数
          if (currentInfo.activeDirects.toString() !== info.activeDirects) {
            const tx1 = await protocol.adminSetActiveDirects(userAddr, info.activeDirects);
            txs.push(tx1);
            console.log(`    📤 ${userAddr} 设置活跃直推: ${tx1.hash}`);
          }
          
          // 2. 恢复团队数量
          if (currentInfo.teamCount.toString() !== info.teamCount) {
            const tx2 = await protocol.adminSetTeamCount(userAddr, info.teamCount);
            txs.push(tx2);
            console.log(`    📤 ${userAddr} 设置团队数量: ${tx2.hash}`);
          }
          
          // 3. 恢复总收益
          if (currentInfo.totalRevenue.toString() !== info.totalRevenue) {
            const tx3 = await protocol.adminSetTotalRevenue(userAddr, info.totalRevenue);
            txs.push(tx3);
            console.log(`    📤 ${userAddr} 设置总收益: ${tx3.hash}`);
          }
          
          // 4. 恢复收益上限
          if (currentInfo.currentCap.toString() !== info.currentCap) {
            const tx4 = await protocol.adminSetCurrentCap(userAddr, info.currentCap);
            txs.push(tx4);
            console.log(`    📤 ${userAddr} 设置收益上限: ${tx4.hash}`);
          }
          
          // 5. 恢复最大门票金额
          if (currentInfo.maxTicketAmount.toString() !== info.maxTicketAmount ||
              currentInfo.maxSingleTicketAmount.toString() !== info.maxSingleTicketAmount) {
            const tx5 = await protocol.adminSetMaxTicketAmounts(
              userAddr,
              info.maxTicketAmount,
              info.maxSingleTicketAmount
            );
            txs.push(tx5);
            console.log(`    📤 ${userAddr} 设置最大门票金额: ${tx5.hash}`);
          }
          
          // 等待所有交易确认
          if (txs.length > 0) {
            console.log(`    ⏳ 等待 ${txs.length} 个交易确认...`);
            await Promise.all(txs.map(tx => tx.wait()));
            console.log(`    ✅ ${userAddr} 恢复成功`);
            restoreResults.restored.push({
              address: userAddr,
              status: "success",
              transactions: txs.length,
              data: info
            });
            successCount++;
          } else {
            console.log(`    ⏭️  ${userAddr} 无需恢复`);
            restoreResults.skipped.push({
              address: userAddr,
              reason: "无需恢复"
            });
          }
        }
        
        processed++;
        
        // 每 10 个用户显示进度
        if (processed % 10 === 0) {
          console.log(`\n    进度: ${processed}/${usersToRestore.length} (成功: ${successCount}, 失败: ${failCount})`);
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
  console.log(`成功恢复: ${successCount}`);
  console.log(`恢复失败: ${failCount}`);
  console.log(`跳过: ${restoreResults.skipped.length}`);
  
  // 保存结果
  const resultsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `user-status-restore-results-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(restoreResults, null, 2));
  console.log(`\n📄 恢复结果已保存: ${resultsFile}`);
  
  return restoreResults;
}

restoreUserStatus()
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



