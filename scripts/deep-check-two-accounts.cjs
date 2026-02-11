/**
 * 深入检查两个客户的链上实时状态
 * 账户1: 0xC65f043aD84561e262C3aE54230F74B1071BEFE3
 * 账户2: 0xd6b93380bAa72a4Ad126b2e8985A33Dd8C13D98f
 *
 * 查询内容：userInfo、userTicket、userStakes、余额、赎回手续费、72h过期状态等
 */
const { ethers } = require('ethers');

const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

const TARGETS = [
  '0xC65f043aD84561e262C3aE54230F74B1071BEFE3',
  '0xd6b93380bAa72a4Ad126b2e8985A33Dd8C13D98f',
];

const ABI = [
  // 用户信息
  'function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, uint256 teamTotalVolume, bool isActive, uint256 maxTicketAmount, uint256 maxSingleTicketAmount, uint256 refundFeeAmount)',
  // 门票信息
  'function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)',
  // 质押
  'function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)',
  // 全局参数
  'function SECONDS_IN_UNIT() view returns (uint256)',
  'function ticketFlexibilityDuration() view returns (uint256)',
  'function ticketExpiryCutoffDate() view returns (uint256)',
  'function lastStakeDeadlineBase(address) view returns (uint256)',
  'function redemptionFeePercent() view returns (uint256)',
  'function swapReserveMC() view returns (uint256)',
  'function swapReserveJBC() view returns (uint256)',
  'function liquidityEnabled() view returns (bool)',
  'function redeemEnabled() view returns (bool)',
  'function paused() view returns (bool)',
  'function stakeRedemptionFeePaid(uint256) view returns (uint256)',
  'function totalDynamicEarned(address) view returns (uint256)',
  'function totalDynamicClaimed(address) view returns (uint256)',
];

