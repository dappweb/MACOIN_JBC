const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event TicketExpired(address indexed user, uint256 ticketId, uint256 amount)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
];

async function checkNoRewardUsersTicketStatus() {
  console.log("🔍 诊断无奖励用户的门票状态\n");
  console.log("=".repeat(70) + "\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  try {
    console.log("📥 第一步：获取购票和奖励事件...");
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    const ticketEvents = await protocol.queryFilter(
      protocol.filters.TicketPurchased(),
      fromBlock,
      "latest"
    );

    const expiredEvents = await protocol.queryFilter(
      protocol.filters.TicketExpired(),
      fromBlock,
      "latest"
    );

    const rewardEvents = await protocol.queryFilter(
      protocol.filters.RewardPaid(),
      fromBlock,
      "latest"
    );

    console.log(`✓ 购票事件：${ticketEvents.length} 条`);
    console.log(`✓ 过期事件：${expiredEvents.length} 条`);
    console.log(`✓ 奖励事件：${rewardEvents.length} 条\n`);

    // 聚合数据
    const ticketMap = {};
    const expiredMap = {};
    const rewardMap = {};

    for (const event of ticketEvents) {
      const user = event.args.user.toLowerCase();
      if (!ticketMap[user]) {
        ticketMap[user] = [];
      }
      ticketMap[user].push({
        ticketId: event.args.ticketId.toString(),
        amount: Number(event.args.amount),
        blockNumber: event.blockNumber,
      });
    }

    for (const event of expiredEvents) {
      const user = event.args.user.toLowerCase();
      if (!expiredMap[user]) {
        expiredMap[user] = [];
      }
      expiredMap[user].push({
        ticketId: event.args.ticketId.toString(),
        blockNumber: event.blockNumber,
      });
    }

    for (const event of rewardEvents) {
      const user = event.args.user.toLowerCase();
      rewardMap[user] = true;
    }

    // 识别无奖励用户
    const noRewardUsers = Object.keys(ticketMap).filter(
      (user) => !rewardMap[user]
    );

    console.log("=".repeat(70));
    console.log("\n📊 无奖励用户分析:\n");

    console.log(`总购票用户：${Object.keys(ticketMap).length}`);
    console.log(
      `已过期用户：${Object.keys(expiredMap).length} (${(
        (Object.keys(expiredMap).length / Object.keys(ticketMap).length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(`无奖励用户：${noRewardUsers.length}\n`);

    // 分析无奖励用户中有多少门票已过期
    let noRewardButTicketExpired = 0; // 无奖励且门票已过期
    let noRewardButTicketActive = 0; // 无奖励但门票还活着
    let noRewardButTicketExited = 0; // 无奖励且用户标记已出局

    console.log("🔨 第二步：检查无奖励用户的门票状态...\n");

    for (let i = 0; i < Math.min(30, noRewardUsers.length); i++) {
      const user = noRewardUsers[i];
      const purchases = ticketMap[user];
      const expired = expiredMap[user] || [];

      try {
        const userTicket = await protocol.userTicket(user);
        const level = await protocol.getUserLevel(user);

        const ticketExited = userTicket.exited;
        const isExpired = expired.length > 0;

        if (ticketExited) noRewardButTicketExited++;
        if (isExpired) noRewardButTicketExpired++;
        if (!isExpired && !ticketExited) noRewardButTicketActive++;

        console.log(
          `  ${String(i + 1).padStart(2, " ")}. ${user.substring(0, 10)}...`
        );
        console.log(
          `      购票: ${purchases.length}次, ` +
          `过期: ${expired.length > 0 ? "是" : "否"}, ` +
          `出局: ${ticketExited ? "是" : "否"}, ` +
          `等级: L${level.level}`
        );
      } catch (e) {
        console.log(
          `  ${String(i + 1).padStart(2, " ")}. ${user.substring(0, 10)}... ❌ 查询失败`
        );
      }

      if ((i + 1) % 10 === 0) {
        console.log("");
      }
    }

    console.log("\n" + "-".repeat(70));
    console.log("\n📈 统计分析（采样30个用户）:\n");

    console.log(`门票已过期：${noRewardButTicketExpired} 人`);
    console.log(`门票已出局：${noRewardButTicketExited} 人`);
    console.log(`门票还活着：${noRewardButTicketActive} 人\n`);

    console.log("=".repeat(70));
    console.log("\n🎯 诊断结论:\n");

    if (
      noRewardButTicketExpired + noRewardButTicketExited >
      (noRewardButTicketActive * 3) / 4
    ) {
      console.log(
        "🔴 极可能是门票过期/出局导致无奖励"
      );
      console.log(
        `   ${noRewardButTicketExpired + noRewardButTicketExited} / 30 用户的门票已过期或出局`
      );
      console.log("   → 这解释了为什么他们没有获得奖励\n");
    } else if (
      noRewardButTicketActive >
      (noRewardButTicketExpired + noRewardButTicketExited) * 2
    ) {
      console.log(
        "🟢 门票都还活着，问题不在于过期"
      );
      console.log(`   ${noRewardButTicketActive} / 30 用户的门票还未过期`);
      console.log("   → 根本原因是其他（L0限制、直推要求等）\n");
    } else {
      console.log(
        "🟡 混合情况，门票状态不一致"
      );
      console.log(
        "   有的门票过期，有的还活着"
      );
      console.log(
        "   → 可能有多个原因：既有过期，也有其他问题\n"
      );
    }

    console.log("-".repeat(70));
    console.log("\n💡 建议:\n");

    if (noRewardButTicketExpired > 5) {
      console.log(
        "1. 门票过期确实是重要原因，需要改进提醒机制"
      );
      console.log("   → 用户可能没有意识到门票会过期");
      console.log(
        "   → 需要在UI中显示倒计时或主动推送通知"
      );
    }

    if (noRewardButTicketActive > 10) {
      console.log(
        "2. 很多用户门票还活着但仍然无奖励"
      );
      console.log("   → 这说明问题不仅仅是过期");
      console.log("   → 需要检查等级、直推要求等其他条件");
    }

    // 保存报告
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalNoRewardUsers: noRewardUsers.length,
        sampledUsers: Math.min(30, noRewardUsers.length),
        ticketExpiredCount: noRewardButTicketExpired,
        ticketExitedCount: noRewardButTicketExited,
        ticketActiveCount: noRewardButTicketActive,
        possibleCause:
          noRewardButTicketExpired + noRewardButTicketExited >
          noRewardButTicketActive
            ? "门票过期/出局"
            : "其他原因（等级/直推等）",
      },
    };

    const reportPath = path.join(
      __dirname,
      "..",
      "output",
      "diagnostics",
      `no-reward-ticket-status-${new Date()
        .toISOString()
        .split("T")[0]}.json`
    );

    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), "utf8");
    console.log(`\n✅ 诊断报告已保存: ${reportPath}\n`);
  } catch (error) {
    console.error("❌ 诊断失败:", error.message);
    process.exit(1);
  }
}

checkNoRewardUsersTicketStatus();
