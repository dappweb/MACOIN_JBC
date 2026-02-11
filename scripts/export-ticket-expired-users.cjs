/**
 * 导出因 72h 未提供流动性而过期（自动销毁）的门票用户列表
 * 用于恢复门票或补偿：adminSetUserTicket / 链下退 MC
 *
 * 用法:
 *   npx hardhat run scripts/export-ticket-expired-users.cjs --network mc --config config/hardhat.config.cjs
 *   npx hardhat run scripts/export-ticket-expired-users.cjs --network mc --config config/hardhat.config.cjs [fromBlock] [toBlock]
 *
 * 输出: output/ticket-expired-{timestamp}.json
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议在 MC 链上较早的区块（可按实际部署调整，只影响扫描起点）
const DEFAULT_FROM_BLOCK = 3000000;

async function main() {
  const fromBlock = process.argv[2] ? parseInt(process.argv[2], 10) : DEFAULT_FROM_BLOCK;
  const toBlock = process.argv[3] ? parseInt(process.argv[3], 10) : "latest";

  console.log("════════════════════════════════════════════");
  console.log("📋 导出 TicketExpired 用户列表");
  console.log("════════════════════════════════════════════\n");
  console.log("协议地址:", PROXY_ADDRESS);
  console.log("区块范围:", fromBlock, "->", toBlock, "\n");

  const protocol = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
  const filter = protocol.filters.TicketExpired();
  const events = await protocol.queryFilter(filter, fromBlock, toBlock);

  const byUser = new Map(); // address -> { totalAmountWei, totalAmount, count, events[] }
  for (const e of events) {
    const user = e.args?.user ?? e.args[0];
    const ticketId = e.args?.ticketId ?? e.args[1];
    const amount = e.args?.amount ?? e.args[2];
    const amountWei = typeof amount === "bigint" ? amount : BigInt(amount.toString());
    const block = e.blockNumber;
    const ts = e.blockNumber; // 可后续用 getBlock 取时间戳

    if (!byUser.has(user)) {
      byUser.set(user, {
        user,
        totalAmountWei: 0n,
        totalAmount: "0",
        count: 0,
        events: [],
      });
    }
    const r = byUser.get(user);
    r.totalAmountWei += amountWei;
    r.count += 1;
    r.events.push({
      ticketId: ticketId?.toString?.() ?? String(ticketId),
      amountWei: amountWei.toString(),
      amount: hre.ethers.formatEther(amountWei),
      blockNumber: block,
    });
  }

  const list = Array.from(byUser.values()).map((r) => ({
    user: r.user,
    totalAmountWei: r.totalAmountWei.toString(),
    totalAmountMC: hre.ethers.formatEther(r.totalAmountWei),
    expiredTicketCount: r.count,
    events: r.events,
  }));

  const totalAmountWei = list.reduce((sum, r) => sum + BigInt(r.totalAmountWei), 0n);
  const out = {
    exportedAt: new Date().toISOString(),
    network: hre.network?.name ?? "mc",
    protocolAddress: PROXY_ADDRESS,
    fromBlock,
    toBlock: toBlock === "latest" ? (await hre.ethers.provider.getBlockNumber()) : toBlock,
    totalEvents: events.length,
    totalUsers: list.length,
    totalAmountWei: totalAmountWei.toString(),
    totalAmountMC: hre.ethers.formatEther(totalAmountWei),
    users: list,
  };

  const outDir = path.join(__dirname, "..", "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filename = path.join(outDir, `ticket-expired-${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify(out, null, 2), "utf8");

  console.log("✅ 扫描完成");
  console.log("   事件数:", events.length);
  console.log("   涉及用户数:", list.length);
  console.log("   过期门票总金额:", out.totalAmountMC, "MC");
  console.log("   输出文件:", filename);
  console.log("\n前 10 条用户:");
  list.slice(0, 10).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.user}  次数:${r.expiredTicketCount}  合计:${r.totalAmountMC} MC`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
