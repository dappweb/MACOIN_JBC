/**
 * 使用质押区块的历史状态核实极差奖励
 * 对比：按质押时链上状态计算的预期值 vs 实际 DifferentialRewardRecorded 事件
 *
 * 用法: node scripts/verify-differential-at-stake-block.cjs
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
  "event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)",
];

function getLevel(teamCount) {
  const tc = Number(teamCount);
  if (tc >= 100000) return { level: 9, percent: 45 };
  if (tc >= 30000) return { level: 8, percent: 40 };
  if (tc >= 10000) return { level: 7, percent: 35 };
  if (tc >= 3000) return { level: 6, percent: 30 };
  if (tc >= 1000) return { level: 5, percent: 25 };
  if (tc >= 300) return { level: 4, percent: 20 };
  if (tc >= 100) return { level: 3, percent: 15 };
  if (tc >= 30) return { level: 2, percent: 10 };
  if (tc >= 10) return { level: 1, percent: 5 };
  return { level: 0, percent: 0 };
}

function formatMC(wei) {
  return parseFloat(ethers.formatEther(wei)).toFixed(4);
}

function shortAddr(addr) {
  return (addr || "").slice(0, 6) + "..." + (addr || "").slice(-4);
}

// 模拟合约逻辑：使用质押区块状态计算预期极差奖励
async function simulateDifferentialAtBlock(protocol, staker, amount, stakeBlock) {
  const blockTag = { blockTag: stakeBlock };
  const results = [];

  let current = staker;
  let previousPercent = 0;
  let iterations = 0;
  const maxLayers = 20;

  while (current && iterations < maxLayers) {
    let stakerRef;
    try {
      stakerRef = await protocol.userInfo(current, blockTag);
    } catch (e) {
      break;
    }
    current = stakerRef[0]; // referrer
    if (!current || current === ethers.ZeroAddress) break;
    current = current.toLowerCase();

    let ui, ticket;
    try {
      ui = await protocol.userInfo(current, blockTag);
      ticket = await protocol.userTicket(current, blockTag);
    } catch (e) {
      break;
    }

    if (!ui[5]) { // isActive
      iterations++;
      continue;
    }

    const uplineTicket = ticket[1] || 0n;
    const exited = ticket[3];
    if (uplineTicket === 0n || exited) {
      iterations++;
      continue;
    }

    const { percent } = getLevel(ui[2]); // teamCount
    if (percent > previousPercent) {
      const diffPercent = percent - previousPercent;
      let baseAmount = amount;
      if (baseAmount > uplineTicket) baseAmount = uplineTicket;
      const reward = (baseAmount * BigInt(diffPercent)) / 100n;
      results.push({
        upline: current,
        percent,
        diffPercent,
        baseAmount,
        reward,
      });
      previousPercent = percent;
    }
    if (percent >= 45) break;
    iterations++;
  }

  return results;
}

async function main() {
  console.log("=".repeat(80));
  console.log("使用质押区块历史状态核实极差奖励");
  console.log("=".repeat(80));
  console.log(`合约: ${PROTOCOL_ADDRESS}\n`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  // 获取 LiquidityStaked 和 DifferentialRewardRecorded 事件
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 500000);

  const [stakeEvents, recordEvents] = await Promise.all([
    protocol.queryFilter(protocol.filters.LiquidityStaked(), fromBlock, currentBlock),
    protocol.queryFilter(protocol.filters.DifferentialRewardRecorded(), fromBlock, currentBlock),
  ]);

  // stakeId -> { user, amount, blockNumber }
  const stakeMap = {};
  stakeEvents.forEach((e) => {
    if (e.args?.stakeId != null) {
      stakeMap[Number(e.args.stakeId)] = {
        user: e.args.user?.toLowerCase(),
        amount: e.args.amount || 0n,
        blockNumber: e.blockNumber,
      };
    }
  });

  // stakeId -> [{ upline, amount }]
  const recordedMap = {};
  recordEvents.forEach((e) => {
    if (e.args?.stakeId != null) {
      const sid = Number(e.args.stakeId);
      if (!recordedMap[sid]) recordedMap[sid] = [];
      recordedMap[sid].push({
        upline: e.args.upline?.toLowerCase(),
        amount: e.args.amount || 0n,
      });
    }
  });

  // 优先检查之前 verify 报异常的质押 ID，再抽样其余
  const anomalyStakeIds = [48, 50, 53, 131, 147, 166, 169, 189, 254, 270, 273, 280, 342];
  const allStakeIds = Object.keys(recordedMap)
    .map(Number)
    .filter((sid) => stakeMap[sid] && recordedMap[sid].length > 0);
  const anomalyToCheck = anomalyStakeIds.filter((sid) => allStakeIds.includes(sid));
  const others = allStakeIds.filter((sid) => !anomalyStakeIds.includes(sid)).slice(0, 50);
  const stakeIdsToCheck = [...new Set([...anomalyToCheck, ...others])];

  let okCount = 0;
  let anomalyCount = 0;

  for (const sid of stakeIdsToCheck) {
    const stake = stakeMap[sid];
    const recorded = recordedMap[sid];
    if (!stake || !recorded.length) continue;

    const stakeBlock = stake.blockNumber;

    let simulated;
    try {
      simulated = await simulateDifferentialAtBlock(protocol, stake.user, stake.amount, stakeBlock);
    } catch (e) {
      console.log(`  [Stake ${sid}] 历史状态查询失败: ${e.message}`);
      continue;
    }

    // 对比：按 upline 聚合
    const expByUpline = {};
    simulated.forEach((r) => {
      const k = r.upline.toLowerCase();
      if (!expByUpline[k]) expByUpline[k] = 0n;
      expByUpline[k] += r.reward;
    });

    const actByUpline = {};
    recorded.forEach((r) => {
      const k = r.upline.toLowerCase();
      if (!actByUpline[k]) actByUpline[k] = 0n;
      actByUpline[k] += r.amount;
    });

    const allUplines = new Set([...Object.keys(expByUpline), ...Object.keys(actByUpline)]);
    let hasAnomaly = false;
    const issues = [];

    for (const u of allUplines) {
      const exp = expByUpline[u] || 0n;
      const act = actByUpline[u] || 0n;
      if (act > exp) {
        const diff = act - exp;
        const pct = exp > 0n ? Number((diff * 10000n) / exp) / 100 : 100;
        issues.push(`  ${shortAddr(u)}: 实际 ${formatMC(act)} > 预期 ${formatMC(exp)} MC (多 ${formatMC(diff)}, +${pct}%)`);
        hasAnomaly = true;
      } else if (act < exp && act > 0n) {
        issues.push(`  ${shortAddr(u)}: 实际 ${formatMC(act)} < 预期 ${formatMC(exp)} MC`);
        hasAnomaly = true;
      } else if (act > 0n && exp === 0n) {
        issues.push(`  ${shortAddr(u)}: 实际 ${formatMC(act)} MC 但预期为 0 (可能不在链上或状态已变)`);
        hasAnomaly = true;
      }
    }

    if (hasAnomaly) {
      anomalyCount++;
      console.log(`\n[Stake ${sid}] 质押者 ${shortAddr(stake.user)} | 质押 ${formatMC(stake.amount)} MC | 区块 ${stakeBlock}`);
      issues.forEach((i) => console.log(i));
    } else {
      okCount++;
    }
  }

  // 额外：用当前状态模拟 vs 历史状态，看差异
  console.log("\n" + "=".repeat(80));
  console.log("【对比】当前状态 vs 质押时状态（抽样 5 笔）");
  console.log("=".repeat(80));
  const sampleIds = stakeIdsToCheck.slice(0, 5);
  for (const sid of sampleIds) {
    const stake = stakeMap[sid];
    if (!stake) continue;
    let atStakeBlock, atCurrent;
    try {
      atStakeBlock = await simulateDifferentialAtBlock(protocol, stake.user, stake.amount, stake.blockNumber);
      atCurrent = await simulateDifferentialAtBlock(protocol, stake.user, stake.amount, currentBlock);
    } catch (e) {
      continue;
    }
    const expAtStake = atStakeBlock.reduce((s, r) => s + r.reward, 0n);
    const expAtCurrent = atCurrent.reduce((s, r) => s + r.reward, 0n);
    const recorded = (recordedMap[sid] || []).reduce((s, r) => s + r.amount, 0n);
    const diff = expAtStake !== expAtCurrent;
    if (diff || expAtStake !== recorded) {
      console.log(`  Stake ${sid}: 质押时预期 ${formatMC(expAtStake)} | 当前预期 ${formatMC(expAtCurrent)} | 实际发放 ${formatMC(recorded)} MC ${diff ? "(状态已变)" : ""}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`核实完成: 抽样 ${stakeIdsToCheck.length} 笔`);
  console.log(`  符合预期（按质押时状态）: ${okCount}`);
  console.log(`  存在差异: ${anomalyCount}`);
  console.log("=".repeat(80));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
