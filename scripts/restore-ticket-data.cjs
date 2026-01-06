const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 恢复门票数据脚本
 * 从备份文件中恢复用户的门票数据到新合约
 */
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || process.argv[2];
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10");
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!NEW_PROTOCOL_ADDRESS) {
  console.error("❌ 请提供新协议合约地址");
  console.log("使用方法: NEW_PROTOCOL_ADDRESS=0x... node scripts/restore-ticket-data.cjs");
  console.log("或: node scripts/restore-ticket-data.cjs <新合约地址>");
  process.exit(1);
}

const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function adminSetUserTicket(address user, uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited) external",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function restoreTicketData() {
  console.log("🚀 开始恢复门票数据\n");
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
  
  // 3. 筛选需要恢复门票数据的用户
  console.log("📋 步骤 3: 筛选需要恢复的用户");
  const usersToRestore = backupData.users.filter(user => {
    const ticket = user.userTicket;
    // 只恢复有门票数据的用户（ticketId != 0）
    return ticket && ticket.ticketId !== "0" && ticket.ticketId !== 0;
  });
  
  console.log(`    总用户数: ${backupData.users.length}`);
  console.log(`    有门票数据: ${usersToRestore.length}`);
  console.log(`    活跃门票: ${usersToRestore.filter(u => !u.userTicket.exited).length}\n`);
  
  if (DRY_RUN) {
    console.log("⚠️  干运行模式 - 不会实际执行恢复\n");
  }
  
  // 4. 恢复门票数据
  console.log("📋 步骤 4: 恢复门票数据");
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
        const ticket = user.userTicket;
        
        // 检查当前门票状态
        const currentTicket = await protocol.userTicket(userAddr);
        if (currentTicket.ticketId !== 0n && currentTicket.amount > 0n) {
          console.log(`    ⏭️  跳过 ${userAddr} (已有门票数据)`);
          restoreResults.skipped.push({
            address: userAddr,
            reason: "已有门票数据",
            current: {
              ticketId: currentTicket.ticketId.toString(),
              amount: ethers.formatEther(currentTicket.amount)
            }
          });
          continue;
        }
        
        if (DRY_RUN) {
          console.log(`    🔍 [干运行] 将恢复 ${userAddr}`);
          console.log(`        门票 ID: ${ticket.ticketId}`);
          console.log(`        门票金额: ${ethers.formatEther(ticket.amount)} MC`);
          console.log(`        购买时间: ${new Date(Number(ticket.purchaseTime) * 1000).toISOString()}`);
          console.log(`        已退出: ${ticket.exited}`);
          restoreResults.restored.push({
            address: userAddr,
            status: "dry_run",
            ticket: ticket
          });
          successCount++;
        } else {
          // 恢复门票数据
          const tx = await protocol.adminSetUserTicket(
            userAddr,
            ticket.ticketId,
            ticket.amount,
            ticket.purchaseTime,
            ticket.exited
          );
          console.log(`    📤 ${userAddr} 发送交易: ${tx.hash}`);
          await tx.wait();
          
          // 验证恢复
          const restoredTicket = await protocol.userTicket(userAddr);
          if (restoredTicket.ticketId.toString() === ticket.ticketId &&
              restoredTicket.amount.toString() === ticket.amount) {
            console.log(`    ✅ ${userAddr} 恢复成功`);
            restoreResults.restored.push({
              address: userAddr,
              status: "success",
              ticket: ticket
            });
            successCount++;
          } else {
            console.log(`    ⚠️  ${userAddr} 恢复验证失败`);
            restoreResults.failed.push({
              address: userAddr,
              error: "验证失败",
              expected: ticket,
              actual: {
                ticketId: restoredTicket.ticketId.toString(),
                amount: restoredTicket.amount.toString()
              }
            });
            failCount++;
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
  
  const resultsFile = path.join(resultsDir, `ticket-restore-results-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(restoreResults, null, 2));
  console.log(`\n📄 恢复结果已保存: ${resultsFile}`);
  
  return restoreResults;
}

restoreTicketData()
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



