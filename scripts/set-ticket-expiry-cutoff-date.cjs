const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  const CUTOFF_DATE = 1770595200; // 2026-02-09 00:00:00 UTC

  console.log("📍 部署账户:", deployer.address);
  console.log("🏠 代理地址:", PROXY_ADDRESS);

  const contract = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);

  console.log("🔄 设置 ticketExpiryCutoffDate...");
  const tx = await contract.setTicketExpiryCutoffDate(CUTOFF_DATE);
  const receipt = await tx.wait();

  console.log("✅ 设置成功");
  console.log("   交易哈希:", receipt.hash);

  const updated = await contract.ticketExpiryCutoffDate();
  console.log("   当前值:", updated.toString());
  console.log("   时间:", new Date(Number(updated) * 1000).toISOString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
