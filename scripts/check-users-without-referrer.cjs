const { ethers } = require("hardhat");
const fs = require("path");

/**
 * 检查旧合约中有门票或质押但没有推荐人的用户
 * 这些用户可能在新合约中也没有数据
 */
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
];

async function checkUsersWithoutReferrer() {
  console.log("🔍 检查旧合约中有门票或质押但没有推荐人的用户\n");
  console.log("=".repeat(60));
  
  // 1. 连接到合约
  console.log("📋 步骤 1: 连接到合约");
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://chain.mcerscan.com/");
  const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  
  console.log(`    旧合约地址: ${OLD_PROTOCOL_ADDRESS}`);
  console.log(`    新合约地址: ${NEW_PROTOCOL_ADDRESS}\n`);
  
  // 2. 查询所有有门票或质押的用户
  console.log("📋 步骤 2: 查询所有有门票或质押的用户");
  const iface = new ethers.Interface(PROTOCOL_ABI);
  
  // 查询 TicketPurchased 事件
  const ticketPurchasedTopic = iface.getEvent("TicketPurchased").topicHash;
  const ticketPurchasedLogs = await provider.getLogs({
    address: OLD_PROTOCOL_ADDRESS,
    topics: [ticketPurchasedTopic],
    fromBlock: 0,
    toBlock: "latest"
  });
  
  // 查询 LiquidityStaked 事件
  const liquidityStakedTopic = iface.getEvent("LiquidityStaked").topicHash;
  const liquidityStakedLogs = await provider.getLogs({
    address: OLD_PROTOCOL_ADDRESS,
    topics: [liquidityStakedTopic],
    fromBlock: 0,
    toBlock: "latest"
  });
  
  const usersWithTicketOrStake = new Set();
  ticketPurchasedLogs.forEach(log => {
    const parsed = iface.parseLog(log);
    usersWithTicketOrStake.add(parsed.args.user.toLowerCase());
  });
  liquidityStakedLogs.forEach(log => {
    const parsed = iface.parseLog(log);
    usersWithTicketOrStake.add(parsed.args.user.toLowerCase());
  });
  
  console.log(`    有门票或质押的用户数: ${usersWithTicketOrStake.size}\n`);
  
  // 3. 检查这些用户是否有推荐人
  console.log("📋 步骤 3: 检查用户是否有推荐人");
  const usersWithoutReferrer = [];
  let checkedCount = 0;
  
  for (const userAddress of usersWithTicketOrStake) {
    try {
      const oldUserInfo = await oldProtocol.userInfo(userAddress);
      const hasReferrer = oldUserInfo.referrer && oldUserInfo.referrer !== ethers.ZeroAddress;
      
      if (!hasReferrer) {
        // 检查是否有门票或质押
        const ticket = await oldProtocol.userTicket(userAddress);
        const hasTicket = ticket.ticketId && ticket.ticketId !== 0n;
        
        usersWithoutReferrer.push({
          address: userAddress,
          hasTicket: hasTicket,
          ticketId: ticket.ticketId?.toString(),
          ticketAmount: ticket.amount?.toString()
        });
      }
      
      checkedCount++;
      if (checkedCount % 50 === 0) {
        console.log(`    已检查 ${checkedCount}/${usersWithTicketOrStake.size} 用户...`);
      }
    } catch (error) {
      // 查询失败
    }
  }
  
  console.log(`\n    没有推荐人但有门票或质押的用户数: ${usersWithoutReferrer.length}\n`);
  
  // 4. 检查这些用户在新合约中的状态
  console.log("📋 步骤 4: 检查这些用户在新合约中的状态");
  const usersNotInNewContract = [];
  
  for (const user of usersWithoutReferrer) {
    try {
      const newUserInfo = await newProtocol.userInfo(user.address);
      const newTicket = await newProtocol.userTicket(user.address);
      
      const hasReferrerInNew = newUserInfo.referrer && newUserInfo.referrer !== ethers.ZeroAddress;
      const hasTicketInNew = newTicket.ticketId && newTicket.ticketId !== 0n;
      
      if (!hasReferrerInNew && !hasTicketInNew) {
        // 新合约中完全没有数据
        usersNotInNewContract.push({
          address: user.address,
          oldTicketId: user.ticketId,
          oldTicketAmount: user.ticketAmount,
          status: "no_data_in_new_contract"
        });
      }
    } catch (error) {
      usersNotInNewContract.push({
        address: user.address,
        error: error.message,
        status: "check_failed"
      });
    }
  }
  
  console.log(`    新合约中完全没有数据的用户数: ${usersNotInNewContract.length}\n`);
  
  // 5. 生成报告
  console.log("=".repeat(60));
  console.log("📊 检查结果");
  console.log("=".repeat(60));
  
  console.log(`\n旧合约统计:`);
  console.log(`  - 有门票或质押的用户数: ${usersWithTicketOrStake.size}`);
  console.log(`  - 没有推荐人但有门票或质押的用户数: ${usersWithoutReferrer.length}`);
  
  console.log(`\n新合约检查:`);
  console.log(`  - 新合约中完全没有数据的用户数: ${usersNotInNewContract.length}`);
  
  if (usersNotInNewContract.length > 0) {
    console.log(`\n新合约中完全没有数据的用户列表:`);
    usersNotInNewContract.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.address}`);
      if (user.oldTicketId) {
        console.log(`     旧合约门票ID: ${user.oldTicketId}`);
      }
      if (user.oldTicketAmount) {
        console.log(`     旧合约门票金额: ${ethers.formatEther(user.oldTicketAmount)} MC`);
      }
      if (user.error) {
        console.log(`     错误: ${user.error}`);
      }
    });
  }
  
  // 保存结果
  const resultsDir = require("path").join(__dirname, "backups");
  if (!require("fs").existsSync(resultsDir)) {
    require("fs").mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = require("path").join(resultsDir, `users-without-referrer-check-${Date.now()}.json`);
  const results = {
    timestamp: new Date().toISOString(),
    oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    summary: {
      usersWithTicketOrStake: usersWithTicketOrStake.size,
      usersWithoutReferrer: usersWithoutReferrer.length,
      usersNotInNewContract: usersNotInNewContract.length
    },
    usersWithoutReferrer: usersWithoutReferrer,
    usersNotInNewContract: usersNotInNewContract
  };
  
  require("fs").writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 检查结果已保存: ${resultsFile}`);
  
  return results;
}

checkUsersWithoutReferrer()
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


