const { ethers } = require("hardhat");
const fs = require("path");

/**
 * 全面检查旧合约中的所有用户，找出所有未迁移到新合约的用户
 */
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function hasReferrer(address) view returns (bool)",
];

async function checkAllOldContractUsers() {
  console.log("🔍 全面检查旧合约中的所有用户\n");
  console.log("=".repeat(60));
  
  // 1. 连接到合约
  console.log("📋 步骤 1: 连接到合约");
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://chain.mcerscan.com/");
  const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  
  console.log(`    旧合约地址: ${OLD_PROTOCOL_ADDRESS}`);
  console.log(`    新合约地址: ${NEW_PROTOCOL_ADDRESS}\n`);
  
  // 2. 查询所有相关事件来找出所有用户
  console.log("📋 步骤 2: 查询所有事件以找出所有用户");
  const iface = new ethers.Interface(PROTOCOL_ABI);
  
  // 查询 BoundReferrer 事件
  console.log("    正在查询 BoundReferrer 事件...");
  const boundReferrerTopic = iface.getEvent("BoundReferrer").topicHash;
  const boundReferrerLogs = await provider.getLogs({
    address: OLD_PROTOCOL_ADDRESS,
    topics: [boundReferrerTopic],
    fromBlock: 0,
    toBlock: "latest"
  });
  console.log(`    BoundReferrer 事件数: ${boundReferrerLogs.length}`);
  
  // 查询 TicketPurchased 事件
  console.log("    正在查询 TicketPurchased 事件...");
  const ticketPurchasedTopic = iface.getEvent("TicketPurchased").topicHash;
  const ticketPurchasedLogs = await provider.getLogs({
    address: OLD_PROTOCOL_ADDRESS,
    topics: [ticketPurchasedTopic],
    fromBlock: 0,
    toBlock: "latest"
  });
  console.log(`    TicketPurchased 事件数: ${ticketPurchasedLogs.length}`);
  
  // 查询 LiquidityStaked 事件
  console.log("    正在查询 LiquidityStaked 事件...");
  const liquidityStakedTopic = iface.getEvent("LiquidityStaked").topicHash;
  const liquidityStakedLogs = await provider.getLogs({
    address: OLD_PROTOCOL_ADDRESS,
    topics: [liquidityStakedTopic],
    fromBlock: 0,
    toBlock: "latest"
  });
  console.log(`    LiquidityStaked 事件数: ${liquidityStakedLogs.length}\n`);
  
  // 3. 提取所有用户地址
  console.log("📋 步骤 3: 提取所有用户地址");
  const allUsers = new Set();
  
  // 从 BoundReferrer 事件提取
  boundReferrerLogs.forEach(log => {
    const parsed = iface.parseLog(log);
    allUsers.add(parsed.args.user.toLowerCase());
  });
  
  // 从 TicketPurchased 事件提取
  ticketPurchasedLogs.forEach(log => {
    const parsed = iface.parseLog(log);
    allUsers.add(parsed.args.user.toLowerCase());
  });
  
  // 从 LiquidityStaked 事件提取
  liquidityStakedLogs.forEach(log => {
    const parsed = iface.parseLog(log);
    allUsers.add(parsed.args.user.toLowerCase());
  });
  
  console.log(`    旧合约中的总用户数: ${allUsers.size}\n`);
  
  // 4. 检查每个用户在新合约中的状态
  console.log("📋 步骤 4: 检查用户在新合约中的状态");
  const usersNotInNewContract = [];
  const usersWithDifferentReferrer = [];
  let checkedCount = 0;
  
  for (const userAddress of allUsers) {
    try {
      // 检查新合约中是否有推荐人
      const newUserInfo = await newProtocol.userInfo(userAddress);
      const hasReferrerInNew = newUserInfo.referrer && newUserInfo.referrer !== ethers.ZeroAddress;
      
      // 检查旧合约中的推荐人
      const oldUserInfo = await oldProtocol.userInfo(userAddress);
      const hasReferrerInOld = oldUserInfo.referrer && oldUserInfo.referrer !== ethers.ZeroAddress;
      
      if (hasReferrerInOld && !hasReferrerInNew) {
        // 旧合约有推荐人，新合约没有
        usersNotInNewContract.push({
          address: userAddress,
          oldReferrer: oldUserInfo.referrer.toLowerCase(),
          newReferrer: null,
          status: "not_migrated"
        });
      } else if (hasReferrerInOld && hasReferrerInNew) {
        // 两个合约都有推荐人，检查是否一致
        const oldReferrer = oldUserInfo.referrer.toLowerCase();
        const newReferrer = newUserInfo.referrer.toLowerCase();
        if (oldReferrer !== newReferrer) {
          usersWithDifferentReferrer.push({
            address: userAddress,
            oldReferrer: oldReferrer,
            newReferrer: newReferrer,
            status: "referrer_mismatch"
          });
        }
      }
      
      checkedCount++;
      if (checkedCount % 50 === 0) {
        console.log(`    已检查 ${checkedCount}/${allUsers.size} 用户...`);
      }
    } catch (error) {
      // 查询失败，可能是用户不存在
      usersNotInNewContract.push({
        address: userAddress,
        error: error.message,
        status: "check_failed"
      });
    }
  }
  
  console.log(`\n    检查完成\n`);
  
  // 5. 生成报告
  console.log("=".repeat(60));
  console.log("📊 检查结果");
  console.log("=".repeat(60));
  
  console.log(`\n旧合约统计:`);
  console.log(`  - BoundReferrer 事件: ${boundReferrerLogs.length}`);
  console.log(`  - TicketPurchased 事件: ${ticketPurchasedLogs.length}`);
  console.log(`  - LiquidityStaked 事件: ${liquidityStakedLogs.length}`);
  console.log(`  - 总用户数: ${allUsers.size}`);
  
  console.log(`\n新合约检查:`);
  console.log(`  - 未迁移的用户数: ${usersNotInNewContract.length}`);
  console.log(`  - 推荐人不匹配的用户数: ${usersWithDifferentReferrer.length}`);
  
  if (usersNotInNewContract.length > 0) {
    console.log(`\n未迁移的用户列表 (${usersNotInNewContract.length} 个):`);
    usersNotInNewContract.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.address}`);
      if (user.oldReferrer) {
        console.log(`     旧合约推荐人: ${user.oldReferrer}`);
      }
      if (user.error) {
        console.log(`     错误: ${user.error}`);
      }
    });
  }
  
  if (usersWithDifferentReferrer.length > 0) {
    console.log(`\n推荐人不匹配的用户列表 (${usersWithDifferentReferrer.length} 个):`);
    usersWithDifferentReferrer.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.address}`);
      console.log(`     旧合约推荐人: ${user.oldReferrer}`);
      console.log(`     新合约推荐人: ${user.newReferrer}`);
    });
  }
  
  // 保存结果
  const resultsDir = require("path").join(__dirname, "backups");
  if (!require("fs").existsSync(resultsDir)) {
    require("fs").mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = require("path").join(resultsDir, `all-old-contract-users-check-${Date.now()}.json`);
  const results = {
    timestamp: new Date().toISOString(),
    oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    summary: {
      totalEvents: {
        boundReferrer: boundReferrerLogs.length,
        ticketPurchased: ticketPurchasedLogs.length,
        liquidityStaked: liquidityStakedLogs.length
      },
      totalUsers: allUsers.size,
      notMigratedUsers: usersNotInNewContract.length,
      referrerMismatchUsers: usersWithDifferentReferrer.length
    },
    notMigratedUsers: usersNotInNewContract,
    referrerMismatchUsers: usersWithDifferentReferrer
  };
  
  require("fs").writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 检查结果已保存: ${resultsFile}`);
  
  return results;
}

checkAllOldContractUsers()
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


