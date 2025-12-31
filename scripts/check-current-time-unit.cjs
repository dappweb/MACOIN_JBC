const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 检查当前合约的时间单位配置...");
  
  const [deployer] = await ethers.getSigners();
  console.log("查询账户:", deployer.address);

  // 当前合约地址
  const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  try {
    // 连接到已部署的合约
    const protocolContract = await ethers.getContractAt("JinbaoProtocol", PROTOCOL_ADDRESS);
    
    console.log("📋 合约信息:");
    console.log("合约地址:", PROTOCOL_ADDRESS);
    
    // 检查时间单位
    const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
    console.log("🕒 SECONDS_IN_UNIT:", secondsInUnit.toString());
    
    if (secondsInUnit.toString() === "60") {
      console.log("✅ 当前是测试环境 (60秒 = 1分钟)");
      console.log("📊 质押周期:");
      console.log("- 7分钟质押: 1.33% 每分钟");
      console.log("- 15分钟质押: 1.67% 每分钟");
      console.log("- 30分钟质押: 2.00% 每分钟");
    } else if (secondsInUnit.toString() === "86400") {
      console.log("✅ 当前是生产环境 (86400秒 = 1天)");
      console.log("📊 质押周期:");
      console.log("- 7天质押: 1.33% 每日");
      console.log("- 15天质押: 1.67% 每日");
      console.log("- 30天质押: 2.00% 每日");
    } else {
      console.log("⚠️ 未知的时间单位:", secondsInUnit.toString());
    }
    
    // 检查其他配置
    const owner = await protocolContract.owner();
    console.log("👤 合约所有者:", owner);
    
    const liquidityEnabled = await protocolContract.liquidityEnabled();
    console.log("💧 流动性启用:", liquidityEnabled);
    
    const redeemEnabled = await protocolContract.redeemEnabled();
    console.log("🔄 赎回启用:", redeemEnabled);
    
  } catch (error) {
    console.error("❌ 查询失败:", error.message);
    
    // 尝试使用 JinbaoProtocolNative
    try {
      console.log("\n🔄 尝试使用 JinbaoProtocolNative ABI...");
      const protocolContract = await ethers.getContractAt("JinbaoProtocolNative", PROTOCOL_ADDRESS);
      
      const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
      console.log("🕒 SECONDS_IN_UNIT:", secondsInUnit.toString());
      
      if (secondsInUnit.toString() === "60") {
        console.log("✅ 当前是测试环境 (60秒 = 1分钟)");
      } else if (secondsInUnit.toString() === "86400") {
        console.log("✅ 当前是生产环境 (86400秒 = 1天)");
      }
      
    } catch (error2) {
      console.error("❌ 使用 Native ABI 也失败:", error2.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });