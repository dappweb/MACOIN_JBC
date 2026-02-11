/**
 * 批量重置过期门票的 purchaseTime，使72小时倒计时重新开始
 * 
 * 原理：
 * - 合约的过期判定逻辑: deadlineBase = lastStakeDeadlineBase[user] || purchaseTime
 * - 92个过期用户的 lastStakeDeadlineBase 都为 0，所以 deadline 基于 purchaseTime
 * - 通过 adminSetUserTicket 将 purchaseTime 重置为当前时间，即可重启72小时倒计时
 * - 只修改 purchaseTime，ticketId/amount/exited 保持原值不变
 * 
 * 使用方法:
 *   node scripts/reset-expired-tickets.cjs
 * 
 * 需要 .env 中配置 PRIVATE_KEY (合约 owner)
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

const RPC = 'https://chain.mcerscan.com/';
const PROXY = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';
const OLD_PROXY = '0x9a01ffa6424b9e52d9a01c622bb7a1e1b3b8e309';

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ 请在 .env 中配置 PRIVATE_KEY');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const abi = JSON.parse(fs.readFileSync('artifacts/contracts/JinbaoProtocolNative.sol/JinbaoProtocolNative.json')).abi;
  const contract = new ethers.Contract(PROXY, abi, wallet);
  const readContract = new ethers.Contract(PROXY, abi, provider);
  const oldContract = new ethers.Contract(OLD_PROXY, abi, provider);

  console.log(`执行钱包: ${wallet.address}`);

  // 验证是 owner
  try {
    const owner = await readContract.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error(`❌ 当前钱包 ${wallet.address} 不是合约 owner (${owner})`);
      process.exit(1);
    }
    console.log(`✅ 已确认为合约 owner`);
  } catch (e) {
    console.warn(`⚠️ 无法验证 owner，继续执行...`);
  }

  const flex = Number(await readContract.ticketFlexibilityDuration());
  const now = Math.floor(Date.now() / 1000);
  console.log(`当前时间: ${new Date(now * 1000).toISOString()}`);
  console.log(`过期阈值: ${flex}s (${(flex/3600).toFixed(0)}h)\n`);

  // 获取所有用户
  console.log('正在获取用户列表...');
  const currentBlock = await provider.getBlockNumber();
  const allUsers = new Set();
  for (const c of [readContract, oldContract]) {
    try {
      const be = await c.queryFilter(c.filters.BoundReferrer(), 0, currentBlock);
      const te = await c.queryFilter(c.filters.TicketPurchased(), 0, currentBlock);
      [...be, ...te].forEach(e => {
        if (e.args?.user) allUsers.add(e.args.user);
        if (e.args?.referrer && e.args.referrer !== ethers.ZeroAddress) allUsers.add(e.args.referrer);
      });
    } catch (e) {}
  }
  console.log(`总用户数: ${allUsers.size}`);

  // 找出所有过期门票
  console.log('正在扫描过期门票...\n');
  const expiredUsers = [];

  const userList = Array.from(allUsers);
  for (let i = 0; i < userList.length; i++) {
    const addr = userList[i];
    try {
      const ticket = await readContract.userTicket(addr);
      if (ticket.amount === 0n || ticket.exited) continue;

      const purchaseTime = Number(ticket.purchaseTime);

      // 检查活跃质押
      let hasActive = false;
      for (let j = 0; j < 50; j++) {
        try {
          const s = await readContract.userStakes(addr, j);
          if (s.active) { hasActive = true; break; }
        } catch (e) { break; }
      }
      if (hasActive) continue;

      // 检查 lastStakeDeadlineBase
      let lsdb = 0n;
      try { lsdb = await readContract.lastStakeDeadlineBase(addr); } catch(e) {}
      const deadlineBase = lsdb > 0n ? Number(lsdb) : purchaseTime;
      const deadline = deadlineBase + flex;

      if (now > deadline) {
        expiredUsers.push({
          addr,
          ticketId: ticket.ticketId,
          amount: ticket.amount,
          purchaseTime: Number(ticket.purchaseTime),
          exited: ticket.exited,
          lastStakeDeadlineBase: Number(lsdb)
        });
      }
    } catch (e) {}
    if ((i+1) % 100 === 0) process.stdout.write(`  扫描 ${i+1}/${userList.length}\r`);
  }

  console.log(`\n找到 ${expiredUsers.length} 个过期门票需要重置\n`);

  if (expiredUsers.length === 0) {
    console.log('✅ 没有需要重置的过期门票');
    return;
  }

  // 确认操作
  console.log('即将执行以下操作:');
  console.log(`  - 对 ${expiredUsers.length} 个用户调用 adminSetUserTicket`);
  console.log(`  - 将 purchaseTime 重置为当前区块时间`);
  console.log(`  - ticketId, amount, exited 保持不变`);
  console.log(`  - 72小时倒计时将从执行时刻重新开始\n`);

  // 检查 --dry-run 参数
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('🔍 [DRY RUN] 仅模拟，不实际发送交易\n');
    expiredUsers.forEach((u, i) => {
      console.log(`  ${i+1}. adminSetUserTicket(${u.addr}, ${u.ticketId}, ${ethers.formatEther(u.amount)} MC, NOW, ${u.exited})`);
    });
    console.log(`\n去掉 --dry-run 参数即可真正执行`);
    return;
  }

  // 执行批量重置
  let success = 0;
  let failed = 0;
  const failedList = [];

  for (let i = 0; i < expiredUsers.length; i++) {
    const u = expiredUsers[i];
    const seq = `[${i+1}/${expiredUsers.length}]`;
    
    try {
      const newPurchaseTime = Math.floor(Date.now() / 1000);
      const tx = await contract.adminSetUserTicket(
        u.addr,
        u.ticketId,
        u.amount,
        newPurchaseTime,
        u.exited
      );
      
      console.log(`  ${seq} ✅ ${u.addr.substring(0,10)}... | ${ethers.formatEther(u.amount)} MC | tx: ${tx.hash.substring(0,16)}...`);
      await tx.wait();
      success++;
      
      // 避免 nonce 冲突，稍等
      if (i < expiredUsers.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.log(`  ${seq} ❌ ${u.addr.substring(0,10)}... | 失败: ${e.message.substring(0, 80)}`);
      failed++;
      failedList.push(u.addr);
    }
  }

  console.log(`\n========== 执行完成 ==========`);
  console.log(`成功: ${success}`);
  console.log(`失败: ${failed}`);
  if (failedList.length > 0) {
    console.log(`失败地址:`);
    failedList.forEach(a => console.log(`  ${a}`));
  }
}

main().catch(e => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});
