// 添加初始流动性到 Protocol 合约
const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
  // 合约地址
  const MC_TOKEN = "0x33A6FE1Ae840c4dd2dfaC4d5aDFc8AD2a1d87eA5";
  const JBC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
  const PROTOCOL = "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4";

  // 初始流动性数量（根据需要调整）
  const MC_AMOUNT = hre.ethers.parseEther("10000");  // 10,000 MC
  const JBC_AMOUNT = hre.ethers.parseEther("10000"); // 10,000 JBC

  const [deployer] = await hre.ethers.getSigners();
  console.log("使用账户:", deployer.address);

  // 获取合约实例
  const mcContract = await hre.ethers.getContractAt("IERC20", MC_TOKEN);
  const jbcContract = await hre.ethers.getContractAt("IERC20", JBC_TOKEN);

  console.log("\n=== 检查余额 ===");
  const mcBalance = await mcContract.balanceOf(deployer.address);
  const jbcBalance = await jbcContract.balanceOf(deployer.address);
  console.log("MC 余额:", hre.ethers.formatEther(mcBalance));
  console.log("JBC 余额:", hre.ethers.formatEther(jbcBalance));

  if (mcBalance < MC_AMOUNT) {
    console.error("❌ MC 余额不足！需要:", hre.ethers.formatEther(MC_AMOUNT));
    return;
  }

  if (jbcBalance < JBC_AMOUNT) {
    console.error("❌ JBC 余额不足！需要:", hre.ethers.formatEther(JBC_AMOUNT));
    return;
  }

  console.log("\n=== 转入 MC 到池子 ===");
  const mcTx = await mcContract.transfer(PROTOCOL, MC_AMOUNT);
  await mcTx.wait();
  console.log("✅ 已转入", hre.ethers.formatEther(MC_AMOUNT), "MC");

  console.log("\n=== 转入 JBC 到池子 ===");
  const jbcTx = await jbcContract.transfer(PROTOCOL, JBC_AMOUNT);
  await jbcTx.wait();
  console.log("✅ 已转入", hre.ethers.formatEther(JBC_AMOUNT), "JBC");

  console.log("\n=== 验证池子余额 ===");
  const poolMC = await mcContract.balanceOf(PROTOCOL);
  const poolJBC = await jbcContract.balanceOf(PROTOCOL);
  console.log("池子 MC 余额:", hre.ethers.formatEther(poolMC));
  console.log("池子 JBC 余额:", hre.ethers.formatEther(poolJBC));

  console.log("\n✅ 流动性添加完成！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
