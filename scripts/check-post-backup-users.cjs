const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * 检查旧合约中备份后的新用户（在备份时间之后新增的用户）
 */
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const BACKUP_TIMESTAMP = 1767521950; // 2026-01-04T10:19:10.255Z 的时间戳

const PROTOCOL_ABI = [
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function checkPostBackupUsers() {
  console.log("🔍 检查旧合约中备份后的新用户\n");
  console.log("=".repeat(60));
  
  // 1. 连接到旧合约
  console.log("📋 步骤 1: 连接到旧合约");
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://chain.mcerscan.com/");
  const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  
  console.log(`    旧合约地址: ${OLD_PROTOCOL_ADDRESS}`);
  console.log(`    备份时间戳: ${BACKUP_TIMESTAMP} (2026-01-04 10:19:10 UTC)\n`);
  
  // 2. 查询 BoundReferrer 事件
  console.log("📋 步骤 2: 查询 BoundReferrer 事件");
  const iface = new ethers.Interface(PROTOCOL_ABI);
  const boundReferrerTopic = iface.getEvent("BoundReferrer").topicHash;
  
  // 估算备份时的区块号（假设每12秒一个区块）
  const backupBlock = Math.floor(BACKUP_TIMESTAMP / 12);
  console.log(`    估算备份区块号: ${backupBlock}`);
  console.log(`    正在查询事件...\n`);
  
  try {
    const logs = await provider.getLogs({
      address: OLD_PROTOCOL_ADDRESS,
      topics: [boundReferrerTopic],
      fromBlock: 0,
      toBlock: "latest"
    });
    
    console.log(`    总 BoundReferrer 事件数: ${logs.length}`);
    
    // 3. 解析事件并获取区块时间戳
    console.log("\n📋 步骤 3: 分析事件");
    const events = [];
    
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const parsed = iface.parseLog(log);
      const block = await provider.getBlock(log.blockNumber);
      
      events.push({
        blockNumber: log.blockNumber,
        timestamp: block.timestamp,
        user: parsed.args.user.toLowerCase(),
        referrer: parsed.args.referrer.toLowerCase(),
        isAfterBackup: block.timestamp > BACKUP_TIMESTAMP
      });
      
      if ((i + 1) % 50 === 0) {
        console.log(`    已处理 ${i + 1}/${logs.length} 事件...`);
      }
    }
    
    // 4. 筛选备份后的新用户
    const postBackupEvents = events.filter(e => e.isAfterBackup);
    const postBackupUsers = new Set(postBackupEvents.map(e => e.user));
    
    console.log(`\n    备份后的事件数: ${postBackupEvents.length}`);
    console.log(`    备份后的新用户数: ${postBackupUsers.size}\n`);
    
    // 5. 检查这些用户是否在新合约中
    console.log("📋 步骤 4: 检查新合约中是否有这些用户");
    const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    const usersNotInNewContract = [];
    let checkedCount = 0;
    
    for (const userAddress of postBackupUsers) {
      try {
        const userInfo = await newProtocol.userInfo(userAddress);
        if (!userInfo.referrer || userInfo.referrer === ethers.ZeroAddress) {
          usersNotInNewContract.push({
            address: userAddress,
            oldContractReferrer: postBackupEvents.find(e => e.user === userAddress)?.referrer,
            newContractReferrer: null,
            status: "not_migrated"
          });
        } else {
          const oldReferrer = postBackupEvents.find(e => e.user === userAddress)?.referrer;
          const newReferrer = userInfo.referrer.toLowerCase();
          if (oldReferrer !== newReferrer) {
            usersNotInNewContract.push({
              address: userAddress,
              oldContractReferrer: oldReferrer,
              newContractReferrer: newReferrer,
              status: "referrer_mismatch"
            });
          }
        }
        checkedCount++;
        if (checkedCount % 10 === 0) {
          console.log(`    已检查 ${checkedCount}/${postBackupUsers.size} 用户...`);
        }
      } catch (error) {
        usersNotInNewContract.push({
          address: userAddress,
          error: error.message,
          status: "check_failed"
        });
      }
    }
    
    console.log(`\n    未迁移或推荐人不匹配的用户数: ${usersNotInNewContract.length}\n`);
    
    // 6. 生成报告
    console.log("=".repeat(60));
    console.log("📊 检查结果");
    console.log("=".repeat(60));
    
    console.log(`\n旧合约 BoundReferrer 事件:`);
    console.log(`  - 总事件数: ${events.length}`);
    console.log(`  - 备份后事件数: ${postBackupEvents.length}`);
    console.log(`  - 备份后新用户数: ${postBackupUsers.size}`);
    
    console.log(`\n新合约检查:`);
    console.log(`  - 未迁移或推荐人不匹配: ${usersNotInNewContract.length}`);
    
    if (usersNotInNewContract.length > 0) {
      console.log(`\n未迁移的用户列表:`);
      usersNotInNewContract.forEach((user, i) => {
        console.log(`  ${i + 1}. ${user.address}`);
        console.log(`     状态: ${user.status}`);
        if (user.oldContractReferrer) {
          console.log(`     旧合约推荐人: ${user.oldContractReferrer}`);
        }
        if (user.newContractReferrer) {
          console.log(`     新合约推荐人: ${user.newContractReferrer}`);
        }
        if (user.error) {
          console.log(`     错误: ${user.error}`);
        }
      });
    } else {
      console.log(`\n✅ 所有备份后的新用户都已正确迁移到新合约！`);
    }
    
    // 保存结果
    const resultsDir = path.join(__dirname, "backups");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsFile = path.join(resultsDir, `post-backup-users-check-${Date.now()}.json`);
    const results = {
      timestamp: new Date().toISOString(),
      oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
      backupTimestamp: BACKUP_TIMESTAMP,
      summary: {
        totalEvents: events.length,
        postBackupEvents: postBackupEvents.length,
        postBackupUsers: postBackupUsers.size,
        notMigratedUsers: usersNotInNewContract.length
      },
      postBackupEvents: postBackupEvents.slice(0, 100), // 只保存前100个
      notMigratedUsers: usersNotInNewContract
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 检查结果已保存: ${resultsFile}`);
    
    return results;
    
  } catch (error) {
    console.error("查询失败:", error);
    throw error;
  }
}

const path = require("path");

checkPostBackupUsers()
  .then(() => {
    console.log("\n" + "=".repeat(60));
    console.log("✅ 检查完成");
    console.log("=".repeat(60));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n" + "=".repeat(60));
    console.error("❌ 检查失败");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  });






