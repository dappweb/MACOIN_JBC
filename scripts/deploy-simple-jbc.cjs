const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 开始简化JBC重新发行...");
  console.log("=".repeat(80));

  const [deployer] = await ethers.getSigners();
  
  if (!deployer) {
    console.error("❌ 错误: 未找到部署账户!");
    process.exit(1);
  }
  
  console.log("📋 部署账户:", deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MC");
  console.log("");

  // 目标地址
  const TARGET_ADDRESS = "0xdb817e0d21a134f649d24b91e39d42e7eec52a65";
  console.log("🎯 目标地址:", TARGET_ADDRESS);
  console.log("");

  try {
    // 1. 部署JBC代币合约
    console.log("📦 部署JBC代币合约...");
    
    const JBC = await ethers.getContractFactory("JBC");
    const jbc = await JBC.deploy(deployer.address);
    await jbc.waitForDeployment();
    
    const jbcAddress = await jbc.getAddress();
    console.log("✅ 新JBC合约地址:", jbcAddress);
    
    // 验证JBC部署
    const jbcName = await jbc.name();
    const jbcSymbol = await jbc.symbol();
    const jbcTotalSupply = await jbc.totalSupply();
    
    console.log(`代币名称: ${jbcName}`);
    console.log(`代币符号: ${jbcSymbol}`);
    console.log(`总供应量: ${ethers.formatEther(jbcTotalSupply)} JBC`);
    console.log("");

    // 2. 将所有JBC转移到目标地址
    console.log("💸 将所有JBC转移到目标地址...");
    
    const deployerBalance = await jbc.balanceOf(deployer.address);
    console.log(`部署者JBC余额: ${ethers.formatEther(deployerBalance)} JBC`);
    
    if (deployerBalance > 0) {
      const transferTx = await jbc.transfer(TARGET_ADDRESS, deployerBalance);
      await transferTx.wait();
      console.log(`✅ 已转移 ${ethers.formatEther(deployerBalance)} JBC 到 ${TARGET_ADDRESS}`);
      
      // 验证转移
      const targetBalance = await jbc.balanceOf(TARGET_ADDRESS);
      console.log(`目标地址JBC余额: ${ethers.formatEther(targetBalance)} JBC`);
    }
    console.log("");

    // 3. 部署JinbaoProtocolNative合约
    console.log("📦 部署JinbaoProtocolNative合约...");
    
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    
    const protocolProxy = await upgrades.deployProxy(
      JinbaoProtocolNative,
      [
        jbcAddress,
        deployer.address, // marketing
        deployer.address, // treasury
        deployer.address, // lpInjection
        deployer.address  // buyback
      ],
      {
        initializer: 'initialize',
        kind: 'uups'
      }
    );

    await protocolProxy.waitForDeployment();
    const protocolAddress = await protocolProxy.getAddress();
    
    console.log("✅ JinbaoProtocolNative代理地址:", protocolAddress);
    
    // 获取实现合约地址
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(protocolAddress);
    console.log("📋 实现合约地址:", implementationAddress);
    console.log("");

    // 4. 配置JBC合约的协议地址
    console.log("🔧 配置JBC合约的协议地址...");
    
    const setProtocolTx = await jbc.setProtocol(protocolAddress);
    await setProtocolTx.wait();
    console.log("✅ JBC协议地址配置完成");
    console.log("");

    // 5. 保存部署信息
    console.log("💾 保存部署信息...");
    
    const deploymentInfo = {
      network: "mc",
      chainId: "88813",
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      targetAddress: TARGET_ADDRESS,
      contracts: {
        jbcToken: jbcAddress,
        protocolProxy: protocolAddress,
        protocolImplementation: implementationAddress
      },
      wallets: {
        marketing: deployer.address,
        treasury: deployer.address,
        lpInjection: deployer.address,
        buyback: deployer.address
      },
      tokenInfo: {
        name: jbcName,
        symbol: jbcSymbol,
        totalSupply: ethers.formatEther(jbcTotalSupply),
        targetAddressBalance: ethers.formatEther(await jbc.balanceOf(TARGET_ADDRESS))
      }
    };
    
    // 创建deployments目录
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = `jbc-reissue-deployment-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ 部署信息已保存: ${filename}`);
    console.log("");

    // 6. 部署总结
    console.log("🎉 JBC重新发行完成！");
    console.log("=".repeat(80));
    console.log(`✅ 新JBC合约地址: ${jbcAddress}`);
    console.log(`✅ 新协议合约地址: ${protocolAddress}`);
    console.log(`✅ JBC总供应量: ${ethers.formatEther(jbcTotalSupply)} JBC`);
    console.log(`✅ 目标地址JBC余额: ${ethers.formatEther(await jbc.balanceOf(TARGET_ADDRESS))} JBC`);
    console.log("");

    return {
      jbcAddress,
      protocolAddress,
      implementationAddress,
      deploymentInfo
    };

  } catch (error) {
    console.error("❌ 部署失败:", error);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("🎉 JBC重新发行成功完成!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 部署过程中出现错误:", error);
      process.exit(1);
    });
}

module.exports = main;