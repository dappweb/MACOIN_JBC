const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 升级协议合约 - stakeLiquidity 入口 72 小时过期检查
 *
 * 本次升级：在 stakeLiquidity 入口调用 _expireTicketIfNeeded(msg.sender)。
 * 效果：用户购票后 72 小时内未提供流动性，在首次尝试质押时门票会被判定失效并清空，
 *       必须重新购票后才能再次提供流动性。
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🚀 升级协议合约 - 72h 未质押则门票在首次质押时失效");
  console.log("=".repeat(60));
  console.log();

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC");
  console.log();

  // 当前线上代理地址（新协议）
  const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  console.log("🏠 代理合约地址:", PROXY_ADDRESS);

  try {
    // 检查当前所有者
    console.log("\n🔍 检查合约所有者...");
    const currentContract = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
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
    const JinbaoProtocolNative = await hre.ethers.getContractFactory("JinbaoProtocolNative");

    console.log("🔄 执行升级（upgradeProxy）...");
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolNative, {
      timeout: 300000,
      unsafeAllow: [],
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

    // 验证：ticketFlexibilityDuration 仍为 72 小时
    const flexDuration = await upgraded.ticketFlexibilityDuration();
    const hours72 = 72n * 3600n;
    console.log("\n🔍 验证:");
    console.log("   ticketFlexibilityDuration:", flexDuration.toString(), "秒 (预期 72*3600 =", hours72.toString() + ")");
    if (flexDuration === hours72) {
      console.log("   ✅ 72 小时配置正确");
    }

    // 保存升级记录
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    const upgradeInfo = {
      upgradeName: "stake-liquidity-72h-expire",
      timestamp: new Date().toISOString(),
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      proxyAddress: PROXY_ADDRESS,
      previousImplementation: currentImpl,
      newImplementation: newImplAddress,
      description: "stakeLiquidity 入口调用 _expireTicketIfNeeded；72h 内未质押则首次质押时门票失效，须重新购票",
    };

    const upgradeFileName = path.join(deploymentsDir, `upgrade-stake-liquidity-72h-expire-${Date.now()}.json`);
    fs.writeFileSync(upgradeFileName, JSON.stringify(upgradeInfo, null, 2));
    console.log("\n📄 升级记录已保存:", upgradeFileName);

    console.log("\n🎉 升级完成");
    console.log("📋 本次变更:");
    console.log("   stakeLiquidity() 入口先执行 _expireTicketIfNeeded(msg.sender)");
    console.log("   → 购票后 72 小时内未提供流动性的用户，首次尝试质押时门票被清空，需重新购票");
    console.log("\n═══════════════════════════════════════════");
  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
    if (error.message.includes("not the owner") || error.message.includes("Ownable")) {
      console.log("\n💡 请使用合约 Owner 账户的 PRIVATE_KEY 执行本脚本");
    }
    if (error.message.includes("storage") || error.message.includes("layout")) {
      console.log("\n💡 若为存储布局冲突，请确认仅修改了 stakeLiquidity 逻辑，未改 storage");
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
