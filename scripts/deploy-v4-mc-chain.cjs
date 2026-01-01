const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 部署 JinbaoProtocolV4 到 MC Chain (级差奖励基于静态收益)\n");
  console.log("=".repeat(80));

  const [deployer] = await hre.ethers.getSigners();
  console.log("📋 部署账户:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC\n");

  if (balance < hre.ethers.parseEther("5")) {
    console.warn("⚠️  警告: 余额不足! 部署可能需要至少 5 MC\n");
  }

  // 使用环境变量或默认值
  const EXISTING_MC_TOKEN = process.env.MC_ADDRESS || "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
  const EXISTING_JBC_TOKEN = process.env.JBC_ADDRESS || "0xA743cB357a9f59D349efB7985072779a094658dD";
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;

  // 钱包地址配置
  const WALLETS = {
    marketing: process.env.MARKETING_WALLET || deployer.address,
    treasury: process.env.TREASURY_WALLET || deployer.address,
    lpInjection: process.env.LP_WALLET || deployer.address,
    buyback: process.env.BUYBACK_WALLET || deployer.address
  };

  console.log("🏦 配置信息:");
  console.log("   MC Token:", EXISTING_MC_TOKEN);
  console.log("   JBC Token:", EXISTING_JBC_TOKEN);
  console.log("   营销钱包:", WALLETS.marketing);
  console.log("   国库钱包:", WALLETS.treasury);
  console.log("   LP注入钱包:", WALLETS.lpInjection);
  console.log("   回购钱包:", WALLETS.buyback);
  console.log("");

  try {
    // 如果是升级
    if (PROXY_ADDRESS && PROXY_ADDRESS !== "0x..." && PROXY_ADDRESS !== "") {
      console.log("🔄 升级模式: 升级现有代理合约\n");
      console.log("📍 代理地址:", PROXY_ADDRESS);
      
      const JinbaoProtocolV4 = await hre.ethers.getContractFactory("JinbaoProtocolV4");
      
      console.log("⏳ 开始升级合约...");
      const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolV4, {
        timeout: 300000, // 5分钟超时
      });
      
      await upgraded.waitForDeployment();
      
      const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
      
      console.log("\n✅ 升级成功!");
      console.log("📍 代理地址:", PROXY_ADDRESS);
      console.log("📍 新实现地址:", newImplAddress);
      
      // 验证升级
      console.log("\n🔍 验证升级...");
      const upgradedContract = await hre.ethers.getContractAt("JinbaoProtocolV4", PROXY_ADDRESS);
      
      // 测试基本功能
      try {
        const mcToken = await upgradedContract.mcToken();
        const jbcToken = await upgradedContract.jbcToken();
        console.log("✅ 合约验证成功:");
        console.log("   MC Token:", mcToken);
        console.log("   JBC Token:", jbcToken);
      } catch (error) {
        console.log("⚠️  验证测试失败:", error.message);
      }

      // 保存部署信息
      const deploymentInfo = {
        network: "MC Chain",
        chainId: 88813,
        type: "upgrade",
        timestamp: new Date().toISOString(),
        proxyAddress: PROXY_ADDRESS,
        implementationAddress: newImplAddress,
        deployer: deployer.address,
        changes: [
          "级差奖励计算逻辑更新: 基于赎回时的静态收益计算，而不是质押金额",
          "移除质押时的级差奖励计算",
          "在赎回时基于静态收益计算并分配级差奖励",
          "级差奖励的MC和JBC从静态奖励的MC和JBC中按比例分配",
          "级差奖励的MC和JBC比例与静态奖励一致（50% MC + 50% JBC）",
          "如果JBC余额不足，通过AMM交换MC获得JBC"
        ]
      };

      const deploymentPath = path.join(__dirname, `../deployments/mc-chain-upgrade-${Date.now()}.json`);
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
      console.log(`\n📄 部署信息已保存到: ${deploymentPath}`);

      console.log("\n🎉 MC Chain 合约升级完成!");
      console.log("📋 更新内容:");
      console.log("   ✅ 级差奖励基于静态收益计算");
      console.log("   ✅ 移除质押时的级差奖励计算");
      console.log("   ✅ 在赎回时计算并分配级差奖励");
      console.log("   ✅ 级差奖励的MC和JBC从静态奖励中按比例分配");
      console.log("   ✅ 级差奖励保持50% MC + 50% JBC比例");
      console.log("   ✅ JBC通过AMM交换获得（如果余额不足）");

    } else {
      // 全新部署
      console.log("📦 全新部署模式: 部署新的代理合约\n");
      
      const JinbaoProtocolV4 = await hre.ethers.getContractFactory("JinbaoProtocolV4");
      
      console.log("⏳ 开始部署合约...");
      const protocolProxy = await upgrades.deployProxy(
        JinbaoProtocolV4,
        [
          EXISTING_JBC_TOKEN,
          WALLETS.marketing,
          WALLETS.treasury,
          WALLETS.lpInjection,
          WALLETS.buyback
        ],
        {
          initializer: 'initialize',
          kind: 'uups',
          timeout: 300000
        }
      );

      await protocolProxy.waitForDeployment();
      const protocolAddress = await protocolProxy.getAddress();
      
      console.log("✅ JinbaoProtocolV4 代理地址:", protocolAddress);
      
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(protocolAddress);
      console.log("📋 实现合约地址:", implementationAddress);
      console.log("");

      // 验证合约部署
      console.log("🔍 验证合约部署...");
      const protocol = await hre.ethers.getContractAt("JinbaoProtocolV4", protocolAddress);
      
      const jbcTokenAddr = await protocol.jbcToken();
      const owner = await protocol.owner();
      
      console.log(`MC Token: 原生MC (Native MC)`);
      console.log(`JBC Token地址: ${jbcTokenAddr} ${jbcTokenAddr.toLowerCase() === EXISTING_JBC_TOKEN.toLowerCase() ? '✅' : '❌'}`);
      console.log(`合约所有者: ${owner} ${owner === deployer.address ? '✅' : '❌'}`);
      console.log("");

      // 保存部署信息
      const deploymentInfo = {
        network: "MC Chain",
        chainId: 88813,
        type: "deployment",
        timestamp: new Date().toISOString(),
        proxyAddress: protocolAddress,
        implementationAddress: implementationAddress,
        deployer: deployer.address,
        mcToken: EXISTING_MC_TOKEN,
        jbcToken: EXISTING_JBC_TOKEN,
        wallets: WALLETS,
        features: [
          "级差奖励基于赎回时的静态收益计算",
          "级差奖励的MC和JBC从静态奖励的MC和JBC中按比例分配",
          "50% MC + 50% JBC 双币奖励分配",
          "V0-V9 等级系统",
          "静态奖励、直推奖励、层级奖励、级差奖励",
          "JBC通过AMM交换获得（如果余额不足）"
        ]
      };

      const deploymentPath = path.join(__dirname, `../deployments/mc-chain-deployment-${Date.now()}.json`);
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
      console.log(`📄 部署信息已保存到: ${deploymentPath}`);

      console.log("\n🎉 MC Chain 合约部署完成!");
      console.log("📋 合约特性:");
      console.log("   ✅ 级差奖励基于静态收益计算");
      console.log("   ✅ 级差奖励的MC和JBC从静态奖励中按比例分配");
      console.log("   ✅ 50% MC + 50% JBC 双币奖励");
      console.log("   ✅ V0-V9 等级系统");
      console.log("   ✅ JBC通过AMM交换获得（如果余额不足）");
    }

  } catch (error) {
    console.error("\n❌ 部署失败:", error.message);
    if (error.transaction) {
      console.error("交易哈希:", error.transaction.hash);
    }
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ 部署流程完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });

