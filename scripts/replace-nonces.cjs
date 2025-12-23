const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;
  const addr = await signer.getAddress();

  const pending = await provider.getTransactionCount(addr, "pending");
  const latest = await provider.getTransactionCount(addr, "latest");

  console.log("address:", addr);
  console.log("latest nonce:", latest, "pending nonce:", pending);

  if (pending <= latest) {
    console.log("No pending nonces to replace.");
    return;
  }

  const fee = await provider.getFeeData();
  let maxPriority = fee.maxPriorityFeePerGas ?? hre.ethers.parseUnits("2", "gwei");
  let maxFee = fee.maxFeePerGas ?? hre.ethers.parseUnits("50", "gwei");

  const floorPriority = hre.ethers.parseUnits("5", "gwei");
  const floorFee = hre.ethers.parseUnits("80", "gwei");
  if (maxPriority < floorPriority) maxPriority = floorPriority;
  if (maxFee < floorFee) maxFee = floorFee;

  if (maxFee < maxPriority) {
    maxFee = maxPriority * 2n;
  }

  const bumpPriority = maxPriority * 3n;
  const bumpFee = maxFee * 3n;

  for (let nonce = latest; nonce < pending; nonce++) {
    console.log(`replacing nonce ${nonce}...`);
    const tx = await signer.sendTransaction({
      to: addr,
      value: 0,
      nonce,
      gasLimit: 21000,
      maxFeePerGas: bumpFee,
      maxPriorityFeePerGas: bumpPriority,
    });
    console.log(`sent ${tx.hash}`);
    try {
      await tx.wait();
      console.log(`confirmed nonce ${nonce}`);
    } catch (err) {
      if (err && err.code === "TRANSACTION_REPLACED" && err.receipt && err.receipt.status === 1) {
        console.log(`nonce ${nonce} already replaced and confirmed: ${err.hash}`);
        continue;
      }
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
