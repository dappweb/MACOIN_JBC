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
  const MC_TOKEN = deployment.mcToken;
  const JBC_TOKEN = deployment.jbcToken;
  const PROTOCOL = deployment.protocolProxy || deployment.protocol;
  
  console.log("加载部署配置:");
  console.log("Protocol:", PROTOCOL);
  console.log("MC Token:", MC_TOKEN);
  console.log("JBC Token:", JBC_TOKEN);

  // 初始流动性数量（根据需要调整）
  const MC_AMOUNT = hre.ethers.parseEther("1");  // 1.0 MC
  const JBC_AMOUNT = hre.ethers.parseEther("1"); // 1.0 JBC

  const [deployer] = await hre.ethers.getSigners();
  console.log("使用账户:", deployer.address);

  // 获取合约实例
  const mcContract = await hre.ethers.getContractAt("IERC20", MC_TOKEN);
  const jbcContract = await hre.ethers.getContractAt("IERC20", JBC_TOKEN);
  const protocol = await hre.ethers.getContractAt("JinbaoProtocol", PROTOCOL);

  console.log("\n=== 检查余额 ===");
  const mcBalance = await mcContract.balanceOf(deployer.address);
  const jbcBalance = await jbcContract.balanceOf(deployer.address);
  console.log("MC 余额:", hre.ethers.formatEther(mcBalance));
  console.log("JBC 余额:", hre.ethers.formatEther(jbcBalance));

  if (mcBalance < MC_AMOUNT) {
    console.error("❌ MC 余额不足！需要:", hre.ethers.formatEther(MC_AMOUNT));
    // return; 
  }

  if (jbcBalance < JBC_AMOUNT) {
    console.error("❌ JBC 余额不足！需要:", hre.ethers.formatEther(JBC_AMOUNT));
    // return;
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
