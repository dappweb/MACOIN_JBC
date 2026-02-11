const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 手动升级 UUPS 代理合约
 * 直接部署新实现并调用 upgradeTo
 */
async function main() {
  console.log("════════════════════════════════════════════");
  console.log("🚀 直接升级 - 手动部署新实现");
  console.log("════════════════════════════════════════════\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);

  const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  console.log("🏠 代理地址:", PROXY_ADDRESS + "\n");

  try {
    // 验证权限
    const proxyContract = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    const owner = await proxyContract.owner();
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error("非合约所有者");
    } console.log("✅ 权限验证通过\n");

    // 部署新实现
    console.log("📦 部署新实现...");
    const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocolNative");
    
    const newImplementation = await JinbaoProtocol.deploy();
    await newImplementation.waitForDeployment();
    const newImplAddress = await newImplementation.getAddress();
    
    console.log("✅ 新实现已部署:", newImplAddress);
    console.log("   交易哈希:", newImplementation.deploymentTransaction().hash + "\n");

    // 执行升级
    console.log("🔄 执行升级...");
    const upgradeTx = await proxyContract.upgradeToAndCall(newImplAddress, "0x", {
      gasLimit: 1000000,
    });
    
    const receipt = await upgradeTx.wait();
    console.log("✅ 升级交易已确认");
    console.log("   交易哈希:", receipt.hash);
    console.log("   区块号:", receipt.blockNumber + "\n");

    // 验证
    console.log("🔍 验证升级...");
    const upgraded = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    
    let cutoffDate;
    try {
      cutoffDate = await upgraded.ticketExpiryCutoffDate();
      const date = new Date(Number(cutoffDate) * 1000);
      console.log("✅ ticketExpiryCutoffDate:", cutoffDate.toString());
      console.log("   时间戳:", date.toISOString());
      
      const expected = 1770432000n;
      if (cutoffDate === expected) {
        console.log("   ✅ 日期正确 (2026-02-09 00:00:00 UTC)");
      }
    } catch (e) {
      console.log("⚠️  无法读取新变量", e.message);
    }

    const duration = await upgraded.ticketFlexibilityDuration();
    console.log("   ticketFlexibilityDuration:", (Number(duration) / 3600).toString(), "小时");

    // 保存记录
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    const record = {
      timestamp: new Date().toISOString(),
      network: hre.network.name,
      proxyAddress: PROXY_ADDRESS,
      newImplementation: newImplAddress,
      method: "manual-uups",
      upgradeTx: receipt.hash,
      blockNumber: receipt.blockNumber,
      cutoffDate: cutoffDate ? cutoffDate.toString() : "error",
    };

    fs.writeFileSync(
      path.join(deploymentsDir, `upgrade-manual-${Date.now()}.json`),
      JSON.stringify(record, null, 2)
    );

    console.log("\n✅ 升级完成！");
    console.log("📄 记录已保存\n");

  } catch (error) {
    console.error("\n❌ 升级失败:");
    console.error(error.message);
    if (error.data) {
      console.error("错误数据:", error.data);
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
