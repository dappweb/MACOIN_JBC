const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 升级协议合约 - 添加门票过期生效日期
 *
 * 本次升级：
 * 1. 添加 ticketExpiryCutoffDate 状态变量
 * 2. 修改 _expireTicketIfNeeded 逻辑：只有购买时间 >= cutoffDate 的门票才检查72小时过期
 * 3. 添加 setTicketExpiryCutoffDate 管理函数
 * 
 * 效果：2026-02-09 之前购买的门票长期有效，之后购买的门票需72小时内提供流动性
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🚀 升级协议合约 - 添加门票过期生效日期（新老票分离）");
  console.log("=".repeat(60));
  console.log();

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC");
  console.log();

  // 当前线上代理地址
  const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  console.log("🏠 代理合约地址:", PROXY_ADDRESS);

  try {
    // 检查当前所有者
    console.log("\n🔍 检查合约所有者...");
    const currentContract = await hre.ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);
    const owner = await currentContract.owner();
    console.log("   合约所有者:", owner);
    console.log("   部署账户:", deployer.address);

    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("\n❌ 错误：部署账户不是合约所有者！");
      console.error("   请使用合约所有者账户执行升级（.env 中 PRIVATE_KEY）");
      process.exit(1);
    }
    console.log("   ✅ 权限验证通过\n");

    // 当前实现地址
    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("📦 当前实现地址:", currentImpl);

    // 编译并升级
    console.log("\n📦 编译 JinbaoProtocolNative...");
    const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocolNative");

    console.log("🔄 执行升级（upgradeProxy）...");
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocol, {
      timeout: 300000,
      unsafeAllow: ['state-variable-immutable'],
      unsafeAllowCustomTypes: true,
    });

    console.log("⏳ 等待交易确认...");
    await upgraded.waitForDeployment();

    const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("📍 新实现地址:", newImplAddress);

    if (currentImpl === newImplAddress) {
      console.log("\n⚠️ 实现地址未变化（可能代码无变更或编译器产出相同）");
    } else {
      console.log("\n✅ 合约升级成功");
    }

    // 验证新增的变量和功能
    console.log("\n🔍 验证升级结果:");
    
    try {
      const cutoffDate = await upgraded.ticketExpiryCutoffDate();
      const cutoffDateReadable = new Date(Number(cutoffDate) * 1000).toISOString();
      console.log("   ticketExpiryCutoffDate:", cutoffDate.toString(), "(" + cutoffDateReadable + ")");
      
      const expectedCutoff = 1770595200n; // 2026-02-09 00:00:00 UTC
      if (cutoffDate === expectedCutoff) {
        console.log("   ✅ 生效日期设置正确 (2026-02-09 00:00:00 UTC)");
      } else {
        console.log("   ⚠️ 生效日期与预期不符，预期:", expectedCutoff.toString());
      }
    } catch (error) {
      console.log("   ⚠️ 无法读取 ticketExpiryCutoffDate:", error.message);
    }

    const flexDuration = await upgraded.ticketFlexibilityDuration();
    const hours72 = 72n * 3600n;
    console.log("   ticketFlexibilityDuration:", flexDuration.toString(), "秒 (72小时:", hours72.toString() + ")");
    if (flexDuration === hours72) {
      console.log("   ✅ 72小时配置保持正确");
    }

    // 保存升级记录
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    const upgradeInfo = {
      upgradeName: "ticket-expiry-cutoff-date",
      timestamp: new Date().toISOString(),
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      proxyAddress: PROXY_ADDRESS,
      previousImplementation: currentImpl,
      newImplementation: newImplAddress,
      description: "添加 ticketExpiryCutoffDate，只有此日期及之后购买的门票才需72小时内提供流动性；之前购买的门票长期有效",
      cutoffDate: "2026-02-09 00:00:00 UTC (1770595200)",
    };

    const upgradeFileName = path.join(deploymentsDir, `upgrade-ticket-expiry-cutoff-${Date.now()}.json`);
    fs.writeFileSync(upgradeFileName, JSON.stringify(upgradeInfo, null, 2));
    console.log("\n📄 升级记录已保存:", upgradeFileName);

    console.log("\n🎉 升级完成");
    console.log("📋 本次变更:");
    console.log("   1. 添加 ticketExpiryCutoffDate 状态变量（默认：2026-02-09 00:00:00 UTC）");
    console.log("   2. _expireTicketIfNeeded 中增加判断：只检查 >= cutoffDate 的门票");
    console.log("   3. 添加 setTicketExpiryCutoffDate 管理函数");
    console.log("\n   效果：");
    console.log("   ✅ 2026-02-09 之前购买的门票 → 长期有效");
    console.log("   ✅ 2026-02-09 及之后购买的门票 → 72小时内需提供流动性");
    console.log("\n═══════════════════════════════════════════");
  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
    if (error.message.includes("not the owner") || error.message.includes("Ownable")) {
      console.log("\n💡 请使用合约 Owner 账户的 PRIVATE_KEY 执行本脚本");
    }
    if (error.message.includes("storage") || error.message.includes("layout")) {
      console.log("\n💡 存储布局冲突检测：");
      console.log("   本次升级在 ticketFlexibilityDuration 后添加了 ticketExpiryCutoffDate");
      console.log("   这是安全的追加操作，不会影响现有存储");
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
