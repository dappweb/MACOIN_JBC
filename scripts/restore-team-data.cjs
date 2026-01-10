const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 恢复团队数据脚本
 * 从备份文件中恢复用户的团队数据到新合约
 */
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || process.argv[2];
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10");
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!NEW_PROTOCOL_ADDRESS) {
  console.error("❌ 请提供新协议合约地址");
  console.log("使用方法: NEW_PROTOCOL_ADDRESS=0x... node scripts/restore-team-data.cjs");
  console.log("或: node scripts/restore-team-data.cjs <新合约地址>");
  process.exit(1);
}

const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
  "function adminSetTeamTotalCap(address user, uint256 newTeamTotalCap) external",
  "function adminAddDirectReferral(address referrer, address referral) external",
  "function directReferrals(address, uint256) view returns (address)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function restoreTeamData() {
  console.log("🚀 开始恢复团队数据\n");
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
  const usersToRestore = [];
  let totalReferrals = 0;
  
  for (const user of backupData.users) {
    const info = user.userInfo;
    const referrals = user.directReferrals || [];
    
    // 需要恢复团队数据的用户
    const needsRestore = 
      (info.teamTotalVolume && info.teamTotalVolume !== "0") ||
      (info.teamTotalCap && info.teamTotalCap !== "0") ||
      (referrals && referrals.length > 0);
    
    if (needsRestore) {
      usersToRestore.push(user);
      totalReferrals += referrals.length;
    }
  }
  
  console.log(`    总用户数: ${backupData.users.length}`);
  console.log(`    需要恢复: ${usersToRestore.length}`);
  console.log(`    总直推记录: ${totalReferrals}\n`);
  
  if (DRY_RUN) {
    console.log("⚠️  干运行模式 - 不会实际执行恢复\n");
  }
  
  // 4. 恢复团队数据
  console.log("📋 步骤 4: 恢复团队数据");
  console.log("=".repeat(60));
  
  const restoreResults = {
    timestamp: new Date().toISOString(),
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    totalUsers: usersToRestore.length,
    totalReferrals: totalReferrals,
    restored: [],
    failed: [],
    skipped: []
  };
  
  let processed = 0;
  let successCount = 0;
  let failCount = 0;
  let referralCount = 0;
  
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
        const referrals = user.directReferrals || [];
        
        // 检查当前状态
        const currentInfo = await protocol.userInfo(userAddr);
        
        if (DRY_RUN) {
          console.log(`    🔍 [干运行] 将恢复 ${userAddr}`);
          if (info.teamTotalVolume && info.teamTotalVolume !== "0") {
            console.log(`        团队总交易量: ${ethers.formatEther(info.teamTotalVolume)} MC (当前: ${ethers.formatEther(currentInfo.teamTotalVolume)})`);
          }
          if (info.teamTotalCap && info.teamTotalCap !== "0") {
            console.log(`        团队总上限: ${ethers.formatEther(info.teamTotalCap)} MC (当前: ${ethers.formatEther(currentInfo.teamTotalCap)})`);
          }
          if (referrals.length > 0) {
            console.log(`        直推用户: ${referrals.length} 个`);
          }
          restoreResults.restored.push({
            address: userAddr,
            status: "dry_run",
            teamTotalVolume: info.teamTotalVolume,
            teamTotalCap: info.teamTotalCap,
            referrals: referrals.length
          });
          successCount++;
          referralCount += referrals.length;
        } else {
          // 恢复团队数据
          const txs = [];
          
          // 1. 恢复团队总交易量
          if (info.teamTotalVolume && info.teamTotalVolume !== "0" && 
              currentInfo.teamTotalVolume.toString() !== info.teamTotalVolume) {
            const tx1 = await protocol.adminSetTeamTotalVolume(userAddr, info.teamTotalVolume);
            txs.push(tx1);
            console.log(`    📤 ${userAddr} 设置团队总交易量: ${tx1.hash}`);
          }
          
          // 2. 恢复团队总上限
          if (info.teamTotalCap && info.teamTotalCap !== "0" && 
              currentInfo.teamTotalCap.toString() !== info.teamTotalCap) {
            const tx2 = await protocol.adminSetTeamTotalCap(userAddr, info.teamTotalCap);
            txs.push(tx2);
            console.log(`    📤 ${userAddr} 设置团队总上限: ${tx2.hash}`);
          }
          
          // 3. 恢复直推列表
          for (const referral of referrals) {
            try {
              const tx3 = await protocol.adminAddDirectReferral(userAddr, referral);
              txs.push(tx3);
              console.log(`    📤 ${userAddr} 添加直推 ${referral}: ${tx3.hash}`);
            } catch (error) {
              // 可能已存在，继续处理
              if (!error.message.includes("已存在")) {
                console.log(`    ⚠️  ${userAddr} 添加直推 ${referral} 失败: ${error.message}`);
              }
            }
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
              teamTotalVolume: info.teamTotalVolume,
              teamTotalCap: info.teamTotalCap,
              referrals: referrals.length
            });
            successCount++;
            referralCount += referrals.length;
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
          console.log(`\n    进度: ${processed}/${usersToRestore.length} (成功: ${successCount}, 失败: ${failCount}, 直推记录: ${referralCount})`);
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
  console.log(`总直推记录: ${totalReferrals}`);
  console.log(`成功恢复: ${successCount} 用户`);
  console.log(`恢复失败: ${failCount} 用户`);
  console.log(`跳过: ${restoreResults.skipped.length} 用户`);
  console.log(`恢复直推记录: ${referralCount} 条`);
  
  // 保存结果
  const resultsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `team-restore-results-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(restoreResults, null, 2));
  console.log(`\n📄 恢复结果已保存: ${resultsFile}`);
  
  return restoreResults;
}

restoreTeamData()
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







