/**
 * 升级：新增 redeemStake(uint256 stakeId) 单笔赎回
 * 方案一：移除 RedemptionLib、DirectReferralData、部分诊断 emit 以腾出字节码
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("════════════════════════════════════════════");
  console.log("🚀 升级：单笔赎回 redeemStake(stakeId)");
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

    console.log("🔍 验证 upgrade...");
    const upgraded = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    const hasRedeemStake = typeof upgraded.redeemStake === "function";
    console.log("   redeemStake 存在:", hasRedeemStake ? "✅" : "❌");

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    const record = {
      timestamp: new Date().toISOString(),
      network: hre.network.name,
      proxyAddress: PROXY_ADDRESS,
      newImplementation: newImplAddress,
      purpose: "add-redeemStake-single-stake-redemption",
      upgradeTx: receipt.hash,
      blockNumber: receipt.blockNumber,
    };

    const filename = path.join(deploymentsDir, `upgrade-redeem-stake-single-${Date.now()}.json`);
    fs.writeFileSync(filename, JSON.stringify(record, null, 2));

    console.log("\n✅ 升级完成！");
    console.log("📄 记录已保存:", filename);
    console.log("\n📝 升级内容:");
    console.log("  - 新增 redeemStake(uint256 stakeId)：按单笔赎回指定质押");
    console.log("  - 移除 RedemptionLib、DirectReferralData、部分诊断 emit 以腾出字节码");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
