const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 如果使用 Hardhat，需要指定网络
const USE_HARDHAT = process.env.USE_HARDHAT === "true";

// 配置
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || process.argv[2];
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10"); // 每批处理的用户数
const DRY_RUN = process.env.DRY_RUN !== "false"; // 默认是干运行模式

if (!NEW_PROTOCOL_ADDRESS) {
  console.error("❌ 请提供新协议合约地址");
  console.log("使用方法: NEW_PROTOCOL_ADDRESS=0x... node scripts/migrate-user-data.cjs");
  console.log("或: node scripts/migrate-user-data.cjs <新合约地址>");
  process.exit(1);
}

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function adminSetReferrer(address user, address newReferrer) external",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
];

async function migrateUserData() {
  console.log("🚀 开始迁移用户数据\n");
  console.log("=" .repeat(60));
  
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
  let deployer, protocol;
  
  if (USE_HARDHAT) {
    [deployer] = await ethers.getSigners();
    protocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
  } else {
    // 使用直接连接（需要设置 RPC 和私钥）
    const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
      throw new Error("请设置 PRIVATE_KEY 环境变量（或使用 USE_HARDHAT=true）");
    }
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    deployer = new ethers.Wallet(PRIVATE_KEY, provider);
    protocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
  }
  
  console.log(`    部署者地址: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`    部署者余额: ${ethers.formatEther(balance)} MC`);
  
  // 验证 Owner
  const owner = await protocol.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${deployer.address}`);
  }
  console.log(`    ✅ Owner 验证通过\n`);
  
  // 3. 准备迁移数据
  console.log("📋 步骤 3: 准备迁移数据");
  const usersToMigrate = backupData.users.filter(user => {
    // 只迁移有数据的用户
    const hasReferrer = user.userInfo.referrer && user.userInfo.referrer !== "0x0000000000000000000000000000000000000000";
    const hasTicket = user.userTicket.ticketId !== "0";
    const hasData = user.userInfo.activeDirects !== "0" || 
                   user.userInfo.teamCount !== "0" || 
                   user.userInfo.totalRevenue !== "0";
    return hasReferrer || hasTicket || hasData;
  });
  
  console.log(`    总用户数: ${backupData.users.length}`);
  console.log(`    需要迁移: ${usersToMigrate.length}`);
  console.log(`    跳过: ${backupData.users.length - usersToMigrate.length}\n`);
  
  if (DRY_RUN) {
    console.log("⚠️  干运行模式 - 不会实际执行迁移\n");
  }
  
  // 4. 迁移用户数据
  console.log("📋 步骤 4: 迁移用户数据");
  console.log("=" .repeat(60));
  
  const migrationResults = {
    timestamp: new Date().toISOString(),
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    totalUsers: usersToMigrate.length,
    migrated: [],
    failed: [],
    skipped: []
  };
  
  let processed = 0;
  let successCount = 0;
  let failCount = 0;
  
  // 按批次处理
  for (let i = 0; i < usersToMigrate.length; i += BATCH_SIZE) {
    const batch = usersToMigrate.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(usersToMigrate.length / BATCH_SIZE);
    
    console.log(`\n📦 批次 ${batchNum}/${totalBatches} (${batch.length} 个用户)`);
    
    for (const user of batch) {
      try {
        const userAddr = user.address;
        
        // 检查是否已迁移
        const existingUserInfo = await protocol.userInfo(userAddr);
        if (existingUserInfo.referrer !== ethers.ZeroAddress || 
            existingUserInfo.activeDirects > 0n || 
            existingUserInfo.teamCount > 0n) {
          console.log(`    ⏭️  跳过 ${userAddr} (已存在数据)`);
          migrationResults.skipped.push({
            address: userAddr,
            reason: "已存在数据"
          });
          continue;
        }
        
        if (DRY_RUN) {
          console.log(`    🔍 [干运行] 将迁移 ${userAddr}`);
          console.log(`        推荐人: ${user.userInfo.referrer}`);
          console.log(`        活跃直推: ${user.userInfo.activeDirects}`);
          console.log(`        团队数量: ${user.userInfo.teamCount}`);
          console.log(`        总收益: ${ethers.formatEther(user.userInfo.totalRevenue)} MC`);
          migrationResults.migrated.push({
            address: userAddr,
            status: "dry_run"
          });
          successCount++;
        } else {
          // 1. 设置推荐人（如果有）
          if (user.userInfo.referrer && 
              user.userInfo.referrer !== "0x0000000000000000000000000000000000000000") {
            try {
              const tx1 = await protocol.adminSetReferrer(
                userAddr,
                user.userInfo.referrer
              );
              await tx1.wait();
            } catch (e) {
              // 如果推荐人设置失败，继续其他数据迁移
              console.log(`        ⚠️  推荐人设置失败: ${e.message}`);
            }
          }
          
          // 2. 注意：当前合约只有 adminSetReferrer 函数
          // 其他用户数据（activeDirects, teamCount 等）会在用户操作时自动更新
          // 或者需要通过其他方式设置（如果合约有相应函数）
          
          // 如果用户有门票，可能需要重新购买门票来恢复状态
          // 这里我们只迁移推荐关系，其他数据会在用户操作时恢复
          
          // 验证迁移
          const migratedUserInfo = await protocol.userInfo(userAddr);
          const migratedReferrer = migratedUserInfo.referrer.toLowerCase();
          const expectedReferrer = user.userInfo.referrer.toLowerCase();
          
          if (migratedReferrer === expectedReferrer &&
              migratedUserInfo.activeDirects.toString() === user.userInfo.activeDirects &&
              migratedUserInfo.teamCount.toString() === user.userInfo.teamCount) {
            console.log(`    ✅ ${userAddr} 迁移成功`);
            migrationResults.migrated.push({
              address: userAddr,
              status: "success"
            });
            successCount++;
          } else {
            console.log(`    ⚠️  ${userAddr} 迁移部分成功（数据不匹配）`);
            migrationResults.migrated.push({
              address: userAddr,
              status: "partial",
              expected: user.userInfo,
              actual: {
                referrer: migratedUserInfo.referrer,
                activeDirects: migratedUserInfo.activeDirects.toString(),
                teamCount: migratedUserInfo.teamCount.toString()
              }
            });
            successCount++;
          }
        }
        
        processed++;
        
        // 每 10 个用户显示进度
        if (processed % 10 === 0) {
          console.log(`\n    进度: ${processed}/${usersToMigrate.length} (成功: ${successCount}, 失败: ${failCount})`);
        }
        
      } catch (error) {
        console.log(`    ❌ ${user.address} 迁移失败: ${error.message}`);
        migrationResults.failed.push({
          address: user.address,
          error: error.message
        });
        failCount++;
        processed++;
      }
    }
    
    // 批次间暂停，避免 RPC 限制
    if (i + BATCH_SIZE < usersToMigrate.length && !DRY_RUN) {
      console.log(`\n    ⏸️  等待 2 秒后继续下一批次...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 5. 保存迁移结果
  console.log("\n" + "=" .repeat(60));
  console.log("📊 迁移摘要");
  console.log("=" .repeat(60));
  console.log(`\n总用户数: ${usersToMigrate.length}`);
  console.log(`成功迁移: ${successCount}`);
  console.log(`迁移失败: ${failCount}`);
  console.log(`跳过: ${migrationResults.skipped.length}`);
  
  // 保存结果
  const resultsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `migration-results-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(migrationResults, null, 2));
  console.log(`\n📄 迁移结果已保存: ${resultsFile}`);
  
  if (DRY_RUN) {
    console.log("\n⚠️  这是干运行模式，未实际执行迁移");
    console.log("要执行实际迁移，请设置: DRY_RUN=false");
  }
  
  return migrationResults;
}

// 执行迁移
if (require.main === module) {
  migrateUserData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ 迁移失败:", error);
      process.exit(1);
    });
}

module.exports = { migrateUserData };

