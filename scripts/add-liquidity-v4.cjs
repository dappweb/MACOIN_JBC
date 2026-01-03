const { ethers } = require("hardhat");

async function main() {
  console.log("💧 添加流动性到 V4 协议...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("操作账户:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "MC\n");

  // 合约地址
  const JBC_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";
  const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

  // 获取合约实例
  const jbc = await ethers.getContractAt("JBC", JBC_ADDRESS);
  const protocol = await ethers.getContractAt("JinbaoProtocolNative", PROTOCOL_ADDRESS);

  // 检查当前储备
  const currentMC = await protocol.swapReserveMC();
  const currentJBC = await protocol.swapReserveJBC();
  console.log("当前储备:");
  console.log("  MC:", ethers.formatEther(currentMC));
  console.log("  JBC:", ethers.formatEther(currentJBC));

  // 添加流动性 - 使用较小数量
  const mcAmount = ethers.parseEther("100");
  const jbcAmount = ethers.parseEther("100");

  console.log("\n添加流动性:");
  console.log("  MC:", ethers.formatEther(mcAmount));
  console.log("  JBC:", ethers.formatEther(jbcAmount));

  try {
    // 检查 JBC 余额
    const jbcBalance = await jbc.balanceOf(deployer.address);
    console.log("\nJBC 余额:", ethers.formatEther(jbcBalance));

    if (jbcBalance < jbcAmount) {
      console.log("⚠️ JBC 余额不足，协议合约已有 JBC");
    }

    // 批准
    console.log("\n批准 JBC...");
    const approveTx = await jbc.approve(PROTOCOL_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
    console.log("✅ 批准完成");

    // 添加流动性
    console.log("\n添加流动性...");
    const addTx = await protocol.addLiquidity(jbcAmount, { value: mcAmount });
    await addTx.wait();
    console.log("✅ 流动性添加成功");

    // 验证
    const newMC = await protocol.swapReserveMC();
    const newJBC = await protocol.swapReserveJBC();
    console.log("\n新储备:");
    console.log("  MC:", ethers.formatEther(newMC));
    console.log("  JBC:", ethers.formatEther(newJBC));

  } catch (error) {
    console.error("\n❌ 错误:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
