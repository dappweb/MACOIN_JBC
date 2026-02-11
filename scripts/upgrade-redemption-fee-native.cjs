const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 赎回金逻辑升级：赎回时用户额外支付 1%（msg.value），用户实收=本金；再次提供流动性时退 1%
 * 部署新 JinbaoProtocolNative 实现并执行 UUPS 升级
 */
async function main() {
  console.log("════════════════════════════════════════════");
  console.log("🚀 赎回金逻辑升级 - 赎回额外支付 1% / 用户实收=本金");
  console.log("════════════════════════════════════════════\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);

  const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  console.log("🏠 代理地址:", PROXY_ADDRESS + "\n");

  try {
    const proxyContract = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    const owner = await proxyContract.owner();

    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error("当前账户非合约所有者，无法执行升级");
    }
    console.log("✅ 权限验证通过\n");

    console.log("📦 部署新实现 (JinbaoProtocolNative)...");
    const JinbaoProtocolNative = await hre.ethers.getContractFactory("JinbaoProtocolNative");
    const newImplementation = await JinbaoProtocolNative.deploy();
    await newImplementation.waitForDeployment();
    const newImplAddress = await newImplementation.getAddress();

    console.log("✅ 新实现已部署:", newImplAddress);
    console.log("   交易哈希:", newImplementation.deploymentTransaction().hash + "\n");

    console.log("🔄 执行 UUPS 升级...");
    const upgradeTx = await proxyContract.upgradeToAndCall(newImplAddress, "0x", {
      gasLimit: 1000000,
    });

    const receipt = await upgradeTx.wait();
    console.log("✅ 升级交易已确认");
    console.log("   交易哈希:", receipt.hash);
    console.log("   区块号:", receipt.blockNumber + "\n");

    console.log("🔍 验证升级...");
    const upgraded = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    const redemptionFeePercent = await upgraded.redemptionFeePercent();
    console.log("   redemptionFeePercent:", redemptionFeePercent.toString(), "%");

    try {
      const nextStakeId = await upgraded.nextStakeId();
      console.log("   nextStakeId:", nextStakeId.toString());
    } catch (e) {
      console.log("   (nextStakeId 读取可选)");
    }

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    const record = {
      timestamp: new Date().toISOString(),
      network: hre.network.name,
      proxyAddress: PROXY_ADDRESS,
      newImplementation: newImplAddress,
      purpose: "redemption-extra-pay-1pct-user-receives-full-principal",
      upgradeTx: receipt.hash,
      blockNumber: receipt.blockNumber,
    };

    const filename = path.join(deploymentsDir, `upgrade-redemption-fee-native-${Date.now()}.json`);
    fs.writeFileSync(filename, JSON.stringify(record, null, 2));

    console.log("\n✅ 升级完成！");
    console.log("📄 记录已保存:", filename);
    console.log("\n📝 升级内容:");
    console.log("  - 赎回时用户额外支付 1%（msg.value），用户实收=本金（全额）");
    console.log("  - 1% 记入待退与 Swap 池，再次提供流动性时退还");
    console.log("  - 新增 getRedeemPreview(user) 视图；旧 stake 赎回仍退原 1%（兼容）");
  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
    if (error.data) console.error("错误数据:", error.data);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
