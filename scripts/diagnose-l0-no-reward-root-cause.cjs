/**
 * 深度诊断：为什么L0用户的质押无法获得奖励？
 * 检查：质押时间、已支付金额、率计算等
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

function getRate(cycleDays) {
  if (cycleDays === 7) return 13333334;
  if (cycleDays === 15) return 16666667;
  return 20000000;
}

async function analyzeStakeReward(provider, stake, blockTimestamp) {
  const SECONDS_IN_UNIT = 86400;
  const stakeStartTime = Number(stake.startTime || 0n);
  const unitsPassed = Math.floor((blockTimestamp - stakeStartTime) / SECONDS_IN_UNIT);
  let adjustedUnits = unitsPassed;
  const cycleDays = Number(stake.cycleDays || 0n);
  if (adjustedUnits > cycleDays) {
    adjustedUnits = cycleDays;
  }

  const ratePerBillion = getRate(cycleDays);
  const stakeAmount = Number(ethers.formatEther(stake.amount || 0n));
  const stakePaid = Number(ethers.formatEther(stake.paid || 0n));

  const totalStaticShouldBe = (stakeAmount * ratePerBillion * adjustedUnits) / 1000000000;
  const pending = Math.max(0, totalStaticShouldBe - stakePaid);

  return {
    stakeAmount,
    cycleDays: stake.cycleDays,
    startTime: stake.startTime,
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
      cycleComplete: adjustedUnits === stake.cycleDays && pending === 0,
    },
  };
}

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
    const blockTimestamp = blockInfo?.timestamp || 0;

    console.log(`📋 当前区块信息：`);
    console.log(`  区块高度: ${currentBlock}`);
    console.log(`  时间戳: ${blockTimestamp} (${new Date(blockTimestamp * 1000).toISOString()})`);
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

    const stakeEvents = await protocol.queryFilter(
      protocol.filters.LiquidityStaked(),
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

    // 深度分析前5个无奖励用户
    console.log("🔍 深度分析前5个无奖励用户的质押详情：\n");

    const analysisResults = [];

    for (let i = 0; i < Math.min(5, noRewardUsers.length); i++) {
      const user = noRewardUsers[i];
      const [userInfo, stakeCount] = await Promise.all([
        protocol.userInfo(user),
        getStakesCount(protocol, user),
      ]);

      console.log(`👤 用户 ${i + 1}: ${user}`);
      console.log(`   activeDirects: ${userInfo.activeDirects}`);
      console.log(`   质押数: ${stakeCount}\n`);

      const userStakes = [];

      for (let si = 0; si < stakeCount; si++) {
        const stakeRaw = await getFullStakeData(protocol, user, si);
        if (!stakeRaw) continue;

        const analysis = await analyzeStakeReward(provider, stakeRaw, blockTimestamp);
        userStakes.push({
          index: si,
          ...analysis,
        });

        console.log(`   质押 #${si + 1}:`);
        console.log(`     金额: ${analysis.stakeAmount} MC`);
        console.log(`     周期: ${analysis.cycleDays}天`);
        console.log(`     创建于: ${new Date(analysis.startTime * 1000).toISOString()}`);
        console.log(`     已支付: ${analysis.stakePaid} MC`);
        console.log(`     应获得: ${analysis.totalStaticShouldBe} MC`);
        console.log(`     待领取: ${analysis.pending} MC`);
        console.log(`     状态: ${analysis.isActive ? "活跃" : "已完成"}`);
        console.log(`     已过期期: ${analysis.adjustedUnits}/${analysis.cycleDays}天`);
          } else if (analysis.reason.alreadyPaid) {
            const expectedTotal = (
              (analysis.stakeAmount * analysis.ratePerBillion * analysis.cycleDays) /
              1000000000
            ).toFixed(2);
            console.log(`     ⚠️ 原因: 已支付${analysis.stakePaid} MC，预期总额${expectedTotal} MC，已全部支付`);
          } else if (analysis.reason.cycleComplete) {
            console.log(`     ✓ 周期已完成，用户应该能赎回本金和收益`);
          }
        } else {
          console.log(`     ✓ 有待领取奖励: ${analysis.pending} MC`);
        }

        console.log();
      }

      analysisResults.push({
        user,
        activeDirects: Number(userInfo.activeDirects),
        stakeCount,
        stakes: userStakes,
      });
    }

    // 汇总分析
    console.log("=".repeat(80));
    console.log("\n📊 汇总诊断：\n");

    for (const result of analysisResults) {
      const noPendingStakes = result.stakes.filter(
        (s) => parseFloat(s.pending) === 0
      ).length;
      const hasPendingStakes = result.stakes.filter(
        (s) => parseFloat(s.pending) > 0
      ).length;

      console.log(
        `👤 ${result.user} - ${noPendingStakes} 个无待领奖励 / ${result.stakes.length} 个质押`
      );

      if (noPendingStakes > 0) {
        const noUnitsCount = result.stakes.filter(
          (s) => s.reason.noUnitsYet
        ).length;
        const alreadyPaidCount = result.stakes.filter(
          (s) => s.reason.alreadyPaid
        ).length;
        const cycleCompleteCount = result.stakes.filter(
          (s) => s.reason.cycleComplete
        ).length;

        if (noUnitsCount > 0) {
          console.log(`   - ${noUnitsCount} 个质押时间不足（<1天）`);
        }
        if (alreadyPaidCount > 0) {
          console.log(`   - ${alreadyPaidCount} 个质押已全额支付`);
        }
        if (cycleCompleteCount > 0) {
          console.log(`   - ${cycleCompleteCount} 个质押周期已完成`);
        }
      }
      console.log();
    }

    // 尝试检查大样本
    console.log("📈 扩大样本检查前 20 个无奖励用户：\n");

    let samplesToCheck = Math.min(20, noRewardUsers.length);
    let hasUnclaimedRewards = 0;
    let noTimePassedCount = 0;
    let alreadyPaidCount = 0;
    let totalCheckedStakes = 0;

    for (let i = 0; i < samplesToCheck; i++) {
      const user = noRewardUsers[i];
      const stakeCount = await getStakesCount(protocol, user);

      for (let si = 0; si < stakeCount; si++) {
        const stakeRaw = await getFullStakeData(protocol, user, si);
        if (!stakeRaw) continue;

        const analysis = await analyzeStakeReward(provider, stakeRaw, blockTimestamp);
        totalCheckedStakes++;

        if (parseFloat(analysis.pending) > 0) {
          hasUnclaimedRewards++;
        } else if (analysis.reason.noUnitsYet) {
          noTimePassedCount++;
        } else if (analysis.reason.alreadyPaid) {
          alreadyPaidCount++;
        }
      }

      if ((i + 1) % 5 === 0) {
        console.log(`  已检查 ${i + 1}/${samplesToCheck} 个用户`);
      }
    }

    console.log(`\n  检查结果（${samplesToCheck} 个用户，共 ${totalCheckedStakes} 个质押）：`);
    console.log(`  - 有待领取奖励: ${hasUnclaimedRewards} 个`);
    console.log(`  - 时间不足(<1天): ${noTimePassedCount} 个`);
    console.log(`  - 已全额支付: ${alreadyPaidCount} 个`);
    console.log(`  - 其他原因: ${totalCheckedStakes - hasUnclaimedRewards - noTimePassedCount - alreadyPaidCount} 个\n`);

    // 关键结论
    console.log("=".repeat(80));
    console.log("\n🔑 关键发现：\n");

    if (hasUnclaimedRewards > 0) {
      console.log(
        `❌ 发现 ${hasUnclaimedRewards} 个质押应该有待领取奖励但用户没有领取！`
      );
      console.log("   原因：用户可能没有调用 claimRewards() 函数\n");
    }

    if (noTimePassedCount > samplesToCheck * 0.5) {
      console.log(
        `❌ 大多数质押时间不足 1 天（${noTimePassedCount}/${totalCheckedStakes}）`
      );
      console.log("   原因：质押创建太近，还未达到 1 天就开始计算奖励\n");
    }

    if (alreadyPaidCount > samplesToCheck * 0.7) {
      console.log(
        `⚠️ 多数质押已全额支付 (${alreadyPaidCount}/${totalCheckedStakes})`
      );
      console.log("   原因：用户已经领取过奖励，现在无权再领\n");
    }
  } catch (error) {
    console.error("❌ 错误:", error.message);
  }
}

analyze().catch(console.error);
