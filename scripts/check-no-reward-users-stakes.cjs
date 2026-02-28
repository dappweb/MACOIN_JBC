/**
 * 检查无奖励用户是否创建了流动性质押
 * 目的：确定L0用户无奖励是否因为没有stake（没有参与质押）
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
];

async function getStakesCount(protocol, userAddress) {
  try {
    let count = 0;
    for (let i = 0; i < 100; i++) {
      try {
        const stake = await protocol.userStakes(userAddress, i);
        if (Number(stake.id || 0) === 0) break;
        count++;
      } catch {
        break;
      }
    }
    return count;
  } catch (error) {
    return 0;
  }
}

async function analyze() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔍 分析无奖励用户的质押情况\n");
  console.log("=".repeat(80));

  try {
    // 获取所有购票和奖励事件
    console.log("\n📥 第一步：获取所有购票和奖励用户...");
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

    console.log(`✓ 购票事件：${ticketEvents.length} 条`);
    console.log(`✓ 奖励事件：${rewardEvents.length} 条`);

    // 收集购票用户
    const ticketUsers = new Set();
    ticketEvents.forEach((e) => {
      if (e.args?.user) {
        ticketUsers.add(String(e.args.user).toLowerCase());
      }
    });

    // 收集有奖励的用户
    const rewardUsers = new Set();
    rewardEvents.forEach((e) => {
      if (e.args?.user) {
        rewardUsers.add(String(e.args.user).toLowerCase());
      }
    });

    // 找出无奖励用户
    const noRewardUsers = Array.from(ticketUsers).filter(
      (user) => !rewardUsers.has(user)
    );

    console.log(`✓ 购票用户：${ticketUsers.size} 个`);
    console.log(`✓ 有奖励用户：${rewardUsers.size} 个`);
    console.log(`✓ 无奖励用户：${noRewardUsers.length} 个 (${((noRewardUsers.length / ticketUsers.size) * 100).toFixed(1)}%)\n`);

    // 检查无奖励用户的stake情况
    console.log("📊 第二步：分析无奖励用户的质押情况...\n");

    const stakeAnalysis = {
      noStakes: [],
      hasStakes: [],
      stakeStatistics: {
        totalNoRewardUsers: noRewardUsers.length,
        usersWithoutStakes: 0,
        usersWithStakes: 0,
        percentWithoutStakes: 0,
        percentWithStakes: 0,
        totalStakesCreated: 0,
        avgStakesPerUser: 0,
      },
    };

    // 随机抽样检查（为了加快速度，检查前50个）
    const sampleSize = Math.min(50, noRewardUsers.length);
    console.log(`🎯 随机抽样检查前 ${sampleSize} 个无奖励用户（共 ${noRewardUsers.length} 个）\n`);

    for (let i = 0; i < sampleSize; i++) {
      const user = noRewardUsers[i];
      const [userInfo, ticket, stakeCount] = await Promise.all([
        protocol.userInfo(user),
        protocol.userTicket(user),
        getStakesCount(protocol, user),
      ]);

      const userRecord = {
        address: user,
        activeDirects: Number(userInfo.activeDirects || 0),
        ticketAmount: ethers.formatEther(ticket.amount || 0n),
        totalRevenue: ethers.formatEther(userInfo.totalRevenue || 0n),
        stakeCount: stakeCount,
        currentCap: ethers.formatEther(userInfo.currentCap || 0n),
      };

      if (stakeCount === 0) {
        stakeAnalysis.noStakes.push(userRecord);
        stakeAnalysis.stakeStatistics.usersWithoutStakes++;
      } else {
        stakeAnalysis.hasStakes.push(userRecord);
        stakeAnalysis.stakeStatistics.usersWithStakes++;
        stakeAnalysis.stakeStatistics.totalStakesCreated += stakeCount;
      }

      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ 已检查 ${i + 1}/${sampleSize} 个用户`);
      }
    }

    // 计算统计信息
    stakeAnalysis.stakeStatistics.percentWithoutStakes = (
      (stakeAnalysis.stakeStatistics.usersWithoutStakes / sampleSize) *
      100
    ).toFixed(1);
    stakeAnalysis.stakeStatistics.percentWithStakes = (
      (stakeAnalysis.stakeStatistics.usersWithStakes / sampleSize) *
      100
    ).toFixed(1);
    stakeAnalysis.stakeStatistics.avgStakesPerUser =
      stakeAnalysis.stakeStatistics.usersWithStakes > 0
        ? (
            stakeAnalysis.stakeStatistics.totalStakesCreated /
            stakeAnalysis.stakeStatistics.usersWithStakes
          ).toFixed(2)
        : 0;

    // 输出结果摘要
    console.log("\n" + "=".repeat(80));
    console.log("📈 无奖励用户质押统计（抽样）：\n");
    console.log(`  无质押用户数：${stakeAnalysis.stakeStatistics.usersWithoutStakes} 个 (${stakeAnalysis.stakeStatistics.percentWithoutStakes}%)`);
    console.log(`  有质押用户数：${stakeAnalysis.stakeStatistics.usersWithStakes} 个 (${stakeAnalysis.stakeStatistics.percentWithStakes}%)`);
    console.log(`  总质押数（有质押的用户）：${stakeAnalysis.stakeStatistics.totalStakesCreated} 个`);
    console.log(
      `  平均每用户质押数：${stakeAnalysis.stakeStatistics.avgStakesPerUser} 个\n`
    );

    // 分析activeDirects
    const allActiveDirects = [
      ...stakeAnalysis.noStakes,
      ...stakeAnalysis.hasStakes,
    ].map((u) => u.activeDirects);
    const directsWithValue = allActiveDirects.filter((d) => d > 0);

    console.log("📊 activeDirects 分析：\n");
    console.log(
      `  activeDirects = 0 的用户：${
        allActiveDirects.filter((d) => d === 0).length
      } 个 (${(
        (allActiveDirects.filter((d) => d === 0).length / sampleSize) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `  activeDirects > 0 的用户：${directsWithValue.length} 个 (${(
        (directsWithValue.length / sampleSize) *
        100
      ).toFixed(1)}%)`
    );

    // 关键发现
    console.log("\n" + "=".repeat(80));
    console.log("🔑 关键发现：\n");

    if (
      stakeAnalysis.stakeStatistics.percentWithoutStakes >= 90
    ) {
      console.log(
        "❌ 大多数无奖励用户都没有创建任何质押 (≥90%)"
      );
      console.log("   → 无奖励原因可能是：用户没有进行质押操作");
      console.log("   → 注意：静态奖励来自quality，没有stake就无法获得奖励\n");
    } else if (
      stakeAnalysis.stakeStatistics.percentWithStakes >= 50
    ) {
      console.log(
        "⚠️  超过一半的无奖励用户有创建质押"
      );
      console.log("   → 无奖励问题可能不是因为缺少stake");
      console.log("   → 问题可能在于：stake奖励计算逻辑或者质押周期问题\n");
    }

    if (allActiveDirects.filter((d) => d === 0).length >= sampleSize - 5) {
      console.log("❌ 几乎所有无奖励用户都是 activeDirects = 0 (L0级)");
      console.log("   → 无法从下线获得分级奖励");
      console.log("   → 只能依赖自己的stake静态奖励\n");
    }

    // 保存详细数据
    const outputPath = path.join(
      __dirname,
      "../output/diagnostics",
      `no-reward-users-stakes-analysis-${new Date().getTime()}.json`
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(stakeAnalysis, null, 2));

    console.log(`\n📁 详细数据已保存到：${path.basename(outputPath)}`);
  } catch (error) {
    console.error("❌ 错误：", error.message);
  }
}

analyze().catch(console.error);
