const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
];

async function diagnoseNewUserRewardIssue() {
  console.log("🔍 新手用户无收益问题详细诊断\n");
  console.log("=".repeat(70) + "\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  try {
    console.log("📥 第一步：获取所有注册用户...");
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    const ticketEvents = await protocol.queryFilter(
      protocol.filters.TicketPurchased(),
      fromBlock,
      "latest"
    );

    const rewardEvents = await protocol.queryFilter(
      protocol.filters.RewardPaid(),
      fromBlock,
      "latest"
    );

    console.log(`✓ 获得 ${ticketEvents.length} 条购票事件`);
    console.log(`✓ 获得 ${rewardEvents.length} 条奖励事件\n`);

    // 聚合数据
    console.log("🔨 第二步：聚合用户数据...");

    const ticketMap = {};
    const rewardMap = {};

    for (const event of ticketEvents) {
      const user = event.args.user.toLowerCase();
      const amount = Number(event.args.amount);

      if (!ticketMap[user]) {
        ticketMap[user] = {
          totalInput: 0,
          count: 0,
          events: [],
        };
      }
      ticketMap[user].totalInput += amount;
      ticketMap[user].count++;
      ticketMap[user].events.push({
        amount,
        blockNumber: event.blockNumber,
      });
    }

    for (const event of rewardEvents) {
      const user = event.args.user.toLowerCase();
      const amount = Number(event.args.amount);

      if (!rewardMap[user]) {
        rewardMap[user] = {
          totalOutput: 0,
          count: 0,
          events: [],
        };
      }
      rewardMap[user].totalOutput += amount;
      rewardMap[user].count++;
      rewardMap[user].events.push({
        amount,
        blockNumber: event.blockNumber,
      });
    }

    console.log(`✓ 购票用户：${Object.keys(ticketMap).length} 个`);
    console.log(`✓ 有奖励用户：${Object.keys(rewardMap).length} 个\n`);

    console.log("=".repeat(70));
    console.log("\n📊 关键数据分析:\n");

    const noRewardUsers = Object.keys(ticketMap).filter(
      (user) => !rewardMap[user]
    );

    console.log(`💡 重要发现：`);
    console.log(`   总购票用户: ${Object.keys(ticketMap).length}`);
    console.log(`   已获奖励用户: ${Object.keys(rewardMap).length}`);
    console.log(`   无奖励用户: ${noRewardUsers.length}`);
    console.log(
      `   无奖励率: ${(
        (noRewardUsers.length / Object.keys(ticketMap).length) *
        100
      ).toFixed(1)}%\n`
    );

    // 按投入额统计无奖励用户
    console.log("📈 无奖励用户的投入额分布:\n");

    let totalInputFromNoReward = 0;
    let usersAbove100 = 0;
    let usersAbove500 = 0;
    let usersAbove1000 = 0;

    for (const user of noRewardUsers) {
      const input = ticketMap[user].totalInput;
      totalInputFromNoReward += input;

      if (input >= 100) usersAbove100++;
      if (input >= 500) usersAbove500++;
      if (input >= 1000) usersAbove1000++;
    }

    console.log(`   无奖励用户总投入: ${totalInputFromNoReward.toFixed(2)} MC`);
    console.log(`   投入 >= 100 MC: ${usersAbove100} 人`);
    console.log(`   投入 >= 500 MC: ${usersAbove500} 人`);
    console.log(`   投入 >= 1000 MC: ${usersAbove1000} 人\n`);

    // 按照投入额排序，查看Top无奖励用户
    const sortedNoReward = noRewardUsers
      .map((user) => ({
        user,
        input: ticketMap[user].totalInput,
        count: ticketMap[user].count,
      }))
      .sort((a, b) => b.input - a.input);

    console.log("🔼 Top 10 无奖励用户（按投入额）:\n");
    for (let i = 0; i < Math.min(10, sortedNoReward.length); i++) {
      const userData = sortedNoReward[i];
      console.log(
        `   ${String(i + 1).padStart(2, " ")}. ${userData.user.substring(0, 10)}... ` +
          `投入: ${userData.input.toFixed(2).padStart(8, " ")} MC ` +
          `购票: ${userData.count}次`
      );
    }

    // 尝试通过state查询了解这些用户的状态
    console.log("\n" + "-".repeat(70));
    console.log("\n🔍 查询Top 5无奖励用户的合约状态...\n");

    for (let i = 0; i < Math.min(5, sortedNoReward.length); i++) {
      const userData = sortedNoReward[i];
      try {
        const userInfo = await protocol.userInfo(userData.user);

        console.log(
          `   ${String(i + 1).padStart(2, " ")}. ${userData.user.substring(0, 10)}...`
        );
        console.log(
          `      合约记录的totalRevenue: ${Number(userInfo.totalRevenue).toFixed(2)} MC`
        );
        console.log(
          `      合约记录的currentCap: ${Number(userInfo.currentCap).toFixed(2)} MC`
        );
        console.log(
          `      合约记录的isActive: ${userInfo.isActive}`
        );
        console.log(
          `      事件记录的reward: 0 MC`
        );
        console.log(
          `      状态一致性: ${
            Number(userInfo.totalRevenue) === 0 ? "✅ 一致" : "❌ 不一致"
          }\n`
        );
      } catch (e) {
        console.log(
          `      ❌ 查询失败: ${e.message.substring(0, 50)}\n`
        );
      }
    }

    console.log("=".repeat(70));
    console.log("\n🎯 诊断结论:\n");

    if (usersAbove500 > 0) {
      console.log(
        "🔴 问题严重性：高"
      );
      console.log(
        `   有 ${usersAbove500} 个用户投入 >= 500 MC 但未获得任何奖励`
      );
      console.log(
        "   → 这不是由于金额太小，而是系统设计问题\n"
      );
    }

    console.log("💡 最可能的根本原因:\n");
    console.log("1. 等级不足导致无奖励（L0用户可能无法获得奖励）");
    console.log("2. 等待激活周期（需要首次购票后等待一定时间）");
    console.log("3. 直推条件未满足（某些场景下需要有直推才能获得奖励）");
    console.log("4. 合约状态未同步（state字段与事件日志不一致）\n");

    // 保存报告
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTicketUsers: Object.keys(ticketMap).length,
        totalRewardUsers: Object.keys(rewardMap).length,
        totalNoRewardUsers: noRewardUsers.length,
        noRewardRate:
          (noRewardUsers.length / Object.keys(ticketMap).length) * 100,
        noRewardTotalInput: totalInputFromNoReward,
        highValueUsers: usersAbove500,
      },
      topNoRewardUsers: sortedNoReward.slice(0, 10),
    };

    const reportPath = path.join(
      __dirname,
      "..",
      "output",
      "diagnostics",
      `new-user-diagnosis-final-${new Date()
        .toISOString()
        .split("T")[0]}.json`
    );

    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), "utf8");
    console.log(`✅ 诊断报告已保存: ${reportPath}\n`);

    console.log("=".repeat(70));
    console.log("\n📋 建议后续行动:\n");
    console.log("1. 检查L0用户的奖励规则是否明确");
    console.log("2. 查看是否存在'激活周期'的设计");
    console.log("3. 验证直推或其他条件是否是必需的");
    console.log("4. 对比state字段和event日志，找出差异\n");
  } catch (error) {
    console.error("❌ 诊断失败:", error.message);
    console.error("\n可能的原因:");
    console.error("- HTTP连接问题");
    console.error("- RPC认证问题");
    console.error("- 合约地址错误\n");
    process.exit(1);
  }
}

diagnoseNewUserRewardIssue();
