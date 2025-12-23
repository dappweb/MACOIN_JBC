const hre = require("hardhat");
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const addr = await signer.getAddress();
  const pending = await hre.ethers.provider.getTransactionCount(addr, "pending");
  const latest = await hre.ethers.provider.getTransactionCount(addr, "latest");
  console.log("address:", addr);
  console.log("latest nonce:", latest, "pending nonce:", pending);
}
main().catch((err) => { console.error(err); process.exit(1); });
