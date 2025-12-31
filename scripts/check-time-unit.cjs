const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 检查当前合约的时间单位设置...");
  
  const [deployer] = await ethers.getSigners();
  console.log("查询账户:", deployer.address);

  // 合约地址
  const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  // 连接到已部署的合约
  const protocolContract = await ethers.getContractAt("JinbaoProtocol", PROTOCOL_ADDRESS);
  
  try {
    console.log("📋 合约信息:");
    console.log("合约地址:", PROTOCOL_ADDRESS);
    
    // 检查时间单位
    const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
    console.log("🕒 SECONDS_IN_UNIT:", secondsInUnit.toString());
    
    // 判断环境类型
    if (secondsInUnit.toString() === "60") {
      console.log("✅ 当前环境: 测试环境 (分钟单位)");
      console.log("📊 质押周期:");
      console.log("  - 7分钟质押: 1.33% 每分钟");
      console.log("  - 15分钟质押: 1.67% 每分钟");
      console.log("  - 30分钟质押: 2.00% 每分钟");
    } else if (secondsInUnit.toString() === "86400") {
      console.log("✅ 当前环境: 生产环境 (天数单位)");
      console.log("📊 质押周期:");
      console.log("  - 7天质押: 1.33% 每日");
      console.log("  - 15天质押: 1.67% 每日");
      console.log("  - 30天质押: 2.00% 每日");
    } else {
      console.log("⚠️ 未知时间单位:", secondsInUnit.toString());
    }
    
    // 检查其他相关参数
    console.log("\n🔧 其他参数:");
    
    try {
      const ticketFlexDuration = await protocolContract.ticketFlexibilityDuration();
      const flexHours = Number(ticketFlexDuration) / 3600;
      console.log("门票灵活期:", flexHours, "小时");
    } catch (e) {
      console.log("门票灵活期: 无法获取");
    }
    
    try {
      const liquidityEnabled = await protocolContract.liquidityEnabled();
      console.log("流动性功能:", liquidityEnabled ? "启用" : "禁用");
    } catch (e) {
      console.log("流动性功能: 无法获取");
    }
    
    try {
      const redeemEnabled = await protocolContract.redeemEnabled();
      console.log("赎回功能:", redeemEnabled ? "启用" : "禁用");
    } catch (e) {
      console.log("赎回功能: 无法获取");
    }
    
  } catch (error) {
    console.error("❌ 查询失败:", error.message);
    
    // 尝试使用不同的合约名称
    console.log("\n🔄 尝试使用 JinbaoProtocolNative...");
    try {
      const nativeContract = await ethers.getContractAt("JinbaoProtocolNative", PROTOCOL_ADDRESS);
      const secondsInUnit = await nativeContract.SECONDS_IN_UNIT();
      console.log("🕒 SECONDS_IN_UNIT:", secondsInUnit.toString());
      
      if (secondsInUnit.toString() === "60") {
        console.log("✅ 当前环境: 测试环境 (分钟单位)");
      } else if (secondsInUnit.toString() === "86400") {
        console.log("✅ 当前环境: 生产环境 (天数单位)");
      }
    } catch (e2) {
      console.error("❌ 使用 JinbaoProtocolNative 也失败:", e2.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });