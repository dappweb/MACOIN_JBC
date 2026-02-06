const hre = require("hardhat");

const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const SEVENTY_TWO_HOURS = 72 * 3600; // 259200 秒

async function main() {
  console.log("设置 ticketFlexibilityDuration 为 72 小时 (259200 秒)\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 账户:", deployer.address);

  const protocol = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS, deployer);
  const owner = await protocol.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ 当前账户不是合约 Owner，无法调用 setTicketFlexibilityDuration");
    process.exit(1);
  }

  const before = await protocol.ticketFlexibilityDuration();
  console.log("当前 ticketFlexibilityDuration:", before.toString(), "秒");

  if (before === BigInt(SEVENTY_TWO_HOURS)) {
    console.log("已是 72 小时，无需修改");
    return;
  }

  console.log("发送交易 setTicketFlexibilityDuration(259200)...");
  const tx = await protocol.setTicketFlexibilityDuration(SEVENTY_TWO_HOURS);
  await tx.wait();
  console.log("交易已确认:", tx.hash);

  const after = await protocol.ticketFlexibilityDuration();
  console.log("当前 ticketFlexibilityDuration:", after.toString(), "秒");
  if (after === BigInt(SEVENTY_TWO_HOURS)) {
    console.log("✅ 已改为 72 小时");
  } else {
    console.log("⚠️ 值异常，请检查");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
