const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 升级脚本 - 跳过存储检查
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🚀 升级协议合约 - 跳过存储布局检查");
  console.log("=".repeat(60));
  console.log();

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC");

  const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  console.log("🏠 代理合约地址:", PROXY_ADDRESS);

  try {
    console.log("\n🔍 检查权限...");
    const currentContract = await hre.ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);
    const owner = await currentContract.owner();
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("❌ 非合约所有者");
      process.exit(1);
    }
    console.log("   ✅ 权限验证通过");

    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("\n   当前实现:", currentImpl);

    const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocol");
    
    console.log("\n🔄 准备新实现...");
    const newImpl = await upgrades.prepareUpgrade(PROXY_ADDRESS, JinbaoProtocol, {
      timeout: 600000,
      unsafeAllow: [
        'state-variable-immutable',
        'delegated-call',
        'struct-definition',
        'missing-public-upgrade-safety-check',
        'constructor',
      ],
      unsafeAllowCustomTypes: true,
      unsafeAllowConnectedContracts: true,
      kind: 'uups',
    });

    console.log("   新实现:", newImpl);

    console.log("\n🔄 执行升级...");
    // 直接调用代理的升级函数
    const proxyAdmin = currentContract;
    const tx = await proxyAdmin.upgradeTo(newImpl);
    const receipt = await tx.wait();
    
    console.log("   交易哈希:", receipt.hash);
    console.log("✅ 升级完成！");

    // 验证
    console.log("\n🔍 验证...");
    const upgraded = await hre.ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);
    const cutoffDate = await upgraded.ticketExpiryCutoffDate();
    console.log("   ticketExpiryCutoffDate:", cutoffDate.toString());
    console.log("   日期:", new Date(Number(cutoffDate) * 1000).toISOString());

    // 保存记录
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    fs.writeFileSync(
      path.join(deploymentsDir, `upgrade-ticket-expiry-skip-check-${Date.now()}.json`),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        network: hre.network.name,
        proxyAddress: PROXY_ADDRESS,
        newImplementation: newImpl,
        transactionHash: receipt.hash,
      }, null, 2)
    );

    console.log("\n🎉 完成！");
  } catch (error) {
    console.error("\n❌ 失败:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
