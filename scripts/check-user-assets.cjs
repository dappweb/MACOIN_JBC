/**
 * 查询指定地址的门票与流动性质押资产
 * 用法: node scripts/check-user-assets.cjs [address]
 */

const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const USER = (process.argv[2] || "0x293ba423b0a4bf19805aD25fb0425aA168753737").trim();

const PROTOCOL_ABI = [
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("\n" + "=".repeat(60));
  console.log("资产查询:", USER);
  console.log("=".repeat(60));

  const userInfo = await protocol.userInfo(USER);
  console.log("\n【用户信息】");
  console.log("  推荐人:", userInfo.referrer);
  console.log("  直推数:", userInfo.activeDirects.toString());
  console.log("  团队人数:", userInfo.teamCount.toString());
  console.log("  是否激活:", userInfo.isActive);
  console.log("  累计收益:", ethers.formatEther(userInfo.totalRevenue), "MC");
  console.log("  当前上限:", ethers.formatEther(userInfo.currentCap), "MC");
  console.log("  可退手续费:", ethers.formatEther(userInfo.refundFeeAmount), "MC");

  const ticket = await protocol.userTicket(USER);
  const ticketAmount = ticket.amount ?? 0n;
  const hasTicket = ticket.ticketId > 0n || ticketAmount > 0n;
  console.log("\n【门票】");
  if (!hasTicket) {
    console.log("  无门票");
  } else {
    console.log("  ticketId:", ticket.ticketId.toString());
    console.log("  金额:", ethers.formatEther(ticketAmount), "MC");
    console.log("  购买时间:", ticket.purchaseTime.toString(), new Date(Number(ticket.purchaseTime) * 1000).toISOString());
    console.log("  已退出:", ticket.exited);
  }

  const stakes = [];
  for (let i = 0; i < 500; i++) {
    try {
      const s = await protocol.userStakes(USER, i);
      if (Number(s.id ?? 0) === 0) break;
      stakes.push({
        id: Number(s.id),
        amount: ethers.formatEther(s.amount ?? 0n),
        startTime: Number(s.startTime),
        startTimeStr: new Date(Number(s.startTime) * 1000).toISOString(),
        cycleDays: Number(s.cycleDays),
        active: s.active,
        paid: ethers.formatEther(s.paid ?? 0n),
      });
    } catch (_) {
      break;
    }
  }

  console.log("\n【流动性质押】 共", stakes.length, "条");
  const activeStakes = stakes.filter((s) => s.active);
  const inactiveStakes = stakes.filter((s) => !s.active);
  console.log("  其中 有效(active):", activeStakes.length, "条");
  console.log("  其中 已结束/赎回:", inactiveStakes.length, "条");
  if (stakes.length > 0) {
    stakes.forEach((s, i) => {
      console.log(`  [${i + 1}] id=${s.id} amount=${s.amount} MC cycle=${s.cycleDays}d active=${s.active} start=${s.startTimeStr} paid=${s.paid} MC`);
    });
  }

  console.log("\n" + "=".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
