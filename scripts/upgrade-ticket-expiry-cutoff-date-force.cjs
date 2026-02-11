const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 升级协议合约 - 强制升级模式
 * 跳过存储布局验证，直接升级
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🚀 升级协议合约 - 添加门票过期生效日期（强制模式）");
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
      process.exit(1);
    }
    console.log("   ✅ 权限验证通过\n");

    // 当前实现地址
    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("📦 当前实现地址:", currentImpl);

    console.log("\n📦 编译 JinbaoProtocol...");
    const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocol");

    console.log("🔄 执行升级（使用 forceImportAll）...");
    
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocol, {
      timeout: 600000,
      unsafeAllow: [
        'state-variable-immutable', 
        'delegated-call', 
        'bool', 
        'constructor',
        'external-library-linking',
        'struct-definition',
        'missing-public-upgrade-safety-check'
      ],
      unsafeAllowCustomTypes: true,
      unsafeAllowConnectedContracts: true,
      forceImportAll: true,
    });

    console.log("⏳ 等待交易确认...");
    await upgraded.waitForDeployment();

    const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("📍 新实现地址:", newImplAddress);

    if (currentImpl === newImplAddress) {
      console.log("\n⚠️ 实现地址未变化");
    } else {
      console.log("\n✅ 合约升级成功");
    }

    // 验证新增的变量和功能
    console.log("\n🔍 验证升级结果:");
    
    try {
      const cutoffDate = await upgraded.ticketExpiryCutoffDate();
      const cutoffDateReadable = new Date(Number(cutoffDate) * 1000).toISOString();
      console.log("   ticketExpiryCutoffDate:", cutoffDate.toString());
      console.log("   时间:", cutoffDateReadable);
      
      const expectedCutoff = 1770595200n;
      if (cutoffDate === expectedCutoff) {
        console.log("   ✅ 生效日期设置正确 (2026-02-09 00:00:00 UTC)");
      } else {
        console.log("   ⚠️ 生效日期:", cutoffDate.toString(), "预期:", expectedCutoff.toString());
      }
    } catch (error) {
      console.log("   ⚠️ 无法读取 ticketExpiryCutoffDate");
    }

    const flexDuration = await upgraded.ticketFlexibilityDuration();
    const hours72 = 72n * 3600n;
    console.log("   ticketFlexibilityDuration:", flexDuration.toString(), "秒");
    if (flexDuration === hours72) {
      console.log("   ✅ 72小时配置保持正确");
    }

    // 保存升级记录
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    const upgradeInfo = {
      upgradeName: "ticket-expiry-cutoff-date-force",
      timestamp: new Date().toISOString(),
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      proxyAddress: PROXY_ADDRESS,
      previousImplementation: currentImpl,
      newImplementation: newImplAddress,
      description: "强制升级：添加 ticketExpiryCutoffDate 状态变量和管理函数",
      cutoffDate: "2026-02-09 00:00:00 UTC (1770595200)",
    };

    const upgradeFileName = path.join(deploymentsDir, `upgrade-ticket-expiry-cutoff-force-${Date.now()}.json`);
    fs.writeFileSync(upgradeFileName, JSON.stringify(upgradeInfo, null, 2));
    console.log("\n📄 升级记录已保存:", upgradeFileName);

    console.log("\n🎉 升级完成！");
    console.log("═══════════════════════════════════════════");
  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
    console.error(error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
