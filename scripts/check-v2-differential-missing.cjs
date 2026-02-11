/**
 * 排查 V2 账户极差收益缺失原因
 * 用户反馈: 0xd5cFE4E34d13AC239C2e4a59662ce9faEc2fEDaA (V2账户, 极差收益缺失)
 *
 * 用法: node scripts/check-v2-differential-missing.cjs
 */

const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const V2_ADDRESS = "0xd5cFE4E34d13AC239C2e4a59662ce9faEc2fEDaA";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function stakeOwner(uint256) view returns (address)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
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

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🔍 V2 账户极差收益缺失排查");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log("目标地址:", V2_ADDRESS);
  console.log("协议地址:", PROTOCOL_ADDRESS);
  console.log("");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 500000);

  try {
    // 1. 用户基本信息与等级
    console.log("【1】用户基本信息");
    console.log("─".repeat(60));
    const userInfo = await protocol.userInfo(V2_ADDRESS);
    const referrer = userInfo.referrer;
    const activeDirects = userInfo.activeDirects.toString();
    const teamCount = userInfo.teamCount.toString();
    const isActive = userInfo.isActive;
    const { level, percent } = getLevel(userInfo.teamCount);
    console.log("  推荐人:", referrer);
    console.log("  活跃直推数:", activeDirects);
    console.log("  团队人数:", teamCount);
    console.log("  等级: V" + level + ", 极差比例:", percent + "%");
    console.log("  是否活跃:", isActive);
    console.log("");

    // 2. 该地址作为 upline 被记录的极差（下级质押时写入）
    console.log("【2】极差「已记录」记录 (DifferentialRewardRecorded, 下级质押时)");
    console.log("─".repeat(60));
    const recordedEvents = await protocol.queryFilter(
      protocol.filters.DifferentialRewardRecorded(null, V2_ADDRESS),
      fromBlock,
      currentBlock
    );
    const byStakeIdRecorded = new Map();
    let totalRecorded = 0n;
    for (const e of recordedEvents) {
      const stakeId = e.args.stakeId.toString();
      const amount = e.args.amount;
      if (!byStakeIdRecorded.has(stakeId)) byStakeIdRecorded.set(stakeId, 0n);
      byStakeIdRecorded.set(stakeId, byStakeIdRecorded.get(stakeId) + amount);
      totalRecorded += amount;
    }
    console.log("  记录笔数:", recordedEvents.length);
    console.log("  涉及质押 ID 数:", byStakeIdRecorded.size);
    console.log("  记录总金额(wei):", totalRecorded.toString());
    console.log("  记录总金额(MC):", ethers.formatEther(totalRecorded));
    if (recordedEvents.length > 0) {
      console.log("  按 stakeId 汇总:");
      for (const [stakeId, amt] of byStakeIdRecorded) {
        console.log("    stakeId", stakeId, "=>", ethers.formatEther(amt), "MC");
      }
    }
    console.log("");

    // 3. 该地址作为 upline 已发放的极差（下级领取/赎回时发放）
    console.log("【3】极差「已发放」记录 (DifferentialRewardReleased)");
    console.log("─".repeat(60));
    const releasedEvents = await protocol.queryFilter(
      protocol.filters.DifferentialRewardReleased(null, V2_ADDRESS),
      fromBlock,
      currentBlock
    );
    const byStakeIdReleased = new Map();
    let totalReleased = 0n;
    for (const e of releasedEvents) {
      const stakeId = e.args.stakeId.toString();
      const amount = e.args.amount;
      if (!byStakeIdReleased.has(stakeId)) byStakeIdReleased.set(stakeId, 0n);
      byStakeIdReleased.set(stakeId, byStakeIdReleased.get(stakeId) + amount);
      totalReleased += amount;
    }
    console.log("  发放笔数:", releasedEvents.length);
    console.log("  涉及质押 ID 数:", byStakeIdReleased.size);
    console.log("  发放总金额(MC):", ethers.formatEther(totalReleased));
    if (releasedEvents.length > 0) {
      console.log("  按 stakeId 汇总:");
      for (const [stakeId, amt] of byStakeIdReleased) {
        console.log("    stakeId", stakeId, "=>", ethers.formatEther(amt), "MC");
      }
    }
    console.log("");

    // 4. ReferralRewardPaid 中 rewardType=4（极差）且 user=V2
    console.log("【4】ReferralRewardPaid 极差类型 (rewardType=4)");
    console.log("─".repeat(60));
    const REWARD_DIFFERENTIAL = 4;
    const paidEvents = await protocol.queryFilter(
      protocol.filters.ReferralRewardPaid(V2_ADDRESS),
      fromBlock,
      currentBlock
    );
    const diffPaid = paidEvents.filter((e) => Number(e.args.rewardType) === REWARD_DIFFERENTIAL);
    let totalMc = 0n, totalJbc = 0n;
    diffPaid.forEach((e) => {
      totalMc += e.args.mcAmount || 0n;
      totalJbc += e.args.jbcAmount || 0n;
    });
    console.log("  极差类 ReferralRewardPaid 笔数:", diffPaid.length);
    console.log("  总 MC:", ethers.formatEther(totalMc), "MC");
    console.log("  总 JBC:", ethers.formatEther(totalJbc), "JBC");
    console.log("");

    // 5. 对比：已记录 vs 已发放
    console.log("【5】对比：已记录 vs 已发放（按 stakeId）");
    console.log("─".repeat(60));
    const allStakeIds = new Set([...byStakeIdRecorded.keys(), ...byStakeIdReleased.keys()]);
    let missingRelease = [];
    let notYetEnded = [];
    const SECONDS_IN_UNIT = Number(await protocol.SECONDS_IN_UNIT());
    for (const stakeId of allStakeIds) {
      const rec = byStakeIdRecorded.get(stakeId) || 0n;
      const rel = byStakeIdReleased.get(stakeId) || 0n;
      const owner = await protocol.stakeOwner(stakeId).catch(() => null);
      let stakeEndTime = null;
      if (owner) {
        try {
          const stakes = await protocol.userStakes(owner, 0);
          let idx = 0;
          while (true) {
            const s = await protocol.userStakes(owner, idx).catch(() => null);
            if (!s) break;
            if (s.id.toString() === stakeId) {
              stakeEndTime = Number(s.startTime) + Number(s.cycleDays) * SECONDS_IN_UNIT;
              break;
            }
            idx++;
            if (idx > 500) break;
          }
        } catch (e) {}
      }
      const now = Math.floor(Date.now() / 1000);
      const ended = stakeEndTime !== null && now >= stakeEndTime;
      if (rec > 0n && rel < rec) {
        missingRelease.push({
          stakeId,
          recorded: ethers.formatEther(rec),
          released: ethers.formatEther(rel),
          stakeEndTime: stakeEndTime ? new Date(stakeEndTime * 1000).toISOString() : "?",
          ended,
        });
      }
      if (rec > 0n && rel === 0n && !ended && stakeEndTime) notYetEnded.push(stakeId);
    }
    if (missingRelease.length > 0) {
      console.log("  ⚠️ 以下 stakeId 有记录但发放不足:");
      missingRelease.forEach((x) => {
        console.log("    stakeId", x.stakeId, "记录", x.recorded, "MC, 已发", x.released, "MC, 周期结束", x.ended, "结束时间", x.stakeEndTime);
      });
    } else if (byStakeIdRecorded.size > 0 && byStakeIdReleased.size === 0) {
      console.log("  ⚠️ 有记录但无一笔发放。可能原因:");
      console.log("    - 下级质押周期尚未结束（极差在「领取/赎回」时发放）");
      console.log("    - 下级从未 claimRewards 或 redeem");
      if (notYetEnded.length > 0) console.log("    未结束的 stakeId:", notYetEnded.join(", "));
    } else if (byStakeIdRecorded.size === 0) {
      console.log("  无任何「已记录」极差。可能原因:");
      console.log("    - 该用户直推/团队无人质押，或质押时该用户未满足条件（活跃、有门票、等级>上级）");
      console.log("    - 下级质押时该用户 teamCount 对应的等级未产生级差（例如与上级同等级）");
    } else {
      console.log("  已记录与已发放按 stakeId 一致或已发更多，无缺失。");
    }
    console.log("");

    // 6. 直推列表（谁绑定了该地址为推荐人）
    console.log("【6】直推用户（BoundReferrer 中 referrer=该地址）");
    console.log("─".repeat(60));
    const boundEvents = await protocol.queryFilter(
      protocol.filters.BoundReferrer(null, V2_ADDRESS),
      fromBlock,
      currentBlock
    );
    const directRefs = [...new Set(boundEvents.map((e) => e.args.user.toLowerCase()))];
    console.log("  直推人数:", directRefs.length);
    directRefs.slice(0, 20).forEach((a, i) => console.log("   ", i + 1, a));
    if (directRefs.length > 20) console.log("   ... 仅列前 20");
    console.log("");

    // 7. 结论
    console.log("【7】结论与可能原因");
    console.log("─".repeat(60));
    if (totalRecorded === 0n) {
      console.log("  • 链上无该 V2 地址的极差「记录」→ 缺失原因多为：");
      console.log("    1) 下级尚未质押，或质押时该用户未在推荐链上（非其直推/间推）");
      console.log("    2) 质押时该用户 isActive=false / 无有效门票 / 已 exited");
      console.log("    3) 质押时该用户 teamCount 对应等级未产生级差（previousPercent 已>=该层 percent）");
    } else if (totalReleased < totalRecorded) {
      const allPending = missingRelease.length;
      const allNotEnded = missingRelease.filter((x) => x.ended === false).length;
      if (allPending > 0 && allNotEnded === allPending) {
        console.log("  • 有记录但未发放 → 原因：极差在「下级质押周期结束且下级领取/赎回」时发放；");
        console.log("    当前未发放的 " + allPending + " 笔对应质押周期均尚未结束（结束时间见上），属正常逻辑，非合约错误。");
        console.log("  • 待发放合计(MC):", ethers.formatEther(totalRecorded - totalReleased));
      } else {
        console.log("  • 有记录但发放不足 → 可能部分质押尚未到期或下级未领取/赎回，或发放时合约余额不足导致 _distributeReward 未发满");
      }
    } else {
      console.log("  • 记录与发放金额一致，若用户仍感「缺失」可能为前端展示或统计范围（时间/类型）不一致");
    }
    console.log("═══════════════════════════════════════════════════════════════");
  } catch (err) {
    console.error("执行失败:", err.message);
    throw err;
  }
}

main().catch(() => process.exit(1));
