const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 检查是否有新用户未导入到最新合约
 * 对比备份文件和当前合约的用户数据
 */
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function hasReferrer(address) view returns (bool)",
];

async function checkNewUsers() {
  console.log("🔍 检查是否有新用户未导入到最新合约\n");
  console.log("=".repeat(60));
  
  // 1. 读取备份数据
  console.log("📋 步骤 1: 读取备份数据");
  if (!fs.existsSync(BACKUP_FILE)) {
    throw new Error(`备份文件不存在: ${BACKUP_FILE}`);
  }
  
  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
  console.log(`    ✅ 已读取备份文件: ${BACKUP_FILE}`);
  console.log(`    备份时间: ${backupData.timestamp}`);
  console.log(`    备份的协议地址: ${backupData.protocolAddress}`);
  console.log(`    备份的用户数: ${backupData.users.length}\n`);
  
  // 2. 连接到新合约和旧合约
  console.log("📋 步骤 2: 连接到合约");
  const [deployer] = await ethers.getSigners();
  const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
  const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
  
  console.log(`    部署者地址: ${deployer.address}`);
  console.log(`    新合约地址: ${NEW_PROTOCOL_ADDRESS}`);
  console.log(`    旧合约地址: ${OLD_PROTOCOL_ADDRESS}\n`);
  
  // 3. 从备份文件中提取所有用户地址
  const backupUsers = new Set(backupData.users.map(u => u.address.toLowerCase()));
  console.log(`📋 步骤 3: 分析备份数据`);
  console.log(`    备份文件中的用户数: ${backupUsers.size}\n`);
  
  // 4. 检查新合约中的用户
  console.log("📋 步骤 4: 检查新合约中的用户数据");
  const newContractUsers = new Set();
  const newContractUsersWithReferrer = new Set();
  let checkedCount = 0;
  
  for (const userAddress of backupUsers) {
    try {
      const userInfo = await newProtocol.userInfo(userAddress);
      if (userInfo.referrer && userInfo.referrer !== ethers.ZeroAddress) {
        newContractUsersWithReferrer.add(userAddress);
      }
      newContractUsers.add(userAddress);
      checkedCount++;
      if (checkedCount % 50 === 0) {
        console.log(`    已检查 ${checkedCount}/${backupUsers.size} 用户...`);
      }
    } catch (error) {
      // 用户不存在或查询失败
    }
  }
  
  console.log(`    新合约中的用户数: ${newContractUsers.size}`);
  console.log(`    新合约中有推荐人的用户数: ${newContractUsersWithReferrer.size}\n`);
  
  // 5. 检查旧合约中的用户（备份后可能新增的用户）
  console.log("📋 步骤 5: 检查旧合约中的用户（备份后可能新增的用户）");
  const oldContractNewUsers = [];
  let oldCheckedCount = 0;
  
  // 从备份文件中获取有推荐人的用户
  const backupUsersWithReferrer = backupData.users
    .filter(u => u.userInfo?.referrer && u.userInfo.referrer !== '0x0000000000000000000000000000000000000000')
    .map(u => u.address.toLowerCase());
  
  console.log(`    备份文件中有推荐人的用户数: ${backupUsersWithReferrer.length}`);
  console.log(`    正在检查旧合约中是否有新用户...\n`);
  
  // 检查旧合约中是否有新用户（不在备份文件中）
  // 由于无法直接枚举所有用户，我们只能检查已知的用户
  // 这里我们检查备份文件中的用户，看看是否有在备份后新增的推荐关系
  
  // 6. 查找未迁移的用户
  console.log("📋 步骤 6: 查找未迁移的用户");
  const notMigratedUsers = [];
  
  for (const userAddress of backupUsersWithReferrer) {
    try {
      const newUserInfo = await newProtocol.userInfo(userAddress);
      const backupUser = backupData.users.find(u => u.address.toLowerCase() === userAddress);
      
      if (!newUserInfo.referrer || newUserInfo.referrer === ethers.ZeroAddress) {
        // 新合约中没有推荐人，但备份文件中有
        if (backupUser?.userInfo?.referrer) {
          notMigratedUsers.push({
            address: userAddress,
            backupReferrer: backupUser.userInfo.referrer,
            newContractReferrer: null
          });
        }
      } else {
        // 检查推荐人是否匹配
        const backupReferrer = backupUser?.userInfo?.referrer?.toLowerCase();
        const newContractReferrer = newUserInfo.referrer.toLowerCase();
        
        if (backupReferrer && backupReferrer !== newContractReferrer) {
          notMigratedUsers.push({
            address: userAddress,
            backupReferrer: backupReferrer,
            newContractReferrer: newContractReferrer
          });
        }
      }
    } catch (error) {
      // 查询失败
      notMigratedUsers.push({
        address: userAddress,
        error: error.message
      });
    }
  }
  
  console.log(`    未迁移的用户数: ${notMigratedUsers.length}\n`);
  
  // 7. 检查旧合约中是否有备份后的新用户
  console.log("📋 步骤 7: 检查旧合约中备份后的新用户");
  console.log("    ⚠️  注意: 由于无法直接枚举合约中的所有用户，");
  console.log("    我们只能通过事件日志来查找新用户。");
  console.log("    建议检查旧合约的 BoundReferrer 事件，查找备份后的新用户。\n");
  
  // 8. 生成报告
  console.log("=".repeat(60));
  console.log("📊 检查结果");
  console.log("=".repeat(60));
  
  console.log(`\n备份文件:`);
  console.log(`  - 总用户数: ${backupUsers.size}`);
  console.log(`  - 有推荐人的用户: ${backupUsersWithReferrer.length}`);
  
  console.log(`\n新合约:`);
  console.log(`  - 已检查的用户数: ${newContractUsers.size}`);
  console.log(`  - 有推荐人的用户数: ${newContractUsersWithReferrer.size}`);
  
  console.log(`\n未迁移的用户:`);
  console.log(`  - 数量: ${notMigratedUsers.length}`);
  
  if (notMigratedUsers.length > 0) {
    console.log(`\n未迁移的用户列表 (前10个):`);
    notMigratedUsers.slice(0, 10).forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.address}`);
      if (user.backupReferrer) {
        console.log(`     备份推荐人: ${user.backupReferrer}`);
      }
      if (user.newContractReferrer) {
        console.log(`     新合约推荐人: ${user.newContractReferrer}`);
      }
      if (user.error) {
        console.log(`     错误: ${user.error}`);
      }
    });
  }
  
  // 保存结果
  const resultsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `new-users-check-${Date.now()}.json`);
  const results = {
    timestamp: new Date().toISOString(),
    backupFile: BACKUP_FILE,
    backupTimestamp: backupData.timestamp,
    backupProtocolAddress: backupData.protocolAddress,
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
    summary: {
      backupUsers: backupUsers.size,
      backupUsersWithReferrer: backupUsersWithReferrer.length,
      newContractUsers: newContractUsers.size,
      newContractUsersWithReferrer: newContractUsersWithReferrer.size,
      notMigratedUsers: notMigratedUsers.length
    },
    notMigratedUsers: notMigratedUsers
  };
  
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 检查结果已保存: ${resultsFile}`);
  
  return results;
}

checkNewUsers()
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


