const ethers = require("ethers");
const fs = require("fs");
const path = require("path");

const CONTRACT_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const CONTRACT_ABI = [
  "function getAllUsers() public view returns (address[])",
  "function getUserTeamData(address) public view returns (tuple(uint256 level, uint256 direct, uint256 indirect, uint256 totalTeam))",
  "function getUserInfo(address) public view returns (tuple(uint256 ticketsAmount, uint256 rewardCap, uint256 totalReward, uint256 jbcReward, uint256 lastUpdateTime))",
];

const EVENT_ABI = [
  "event BuyTicket(indexed address indexed user, uint256 amount, uint256 ticketCount, uint256 timestamp)",
  "event GetReward(indexed address indexed user, uint256 amount, uint256 rewardType, uint256 timestamp)",
];

const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");

async function diagnoseNewUserIssue() {
  console.log("🔍 开始诊断新手用户无收益问题\n");
  console.log("=".repeat(60) + "\n");

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  const allUsers = await contract.getAllUsers();

  // 获取所有事件
  console.log("📥 获取区块链事件...");
  const buyTicketEvents = await provider.getLogs({
    address: CONTRACT_ADDRESS,
    topics: [ethers.id("BuyTicket(address,uint256,uint256,uint256)")],
  });

  const getRewardEvents = await provider.getLogs({
    address: CONTRACT_ADDRESS,
    topics: [ethers.id("GetReward(address,uint256,uint256,uint256)")],
  });

  // 聚合数据
  const userInput = {};
  for (const log of buyTicketEvents) {
    const iface = new ethers.Interface(EVENT_ABI);
    try {
      const parsed = iface.parseLog(log);
      const user = parsed.args[0];
      const amount = Number(parsed.args[1]);
      userInput[user] = (userInput[user] || 0) + amount;
    } catch (e) {}
  }

  const userOutput = {};
  for (const log of getRewardEvents) {
    const iface = new ethers.Interface(EVENT_ABI);
    try {
      const parsed = iface.parseLog(log);
      const user = parsed.args[0];
      const amount = Number(parsed.args[1]);
      userOutput[user] = (userOutput[user] || 0) + amount;
    } catch (e) {}
  }

  // 识别无收益用户
  const noRewardUsers = Object.keys(userInput).filter(
    (user) => !userOutput[user] || userOutput[user] === 0
  );
  console.log(`✓ 找到 ${noRewardUsers.length} 个无收益用户\n`);

  // 采样诊断（前30个）
  const sampleSize = Math.min(30, noRewardUsers.length);
  const samples = noRewardUsers.slice(0, sampleSize);

  console.log(`📊 诊断样本 (前${sampleSize}个):\n`);

  const diagnosisResults = [];

  for (let i = 0; i < samples.length; i++) {
    const user = samples[i];
    const input = userInput[user];

    try {
      const teamData = await contract.getUserTeamData(user);
      const userInfo = await contract.getUserInfo(user);

      const level = Number(teamData.level);
      const directCount = Number(teamData.direct);
      const indirectCount = Number(teamData.indirect);
      const totalTeam = Number(teamData.totalTeam);
      const ticketsAmount = Number(userInfo.ticketsAmount);
      const rewardCap = Number(userInfo.rewardCap);
      const totalReward = Number(userInfo.totalReward);

      const diagnosis = {
        user,
        level,
        input: parseFloat(input.toFixed(2)),
        directCount,
        indirectCount,
        totalTeam,
        ticketsAmount,
        rewardCap: parseFloat(rewardCap.toFixed(2)),
        totalReward: parseFloat(totalReward.toFixed(2)),
        eventReward: userOutput[user] || 0,
      };

      diagnosisResults.push(diagnosis);

      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ 已诊断 ${i + 1}/${sampleSize} 个用户...`);
      }
    } catch (e) {
      console.error(`  ❌ 用户 ${user} 查询失败:`, e.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n📈 诊断结果分析:\n");

  // 按特征分类
  let emptyDirectCount = 0;
  let emptyTeamCount = 0;
  let level0Count = 0;
  let lowTicketCount = 0;
  let stateVsEventMismatch = 0;

  for (const diag of diagnosisResults) {
    if (diag.directCount === 0) emptyDirectCount++;
    if (diag.totalTeam === 0) emptyTeamCount++;
    if (diag.level === 0) level0Count++;
    if (diag.ticketsAmount < 10) lowTicketCount++;
    if (diag.rewardCap > 0 && diag.totalReward === 0) stateVsEventMismatch++;
  }

  console.log(
    `无直推用户: ${emptyDirectCount}/${sampleSize} (${(
      (emptyDirectCount / sampleSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `无团队用户: ${emptyTeamCount}/${sampleSize} (${(
      (emptyTeamCount / sampleSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `L0等级用户: ${level0Count}/${sampleSize} (${(
      (level0Count / sampleSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `购票少于10张: ${lowTicketCount}/${sampleSize} (${(
      (lowTicketCount / sampleSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `状态-事件不一致: ${stateVsEventMismatch}/${sampleSize} (${(
      (stateVsEventMismatch / sampleSize) *
      100
    ).toFixed(1)}%)`
  );

  console.log("\n" + "-".repeat(60));
  console.log("\n🎯 可能的根本原因:\n");

  if (emptyDirectCount > sampleSize * 0.8) {
    console.log("1️⃣ 🔴 PRIMARY: 无直推导致无奖励");
    console.log("   用户只是购票，未能获得任何直推");
    console.log(
      "   → 需要提升直推转化率或提供新手奖励"
    );
  }

  if (emptyTeamCount > sampleSize * 0.8) {
    console.log("2️⃣ 🔴 PRIMARY: 孤立用户，无推荐网络");
    console.log("   无直推也无间接用户");
    console.log("   → 这些是被动消费者，非营销人员");
  }

  if (level0Count > sampleSize * 0.9) {
    console.log("3️⃣ 🟡 SECONDARY: 新手等级门槛");
    console.log("   大多数是L0等级用户");
    console.log("   → 可能是设计限制：L0用户不获得奖励");
  }

  if (stateVsEventMismatch > 0) {
    console.log(
      "4️⃣ 🟠 WARNING: 合约状态与事件日志不一致"
    );
    console.log(
      `   ${stateVsEventMismatch} 个用户在合约state中有rewardCap但无totalReward`
    );
    console.log("   → 可能存在数据同步或计算bug");
  }

  // 保存详细诊断报告
  const reportPath = path.join(
    __dirname,
    "..",
    "output",
    "diagnostics",
    `new-user-diagnosis-${new Date()
      .toISOString()
      .split("T")[0]}.json`
  );

  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalNoRewardUsers: noRewardUsers.length,
    sampleSize: sampleSize,
    summary: {
      emptyDirectCount,
      emptyTeamCount,
      level0Count,
      lowTicketCount,
      stateVsEventMismatch,
    },
    details: diagnosisResults,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n✅ 详细诊断报告已保存: ${reportPath}\n`);

  console.log("=".repeat(60));
  console.log("\n💡 后续建议:\n");
  console.log("1. 如果是无直推: 考虑为新手提供激励");
  console.log("2. 如果是L0限制: 需要调整等级规则");
  console.log("3. 如果是数据不一致: 需要执行同步修复");
  console.log("4. 可在Excel中打开CSV文件进行逐个审视\n");
}

diagnoseNewUserIssue().catch((err) => {
  console.error("❌ 诊断失败:", err);
  process.exit(1);
});
