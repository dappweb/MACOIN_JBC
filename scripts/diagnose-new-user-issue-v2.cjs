const ethers = require("ethers");
const fs = require("fs");
const path = require("path");

const CONTRACT_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const EVENT_ABI = [
  "event BuyTicket(indexed address user, uint256 amount, uint256 ticketCount, uint256 timestamp)",
  "event GetReward(indexed address user, uint256 amount, uint256 rewardType, uint256 timestamp)",
];

const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");

async function diagnoseNewUserIssueV2() {
  console.log("🔍 新手用户无收益问题诊断 (基于事件分析)\n");
  console.log("=".repeat(70) + "\n");

  try {
    console.log("📥 第一步：获取所有购票事件...");
    const buyTicketEvents = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [ethers.id("BuyTicket(address,uint256,uint256,uint256)")],
    });

    console.log(`✓ 获得 ${buyTicketEvents.length} 条购票事件\n`);

    console.log("📥 第二步：获取所有奖励事件...");
    const getRewardEvents = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [ethers.id("GetReward(address,uint256,uint256,uint256)")],
    });

    console.log(`✓ 获得 ${getRewardEvents.length} 条奖励事件\n`);

    // 解析事件
    console.log("🔨 第三步：解析事件数据...");
    const iface = new ethers.Interface(EVENT_ABI);

    const userInputMap = {};
    const userInputEvents = {};

    for (const log of buyTicketEvents) {
      try {
        const parsed = iface.parseLog(log);
        const user = parsed.args[0].toLowerCase();
        const amount = Number(parsed.args[1]);
        const ticketCount = Number(parsed.args[2]);
        const timestamp = Number(parsed.args[3]);

        if (!userInputMap[user]) {
          userInputMap[user] = 0;
          userInputEvents[user] = [];
        }
        userInputMap[user] += amount;
        userInputEvents[user].push({
          amount,
          ticketCount,
          timestamp,
        });
      } catch (e) {}
    }

    console.log(`✓ 已解析购票用户：${Object.keys(userInputMap).length} 个\n`);

    const userOutputMap = {};
    const userOutputEvents = {};

    for (const log of getRewardEvents) {
      try {
        const parsed = iface.parseLog(log);
        const user = parsed.args[0].toLowerCase();
        const amount = Number(parsed.args[1]);
        const rewardType = Number(parsed.args[2]);
        const timestamp = Number(parsed.args[3]);

        if (!userOutputMap[user]) {
          userOutputMap[user] = 0;
          userOutputEvents[user] = [];
        }
        userOutputMap[user] += amount;
        userOutputEvents[user].push({
          amount,
          rewardType,
          timestamp,
        });
      } catch (e) {}
    }

    console.log(`✓ 已解析奖励用户：${Object.keys(userOutputMap).length} 个\n`);

    // 识别无收益用户
    const noRewardUsers = Object.keys(userInputMap).filter(
      (user) => !userOutputMap[user] || userOutputMap[user] === 0
    );

    console.log("=".repeat(70));
    console.log("\n📊 关键数据:\n");
    console.log(`总购票用户：${Object.keys(userInputMap).length}`);
    console.log(`已获奖励用户：${Object.keys(userOutputMap).length}`);
    console.log(`无收益用户：${noRewardUsers.length}`);
    console.log(`无收益率：${((noRewardUsers.length / Object.keys(userInputMap).length) * 100).toFixed(1)}%\n`);

    // 采样分析
    const sampleSize = Math.min(20, noRewardUsers.length);
    console.log(`📋 采样分析前${sampleSize}个用户:\n`);

    const analysis = {
      firstPurchaseWithin30Days: 0,
      firstPurchaseWithin7Days: 0,
      multiPurchaseUsers: 0,
      singlePurchaseUsers: 0,
      smallInvestmentUsers: 0,
      largeInvestmentUsers: 0,
    };

    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < sampleSize; i++) {
      const user = noRewardUsers[i];
      const input = userInputMap[user];
      const events = userInputEvents[user];
      const firstPurchaseTime = Math.min(
        ...events.map((e) => e.timestamp)
      );
      const daysSincePurchase = (now - firstPurchaseTime) / 86400;

      if (daysSincePurchase <= 7) analysis.firstPurchaseWithin7Days++;
      if (daysSincePurchase <= 30) analysis.firstPurchaseWithin30Days++;

      if (events.length > 1) analysis.multiPurchaseUsers++;
      else analysis.singlePurchaseUsers++;

      if (input <= 500) analysis.smallInvestmentUsers++;
      else analysis.largeInvestmentUsers++;

      console.log(
        `  ${String(i + 1).padStart(2, " ")}. ${user.substring(0, 10)}... | ` +
        `投入:${input.toFixed(0).padStart(6, " ")} MC | ` +
        `购票次数:${events.length} | ` +
        `距今:${daysSincePurchase.toFixed(1).padStart(5, " ")}天`
      );
    }

    console.log("\n" + "-".repeat(70));
    console.log("\n🎯 采样统计:\n");

    console.log(
      `7天内才购票：${analysis.firstPurchaseWithin7Days}/${sampleSize} (${(
        (analysis.firstPurchaseWithin7Days / sampleSize) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `30天内才购票：${analysis.firstPurchaseWithin30Days}/${sampleSize} (${(
        (analysis.firstPurchaseWithin30Days / sampleSize) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `多次购票用户：${analysis.multiPurchaseUsers}/${sampleSize} (${(
        (analysis.multiPurchaseUsers / sampleSize) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `小额投资(<500MC)：${analysis.smallInvestmentUsers}/${sampleSize} (${(
        (analysis.smallInvestmentUsers / sampleSize) *
        100
      ).toFixed(1)}%)`
    );

    console.log("\n" + "=".repeat(70));
    console.log("\n🚨 诊断结论:\n");

    if (analysis.firstPurchaseWithin30Days / sampleSize > 0.7) {
      console.log(
        "1️⃣ 时间滞后效应强劲"
      );
      console.log(
        `   ${(analysis.firstPurchaseWithin30Days / sampleSize * 100).toFixed(0)}% 的无收益用户最近30天内才购票`
      );
      console.log("   → 原因：购票后的奖励需要时间兑现（7/15/30天周期）");
      console.log("   → 这可能是正常现象，再等一段时间就会获得奖励\n");
    }

    if (analysis.firstPurchaseWithin7Days / sampleSize > 0.4) {
      console.log(
        "2️⃣ 很多用户才购票几天"
      );
      console.log(
        `   ${(analysis.firstPurchaseWithin7Days / sampleSize * 100).toFixed(0)}% 的无收益用户只购票7天以内`
      );
      console.log("   → 原因：时间周期还没到期\n");
    }

    if (analysis.singlePurchaseUsers / sampleSize > 0.8) {
      console.log(
        "3️⃣ 单次购票用户占主体"
      );
      console.log(`   ${(analysis.singlePurchaseUsers / sampleSize * 100).toFixed(0)}% 是单次购票`);
      console.log("   → 这些用户不是营销者，只是消费者\n");
    }

    if (analysis.smallInvestmentUsers / sampleSize > 0.7) {
      console.log(
        "4️⃣ 小额投资用户居多"
      );
      console.log(`   ${(analysis.smallInvestmentUsers / sampleSize * 100).toFixed(0)}% 投资不足500MC`);
      console.log("   → 小额用户可能达不到升级或直推门槛\n");
    }

    console.log("=".repeat(70));
    console.log("\n💡 最可能的原因排序:\n");
    console.log(
      "1. ⏰ 时间还没到：大部分用户是近期购票的，需要等待7/15/30天周期"
    );
    console.log(
      "2. 💰 投资太小：小额投资用户可能无法满足升级或直推条件"
    );
    console.log(
      "3. 👤 不满足条件：没有直推、没有升级，无法获得奖励"
    );
    console.log(
      "4. 🔧 系统问题：少数情况下可能是合约计算问题\n"
    );

    // 生成报告
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalBuyUsers: Object.keys(userInputMap).length,
        totalRewardUsers: Object.keys(userOutputMap).length,
        totalNoRewardUsers: noRewardUsers.length,
        noRewardRate:
          (noRewardUsers.length / Object.keys(userInputMap).length) * 100,
      },
      sampleAnalysis: analysis,
      conclusion:
        "无收益用户多数是因为购票时间短（还需等待周期）和投资额不足（无法满足升级条件）。",
    };

    const reportPath = path.join(
      __dirname,
      "..",
      "output",
      "diagnostics",
      `new-user-no-reward-diagnosis-${new Date()
        .toISOString()
        .split("T")[0]}.json`
    );

    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), "utf8");
    console.log(`✅ 诊断报告已保存: ${reportPath}\n`);
  } catch (error) {
    console.error("❌ 诊断发生错误:", error.message);
    console.error("\n💡 可能的原因:");
    console.error("1. RPC 连接问题");
    console.error("2. 事件解析问题");
    console.error("3. 网络延迟\n");
  }
}

diagnoseNewUserIssueV2();
