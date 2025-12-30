const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 开始重新发行JBC代币并部署新协议...");
  console.log("=".repeat(80));

  const [deployer] = await ethers.getSigners();
  
  if (!deployer) {
    console.error("❌ 错误: 未找到部署账户!");
    console.error("   请确保.env文件存在并包含有效的PRIVATE_KEY");
    process.exit(1);
  }
  
  console.log("📋 部署账户:", deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MC");
  console.log("");

  // 目标地址 - 所有JBC将转移到这个地址
  const TARGET_ADDRESS = "0xdb817e0d21a134f649d24b91e39d42e7eec52a65";
  console.log("🎯 目标地址:", TARGET_ADDRESS);
  console.log("");

  // 钱包地址配置
  const WALLETS = {
    marketing: deployer.address,
    treasury: deployer.address,
    lpInjection: deployer.address,
    buyback: deployer.address
  };

  try {
    // 1. 重新部署JBC代币合约
    console.log("📦 重新部署JBC代币合约...");
    
    const JBC = await ethers.getContractFactory("JBC");
    const jbc = await JBC.deploy(deployer.address);
    await jbc.waitForDeployment();
    
    const jbcAddress = await jbc.getAddress();
    console.log("✅ 新JBC合约地址:", jbcAddress);
    
    // 验证JBC部署
    const jbcName = await jbc.name();
    const jbcSymbol = await jbc.symbol();
    const jbcTotalSupply = await jbc.totalSupply();
    const jbcDecimals = await jbc.decimals();
    
    console.log(`代币名称: ${jbcName}`);
    console.log(`代币符号: ${jbcSymbol}`);
    console.log(`小数位数: ${jbcDecimals}`);
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
      const newDeployerBalance = await jbc.balanceOf(deployer.address);
      
      console.log(`目标地址JBC余额: ${ethers.formatEther(targetBalance)} JBC`);
      console.log(`部署者剩余余额: ${ethers.formatEther(newDeployerBalance)} JBC`);
    }
    console.log("");

    // 3. 部署新的JinbaoProtocolNative合约
    console.log("📦 部署新的JinbaoProtocolNative合约...");
    
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    
    const protocolProxy = await upgrades.deployProxy(
      JinbaoProtocolNative,
      [
        jbcAddress,
        WALLETS.marketing,
        WALLETS.treasury,
        WALLETS.lpInjection,
        WALLETS.buyback
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

    // 5. 验证协议合约部署
    console.log("🔍 验证协议合约部署...");
    
    const protocol = await ethers.getContractAt("JinbaoProtocolNative", protocolAddress);
    
    // 检查基本配置
    const jbcTokenAddr = await protocol.jbcToken();
    const owner = await protocol.owner();
    
    console.log(`JBC Token地址: ${jbcTokenAddr} ${jbcTokenAddr === jbcAddress ? '✅' : '❌'}`);
    console.log(`合约所有者: ${owner} ${owner === deployer.address ? '✅' : '❌'}`);
    
    // 检查钱包配置
    const marketingWallet = await protocol.marketingWallet();
    const treasuryWallet = await protocol.treasuryWallet();
    const lpInjectionWallet = await protocol.lpInjectionWallet();
    const buybackWallet = await protocol.buybackWallet();
    
    console.log(`营销钱包: ${marketingWallet}`);
    console.log(`国库钱包: ${treasuryWallet}`);
    console.log(`LP注入钱包: ${lpInjectionWallet}`);
    console.log(`回购钱包: ${buybackWallet}`);
    console.log("");

    // 6. 初始化AMM流动性（使用原生MC）
    console.log("💧 初始化AMM流动性...");
    
    // 从目标地址获取一些JBC用于初始流动性
    console.log("⚠️  注意: 需要从目标地址手动转移一些JBC用于初始流动性");
    console.log(`请从 ${TARGET_ADDRESS} 转移一些JBC到部署者地址用于初始流动性`);
    
    // 这里我们先设置一个小的初始流动性，实际使用时需要调整
    const INITIAL_MC_LIQUIDITY = ethers.parseEther("1000"); // 1,000 MC
    const INITIAL_JBC_LIQUIDITY = ethers.parseEther("1000"); // 1,000 JBC
    
    console.log(`准备添加流动性:`);
    console.log(`- MC: ${ethers.formatEther(INITIAL_MC_LIQUIDITY)} MC (原生)`);
    console.log(`- JBC: ${ethers.formatEther(INITIAL_JBC_LIQUIDITY)} JBC`);
    
    // 检查部署者是否有足够的原生MC
    const deployerMCBalance = await deployer.provider.getBalance(deployer.address);
    if (deployerMCBalance < INITIAL_MC_LIQUIDITY) {
      console.log(`❌ 原生MC余额不足! 需要: ${ethers.formatEther(INITIAL_MC_LIQUIDITY)}, 拥有: ${ethers.formatEther(deployerMCBalance)}`);
      console.log("⚠️  跳过初始流动性添加，请稍后手动添加");
    } else {
      // 检查部署者是否有JBC（需要从目标地址转移一些回来）
      const deployerJBCBalance = await jbc.balanceOf(deployer.address);
      if (deployerJBCBalance < INITIAL_JBC_LIQUIDITY) {
        console.log(`❌ JBC余额不足! 需要: ${ethers.formatEther(INITIAL_JBC_LIQUIDITY)}, 拥有: ${ethers.formatEther(deployerJBCBalance)}`);
        console.log("⚠️  跳过初始流动性添加，请稍后手动添加");
      } else {
        // 授权JBC给协议合约
        console.log("🔐 授权JBC给协议合约...");
        const jbcApproveTx = await jbc.approve(protocolAddress, INITIAL_JBC_LIQUIDITY);
        await jbcApproveTx.wait();
        console.log("✅ JBC授权完成");
        
        // 添加初始流动性（原生MC通过payable发送）
        console.log("💧 添加初始流动性...");
        const addLiquidityTx = await protocol.addLiquidity(INITIAL_JBC_LIQUIDITY, {
          value: INITIAL_MC_LIQUIDITY
        });
        await addLiquidityTx.wait();
        console.log("✅ 初始流动性添加完成");
        
        // 验证流动性
        const swapReserveMC = await protocol.swapReserveMC();
        const swapReserveJBC = await protocol.swapReserveJBC();
        
        console.log(`Swap储备 MC: ${ethers.formatEther(swapReserveMC)} MC`);
        console.log(`Swap储备 JBC: ${ethers.formatEther(swapReserveJBC)} JBC`);
      }
    }
    console.log("");

    // 7. 保存部署信息
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
      wallets: WALLETS,
      tokenInfo: {
        name: jbcName,
        symbol: jbcSymbol,
        decimals: jbcDecimals,
        totalSupply: ethers.formatEther(jbcTotalSupply),
        targetAddressBalance: ethers.formatEther(await jbc.balanceOf(TARGET_ADDRESS))
      },
      initialLiquidity: {
        mcAmount: ethers.formatEther(INITIAL_MC_LIQUIDITY),
        jbcAmount: ethers.formatEther(INITIAL_JBC_LIQUIDITY),
        initialized: deployerMCBalance >= INITIAL_MC_LIQUIDITY && (await jbc.balanceOf(deployer.address)) >= INITIAL_JBC_LIQUIDITY
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

    // 8. 生成前端配置更新
    console.log("📋 前端配置更新:");
    console.log("-".repeat(50));
    console.log("需要更新以下文件中的合约地址:");
    console.log("");
    console.log("src/Web3Context.tsx 或 src/config.ts:");
    console.log(`  JBC_TOKEN: "${jbcAddress}"`);
    console.log(`  PROTOCOL: "${protocolAddress}"`);
    console.log("");

    // 9. 生成Cloudflare部署配置
    console.log("☁️  Cloudflare部署配置:");
    console.log("-".repeat(50));
    console.log("需要在Cloudflare Pages环境变量中设置:");
    console.log("");
    console.log(`JBC_CONTRACT_ADDRESS=${jbcAddress}`);
    console.log(`PROTOCOL_CONTRACT_ADDRESS=${protocolAddress}`);
    console.log(`CHAIN_ID=88813`);
    console.log(`RPC_URL=https://chain.mcerscan.com/`);
    console.log("");

    // 10. 部署总结
    console.log("🎉 重新发行和部署完成总结:");
    console.log("=".repeat(80));
    console.log(`✅ 新JBC合约地址: ${jbcAddress}`);
    console.log(`✅ 新协议合约地址: ${protocolAddress}`);
    console.log(`✅ JBC总供应量: ${ethers.formatEther(jbcTotalSupply)} JBC`);
    console.log(`✅ 目标地址JBC余额: ${ethers.formatEther(await jbc.balanceOf(TARGET_ADDRESS))} JBC`);
    console.log(`✅ 协议配置完成`);
    console.log("");
    console.log("📋 下一步操作:");
    console.log("1. 更新前端配置文件中的合约地址");
    console.log("2. 重新构建前端应用");
    console.log("3. 部署到Cloudflare Pages");
    console.log("4. 配置Cloudflare环境变量");
    console.log("5. 测试所有功能");
    console.log("");
    console.log("⚠️  重要提醒:");
    console.log("- 这是全新的合约，所有历史数据已清空");
    console.log("- 用户需要重新开始（绑定推荐人、购买门票等）");
    console.log("- 建议进行充分测试后再公告用户");
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
      console.log("🎉 JBC重新发行和协议部署成功完成!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 部署过程中出现错误:", error);
      process.exit(1);
    });
}

module.exports = main;