/**
 * 诊断指定地址为何无法提供流动性
 * 用法: node scripts/diagnose-liquidity-user.cjs [地址]
 * 或: npx hardhat run scripts/diagnose-liquidity-user.cjs --network mc
 * 默认诊断地址: 0xa05830E0945fb23EEcb05472C77d48B1E9908FAb
 */
const hre = require("hardhat");

const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const DEFAULT_USER = "0xa05830E0945fb23EEcb05472C77d48B1E9908FAb";

function formatEther(v) {
  if (typeof v === "bigint") return hre.ethers.formatEther(v);
  return String(v);
}

async function main() {
  const userAddress = process.argv[2] || DEFAULT_USER;
  console.log("════════════════════════════════════════════");
  console.log("🔍 流动性无法提供 - 用户诊断");
  console.log("════════════════════════════════════════════\n");
  console.log("用户地址:", userAddress);
  console.log("协议合约:", PROXY_ADDRESS);
  console.log("");

  const protocol = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);

  const [
    ticket,
    userInfo,
    swapReserveMC,
    liquidityEnabled,
    ticketFlexibilityDuration,
    ticketExpiryCutoffDate,
  ] = await Promise.all([
    protocol.userTicket(userAddress),
    protocol.userInfo(userAddress),
    protocol.swapReserveMC(),
    protocol.liquidityEnabled(),
    protocol.ticketFlexibilityDuration(),
    protocol.ticketExpiryCutoffDate(),
  ]);

  const now = Math.floor(Date.now() / 1000);
  const purchaseTime = Number(ticket.purchaseTime);
  const cutoff = Number(ticketExpiryCutoffDate);
  const flexibility = Number(ticketFlexibilityDuration);
  const ticketAmount = ticket.amount;
  const exited = ticket.exited;
  const refund = userInfo.refundFeeAmount ?? 0n;
  const maxSingle = userInfo.maxSingleTicketAmount ?? 0n;
  const baseAmount = maxSingle > 0n ? maxSingle : ticketAmount;
  const requiredWei = (baseAmount * 150n) / 100n;

  console.log("---------- 1. 门票状态 ----------");
  console.log("  门票金额 (ticket.amount):", formatEther(ticketAmount), "MC");
  console.log("  是否已退出 (exited):", exited);
  console.log("  购买时间 (purchaseTime):", purchaseTime, new Date(purchaseTime * 1000).toISOString());
  if (ticketAmount === 0n) {
    console.log("  ❌ 原因: 没有有效门票 (amount=0)，需先购买门票");
  } else if (exited) {
    console.log("  ❌ 原因: 已出局 (exited=true)，需重新购票后再提供流动性");
  }
  console.log("");

  console.log("---------- 2. 72 小时门票有效期（仅购票日期 >= cutoff 时生效）----------");
  console.log("  有效期截止日期 (ticketExpiryCutoffDate):", cutoff, new Date(cutoff * 1000).toISOString());
  console.log("  需在购票后 (秒):", flexibility, "(", flexibility / 3600, "小时 )");
  const needExpiryCheck = purchaseTime >= cutoff;
  console.log("  是否检查 72h 过期:", needExpiryCheck, needExpiryCheck ? "(购票日期 >= 截止日)" : "(不检查)");
  if (needExpiryCheck && ticketAmount > 0n && !exited) {
    const deadline = purchaseTime + flexibility;
    const expired = now > deadline;
    console.log("  流动性提供截止时间:", deadline, new Date(deadline * 1000).toISOString());
    if (expired) {
      console.log("  ❌ 原因: 门票已过期（超过 72 小时未提供流动性），需重新购票");
    } else {
      console.log("  ✅ 未过期，剩余", Math.max(0, deadline - now), "秒");
    }
  }
  console.log("");

  console.log("---------- 3. 待退金与池子（先退待退金才能质押）----------");
  console.log("  用户待退金 (refundFeeAmount):", formatEther(refund), "MC");
  console.log("  协议 Swap 池 MC (swapReserveMC):", formatEther(swapReserveMC), "MC");
  if (refund > 0n) {
    if (swapReserveMC < refund) {
      console.log("  ❌ 原因: 协议池子 MC 不足，无法退还您的待退金，暂时无法提供流动性。请稍后再试或联系客服。");
    } else {
      console.log("  ✅ 池子足够，质押时会先退", formatEther(refund), "MC 再记新质押");
    }
  } else {
    console.log("  ✅ 无待退金，无需从池子退");
  }
  console.log("");

  console.log("---------- 4. 所需质押金额 ----------");
  console.log("  maxSingleTicketAmount:", formatEther(maxSingle), "MC");
  console.log("  计算基准 (baseAmount):", formatEther(baseAmount), "MC");
  console.log("  所需质押 (1.5× 本金):", formatEther(requiredWei), "MC");
  console.log("  用户必须发送 msg.value 精确等于", formatEther(requiredWei), "MC，否则 revert InvalidAmount");
  console.log("");

  console.log("---------- 5. 全局开关 ----------");
  console.log("  liquidityEnabled:", liquidityEnabled);
  if (!liquidityEnabled) {
    console.log("  ❌ 原因: 协议已关闭提供流动性功能");
  }
  console.log("");

  console.log("---------- 结论 ----------");
  const reasons = [];
  if (ticketAmount === 0n) reasons.push("没有有效门票");
  else if (exited) reasons.push("已出局，需重新购票");
  else if (needExpiryCheck && now > purchaseTime + flexibility) reasons.push("门票已过期（72h 内未质押）");
  else if (refund > 0n && swapReserveMC < refund) reasons.push("协议池子不足，无法退待退金");
  else if (!liquidityEnabled) reasons.push("协议已关闭流动性");

  if (reasons.length > 0) {
    console.log("  无法提供流动性的原因:", reasons.join("；"));
  } else {
    console.log("  从合约状态看，该用户应可以提供流动性。请确认：");
    console.log("  - 前端发送的 value 精确为", formatEther(requiredWei), "MC（与页面显示一致）");
    console.log("  - 用户钱包 MC 余额 >= 所需金额 + Gas");
    console.log("  - 若仍失败，请提供交易哈希或 revert 原因以便进一步排查");
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
