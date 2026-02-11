/**
 * 排查「赎回不行」「赎回后质押不进去」问题
 * 用法: node scripts/diagnose-redeem-stake-issues.cjs [地址1] [地址2] ...
 * 若不传地址，则扫描 Exited 事件中的用户并诊断
 */
const { ethers } = require("ethers");

const RPC = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function swapReserveMC() view returns (uint256)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function lastStakeDeadlineBase(address) view returns (uint256)",
  "function ticketExpiryCutoffDate() view returns (uint256)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "event Redeemed(address indexed user, uint256 principal, uint256 fee)",
  "event Exited(address indexed user, uint256 ticketId)",
];

async function main() {
  console.log("════════════════════════════════════════════");
  console.log("🔍 赎回/质押问题排查");
  console.log("════════════════════════════════════════════\n");

  const provider = new ethers.JsonRpcProvider(RPC);
  const protocol = new ethers.Contract(PROTOCOL, ABI, provider);

  // 1. 全局状态
  const [swapMC, liqOn, redeemOn] = await Promise.all([
    protocol.swapReserveMC(),
    protocol.liquidityEnabled(),
    protocol.redeemEnabled(),
  ]);
  console.log("【1. 协议状态】");
  console.log("  liquidityEnabled:", liqOn);
  console.log("  redeemEnabled:", redeemOn);
  console.log("  swapReserveMC:", ethers.formatEther(swapMC), "MC\n");

  // 2. 获取待诊断地址：命令行参数 或 扫描 Exited/Redeemed 事件
  const argvAddrs = process.argv.slice(2).filter((a) => a.startsWith("0x"));
  let usersToCheck = argvAddrs.map((a) => a.toLowerCase());

  if (usersToCheck.length === 0) {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000);
    const [redeemedEvents, exitedEvents] = await Promise.all([
      protocol.queryFilter(protocol.filters.Redeemed(), fromBlock).catch(() => []),
      protocol.queryFilter(protocol.filters.Exited(), fromBlock).catch(() => []),
    ]);
    const fromRedeemed = [...new Set(redeemedEvents.map((e) => (e.args?.user ?? e.args?.[0])?.toLowerCase()).filter(Boolean))];
    const fromExited = [...new Set(exitedEvents.map((e) => (e.args?.user ?? e.args?.[0])?.toLowerCase()).filter(Boolean))];
    usersToCheck = [...new Set([...fromRedeemed, ...fromExited])];
    console.log("【2. 扫描事件】区块", fromBlock, "-", currentBlock);
    console.log("  Redeemed:", redeemedEvents.length, " Exited:", exitedEvents.length);
    console.log("  待诊断用户数:", usersToCheck.length, "\n");
  } else {
    console.log("【2. 指定地址】", usersToCheck.length, "个\n");
  }

  // 3. 诊断每位用户
  console.log("【3. 用户诊断】");
  const issues = [];
  let ticketExpiryCutoff = 0n;
  let flexibility = 259200n; // 72h default

  try {
    ticketExpiryCutoff = await protocol.ticketExpiryCutoffDate();
    flexibility = await protocol.ticketFlexibilityDuration();
  } catch (_) {}

  for (let i = 0; i < Math.min(usersToCheck.length, 30); i++) {
    const addr = usersToCheck[i];
    try {
      const [info, ticket, deadline] = await Promise.all([
        protocol.userInfo(addr),
        protocol.userTicket(addr),
        protocol.lastStakeDeadlineBase(addr).catch(() => 0n),
      ]);

      const refund = info.refundFeeAmount ?? 0n;
      const exited = ticket.exited ?? false;
      const amount = ticket.amount ?? 0n;
      const now = BigInt(Math.floor(Date.now() / 1000));

      let reason = [];
      if (exited && amount > 0n) {
        if (deadline > 0n) {
          const remaining = Number(deadline) + Number(flexibility) - Number(now);
          if (remaining <= 0) {
            reason.push("72h已过期");
          } else {
            reason.push(`72h剩余${Math.floor(remaining / 3600)}h`);
          }
        } else {
          reason.push("赎回后72h内可再质押");
        }
      }
      if (refund > 0n && swapMC < refund) {
        reason.push("池子不足无法退待退金");
      }
      if (!liqOn) reason.push("流动性已关闭");
      if (!info.isActive && amount > 0n && !exited) {
        reason.push("未激活");
      }

      const status = reason.length > 0 ? reason.join("; ") : "正常可质押";
      if (reason.length > 0) {
        issues.push({ addr, refund: ethers.formatEther(refund), reason: status });
      }
      if (i < 5 || issues.some((x) => x.addr === addr)) {
        console.log(`  ${addr.slice(0, 10)}... 待退:${ethers.formatEther(refund)} MC exited:${exited} | ${status}`);
      }
    } catch (e) {
      console.log(`  ${addr} 查询失败:`, e.message?.slice(0, 50));
    }
  }

  console.log("\n【4. 汇总】");
  if (issues.length > 0) {
    console.log("  存在异常的用户数:", issues.length);
    issues.slice(0, 10).forEach((x) => console.log(`    - ${x.addr} ${x.reason}`));
  } else {
    console.log("  近期赎回用户中未发现明显异常（池子充足、72h 未过期）");
  }
  console.log("\n排查完成。若用户仍有问题，请提供具体地址以便单用户诊断。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
