const { ethers } = require('ethers');
const fs = require('fs');

const RPC = 'https://chain.mcerscan.com/';
const PROXY = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';
const OLD_PROXY = '0x9a01ffa6424b9e52d9a01c622bb7a1e1b3b8e309';

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = JSON.parse(fs.readFileSync('artifacts/contracts/JinbaoProtocolNative.sol/JinbaoProtocolNative.json')).abi;
  const contract = new ethers.Contract(PROXY, abi, provider);
  const oldContract = new ethers.Contract(OLD_PROXY, abi, provider);

  // 获取参数
  const cutoff = Number(await contract.ticketExpiryCutoffDate());
  const flex = Number(await contract.ticketFlexibilityDuration());
  const now = Math.floor(Date.now() / 1000);
  console.log('ticketExpiryCutoffDate:', cutoff, cutoff > 0 ? '(' + new Date(cutoff * 1000).toISOString() + ')' : '(未设置)');
  console.log('ticketFlexibilityDuration:', flex, 's =', (flex / 3600).toFixed(1), 'h');
  console.log('当前时间:', now, '(' + new Date(now * 1000).toISOString() + ')');

  // 从事件获取所有用户
  const currentBlock = await provider.getBlockNumber();
  const allUsers = new Set();

  for (const c of [contract, oldContract]) {
    try {
      const boundEvents = await c.queryFilter(c.filters.BoundReferrer(), 0, currentBlock);
      const ticketEvents = await c.queryFilter(c.filters.TicketPurchased(), 0, currentBlock);
      [...boundEvents, ...ticketEvents].forEach(event => {
        if (event.args && event.args.user) allUsers.add(event.args.user);
        if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) allUsers.add(event.args.referrer);
      });
    } catch (e) {
      console.warn('事件查询失败:', e.message);
    }
  }

  const userList = Array.from(allUsers);
  console.log(`\n总用户数: ${userList.length}`);
  console.log('开始扫描...\n');

  let expired = [];
  let noTicket = 0, exitedCount = 0, oldTicketCount = 0, activeStakeCount = 0, notYetExpired = 0;

  for (let i = 0; i < userList.length; i++) {
    const addr = userList[i];
    try {
      const ticket = await contract.userTicket(addr);
      const amount = ticket.amount;
      const purchaseTime = Number(ticket.purchaseTime);
      const exited = ticket.exited;

      if (amount === 0n) { noTicket++; continue; }
      if (exited) { exitedCount++; continue; }

      // cutoff 为 0 表示所有门票都受过期规则约束
      if (cutoff > 0 && purchaseTime < cutoff) { oldTicketCount++; continue; }

      // 检查活跃质押
      let hasActive = false;
      for (let j = 0; j < 50; j++) {
        try {
          const s = await contract.userStakes(addr, j);
          if (s.active) { hasActive = true; break; }
        } catch (e) { break; }
      }

      if (hasActive) { activeStakeCount++; continue; }

      // 无活跃质押，检查是否过期
      let deadlineBase = purchaseTime;
      try {
        const lsdb = await contract.lastStakeDeadlineBase(addr);
        if (lsdb > 0n) deadlineBase = Number(lsdb);
      } catch (e) {}

      const deadline = deadlineBase + flex;
      if (now > deadline) {
        const hoursAgo = ((now - deadline) / 3600).toFixed(1);
        expired.push({
          addr,
          amount: ethers.formatEther(amount),
          purchaseTime: new Date(purchaseTime * 1000).toISOString(),
          deadlineBase: new Date(deadlineBase * 1000).toISOString(),
          expiredAt: new Date(deadline * 1000).toISOString(),
          hoursAgoExpired: hoursAgo,
          ticketAmountWei: amount
        });
      } else {
        const hoursLeft = ((deadline - now) / 3600).toFixed(1);
        notYetExpired++;
      }
    } catch (e) {}

    if ((i + 1) % 100 === 0) process.stdout.write(`  已扫描 ${i + 1}/${userList.length}\r`);
  }

  console.log(`\n\n========== 统计结果 ==========`);
  console.log(`总用户数:         ${userList.length}`);
  console.log(`无门票:           ${noTicket}`);
  console.log(`已出局 (exited):  ${exitedCount}`);
  if (cutoff > 0) console.log(`旧门票 (cutoff前): ${oldTicketCount}`);
  console.log(`有活跃质押:       ${activeStakeCount}`);
  console.log(`未过期(倒计时中): ${notYetExpired}`);
  console.log(`🔴 已过期门票:    ${expired.length}`);

  if (expired.length > 0) {
    let totalMC = 0n;
    console.log(`\n--- 过期门票明细 ---`);
    expired.sort((a, b) => Number(b.ticketAmountWei - a.ticketAmountWei));
    expired.forEach((e, i) => {
      totalMC += e.ticketAmountWei;
      console.log(`${String(i + 1).padStart(3)}. ${e.addr} | ${e.amount} MC | 购票: ${e.purchaseTime.substring(0, 10)} | 过期: ${e.expiredAt.substring(0, 16)} | ${e.hoursAgoExpired}h前`);
    });
    console.log(`\n过期门票总金额: ${ethers.formatEther(totalMC)} MC`);
  }
})().catch(e => console.error(e));
