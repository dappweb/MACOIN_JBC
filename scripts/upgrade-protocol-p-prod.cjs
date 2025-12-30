const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 开始升级 p-prod 分支的 JinbaoProtocol 到 V2...");
  
  // p-prod 分支的合约地址
  const CURRENT_PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  console.log("📋 当前合约地址:", CURRENT_PROXY_ADDRESS);
  
  // 获取升级后的合约工厂
  const JinbaoProtocolV2 = await ethers.getContractFactory("JinbaoProtocolV2");
  
  console.log("⏳ 正在升级合约...");
  
  try {
    // 执行升级
    const upgraded = await upgrades.upgradeProxy(CURRENT_PROXY_ADDRESS, JinbaoProtocolV2);
    await upgraded.waitForDeployment();
    
    const upgradedAddress = await upgraded.getAddress();
    console.log("✅ 合约升级成功!");
    console.log("📍 代理合约地址:", upgradedAddress);
    
    // 验证升级
    console.log("🔍 验证升级结果...");
    
    // 检查基本配置
    const directPercent = await upgraded.directRewardPercent();
    const levelPercent = await upgraded.levelRewardPercent();
    const secondsInUnit = await upgraded.SECONDS_IN_UNIT();
    
    console.log("⚙️ 合约配置:");
    console.log("  - 直推奖励比例:", Number(directPercent), "%");
    console.log("  - 层级奖励比例:", Number(levelPercent), "%");
    console.log("  - 时间单位:", Number(secondsInUnit), "秒");
    
    // 检查代币地址
    const jbcToken = await upgraded.jbcToken();
    console.log("  - JBC Token:", jbcToken);
    
    // 检查储备
    const mcReserve = await upgraded.swapReserveMC();
    const jbcReserve = await upgraded.swapReserveJBC();
    console.log("  - MC 储备:", ethers.formatEther(mcReserve), "MC");
    console.log("  - JBC 储备:", ethers.formatEther(jbcReserve), "JBC");
    
    console.log("\n🎉 升级完成! 主要改进:");
    console.log("  ✅ 实现直推奖励 50% MC + 50% JBC 分配");
    console.log("  ✅ 实现层级奖励 50% MC + 50% JBC 分配");
    console.log("  ✅ 实现级差奖励 50% MC + 50% JBC 分配");
    console.log("  ✅ 保持静态奖励 50% MC + 50% JBC 分配");
    console.log("  ✅ 支持完整的6参数ReferralRewardPaid事件格式");
    console.log("  ✅ 修复了所有奖励类型的显示问题");
    
    console.log("\n📝 升级后需要做的事情:");
    console.log("  1. 测试购买门票功能，验证所有奖励事件正常触发");
    console.log("  2. 检查收益明细页面是否正常显示四种奖励类型");
    console.log("  3. 验证 50% MC + 50% JBC 分配机制");
    console.log("  4. 监控合约运行状态");
    console.log("  5. 部署更新后的前端到 Cloudflare Pages");
    
  } catch (error) {
    console.error("❌ 升级失败:", error);
    
    if (error.message.includes("not the owner")) {
      console.log("\n💡 解决方案:");
      console.log("  请确保使用合约owner账户执行升级");
      console.log("  当前owner可以通过以下命令查询:");
      console.log("  npx hardhat run scripts/check-current-owner.cjs --network mc");
    }
    
    if (error.message.includes("implementation")) {
      console.log("\n💡 可能的问题:");
      console.log("  1. 新合约可能有编译错误");
      console.log("  2. 新合约可能与现有存储布局不兼容");
      console.log("  3. 请检查 JinbaoProtocolV2.sol 的实现");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });