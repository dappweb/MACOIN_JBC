// 添加初始流动性到 Protocol 合约
const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
  // 自动加载最新部署地址
  const fs = require("fs");
  const path = require("path");
  const deploymentPath = path.join(__dirname, "../deployments/latest-mc.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ 找不到部署文件:", deploymentPath);
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  // Override with specific addresses if needed, or rely on deployment file
  const MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
  const JBC_TOKEN = "0xA743cB357a9f59D349efB7985072779a094658dD";
  const PROTOCOL = "0x498068346562685F3c7b89D9eC71683fb1752DF7";
  
  console.log("加载部署配置:");
  console.log("Protocol:", PROTOCOL);
  console.log("MC Token:", MC_TOKEN);
  console.log("JBC Token:", JBC_TOKEN);

  // 初始流动性数量（根据需要调整）
  // User requested 1,000,000 each. 
  // Wallet has ~999,900 JBC. We will use 990,000 to be safe and keep 1:1 ratio.
  const AMOUNT_TO_ADD = hre.ethers.parseEther("990000"); 
  const MC_AMOUNT = AMOUNT_TO_ADD;
  const JBC_AMOUNT = AMOUNT_TO_ADD;

  const [deployer] = await hre.ethers.getSigners();
  console.log("使用账户:", deployer.address);

  // 获取合约实例
  const mcContract = await hre.ethers.getContractAt("MockMC", MC_TOKEN); // Use MockMC interface for minting
  const jbcContract = await hre.ethers.getContractAt("IERC20", JBC_TOKEN);
  const protocol = await hre.ethers.getContractAt("JinbaoProtocol", PROTOCOL);

  console.log("\n=== 检查余额 ===");
  const mcBalance = await mcContract.balanceOf(deployer.address);
  const jbcBalance = await jbcContract.balanceOf(deployer.address);
  console.log("MC 余额:", hre.ethers.formatEther(mcBalance));
  console.log("JBC 余额:", hre.ethers.formatEther(jbcBalance));

  if (mcBalance < MC_AMOUNT) {
    console.log("⚠️ MC 余额不足，正在铸造...");
    const mintTx = await mcContract.mint(deployer.address, MC_AMOUNT);
    await mintTx.wait();
    console.log("✅ MC 铸造完成");
  }

  if (jbcBalance < JBC_AMOUNT) {
    console.error("❌ JBC 余额不足！需要:", hre.ethers.formatEther(JBC_AMOUNT));
    process.exit(1);
  }

  console.log("\n=== 授权 Protocol ===");
  const approveMc = await mcContract.approve(PROTOCOL, hre.ethers.MaxUint256);
  await approveMc.wait();
  const approveJbc = await jbcContract.approve(PROTOCOL, hre.ethers.MaxUint256);
  await approveJbc.wait();
  console.log("✅ 授权完成");

  console.log("\n=== 添加流动性 (addLiquidity) ===");
  // Check if we have enough allowance and balance, but for now assuming yes or just try
  try {
      const tx = await protocol.addLiquidity(MC_AMOUNT, JBC_AMOUNT);
      console.log("Tx Hash:", tx.hash);
      await tx.wait();
      console.log("✅ 流动性添加成功");
  } catch (e) {
      console.error("❌ 添加流动性失败:", e.message);
  }

  console.log("\n=== 验证池子余额 (Reserves) ===");
  const poolMC = await protocol.swapReserveMC();
  const poolJBC = await protocol.swapReserveJBC();
  console.log("池子 MC Reserve:", hre.ethers.formatEther(poolMC));
  console.log("池子 JBC Reserve:", hre.ethers.formatEther(poolJBC));

  console.log("\n✅ 操作完成！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
