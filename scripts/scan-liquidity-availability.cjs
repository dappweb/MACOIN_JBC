/**
 * 扫描：检查所有有效门票用户的72小时过期状态
 * 以及是否存在 lastStakeDeadlineBase=0 导致的误过期问题
 */
const { ethers } = require('ethers');

const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

const ABI = [
  'function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, uint256 teamTotalVolume, bool isActive, uint256 maxTicketAmount, uint256 maxSingleTicketAmount, uint256 refundFeeAmount)',
  'function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)',
  'function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)',
  'function SECONDS_IN_UNIT() view returns (uint256)',
  'function ticketFlexibilityDuration() view returns (uint256)',
  'function ticketExpiryCutoffDate() view returns (uint256)',
  'function lastStakeDeadlineBase(address) view returns (uint256)',
  'function swapReserveMC() view returns (uint256)',
  'function redemptionFeePercent() view returns (uint256)',
];

const fmt = (wei) => ethers.formatEther(wei);

// 从1月31日的导出数据中读取所有账户地址
const fs = require('fs');
const path = require('path');
const ticketDataFile = path.join(__dirname, '../output/980-accounts-ticket-data-2026-01-31T07-28-36.json');

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { name: 'MC Chain', chainId: 88813 });
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, ABI, provider);

  const blockNum = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNum);
  const nowOnChain = block.timestamp;

  const safe = async (fn, fallback) => { try { return await fn(); } catch (_) { return fallback; } };
  const secondsInUnit = await safe(() => protocol.SECONDS_IN_UNIT(), 86400n);
  const flexibility = Number(await safe(() => protocol.ticketFlexibilityDuration(), 259200n));
  const cutoffDate = Number(await safe(() => protocol.ticketExpiryCutoffDate(), 0n));
  const reserveMC = await safe(() => protocol.swapReserveMC(), 0n);
  const redeemFeePercent = Number(await safe(() => protocol.redemptionFeePercent(), 1n));

  console.log('='.repeat(80));
  console.log('  全系统流动性可用性扫描');
  console.log('='.repeat(80));
  console.log(`\n链上时间: ${new Date(nowOnChain * 1000).toLocaleString('zh-CN')}  区块 #${blockNum}`);
  console.log(`ticketExpiryCutoffDate: ${cutoffDate}  (${cutoffDate === 0 ? '⚠️ 为0 → 所有门票都受72h限制!' : new Date(cutoffDate * 1000).toLocaleString('zh-CN')})`);
  console.log(`ticketFlexibilityDuration: ${flexibility}s = ${flexibility/3600}h`);
  console.log(`swapReserveMC: ${fmt(reserveMC)} MC`);

  // 加载地址列表
  const ticketData = JSON.parse(fs.readFileSync(ticketDataFile, 'utf8'));
  const addresses = ticketData.accounts.map(a => a.address);

  console.log(`\n扫描 ${addresses.length} 个地址...\n`);

  let stats = {
    total: addresses.length,
    hasTicket: 0,
    ticketExited: 0,
    noTicket: 0,
    hasActiveStake: 0,
    noActiveStake: 0,
    expired72h: 0,         // 门票已过期（72小时）
    willExpireSoon: 0,     // 即将过期（<24h）
    safeWindow: 0,         // 72h内安全
    deadlineBaseZero: 0,   // lastStakeDeadlineBase=0 (潜在问题)
    isActiveFalse_hasTicket: 0, // 有门票但isActive=false
    canStake: 0,           // 可以正常质押
    cannotStake: 0,        // 无法质押
    refundBlockers: 0,     // 因退费池不足被阻塞
    insufficientBalance: 0,
  };

  let expiredUsers = [];
  let blockedUsers = [];
  let deadlineZeroIssue = [];

  const BATCH = 20;
  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch = addresses.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (addr) => {
      try {
        const [tk, ui, deadlineBase, balance] = await Promise.all([
          protocol.userTicket(addr),
          protocol.userInfo(addr),
          protocol.lastStakeDeadlineBase(addr),
          provider.getBalance(addr),
        ]);

        // 检查活跃质押
        let activeStakeTotal = 0n;
        let maturedCount = 0;
        let activeCount = 0;
        for (let s = 0; s < 50; s++) {
          try {
            const stake = await protocol.userStakes(addr, s);
            if (stake.id === 0n && stake.amount === 0n) break;
            if (stake.active) {
              activeStakeTotal += stake.amount;
              const endTime = Number(stake.startTime) + Number(stake.cycleDays) * Number(secondsInUnit);
              if (nowOnChain >= endTime) maturedCount++;
              else activeCount++;
            }
          } catch (_) { break; }
        }

        return { addr, tk, ui, deadlineBase, balance, activeStakeTotal, maturedCount, activeCount };
      } catch (e) {
        return { addr, error: e.message };
      }
    }));

    for (const r of results) {
      if (r.error) continue;
      const { addr, tk, ui, deadlineBase, balance, activeStakeTotal, maturedCount, activeCount } = r;

      if (tk.amount === 0n) {
        stats.noTicket++;
        continue;
      }
      if (tk.exited) {
        stats.ticketExited++;
        continue;
      }

      stats.hasTicket++;

      if (activeStakeTotal > 0n) {
        stats.hasActiveStake++;
        stats.canStake++; // 有活跃质押，门票不会过期
        continue;
      }

      stats.noActiveStake++;

      // 无活跃质押 → 检查72h过期
      const base = Number(deadlineBase) !== 0 ? Number(deadlineBase) : Number(tk.purchaseTime);
      const deadline = base + flexibility;
      const isSubject = Number(tk.purchaseTime) >= cutoffDate;

      if (Number(deadlineBase) === 0) {
        stats.deadlineBaseZero++;
        deadlineZeroIssue.push({
          addr,
          purchaseTime: new Date(Number(tk.purchaseTime) * 1000).toLocaleString('zh-CN'),
          ticketAmount: fmt(tk.amount),
          isActive: ui.isActive,
        });
      }

      if (!ui.isActive) {
        stats.isActiveFalse_hasTicket++;
      }

      if (isSubject && nowOnChain > deadline) {
        stats.expired72h++;
        stats.cannotStake++;
        expiredUsers.push({
          addr,
          ticketAmount: fmt(tk.amount),
          deadlineBase: Number(deadlineBase),
          purchaseTime: new Date(Number(tk.purchaseTime) * 1000).toLocaleString('zh-CN'),
          expiredSince: new Date(deadline * 1000).toLocaleString('zh-CN'),
          hoursOverdue: ((nowOnChain - deadline) / 3600).toFixed(1),
          isActive: ui.isActive,
          refundFee: fmt(ui.refundFeeAmount),
        });
      } else if (isSubject && (deadline - nowOnChain) < 86400) {
        stats.willExpireSoon++;
        stats.canStake++;
      } else {
        stats.safeWindow++;
        stats.canStake++;
      }

      // 检查退费阻塞
      if (ui.refundFeeAmount > 0n && reserveMC < ui.refundFeeAmount) {
        stats.refundBlockers++;
        blockedUsers.push({
          addr,
          refundFee: fmt(ui.refundFeeAmount),
          poolMC: fmt(reserveMC),
        });
      }
    }
    process.stdout.write(`  已扫描 ${Math.min(i + BATCH, addresses.length)}/${addresses.length}\r`);
  }

  // 输出结果
  console.log('\n');
  console.log('='.repeat(80));
  console.log('  📊 扫描结果');
  console.log('='.repeat(80));
  console.log(`\n📋 总体统计:`);
  console.log(`   扫描地址数:           ${stats.total}`);
  console.log(`   有有效门票:           ${stats.hasTicket}`);
  console.log(`   门票已出局:           ${stats.ticketExited}`);
  console.log(`   无门票:               ${stats.noTicket}`);
  console.log(`   有活跃质押(安全):     ${stats.hasActiveStake}`);
  console.log(`   无活跃质押:           ${stats.noActiveStake}`);

  console.log(`\n⏰ 72小时过期状态:`);
  console.log(`   ❌ 已过期(无法质押):   ${stats.expired72h}`);
  console.log(`   ⚠️  即将过期(<24h):    ${stats.willExpireSoon}`);
  console.log(`   ✅ 安全窗口内:        ${stats.safeWindow}`);

  console.log(`\n🔍 潜在问题:`);
  console.log(`   lastStakeDeadlineBase=0: ${stats.deadlineBaseZero}  (使用购票时间作为基准)`);
  console.log(`   有门票但isActive=false:  ${stats.isActiveFalse_hasTicket}`);
  console.log(`   退费池阻塞:             ${stats.refundBlockers}`);

  console.log(`\n📊 流动性操作可用性:`);
  console.log(`   ✅ 可以提供流动性:  ${stats.canStake}`);
  console.log(`   ❌ 无法提供流动性:  ${stats.cannotStake}`);

  if (expiredUsers.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ❌ 门票已过期的用户 (共 ${expiredUsers.length} 个)`);
    console.log(`${'─'.repeat(60)}`);
    expiredUsers.forEach((u, i) => {
      console.log(`\n  ${i + 1}. ${u.addr}`);
      console.log(`     门票: ${u.ticketAmount} MC, 购票: ${u.purchaseTime}`);
      console.log(`     过期时间: ${u.expiredSince}, 已过期 ${u.hoursOverdue} 小时`);
      console.log(`     deadlineBase: ${u.deadlineBase === 0 ? '0 (⚠️ 未设置!)' : new Date(u.deadlineBase * 1000).toLocaleString('zh-CN')}`);
      console.log(`     isActive: ${u.isActive}, 待退手续费: ${u.refundFee} MC`);
    });
  }

  if (deadlineZeroIssue.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ⚠️  lastStakeDeadlineBase=0 的用户 (共 ${deadlineZeroIssue.length} 个)`);
    console.log(`${'─'.repeat(60)}`);
    deadlineZeroIssue.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.addr} | 门票=${u.ticketAmount} MC | 购票=${u.purchaseTime} | isActive=${u.isActive}`);
    });
  }

  if (blockedUsers.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ⚠️  退费池阻塞的用户 (共 ${blockedUsers.length} 个)`);
    console.log(`${'─'.repeat(60)}`);
    blockedUsers.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.addr} | 待退=${u.refundFee} MC | 池子=${u.poolMC} MC`);
    });
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('  扫描完成');
  console.log('='.repeat(80) + '\n');
}

main().catch(e => {
  console.error('❌ 扫描失败:', e.message);
  process.exit(1);
});
