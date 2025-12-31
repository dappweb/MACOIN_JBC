const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 开始部署 V4 协议到 MC Chain...\n");
  
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;
  
  console.log("═══════════════════════════════════════════");
  console.log("部署账户:", deployerAddress);
  const balance = await deployer.provider.getBalance(deployerAddress);
  console.log("账户余额:", ethers.formatEther(balance), "MC");
  console.log("═══════════════════════════════════════════\n");

  // 检查余额
  if (balance < ethers.parseEther("100")) {
    console.log("⚠️ 警告: 账户余额较低，可能不足以完成部署");
  }

  // 钱包配置 (使用部署者地址)
  const wallets = {
    marketing: process.env.MARKETING_WALLET || deployerAddress,
    treasury: process.env.TREASURY_WALLET || deployerAddress,
    lpInjection: process.env.LP_WALLET || deployerAddress,
    buyback: process.env.BUYBACK_WALLET || deployerAddress
  };

  console.log("钱包配置:");
  console.log("  营销钱包 (5%):", wallets.marketing);
  console.log("  国库钱包 (25%):", wallets.treasury);
  console.log("  LP注入钱包 (25%):", wallets.lpInjection);
  console.log("  回购钱包 (5%):", wallets.buyback);
  console.log("");

  const deploymentInfo = {
    network: "mc",
    chainId: "88813",
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    contracts: {},
    wallets: wallets
  };

  try {
    // ═══════════════════════════════════════════
    // 1. 部署 JBC 代币
    // ═══════════════════════════════════════════
    console.log("📄 [1/4] 部署 JBC 代币...");
    const JBC = await ethers.getContractFactory("JBC");
    const jbc = await JBC.deploy(deployerAddress);
    await jbc.waitForDeployment();
    const jbcAddress = await jbc.getAddress();
    console.log("✅ JBC 代币部署成功:", jbcAddress);
    deploymentInfo.contracts.JBC = jbcAddress;

    // ═══════════════════════════════════════════
    // 2. 部署协议合约 (UUPS 代理)
    // ═══════════════════════════════════════════
    console.log("\n🏗️ [2/4] 部署 JinbaoProtocolNative 合约...");
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    
    const protocol = await upgrades.deployProxy(
      JinbaoProtocolNative,
      [
        jbcAddress,
        wallets.marketing,
        wallets.treasury,
        wallets.lpInjection,
        wallets.buyback
      ],
      {
        kind: 'uups',
        initializer: 'initialize'
      }
    );
    
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();
    console.log("✅ 协议合约部署成功:", protocolAddress);
    deploymentInfo.contracts.Protocol = protocolAddress;

    // 获取实现合约地址
    const implAddress = await upgrades.erc1967.getImplementationAddress(protocolAddress);
    console.log("   实现合约地址:", implAddress);
    deploymentInfo.contracts.ProtocolImplementation = implAddress;

    // ═══════════════════════════════════════════
    // 3. 配置合约关系
    // ═══════════════════════════════════════════
    console.log("\n🔧 [3/4] 配置合约关系...");
    
    // 设置协议地址到 JBC
    await jbc.setProtocol(protocolAddress);
    console.log("✅ JBC 协议地址已设置");

    // ═══════════════════════════════════════════
    // 4. 添加初始流动性
    // ═══════════════════════════════════════════
    const initialMC = ethers.parseEther("100"); // 使用较小数量
    const initialJBC = ethers.parseEther("100");
    
    console.log("\n💧 [4/4] 添加初始流动性...");
    console.log("   MC 数量:", ethers.formatEther(initialMC));
    console.log("   JBC 数量:", ethers.formatEther(initialJBC));

    // 转移 JBC 到协议合约 (从初始供应中)
    await jbc.transfer(protocolAddress, initialJBC.toString());
    console.log("   ✓ JBC 转入协议合约");

    // 批准协议使用 JBC
    await jbc.approve(protocolAddress, ethers.MaxUint256);
    console.log("   ✓ JBC 批准完成");

    // 添加流动性
    const addLiquidityTx = await protocol.addLiquidity(initialJBC, { 
      value: initialMC 
    });
    await addLiquidityTx.wait();
    console.log("✅ 初始流动性添加成功");

    // 验证流动性
    const reserveMC = await protocol.swapReserveMC();
    const reserveJBC = await protocol.swapReserveJBC();
    console.log("   当前 MC 储备:", ethers.formatEther(reserveMC));
    console.log("   当前 JBC 储备:", ethers.formatEther(reserveJBC));

    // ═══════════════════════════════════════════
    // 保存部署信息
    // ═══════════════════════════════════════════
    const deploymentPath = path.join(__dirname, '..', 'deployments', `deployment-mc-v4-${Date.now()}.json`);
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    // 更新 latest
    const latestPath = path.join(__dirname, '..', 'deployments', 'latest-mc-v4.json');
    fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n═══════════════════════════════════════════");
    console.log("🎉 V4 协议部署完成!");
    console.log("═══════════════════════════════════════════");
    console.log("\n合约地址汇总:");
    console.log("  JBC Token:", jbcAddress);
    console.log("  Protocol:", protocolAddress);
    console.log("  Implementation:", implAddress);
    console.log("\n部署信息已保存到:", deploymentPath);
    console.log("\n⚠️ 请更新前端 CONTRACT_ADDRESSES:");
    console.log(`
export const CONTRACT_ADDRESSES = {
  JBC_TOKEN: "${jbcAddress}",
  PROTOCOL: "${protocolAddress}",
  // DAILY_BURN_MANAGER: "待部署"
};
`);

    return deploymentInfo;

  } catch (error) {
    console.error("\n❌ 部署失败:", error.message);
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
