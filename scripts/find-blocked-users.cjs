#!/usr/bin/env node
/**
 * 精确查找不能赎回和不能质押的用户
 * 
 * 不能赎回的情况：
 * 1. 质押已到期但赎回失败（合约层面阻止）
 * 2. 手续费无法支付
 * 3. 合约余额不足无法支付收益
 * 
 * 不能质押的情况：
 * 1. 没有门票
 * 2. 门票已退出（reached 3x cap）
 * 3. 门票过期（72小时规则）
 * 4. 用户未激活
 * 5. MC余额不足
 */

const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function emergencyPaused() view returns (bool)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function redemptionFeePercent() view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "function ticketExpiryCutoffDate() view returns (uint256)",
  "function lastStakeDeadlineBase(address) view returns (uint256)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)"
];

const SECONDS_IN_UNIT = 86400;

function fmt(wei) { return ethers.formatEther(wei); }
function fmtTime(ts) { return new Date(Number(ts) * 1000).toLocaleString('zh-CN'); }

async function getAllUsers(contract, provider) {
  console.log("📡 获取所有用户...");
  const allUsers = new Set();
  const blockNumber = await provider.getBlockNumber();

  try {
    const events = await contract.queryFilter(contract.filters.BoundReferrer(), 0, blockNumber);
    events.forEach(e => { if (e.args) { allUsers.add(e.args.user); allUsers.add(e.args.referrer); } });
  } catch (e) { console.warn("  BoundReferrer查询失败"); }

  try {
    const events = await contract.queryFilter(contract.filters.TicketPurchased(), 0, blockNumber);
    events.forEach(e => { if (e.args) allUsers.add(e.args.user); });
  } catch (e) {}

  try {
    const events = await contract.queryFilter(contract.filters.LiquidityStaked(), 0, blockNumber);
    events.forEach(e => { if (e.args) allUsers.add(e.args.user); });
  } catch (e) {}

  // 加备份
  try {
    const fs = require('fs');
    const path = require('path');
    const backup = JSON.parse(fs.readFileSync(path.join(__dirname, 'backups', 'protocol-backup-1767522095585.json'), 'utf8'));
    backup.users.forEach(u => allUsers.add(u.address));
  } catch (e) {}

  allUsers.delete(ethers.ZeroAddress);
  console.log(`  总计 ${allUsers.size} 个用户\n`);
  return Array.from(allUsers);
}

