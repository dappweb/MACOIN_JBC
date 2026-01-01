const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 测试 liquidityEnabled 检查...\n");
  
  const [deployer] = await ethers.getSigners();
  const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
  
  const protocol = await ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
  
  // 检查当前状态
  const liquidityEnabled = await protocol.liquidityEnabled();
  console.log("liquidityEnabled:", liquidityEnabled);
  
  if (!liquidityEnabled) {
    console.log("\n尝试调用 stakeLiquidity (应该失败)...");
    try {
      // 尝试质押 - 应该失败
      await protocol.stakeLiquidity.staticCall(7, { value: ethers.parseEther("150") });
      console.log("❌ 调用成功了，修复无效!");
    } catch (error) {
      if (error.message.includes("Liquidity disabled")) {
        console.log("✅ 正确拒绝: Liquidity disabled");
      } else {
        console.log("拒绝原因:", error.message.substring(0, 100));
      }
    }
  } else {
    console.log("流动性已启用，无法测试禁用状态");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
