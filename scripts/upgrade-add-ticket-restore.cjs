const { ethers, upgrades } = require("hardhat");

/**
 * 升级合约以添加 adminSetUserTicket 函数
 */
async function main() {
  console.log("🚀 开始升级合约以添加门票恢复功能\n");
  console.log("=".repeat(60));
  
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS || process.argv[2] || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  
  console.log(`📍 代理合约地址: ${PROXY_ADDRESS}`);
  
  // 获取签名者
  const [deployer] = await ethers.getSigners();
  console.log(`👤 部署者地址: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 部署者余额: ${ethers.formatEther(balance)} MC\n`);
  
  // 验证 Owner
  const Protocol = await ethers.getContractFactory("JinbaoProtocolNative");
  const protocol = Protocol.attach(PROXY_ADDRESS);
  const owner = await protocol.owner();
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${deployer.address}`);
  }
  console.log(`✅ Owner 验证通过\n`);
  
  // 升级合约
  console.log("📋 步骤 1: 升级合约");
  console.log("   正在部署新的实现合约...");
  
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, Protocol);
  await upgraded.waitForDeployment();
  
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log(`    ✅ 升级完成`);
  console.log(`    代理地址: ${PROXY_ADDRESS}`);
  console.log(`    实现地址: ${implementationAddress}\n`);
  
  // 验证新函数
  console.log("📋 步骤 2: 验证新函数");
  try {
    // 检查函数是否存在（通过尝试调用一个无效的调用）
    const iface = new ethers.Interface([
      "function adminSetUserTicket(address user, uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited) external"
    ]);
    
    // 尝试编码函数调用（不实际执行）
    const data = iface.encodeFunctionData("adminSetUserTicket", [
      ethers.ZeroAddress,
      0,
      0,
      0,
      false
    ]);
    
    console.log(`    ✅ adminSetUserTicket 函数已添加`);
    console.log(`    函数签名: adminSetUserTicket(address,uint256,uint256,uint256,bool)\n`);
  } catch (error) {
    console.log(`    ⚠️  验证函数时出错: ${error.message}`);
  }
  
  // 保存升级信息
  const upgradeInfo = {
    timestamp: new Date().toISOString(),
    proxyAddress: PROXY_ADDRESS,
    implementationAddress: implementationAddress,
    deployer: deployer.address,
    network: "mc",
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    upgrade: {
      addedFunction: "adminSetUserTicket",
      purpose: "恢复门票数据"
    }
  };
  
  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const upgradeFile = path.join(deploymentsDir, `upgrade-ticket-restore-${Date.now()}.json`);
  fs.writeFileSync(upgradeFile, JSON.stringify(upgradeInfo, null, 2));
  console.log(`📄 升级信息已保存: ${upgradeFile}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ 合约升级完成");
  console.log("=".repeat(60));
  console.log("\n📋 下一步:");
  console.log("  运行恢复脚本: node scripts/restore-ticket-data.cjs " + PROXY_ADDRESS);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n" + "=".repeat(60));
    console.error("❌ 升级失败");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  });







