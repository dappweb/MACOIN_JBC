const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 开始部署原生MC版本的Jinbao协议...");
  
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MC");

  // 配置钱包地址
  const wallets = {
    marketing: process.env.MARKETING_WALLET || deployer.address,
    treasury: process.env.TREASURY_WALLET || deployer.address,
    lpInjection: process.env.LP_WALLET || deployer.address,
    buyback: process.env.BUYBACK_WALLET || deployer.address
  };

  console.log("钱包配置:");
  console.log("  营销钱包:", wallets.marketing);
  console.log("  国库钱包:", wallets.treasury);
  console.log("  流动性钱包:", wallets.lpInjection);
  console.log("  回购钱包:", wallets.buyback);

  try {
    // 1. 部署JBC代币 (如果需要)
    console.log("\n📄 部署JBC代币...");
    const JBCv2 = await ethers.getContractFactory("JBCv2");
    const jbc = await JBCv2.deploy();
    await jbc.waitForDeployment();
    const jbcAddress = await jbc.getAddress();
    console.log("✅ JBC代币部署成功:", jbcAddress);

    // 2. 部署原生MC协议合约
    console.log("\n🏗️ 部署原生MC协议合约...");
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    
    // 使用UUPS代理模式部署
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
    console.log("✅ 原生MC协议部署成功:", protocolAddress);

    // 3. 设置JBC铸造权限
    console.log("\n🔧 配置JBC铸造权限...");
    await jbc.setMinter(protocolAddress);
    console.log("✅ JBC铸造权限设置完成");

    // 4. 添加初始流动性 (如果有足够的代币)
    const initialMC = ethers.parseEther("10000"); // 10,000 MC
    const initialJBC = ethers.parseEther("10000"); // 10,000 JBC
    
    console.log("\n💧 添加初始流动性...");
    console.log("  MC数量:", ethers.formatEther(initialMC));
    console.log("  JBC数量:", ethers.formatEther(initialJBC));
    
    // 铸造JBC给部署者
    await jbc.mint(deployer.address, initialJBC);
    await jbc.approve(protocolAddress, initialJBC);
    
    // 添加流动性 - 原生MC作为value发送
    const addLiquidityTx = await protocol.addLiquidity(initialJBC, { 
      value: initialMC 
    });
    await addLiquidityTx.wait();
    console.log("✅ 初始流动性添加成功");

    // 5. 验证部署
    console.log("\n🔍 验证部署状态...");
    const reserveMC = await protocol.swapReserveMC();
    const reserveJBC = await protocol.swapReserveJBC();
    const owner = await protocol.owner();
    
    console.log("  MC储备:", ethers.formatEther(reserveMC));
    console.log("  JBC储备:", ethers.formatEther(reserveJBC));
    console.log("  合约拥有者:", owner);
    console.log("  部署者地址:", deployer.address);
    console.log("  拥有者匹配:", owner === deployer.address ? "✅" : "❌");

    // 6. 输出部署信息
    console.log("\n🎉 原生MC版本部署完成!");
    console.log("=" .repeat(60));
    console.log("📋 部署摘要:");
    console.log("  网络:", (await deployer.provider.getNetwork()).name);
    console.log("  链ID:", (await deployer.provider.getNetwork()).chainId);
    console.log("  JBC代币:", jbcAddress);
    console.log("  协议合约:", protocolAddress);
    console.log("  代理实现:", await upgrades.erc1967.getImplementationAddress(protocolAddress));
    console.log("=" .repeat(60));

    // 7. 保存部署信息到文件
    const deploymentInfo = {
      network: (await deployer.provider.getNetwork()).name,
      chainId: Number((await deployer.provider.getNetwork()).chainId),
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: {
        JBC_TOKEN: jbcAddress,
        PROTOCOL: protocolAddress,
        IMPLEMENTATION: await upgrades.erc1967.getImplementationAddress(protocolAddress)
      },
      wallets: wallets,
      initialLiquidity: {
        MC: ethers.formatEther(initialMC),
        JBC: ethers.formatEther(initialJBC)
      },
      reserves: {
        MC: ethers.formatEther(reserveMC),
        JBC: ethers.formatEther(reserveJBC)
      }
    };

    const fs = require('fs');
    const deploymentFile = `deployments/native-mc-${Date.now()}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("📁 部署信息已保存到:", deploymentFile);

    // 8. 生成前端配置
    const frontendConfig = `// 原生MC版本配置 - 自动生成于 ${new Date().toISOString()}
export const NATIVE_MC_CONFIG = {
  PROTOCOL_ADDRESS: "${protocolAddress}",
  JBC_TOKEN_ADDRESS: "${jbcAddress}",
  NETWORK_ID: ${Number((await deployer.provider.getNetwork()).chainId)},
  IS_NATIVE_MC: true,
  DEPLOYMENT_BLOCK: ${await deployer.provider.getBlockNumber()}
};

// 更新Web3Context使用此配置
export const CONTRACT_ADDRESSES = {
  PROTOCOL: "${protocolAddress}",
  JBC_TOKEN: "${jbcAddress}",
  // MC_TOKEN 不再需要 - 使用原生MC
};
`;

    fs.writeFileSync('src/config/native-mc-config.ts', frontendConfig);
    console.log("📁 前端配置已生成: src/config/native-mc-config.ts");

    console.log("\n🚀 部署成功! 可以开始使用原生MC版本的Jinbao协议了!");
    
  } catch (error) {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  }
}

// 执行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署脚本执行失败:", error);
    process.exit(1);
  });