const fmt = (wei) => ethers.formatEther(wei);

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { name: 'MC Chain', chainId: 88813 });
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, ABI, provider);

  // 全局参数 - 逐个查询，处理可能不存在的函数
  const blockNum = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNum);
  const nowOnChain = block.timestamp;

  const safe = async (fn, fallback) => { try { return await fn(); } catch (_) { return fallback; } };

  const secondsInUnit = await safe(() => protocol.SECONDS_IN_UNIT(), 86400n);
  const flexibility = await safe(() => protocol.ticketFlexibilityDuration(), 259200n);
  const cutoffDate = await safe(() => protocol.ticketExpiryCutoffDate(), 0n);
  const redeemFeePercent = await safe(() => protocol.redemptionFeePercent(), 1n);
  const reserveMC = await safe(() => protocol.swapReserveMC(), 0n);
  const reserveJBC = await safe(() => protocol.swapReserveJBC(), 0n);
  const liqEnabled = await safe(() => protocol.liquidityEnabled(), true);
  const redeemEnabled = await safe(() => protocol.redeemEnabled(), true);
  const paused = await safe(() => protocol.paused(), false);

  console.log('='.repeat(80));
  console.log('  深入链上诊断 - 两个客户账户');
  console.log('='.repeat(80));
  console.log(`\n📡 链上时间: ${new Date(nowOnChain * 1000).toLocaleString('zh-CN')}  (区块 #${blockNum})`);
  console.log(`\n🔧 全局参数:`);
  console.log(`   SECONDS_IN_UNIT: ${secondsInUnit}  (${Number(secondsInUnit) === 86400 ? '1天' : Number(secondsInUnit) / 60 + '分钟'})`);
  console.log(`   ticketFlexibilityDuration: ${flexibility}  (${Number(flexibility) / 3600}小时)`);
  console.log(`   ticketExpiryCutoffDate: ${cutoffDate}  (${new Date(Number(cutoffDate) * 1000).toLocaleString('zh-CN')})`);
  console.log(`   redemptionFeePercent: ${redeemFeePercent}%`);
  console.log(`   liquidityEnabled: ${liqEnabled}`);
  console.log(`   redeemEnabled: ${redeemEnabled}`);
  console.log(`   paused: ${paused}`);
  console.log(`   swapReserveMC: ${fmt(reserveMC)} MC`);
  console.log(`   swapReserveJBC: ${fmt(reserveJBC)} JBC`);

  for (const addr of TARGETS) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  🔍 账户: ${addr}`);
    console.log('='.repeat(80));

    // -- 余额 --
    const balance = await provider.getBalance(addr);
    console.log(`\n💳 钱包余额: ${fmt(balance)} MC`);

    // -- userInfo --
    const ui = await protocol.userInfo(addr);
    console.log(`\n📋 userInfo:`);
    console.log(`   referrer:              ${ui.referrer}`);
    console.log(`   activeDirects:         ${ui.activeDirects}`);
    console.log(`   teamCount:             ${ui.teamCount}`);
    console.log(`   totalRevenue:          ${fmt(ui.totalRevenue)} MC`);
    console.log(`   currentCap:            ${fmt(ui.currentCap)} MC`);
    console.log(`   teamTotalVolume:       ${fmt(ui.teamTotalVolume)} MC`);
    console.log(`   isActive:              ${ui.isActive}`);
    console.log(`   maxTicketAmount:       ${fmt(ui.maxTicketAmount)} MC`);
    console.log(`   maxSingleTicketAmount: ${fmt(ui.maxSingleTicketAmount)} MC`);
    console.log(`   refundFeeAmount:       ${fmt(ui.refundFeeAmount)} MC`);

    const capRemaining = ui.currentCap > 0n ? ui.currentCap - ui.totalRevenue : 0n;
    const capPercent = ui.currentCap > 0n ? (Number(ui.totalRevenue) * 100 / Number(ui.currentCap)).toFixed(2) : '0';
    console.log(`   ---> 上限已用: ${capPercent}%,  剩余上限: ${fmt(capRemaining)} MC`);

    if (ui.totalRevenue >= ui.currentCap && ui.currentCap > 0n) {
      console.log(`   ⚠️  已达到收益上限！账户应已出局 (_handleExit)`);
    }

    // -- userTicket --
    const tk = await protocol.userTicket(addr);
    console.log(`\n🎫 门票 (userTicket):`);
    console.log(`   ticketId:     ${tk.ticketId}`);
    console.log(`   amount:       ${fmt(tk.amount)} MC`);
    console.log(`   purchaseTime: ${tk.purchaseTime}  (${new Date(Number(tk.purchaseTime) * 1000).toLocaleString('zh-CN')})`);
    console.log(`   exited:       ${tk.exited}`);

    // -- 72h过期检查 --
    const deadlineBase = await protocol.lastStakeDeadlineBase(addr);
    const effectiveBase = deadlineBase > 0n ? deadlineBase : tk.purchaseTime;
    const deadline = Number(effectiveBase) + Number(flexibility);
    const isSubjectToExpiry = Number(tk.purchaseTime) >= Number(cutoffDate);

    console.log(`\n⏰ 72小时过期检查:`);
    console.log(`   lastStakeDeadlineBase: ${deadlineBase}  (${deadlineBase > 0n ? new Date(Number(deadlineBase) * 1000).toLocaleString('zh-CN') : '未设置 → 使用购票时间'})`);
    console.log(`   有效基准时间:          ${new Date(Number(effectiveBase) * 1000).toLocaleString('zh-CN')}`);
    console.log(`   截止时间:              ${new Date(deadline * 1000).toLocaleString('zh-CN')}`);
    console.log(`   门票是否受过期规则限制: ${isSubjectToExpiry ? '是' : '否 (购票早于cutoff)'}`);

    if (isSubjectToExpiry && tk.amount > 0n && !tk.exited) {
      if (nowOnChain > deadline) {
        console.log(`   ⚠️  链上时间已超过截止时间 → 门票已过期！下次操作会被 _expireTicketIfNeeded 清除`);
      } else {
        const remaining = deadline - nowOnChain;
        console.log(`   ✅ 门票尚未过期。剩余: ${(remaining / 3600).toFixed(1)} 小时`);
      }
    } else if (!isSubjectToExpiry) {
      console.log(`   ✅ 该门票不受72小时过期限制（购票早于 cutoffDate）`);
    }

    // -- 质押列表 --
    console.log(`\n💰 质押列表 (userStakes):`);
    let totalActiveStakeAmount = 0n;
    let maturedStakes = [];
    let activeStakes = [];
    let inactiveStakes = [];

    for (let i = 0; i < 50; i++) {
      try {
        const s = await protocol.userStakes(addr, i);
        if (s.id === 0n && s.amount === 0n) break;

        const endTime = Number(s.startTime) + (Number(s.cycleDays) * Number(secondsInUnit));
        const isMatured = nowOnChain >= endTime;
        const stakeInfo = {
          index: i,
          id: Number(s.id),
          amount: s.amount,
          startTime: Number(s.startTime),
          cycleDays: Number(s.cycleDays),
          active: s.active,
          paid: s.paid,
          endTime,
          isMatured,
        };

        if (s.active) {
          totalActiveStakeAmount += s.amount;
          if (isMatured) maturedStakes.push(stakeInfo);
          else activeStakes.push(stakeInfo);
        } else {
          inactiveStakes.push(stakeInfo);
        }

        // 查询 stakeRedemptionFeePaid
        let feePaid = 0n;
        try { feePaid = await protocol.stakeRedemptionFeePaid(s.id); } catch (_) {}

        const statusIcon = !s.active ? '⬜' : isMatured ? '🟢' : '🔵';
        console.log(`   ${statusIcon} [${i}] ID=${s.id}, ${fmt(s.amount)} MC, ` +
          `开始=${new Date(Number(s.startTime) * 1000).toLocaleString('zh-CN')}, ` +
          `${s.cycleDays}天, 到期=${new Date(endTime * 1000).toLocaleString('zh-CN')}, ` +
          `active=${s.active}, paid=${fmt(s.paid)} MC, feePaid=${fmt(feePaid)} MC` +
          (isMatured && s.active ? '  ← 可赎回' : '') +
          (!s.active ? '  ← 已赎回/关闭' : ''));
      } catch (e) {
        break; // 超出数组范围
      }
    }
    
    console.log(`\n   活跃质押总额: ${fmt(totalActiveStakeAmount)} MC`);
    console.log(`   已成熟可赎回: ${maturedStakes.length} 笔`);
    console.log(`   未到期进行中: ${activeStakes.length} 笔`);
    console.log(`   已关闭/赎回:  ${inactiveStakes.length} 笔`);

    // -- 动态奖励 --
    try {
      const dynEarned = await protocol.totalDynamicEarned(addr);
      const dynClaimed = await protocol.totalDynamicClaimed(addr);
      console.log(`\n🎯 动态奖励:`);
      console.log(`   总已赚取: ${fmt(dynEarned)} MC`);
      console.log(`   总已提取: ${fmt(dynClaimed)} MC`);
      console.log(`   可提取:   ${fmt(dynEarned - dynClaimed)} MC`);
    } catch (e) {
      console.log(`\n🎯 动态奖励: 查询失败 (${e.message})`);
    }

    // -- 综合诊断 --
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  📊 综合诊断结论`);
    console.log(`${'─'.repeat(60)}`);

    // 能否赎回?
    if (maturedStakes.length > 0) {
      const feeBase = ui.maxTicketAmount > 0n ? ui.maxTicketAmount : tk.amount;
      const totalFee = (feeBase * redeemFeePercent) / 100n * BigInt(maturedStakes.length);
      console.log(`\n  ✅ 可以赎回: ${maturedStakes.length} 笔已成熟的质押`);
      console.log(`     预估手续费: ${fmt(totalFee)} MC (feeBase=${fmt(feeBase)} × ${redeemFeePercent}% × ${maturedStakes.length}笔)`);
      if (balance < totalFee) {
        console.log(`     ⚠️  钱包余额 (${fmt(balance)} MC) < 手续费 (${fmt(totalFee)} MC) → 余额不足，需充值!`);
      } else {
        console.log(`     ✅ 钱包余额充足，可以执行赎回`);
      }
    } else if (activeStakes.length > 0) {
      const nextMaturity = activeStakes.reduce((min, s) => Math.min(min, s.endTime), Infinity);
      console.log(`\n  ⏳ 暂时无法赎回: 无已成熟的质押`);
      console.log(`     最近到期时间: ${new Date(nextMaturity * 1000).toLocaleString('zh-CN')}`);
    } else {
      console.log(`\n  ❌ 无法赎回: 没有任何活跃质押`);
    }

    // 能否提供流动性?
    console.log('');
    if (tk.amount === 0n || tk.exited) {
      console.log(`  ❌ 无法提供流动性: 门票无效 (amount=0 或 exited=true)`);
      console.log(`     解决: 需要重新购买门票`);
    } else if (ui.totalRevenue >= ui.currentCap && ui.currentCap > 0n) {
      console.log(`  ❌ 无法提供流动性: 已达3倍收益上限`);
      console.log(`     解决: 需要重新购买门票`);
    } else if (isSubjectToExpiry && nowOnChain > deadline && totalActiveStakeAmount === 0n) {
      console.log(`  ❌ 无法提供流动性: 门票已过期 (72小时未质押)`);
      console.log(`     解决: 需要重新购买门票`);
    } else if (!liqEnabled) {
      console.log(`  ❌ 无法提供流动性: 全局 liquidityEnabled = false`);
    } else if (paused) {
      console.log(`  ❌ 无法提供流动性: 合约已暂停`);
    } else {
      const base = ui.maxSingleTicketAmount > 0n ? ui.maxSingleTicketAmount : tk.amount;
      const required = (base * 150n) / 100n;
      console.log(`  ✅ 可以提供流动性`);
      console.log(`     所需金额: ${fmt(required)} MC (base=${fmt(base)} × 1.5)`);
      if (balance < required) {
        console.log(`     ⚠️  钱包余额不足! 需要 ${fmt(required)} MC, 当前 ${fmt(balance)} MC`);
      } else {
        console.log(`     ✅ 钱包余额充足`);
      }
      // 退费检查
      if (ui.refundFeeAmount > 0n) {
        if (reserveMC < ui.refundFeeAmount) {
          console.log(`     ⚠️  待退手续费 ${fmt(ui.refundFeeAmount)} MC > 协议池 ${fmt(reserveMC)} MC → 质押会失败!`);
        } else {
          console.log(`     ✅ 待退手续费 ${fmt(ui.refundFeeAmount)} MC 可从协议池退还`);
        }
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('  诊断完成');
  console.log('='.repeat(80) + '\n');
}

main().catch(e => {
  console.error('❌ 诊断失败:', e.message);
  process.exit(1);
});
