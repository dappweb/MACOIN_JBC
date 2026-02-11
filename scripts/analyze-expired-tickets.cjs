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

  const flex = Number(await contract.ticketFlexibilityDuration());
  const now = Math.floor(Date.now() / 1000);

  // 获取所有用户
  const currentBlock = await provider.getBlockNumber();
  const allUsers = new Set();
  for (const c of [contract, oldContract]) {
    try {
      const be = await c.queryFilter(c.filters.BoundReferrer(), 0, currentBlock);
      const te = await c.queryFilter(c.filters.TicketPurchased(), 0, currentBlock);
      [...be, ...te].forEach(e => {
        if (e.args?.user) allUsers.add(e.args.user);
        if (e.args?.referrer && e.args.referrer !== ethers.ZeroAddress) allUsers.add(e.args.referrer);
      });
    } catch (e) {}
  }

  const userList = Array.from(allUsers);
  console.log(`总用户数: ${userList.length}\n`);

  let type0 = []; // lastStakeDeadlineBase == 0, 用 purchaseTime 做 deadline
  let typeN = []; // lastStakeDeadlineBase != 0, 用 lastStakeDeadlineBase 做 deadline

  for (let i = 0; i < userList.length; i++) {
    const addr = userList[i];
    try {
      const ticket = await contract.userTicket(addr);
      if (ticket.amount === 0n || ticket.exited) continue;

      const purchaseTime = Number(ticket.purchaseTime);

      // 检查活跃质押
      let hasActive = false;
      for (let j = 0; j < 50; j++) {
        try {
          const s = await contract.userStakes(addr, j);
          if (s.active) { hasActive = true; break; }
        } catch (e) { break; }
      }
      if (hasActive) continue;

      let lsdb = 0n;
      try { lsdb = await contract.lastStakeDeadlineBase(addr); } catch(e) {}
      const deadlineBase = lsdb > 0n ? Number(lsdb) : purchaseTime;
      const deadline = deadlineBase + flex;

      if (now > deadline) {
        const entry = {
          addr,
          amount: ethers.formatEther(ticket.amount),
          purchaseTime,
          lastStakeDeadlineBase: Number(lsdb),
          deadlineBase,
          deadline,
          hoursExpired: ((now - deadline) / 3600).toFixed(1)
        };
        if (lsdb > 0n) {
          typeN.push(entry);
        } else {
          type0.push(entry);
        }
      }
    } catch (e) {}
    if ((i+1) % 100 === 0) process.stdout.write(`  扫描 ${i+1}/${userList.length}\r`);
  }

  console.log(`\n\n====== 分析结果 ======`);
  console.log(`过期门票总数: ${type0.length + typeN.length}`);
  console.log(`\n类型A: lastStakeDeadlineBase == 0 (deadline基于purchaseTime): ${type0.length} 个`);
  console.log(`  → 可通过 adminSetUserTicket 重置 purchaseTime 来恢复`);
  if (type0.length > 0) {
    type0.forEach((e, i) => {
      console.log(`    ${i+1}. ${e.addr} | ${e.amount} MC | purchaseTime: ${new Date(e.purchaseTime*1000).toISOString().substring(0,16)}`);
    });
  }

  console.log(`\n类型B: lastStakeDeadlineBase != 0 (deadline基于lastStakeDeadlineBase): ${typeN.length} 个`);
  console.log(`  → 需要合约新增 adminSetLastStakeDeadlineBase 函数才能恢复`);
  if (typeN.length > 0) {
    typeN.forEach((e, i) => {
      console.log(`    ${i+1}. ${e.addr} | ${e.amount} MC | lsdb: ${new Date(e.lastStakeDeadlineBase*1000).toISOString().substring(0,16)} | purchaseTime: ${new Date(e.purchaseTime*1000).toISOString().substring(0,16)}`);
    });
  }

  // 导出地址列表
  const allExpired = [...type0, ...typeN];
  const addrList = allExpired.map(e => `"${e.addr}"`).join(',\n  ');
  console.log(`\n====== 地址列表 (可复制) ======`);
  console.log(`[\n  ${addrList}\n]`);
})().catch(e => console.error(e));
