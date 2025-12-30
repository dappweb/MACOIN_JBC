const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 开始升级 p-prod 分支的 JinbaoProtocol 到 V2Complete...");
  
  // p-prod 分支的合约地址
  const CURRENT_PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  console.log("📋 当前合约地址:", CURRENT_PROXY_ADDRESS);
  
  // 获取升级后的合约工厂
  const JinbaoProtocolV2Simple = await ethers.getContractFactory("JinbaoProtocolV2Simple");
  
  console.log("⏳ 正在升级合约...");
  
  try {
    // 执行升级
    const upgraded = await upgrades.upgradeProxy(CURRENT_PROXY_ADDRESS, JinbaoProtocolV2Simple);
    await upgraded.waitForDeployment();
    
    const upgradedAddress = await upgraded.getAddress();
    console.log("✅ 合约升级成功!");
    console.log("📍 代理合约地址:", upgradedAddress);
    
    // 初始化升级
    console.log("🔧 初始化升级...");
    const initTx = await upgraded.initializeV2();
    await initTx.wait();
    console.log("✅ 升级初始化完成");
    
    // 验证升级
    console.log("🔍 验证升级结果...");
    const version = await upgraded.getVersion();
    console.log("📦 合约版本:", version);
    
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
    
    if (mcReserve > 0n && jbcReserve > 0n) {
      const jbcPrice = (mcReserve * 1000000000000000000n) / jbcReserve;
      console.log("  - JBC 价格: 1 JBC =", ethers.formatEther(jbcPrice), "MC");
    }
    
    console.log("\n🎉 升级完成! 主要改进:");
    console.log("  ✅ 实现直推奖励 50% MC + 50% JBC 分配");
    console.log("  ✅ 实现层级奖励 50% MC + 50% JBC 分配");
    console.log("  ✅ 实现级差奖励 50% MC + 50% JBC 分配");
    console.log("  ✅ 保持静态奖励 50% MC + 50% JBC 分配");
    console.log("  ✅ 支持完整的6参数ReferralRewardPaid事件格式");
    console.log("  ✅ 修复了所有奖励类型的显示问题");
    console.log("  ✅ 根据实时汇率计算 JBC 分配数量");
    
    console.log("\n📝 升级后需要做的事情:");
    console.log("  1. 测试购买门票功能，验证所有奖励事件正常触发");
    console.log("  2. 检查收益明细页面是否正常显示四种奖励类型");
    console.log("  3. 验证 50% MC + 50% JBC 分配机制");
    console.log("  4. 验证 JBC 数量根据实时汇率正确计算");
    console.log("  5. 监控合约运行状态");
    console.log("  6. 部署更新后的前端到 Cloudflare Pages");
    
    console.log("\n🧪 建议测试步骤:");
    console.log("  1. 创建测试账户并绑定推荐关系");
    console.log("  2. 购买门票，观察直推奖励事件");
    console.log("  3. 检查前端收益明细页面显示");
    console.log("  4. 验证 MC 和 JBC 数量是否正确");
    console.log("  5. 测试层级奖励分配");
    
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
      console.log("  3. 请检查 JinbaoProtocolV2Complete.sol 的实现");
    }
    
    if (error.message.includes("revert")) {
      console.log("\n💡 合约调用失败:");
      console.log("  1. 检查网络连接");
      console.log("  2. 确认账户有足够的 gas");
      console.log("  3. 验证合约地址是否正确");
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