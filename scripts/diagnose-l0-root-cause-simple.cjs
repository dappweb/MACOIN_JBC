/**
 * 深度诊断：为什么L0用户的质押无法获得奖励？
 * 检查：质押时间、已支付金额、率计算等
 */

const { ethers } = require("ethers");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
];

function getRate(cycleDays) {
  if (cycleDays === BigInt(7)) return 13333334;
  if (cycleDays === BigInt(15)) return 16666667;
  return 20000000;
}

async function analyzeStakeReward(provider, stake, blockTimestamp) {
  const SECONDS_IN_UNIT = 86400n;
  const stakeStartTime = stake.startTime;
  const unitsPassed = Number((blockTimestamp - stakeStartTime) / SECONDS_IN_UNIT);
  let adjustedUnits = unitsPassed;
  const cycleDays = Number(stake.cycleDays);
  
  if (adjustedUnits > cycleDays) {
    adjustedUnits = cycleDays;
  }

  const ratePerBillion = getRate(stake.cycleDays);
  const stakeAmount = Number(ethers.formatEther(stake.amount));
  const stakePaid = Number(ethers.formatEther(stake.paid));

  const totalStaticShouldBe = (stakeAmount * ratePerBillion * adjustedUnits) / 1000000000;
  const pending = Math.max(0, totalStaticShouldBe - stakePaid);

  return {
    stakeAmount,
    cycleDays,
    startTime: Number(stakeStartTime),
    stakePaid,
    ratePerBillion,
    unitsPassed,
    adjustedUnits,
    totalStaticShouldBe: totalStaticShouldBe.toFixed(4),
    pending: pending.toFixed(4),
    isActive: stake.active,
    reason: {
      noUnitsYet: unitsPassed === 0,
      alreadyPaid: totalStaticShouldBe <= stakePaid,
      cycleComplete: adjustedUnits === cycleDays && pending === 0,
    },
  };
}

async function getStakesCount(protocol, userAddress) {
  try {
    let count = 0;
    for (let i = 0; i < 100; i++) {
      try {
        const stake = await protocol.userStakes(userAddress, i);
        if (Number(stake.id) === 0) break;
        count++;
      } catch {
        break;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

async function getFullStakeData(protocol, userAddress, stakeIndex) {
  try {
    return await protocol.userStakes(userAddress, stakeIndex);
  } catch {
    return null;
  }
}

async function analyze() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔬 L0用户无奖励根本原因深度诊断\n");
  console.log("=".repeat(80) + "\n");

  try {
    // 获取当前区块信息
    const currentBlock = await provider.getBlockNumber();
    const blockInfo = await provider.getBlock(currentBlock);
    const blockTimestamp = BigInt(blockInfo?.timestamp || 0);

    console.log(`📋 当前区块信息：`);
    console.log(`  区块高度: ${currentBlock}`);
    console.log(`  时间戳: ${blockTimestamp} (${new Date(Number(blockTimestamp) * 1000).toISOString()})`);
    console.log();

    // 获取所有购票和奖励事件
    console.log("📥 获取购票和奖励用户...");
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

    // 收集用户
    const ticketUsers = new Set();
    ticketEvents.forEach((e) => {
      if (e.args?.user) {
        ticketUsers.add(String(e.args.user).toLowerCase());
      }
    });

    const rewardUsers = new Set();
    rewardEvents.forEach((e) => {
      if (e.args?.user) {
        rewardUsers.add(String(e.args.user).toLowerCase());
      }
    });

    const noRewardUsers = Array.from(ticketUsers).filter(
      (user) => !rewardUsers.has(user)
    );

    console.log(`✓ 无奖励用户: ${noRewardUsers.length} 个\n`);

    // 样本分析
    console.log("📈 检查前 10 个无奖励用户的质押详情：\n");

    let samplesToCheck = Math.min(10, noRewardUsers.length);
    let totalCheckedStakes = 0;
    let hasUnclaimedRewards = 0;
    let noTimePassedCount = 0;
    let alreadyPaidCount = 0;

    for (let i = 0; i < samplesToCheck; i++) {
      const user = noRewardUsers[i];
      const [userInfo, stakeCount] = await Promise.all([
        protocol.userInfo(user),
        getStakesCount(protocol, user),
      ]);

      console.log(`👤 用户 ${i + 1}: ${user.substring(0, 10)}...`);
      console.log(`   activeDirects: ${userInfo.activeDirects}`);
      console.log(`   质押数: ${stakeCount}`);

      if (stakeCount === 0) {
        console.log(`   ⚠️  该用户没有创建任何质押！\n`);
        continue;
      }

      for (let si = 0; si < stakeCount; si++) {
        const stakeRaw = await getFullStakeData(protocol, user, si);
        if (!stakeRaw) continue;

        const analysis = await analyzeStakeReward(provider, stakeRaw, blockTimestamp);
        totalCheckedStakes++;

        console.log(`   质押 #${si + 1}: ${analysis.stakeAmount} MC (${analysis.cycleDays}天) - 已支付:${analysis.stakePaid}MC 待领:${analysis.pending}MC`);

        if (parseFloat(analysis.pending) > 0) {
          console.log(`     ✓ 有待领取奖励！`);
          hasUnclaimedRewards++;
        } else if (analysis.reason.noUnitsYet) {
          console.log(`     ❌ 时间不足（<1天）`);
          noTimePassedCount++;
        } else if (analysis.reason.alreadyPaid) {
          console.log(`     ⚠️  已全额支付`);
          alreadyPaidCount++;
        }
      }

      console.log();
    }

    console.log("=".repeat(80));
    console.log(`\n📊 检查结果（${samplesToCheck} 用户，${totalCheckedStakes} 个质押）：\n`);
    console.log(`  有待领奖励: ${hasUnclaimedRewards} 个 (${((hasUnclaimedRewards / totalCheckedStakes) * 100).toFixed(1)}%)`);
    console.log(`  时间不足: ${noTimePassedCount} 个 (${((noTimePassedCount / totalCheckedStakes) * 100).toFixed(1)}%)`);
    console.log(`  已全额支付: ${alreadyPaidCount} 个 (${((alreadyPaidCount / totalCheckedStakes) * 100).toFixed(1)}%)`);

    console.log("\n🔑 关键发现：\n");

    if (hasUnclaimedRewards > 0) {
      const percent = ((hasUnclaimedRewards / totalCheckedStakes) * 100).toFixed(1);
      console.log(
        `❌ ${hasUnclaimedRewards} 个质押 (${percent}%) 有待领奖励但用户未领取`
      );
      console.log("   → 用户可能未调用 claimRewards() 或 claimRewards() 执行失败\n");
    }

    if (noTimePassedCount > totalCheckedStakes * 0.5) {
      console.log(
        `❌ ${noTimePassedCount} 个质押 (<时间不足)`
      );
      console.log("   → 质押创建不足 1 天，尚未产生奖励\n");
    }

    if (alreadyPaidCount > totalCheckedStakes * 0.7) {
      console.log(
        `⚠️ ${alreadyPaidCount} 个质押已全额支付`
      );
      console.log("   → 用户优先已领取全部应得报酬\n");
    }

    console.log("💡建议:");
    console.log("  1. 如果质押有待领奖励 → 检查 claimRewards() 是否出错");
    console.log("  2. 如果时间不足 → 等待足够时间或查仓库数据");
    console.log("  3. 检查 currentCap 限制是否影响奖励领取\n");
  } catch (error) {
    console.error("❌ 错误:", error.message);
  }
}

analyze().catch(console.error);
