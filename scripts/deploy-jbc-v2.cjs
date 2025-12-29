const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 开始部署 JBC v2.0 代币...");
  
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));
  
  // 钱包地址配置
  const wallets = {
    treasury: process.env.TREASURY_WALLET || deployer.address,
    marketing: process.env.MARKETING_WALLET || deployer.address,
    liquidity: process.env.LIQUIDITY_WALLET || deployer.address
  };
  
  console.log("钱包配置:");
  console.log("- 国库钱包:", wallets.treasury);
  console.log("- 营销钱包:", wallets.marketing);
  console.log("- 流动性钱包:", wallets.liquidity);
  
  // 部署 JBCv2 合约
  console.log("\n📄 部署 JBCv2 合约...");
  const JBCv2 = await ethers.getContractFactory("JBCv2");
  
  const jbcv2 = await upgrades.deployProxy(
    JBCv2,
    [
      deployer.address,  // owner
      wallets.treasury,  // treasury wallet
      wallets.marketing, // marketing wallet
      wallets.liquidity  // liquidity wallet
    ],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );
  
  await jbcv2.waitForDeployment();
  const jbcv2Address = await jbcv2.getAddress();
  
  console.log("✅ JBCv2 代理合约地址:", jbcv2Address);
  
  // 获取实现合约地址
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(jbcv2Address);
  console.log("📋 JBCv2 实现合约地址:", implementationAddress);
  
  // 验证部署
  console.log("\n🔍 验证合约部署...");
  
  const name = await jbcv2.name();
  const symbol = await jbcv2.symbol();
  const totalSupply = await jbcv2.totalSupply();
  const maxSupply = await jbcv2.MAX_SUPPLY();
  const version = await jbcv2.VERSION();
  
  console.log("代币名称:", name);
  console.log("代币符号:", symbol);
  console.log("总供应量:", ethers.formatEther(totalSupply));
  console.log("最大供应量:", ethers.formatEther(maxSupply));
  console.log("合约版本:", version);
  
  // 验证税收配置
  const taxInfo = await jbcv2.getTaxInfo();
  console.log("\n💰 税收配置:");
  console.log("- 买入税:", taxInfo.buyTax / 100, "%");
  console.log("- 卖出税:", taxInfo.sellTax / 100, "%");
  console.log("- 转账税:", taxInfo.transferTax / 100, "%");
  console.log("- 税收启用:", taxInfo.enabled);
  
  // 验证供应量信息
  const supplyInfo = await jbcv2.getSupplyInfo();
  console.log("\n📊 供应量信息:");
  console.log("- 当前供应量:", ethers.formatEther(supplyInfo.totalSupply_));
  console.log("- 最大供应量:", ethers.formatEther(supplyInfo.maxSupply_));
  console.log("- 已燃烧数量:", ethers.formatEther(supplyInfo.totalBurned_));
  console.log("- 流通供应量:", ethers.formatEther(supplyInfo.circulatingSupply));
  
  // 保存部署信息
  const deploymentInfo = {
    network: await deployer.provider.getNetwork(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      JBCv2: {
        proxy: jbcv2Address,
        implementation: implementationAddress
      }
    },
    wallets: wallets,
    tokenInfo: {
      name: name,
      symbol: symbol,
      totalSupply: ethers.formatEther(totalSupply),
      maxSupply: ethers.formatEther(maxSupply),
      version: version
    },
    taxConfig: {
      buyTax: taxInfo.buyTax.toString(),
      sellTax: taxInfo.sellTax.toString(),
      transferTax: taxInfo.transferTax.toString(),
      enabled: taxInfo.enabled
    }
  };
  
  console.log("\n💾 保存部署信息到 deployments/jbc-v2-deployment.json");
  const fs = require('fs');
  const path = require('path');
  
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'jbc-v2-deployment.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n🎉 JBC v2.0 部署完成!");
  console.log("📋 合约地址:", jbcv2Address);
  console.log("🔗 在区块浏览器中查看:", `https://mcerscan.com/address/${jbcv2Address}`);
  
  return {
    jbcv2: jbcv2Address,
    implementation: implementationAddress
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ 部署失败:", error);
      process.exit(1);
    });
}

module.exports = main;