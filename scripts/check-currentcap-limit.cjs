/**
 * 检查currentCap限制是否导致无法领取奖励
 * 问题：如果totalRevenue已经达到currentCap，新的rewards会被cap为0
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

async function analyzeStakeReward(stake, blockTimestamp) {
  const SECONDS_IN_UNIT = 86400n;
  const unitsPassed = Number((blockTimestamp - stake.startTime) / SECONDS_IN_UNIT);
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

  return pending;
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

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔍 检查currentCap限制是否导致无奖励\n");
  console.log("=".repeat(80) + "\n");

  try {
    const currentBlock = await provider.getBlockNumber();
    const blockInfo = await provider.getBlock(currentBlock);
    const blockTimestamp = BigInt(blockInfo?.timestamp || 0);

    // 获取无奖励用户
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

    console.log(`无奖励用户总数: ${noRewardUsers.length}\n`);
    console.log("检查前20个用户的currentCap情况：\n");

    let capReachedCount = 0;
    let capNotReachedCount = 0;
    let capDataList = [];

    for (let i = 0; i < Math.min(20, noRewardUsers.length); i++) {
      const user = noRewardUsers[i];
      const [userInfo, stakeCount] = await Promise.all([
        protocol.userInfo(user),
        getStakesCount(protocol, user),
      ]);

      let totalPending = 0n;
      for (let si = 0; si < stakeCount; si++) {
        const stakeRaw = await getFullStakeData(protocol, user, si);
        if (stakeRaw) {
          const pending = await analyzeStakeReward(stakeRaw, blockTimestamp);
          totalPending += BigInt(Math.floor(pending * 1000000000000000000));
        }
      }

      const totalRevenue = Number(ethers.formatEther(userInfo.totalRevenue));
      const currentCap = Number(ethers.formatEther(userInfo.currentCap));
      const canClaimMore = totalRevenue < currentCap;
      const rewardRoomLeft = currentCap - totalRevenue;
      const totalPendingMC = Number(ethers.formatEther(totalPending));

      const record = {
        user: user.substring(0, 10) + "...",
        totalRevenue: totalRevenue.toFixed(2),
        currentCap: currentCap.toFixed(2),
        roomLeft: rewardRoomLeft.toFixed(2),
        pendingRewards: totalPendingMC.toFixed(2),
        canClaimMore: canClaimMore,
        fullyBlocked: !canClaimMore && totalPendingMC > 0,
      };

      capDataList.push(record);

      if (canClaimMore) {
        capNotReachedCount++;
        console.log(`✓ ${user.substring(0, 10)}... 可领取: 余额${rewardRoomLeft.toFixed(2)}MC > 待领${totalPendingMC.toFixed(2)}MC`);
      } else {
        capReachedCount++;
        console.log(`❌ ${user.substring(0, 10)}... 已到版: totalRevenue${totalRevenue.toFixed(2)}MC >= cap${currentCap.toFixed(2)}MC (待领${totalPendingMC.toFixed(2)}MC)`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`\n📊 检查结果：\n`);
    console.log(`  已到达currentCap: ${capReachedCount} 个 (${((capReachedCount / 20) * 100).toFixed(1)}%)`);
    console.log(`  未到达currentCap: ${capNotReachedCount} 个 (${((capNotReachedCount / 20) * 100).toFixed(1)}%)`);
    console.log(`\n🔑 关键发现：\n`);

    if (capReachedCount > capNotReachedCount) {
      console.log(
        `❌ 大多数用户已经达到或超过currentCap限制(${capReachedCount}/${20})`
      );
      console.log(`   原因：一旦totalRevenue >= currentCap，claimRewards()会直接触发_handleExit()`);
      console.log(`   结果：用户的currentCap承载的奖励上限已满，无法再领取新奖励\n`);
      console.log(`💡解决方案：`);
      console.log(`   1. 增加用户的currentCap（通过管理员函数）`);
      console.log(`   2. 或让用户赎回本金，重新开始新周期\n`);
    } else {
      console.log(`✓ 大多数用户未达到currentCap限制`);
      console.log(`   → currentCap不是主要问题\n`);
    }
  } catch (error) {
    console.error("❌ 错误:", error.message);
  }
}

main().catch(console.error);
