const { ethers } = require("ethers");

async function main() {
  console.log("🔍 直接查询合约状态...");
  
  // 连接到 MC Chain
  const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
  
  // 合约地址
  const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  // 简化的 ABI，只包含我们需要的函数
  const SIMPLE_ABI = [
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "function ticketFlexibilityDuration() view returns (uint256)",
    "function liquidityEnabled() view returns (bool)",
    "function redeemEnabled() view returns (bool)"
  ];
  
  try {
    console.log("📋 合约信息:");
    console.log("合约地址:", PROTOCOL_ADDRESS);
    console.log("网络: MC Chain (88813)");
    
    // 创建合约实例
    const contract = new ethers.Contract(PROTOCOL_ADDRESS, SIMPLE_ABI, provider);
    
    // 检查时间单位
    console.log("\n🕒 查询时间单位...");
    const secondsInUnit = await contract.SECONDS_IN_UNIT();
    console.log("SECONDS_IN_UNIT:", secondsInUnit.toString());
    
    // 判断环境类型
    if (secondsInUnit.toString() === "60") {
      console.log("✅ 当前环境: 测试环境 (分钟单位)");
      console.log("\n📊 质押周期:");
      console.log("  - 7分钟质押: 1.33% 每分钟 (约 9.33% 总收益)");
      console.log("  - 15分钟质押: 1.67% 每分钟 (约 25% 总收益)");
      console.log("  - 30分钟质押: 2.00% 每分钟 (约 60% 总收益)");
      
      console.log("\n⏱️ 测试时间:");
      console.log("  - 最短质押: 7分钟后可领取奖励");
      console.log("  - 中期质押: 15分钟后可领取奖励");
      console.log("  - 长期质押: 30分钟后可领取奖励");
      
    } else if (secondsInUnit.toString() === "86400") {
      console.log("✅ 当前环境: 生产环境 (天数单位)");
      console.log("\n📊 质押周期:");
      console.log("  - 7天质押: 1.33% 每日 (约 9.33% 总收益)");
      console.log("  - 15天质押: 1.67% 每日 (约 25% 总收益)");
      console.log("  - 30天质押: 2.00% 每日 (约 60% 总收益)");
      
      console.log("\n⏱️ 生产时间:");
      console.log("  - 最短质押: 7天后可领取奖励");
      console.log("  - 中期质押: 15天后可领取奖励");
      console.log("  - 长期质押: 30天后可领取奖励");
      
    } else {
      console.log("⚠️ 未知时间单位:", secondsInUnit.toString(), "秒");
      const hours = Number(secondsInUnit) / 3600;
      const days = hours / 24;
      console.log("   等于:", hours, "小时 或", days, "天");
    }
    
    // 检查其他参数
    console.log("\n🔧 其他合约参数:");
    
    try {
      const ticketFlexDuration = await contract.ticketFlexibilityDuration();
      const flexHours = Number(ticketFlexDuration) / 3600;
      console.log("门票灵活期:", flexHours, "小时");
    } catch (e) {
      console.log("门票灵活期: 无法获取 -", e.message);
    }
    
    try {
      const liquidityEnabled = await contract.liquidityEnabled();
      console.log("流动性功能:", liquidityEnabled ? "✅ 启用" : "❌ 禁用");
    } catch (e) {
      console.log("流动性功能: 无法获取 -", e.message);
    }
    
    try {
      const redeemEnabled = await contract.redeemEnabled();
      console.log("赎回功能:", redeemEnabled ? "✅ 启用" : "❌ 禁用");
    } catch (e) {
      console.log("赎回功能: 无法获取 -", e.message);
    }
    
  } catch (error) {
    console.error("❌ 查询失败:", error.message);
    
    if (error.message.includes("call revert")) {
      console.log("💡 可能原因: 合约不存在或函数签名不匹配");
    } else if (error.message.includes("network")) {
      console.log("💡 可能原因: 网络连接问题");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("脚本执行失败:", error);
    process.exit(1);
  });