async function main() {
  console.log("=".repeat(80));
  console.log("🔍 不能赎回 / 不能质押 用户排查");
  console.log("=".repeat(80));
  console.log(`⏰ ${new Date().toLocaleString('zh-CN')}\n`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  const now = Math.floor(Date.now() / 1000);

  // 获取全局参数
  const [paused, liquidityEnabled, redeemEnabled, redemptionFeePercent, poolMC] = await Promise.all([
    contract.emergencyPaused(),
    contract.liquidityEnabled(),
    contract.redeemEnabled(),
    contract.redemptionFeePercent(),
    contract.swapReserveMC()
  ]);

  let ticketFlexDuration = 259200; // 默认72小时
  try { ticketFlexDuration = Number(await contract.ticketFlexibilityDuration()); } catch(e) {}

  // 2026-02-09 00:00:00 UTC
  const TICKET_EXPIRY_CUTOFF = 1770595200;

  console.log("📋 全局状态:");
  console.log(`  合约暂停: ${paused ? "❌ 是" : "✅ 否"}`);
  console.log(`  质押功能: ${liquidityEnabled ? "✅ 启用" : "❌ 禁用"}`);
  console.log(`  赎回功能: ${redeemEnabled ? "✅ 启用" : "❌ 禁用"}`);
  console.log(`  赎回手续费: ${redemptionFeePercent}%`);
  console.log(`  协议池MC: ${fmt(poolMC)} MC`);
  console.log(`  门票灵活期: ${ticketFlexDuration}s (${(ticketFlexDuration/3600).toFixed(1)}h)\n`);

  const allAddresses = await getAllUsers(contract, provider);

  // ====== 分类存储 ======
  const cannotRedeem = [];      // 有到期质押但不能赎回
  const cannotStake = [];       // 应该能质押但不能质押
  const expiredNotRedeemed = []; // 到期未赎回的（可赎回但未赎回）
  const underpaidTerminated = []; // 终止但未支付收益

  const batchSize = 5;
  let processed = 0;

  for (let i = 0; i < allAddresses.length; i += batchSize) {
    const batch = allAddresses.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (addr) => {
      try {
        const [info, ticket] = await Promise.all([
          contract.userInfo(addr),
          contract.userTicket(addr)
        ]);

        // 获取质押
        const stakes = [];
        let idx = 0;
        while (idx < 100) {
          try {
            const s = await contract.userStakes(addr, idx);
            if (s.amount > 0n) stakes.push({
              idx, id: Number(s.id), amount: s.amount,
              startTime: Number(s.startTime), cycleDays: Number(s.cycleDays),
              active: s.active, paid: s.paid
            });
            idx++;
          } catch(e) { break; }
        }

        return { addr, info, ticket, stakes };
      } catch(e) { return null; }
    }));

    for (const r of results) {
      if (!r) continue;
      const { addr, info, ticket, stakes } = r;

      // ======= 不能赎回分析 =======
      const activeStakes = stakes.filter(s => s.active);
      const maturedActiveStakes = activeStakes.filter(s => {
        const endTime = s.startTime + s.cycleDays * SECONDS_IN_UNIT;
        return now >= endTime;
      });

      if (maturedActiveStakes.length > 0) {
        const reasons = [];

        // 全局阻止
        if (paused) reasons.push("合约已暂停");
        if (!redeemEnabled) reasons.push("赎回功能已禁用");

        // 手续费问题
        const feeBase = info.maxTicketAmount > 0n ? info.maxTicketAmount : ticket.amount;
        const fee = (feeBase * BigInt(redemptionFeePercent)) / 100n;

        // 收益上限问题
        if (info.currentCap > 0n && info.totalRevenue >= info.currentCap) {
          reasons.push(`已达3倍收益上限 (${fmt(info.totalRevenue)}/${fmt(info.currentCap)} MC)`);
        }

        if (reasons.length > 0) {
          cannotRedeem.push({
            address: addr,
            reasons,
            maturedStakeCount: maturedActiveStakes.length,
            maturedStakes: maturedActiveStakes.map(s => ({
              id: s.id, amount: fmt(s.amount),
              cycleDays: s.cycleDays,
              endTime: fmtTime(s.startTime + s.cycleDays * SECONDS_IN_UNIT),
              overdueDays: Math.floor((now - (s.startTime + s.cycleDays * SECONDS_IN_UNIT)) / SECONDS_IN_UNIT)
            })),
            fee: fmt(fee)
          });
        } else {
          // 可以赎回但没赎回
          expiredNotRedeemed.push({
            address: addr,
            stakeCount: maturedActiveStakes.length,
            stakes: maturedActiveStakes.map(s => ({
              id: s.id, amount: fmt(s.amount),
              cycleDays: s.cycleDays,
              overdueDays: Math.floor((now - (s.startTime + s.cycleDays * SECONDS_IN_UNIT)) / SECONDS_IN_UNIT)
            })),
            fee: fmt(fee),
            totalAmount: fmt(maturedActiveStakes.reduce((sum, s) => sum + s.amount, 0n))
          });
        }
      }

      // ======= 终止但未付收益 =======
      const terminatedStakes = stakes.filter(s => !s.active && s.amount > 0n);
      for (const s of terminatedStakes) {
        let rate = 0n;
        if (s.cycleDays === 7) rate = 13333334n;
        else if (s.cycleDays === 15) rate = 16666667n;
        else if (s.cycleDays === 30) rate = 20000000n;
        
        if (rate > 0n) {
          const expectedTotal = (s.amount * rate * BigInt(s.cycleDays)) / 1000000000n;
          if (s.paid === 0n && expectedTotal > 0n) {
            underpaidTerminated.push({
              address: addr,
              stakeId: s.id,
              amount: fmt(s.amount),
              cycleDays: s.cycleDays,
              expectedRevenue: fmt(expectedTotal),
              paid: fmt(s.paid),
              missing: fmt(expectedTotal)
            });
          }
        }
      }

      // ======= 不能质押分析 =======
      // 只分析有门票的用户
      if (ticket.amount > 0n) {
        const reasons = [];

        // 全局阻止
        if (paused) reasons.push("合约已暂停");
        if (!liquidityEnabled) reasons.push("质押功能已禁用");

        // 门票已退出
        if (ticket.exited) {
          reasons.push(`门票已退出(3倍出局)`);
        }

        // 72小时过期检查
        if (!ticket.exited && Number(ticket.purchaseTime) >= TICKET_EXPIRY_CUTOFF) {
          let deadlineBase = Number(ticket.purchaseTime);
          try {
            const lsdb = await contract.lastStakeDeadlineBase(addr);
            if (lsdb > 0n) deadlineBase = Number(lsdb);
          } catch(e) {}
          
          const deadline = deadlineBase + ticketFlexDuration;
          if (now > deadline) {
            reasons.push(`门票已过期(72h规则，过期于${fmtTime(deadline)})`);
          }
        }

        // 账户未激活
        if (!info.isActive) {
          reasons.push("账户未激活");
        }

        // 收益上限
        if (info.currentCap > 0n && info.totalRevenue >= info.currentCap) {
          reasons.push(`已达3倍收益上限`);
        }

        if (reasons.length > 0) {
          cannotStake.push({
            address: addr,
            reasons,
            ticketAmount: fmt(ticket.amount),
            purchaseTime: fmtTime(ticket.purchaseTime),
            exited: ticket.exited,
            totalRevenue: fmt(info.totalRevenue),
            currentCap: fmt(info.currentCap),
            isActive: info.isActive
          });
        }
      }
    }

    processed = Math.min(i + batchSize, allAddresses.length);
    if (processed % 100 === 0 || processed === allAddresses.length) {
      process.stdout.write(`  进度: ${processed}/${allAddresses.length}\r`);
    }
  }

  // ====== 输出结果 ======
  console.log("\n\n");
  console.log("=".repeat(80));
  console.log("🔴 不能赎回的用户（有到期质押但存在阻止原因）");
  console.log("=".repeat(80));

  if (cannotRedeem.length === 0) {
    console.log("  ✅ 没有用户被合约逻辑阻止赎回\n");
  } else {
    console.log(`  共 ${cannotRedeem.length} 个用户\n`);
    cannotRedeem.forEach((u, i) => {
      console.log(`  ${i+1}. ${u.address}`);
      console.log(`     阻止原因: ${u.reasons.join('; ')}`);
      console.log(`     到期质押: ${u.maturedStakeCount} 笔`);
      u.maturedStakes.forEach(s => {
        console.log(`       - 质押#${s.id}: ${s.amount} MC, ${s.cycleDays}天, 到期${s.endTime}, 逾期${s.overdueDays}天`);
      });
      console.log(`     赎回手续费: ${u.fee} MC`);
      console.log('');
    });
  }

  console.log("=".repeat(80));
  console.log("🔴 不能质押（提供流动性）的用户");
  console.log("=".repeat(80));

  if (cannotStake.length === 0) {
    console.log("  ✅ 没有用户被阻止质押\n");
  } else {
    console.log(`  共 ${cannotStake.length} 个用户\n`);
    
    // 按原因分类统计
    const reasonStats = {};
    cannotStake.forEach(u => {
      u.reasons.forEach(r => { reasonStats[r] = (reasonStats[r] || 0) + 1; });
    });
    console.log("  📊 原因统计:");
    Object.entries(reasonStats).sort((a,b) => b[1]-a[1]).forEach(([r, c]) => {
      console.log(`    ${r}: ${c} 人`);
    });
    console.log('');
    
    // 详细列表
    cannotStake.forEach((u, i) => {
      console.log(`  ${i+1}. ${u.address}`);
      console.log(`     阻止原因: ${u.reasons.join('; ')}`);
      console.log(`     门票: ${u.ticketAmount} MC, 购于${u.purchaseTime}`);
      console.log(`     收益: ${u.totalRevenue}/${u.currentCap} MC, 激活: ${u.isActive}`);
      console.log('');
    });
  }

  console.log("=".repeat(80));
  console.log("🟡 到期未赎回但可以赎回的用户");
  console.log("=".repeat(80));

  if (expiredNotRedeemed.length === 0) {
    console.log("  ✅ 没有到期未赎回的用户\n");
  } else {
    console.log(`  共 ${expiredNotRedeemed.length} 个用户\n`);
    
    // 按逾期天数排序
    expiredNotRedeemed.sort((a, b) => {
      const maxA = Math.max(...a.stakes.map(s => s.overdueDays));
      const maxB = Math.max(...b.stakes.map(s => s.overdueDays));
      return maxB - maxA;
    });

    expiredNotRedeemed.forEach((u, i) => {
      const maxOverdue = Math.max(...u.stakes.map(s => s.overdueDays));
      console.log(`  ${i+1}. ${u.address}`);
      console.log(`     到期质押: ${u.stakeCount} 笔, 总额: ${u.totalAmount} MC, 最大逾期: ${maxOverdue}天`);
      console.log(`     手续费: ${u.fee} MC`);
      u.stakes.forEach(s => {
        console.log(`       - 质押#${s.id}: ${s.amount} MC, ${s.cycleDays}天周期, 逾期${s.overdueDays}天`);
      });
      console.log('');
    });
  }

  console.log("=".repeat(80));
  console.log("🔴 质押被终止但收益为0（可能数据丢失）");
  console.log("=".repeat(80));

  if (underpaidTerminated.length === 0) {
    console.log("  ✅ 没有此类问题\n");
  } else {
    console.log(`  共 ${underpaidTerminated.length} 笔\n`);
    
    // 去重
    const seen = new Set();
    const unique = underpaidTerminated.filter(u => {
      const key = u.address.toLowerCase() + '|' + u.stakeId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let totalMissing = 0;
    unique.forEach((u, i) => {
      totalMissing += parseFloat(u.missing);
      console.log(`  ${i+1}. ${u.address}`);
      console.log(`     质押#${u.stakeId}: ${u.amount} MC, ${u.cycleDays}天`);
      console.log(`     应得: ${u.expectedRevenue} MC, 已付: ${u.paid} MC, 缺少: ${u.missing} MC`);
      console.log('');
    });
    console.log(`  💰 总计缺少收益: ${totalMissing.toFixed(2)} MC`);
  }

  // ====== 总结 ======
  console.log("\n" + "=".repeat(80));
  console.log("📊 总结");
  console.log("=".repeat(80));
  console.log(`  🔴 不能赎回（合约阻止）: ${cannotRedeem.length} 人`);
  console.log(`  🔴 不能质押（合约阻止）: ${cannotStake.length} 人`);
  console.log(`  🟡 到期可赎回但未赎回:    ${expiredNotRedeemed.length} 人`);
  console.log(`  🔴 质押终止但收益为0:     ${underpaidTerminated.length} 笔`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
