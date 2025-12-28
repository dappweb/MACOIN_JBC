const { ethers, upgrades } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("🚀 开始全新部署JinbaoProtocol合约...");
  console.log("=".repeat(80));

  // 使用现有的代币地址
  const EXISTING_MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
  const EXISTING_JBC_TOKEN = "0xA743cB357a9f59D349efB7985072779a094658dD";



  try {
    const [deployer] = await ethers.getSigners();
    console.log("📋 部署账户:", deployer.address);
    console.log("💰 账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    console.log("");

    // 钱包地址配置 (使用部署者地址作为默认值)
    const WALLETS = {
      marketing: deployer.address,
      treasury: deployer.address, 
      lpInjection: deployer.address,
      buyback: deployer.address
    };

    // 验证现有代币合约
    console.log("🔍 验证现有代币合约...");
    console.log(`MC Token: ${EXISTING_MC_TOKEN}`);
    console.log(`JBC Token: ${EXISTING_JBC_TOKEN}`);
    
    const mcContract = await ethers.getContractAt("IERC20", EXISTING_MC_TOKEN);
    const jbcContract = await ethers.getContractAt("IERC20", EXISTING_JBC_TOKEN);
    
    // 检查代币余额
    const mcBalance = await mcContract.balanceOf(deployer.address);
    const jbcBalance = await jbcContract.balanceOf(deployer.address);
    
    console.log(`部署者MC余额: ${ethers.formatEther(mcBalance)} MC`);
    console.log(`部署者JBC余额: ${ethers.formatEther(jbcBalance)} JBC`);
    console.log("");

    // 1. 部署新的JinbaoProtocol合约（可升级版本）
    console.log("📦 部署JinbaoProtocol合约...");
    
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    
    const protocolProxy = await upgrades.deployProxy(
      JinbaoProtocol,
      [
        EXISTING_MC_TOKEN,
        EXISTING_JBC_TOKEN,
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
    
    console.log("✅ JinbaoProtocol代理地址:", protocolAddress);
    
    // 获取实现合约地址
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(protocolAddress);
    console.log("📋 实现合约地址:", implementationAddress);
    console.log("");

    // 2. 验证合约部署
    console.log("🔍 验证合约部署...");
    
    const protocol = await ethers.getContractAt("JinbaoProtocol", protocolAddress);
    
    // 检查基本配置
    const mcTokenAddr = await protocol.mcToken();
    const jbcTokenAddr = await protocol.jbcToken();
    const owner = await protocol.owner();
    
    console.log(`MC Token地址: ${mcTokenAddr} ${mcTokenAddr === EXISTING_MC_TOKEN ? '✅' : '❌'}`);
    console.log(`JBC Token地址: ${jbcTokenAddr} ${jbcTokenAddr === EXISTING_JBC_TOKEN ? '✅' : '❌'}`);
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

    // 3. 初始化Swap流动性
    console.log("💧 初始化Swap流动性...");
    
    // 初始流动性配置
    const INITIAL_MC_LIQUIDITY = ethers.parseEther("10000"); // 10,000 MC
    const INITIAL_JBC_LIQUIDITY = ethers.parseEther("10000"); // 10,000 JBC
    
    console.log(`准备添加流动性:`);
    console.log(`- MC: ${ethers.formatEther(INITIAL_MC_LIQUIDITY)} MC`);
    console.log(`- JBC: ${ethers.formatEther(INITIAL_JBC_LIQUIDITY)} JBC`);
    
    // 检查余额是否足够
    if (mcBalance < INITIAL_MC_LIQUIDITY) {
      console.log(`❌ MC余额不足! 需要: ${ethers.formatEther(INITIAL_MC_LIQUIDITY)}, 拥有: ${ethers.formatEther(mcBalance)}`);
      throw new Error("MC余额不足");
    }
    
    if (jbcBalance < INITIAL_JBC_LIQUIDITY) {
      console.log(`❌ JBC余额不足! 需要: ${ethers.formatEther(INITIAL_JBC_LIQUIDITY)}, 拥有: ${ethers.formatEther(jbcBalance)}`);
      throw new Error("JBC余额不足");
    }
    
    // 授权代币给协议合约
    console.log("🔐 授权代币给协议合约...");
    
    console.log("授权MC代币...");
    const mcApproveTx = await mcContract.approve(protocolAddress, INITIAL_MC_LIQUIDITY);
    await mcApproveTx.wait();
    console.log("✅ MC授权完成");
    
    console.log("授权JBC代币...");
    const jbcApproveTx = await jbcContract.approve(protocolAddress, INITIAL_JBC_LIQUIDITY);
    await jbcApproveTx.wait();
    console.log("✅ JBC授权完成");
    
    // 添加初始流动性
    console.log("💧 添加初始流动性...");
    const addLiquidityTx = await protocol.addLiquidity(INITIAL_MC_LIQUIDITY, INITIAL_JBC_LIQUIDITY);
    await addLiquidityTx.wait();
    console.log("✅ 初始流动性添加完成");
    
    // 验证流动性
    const swapReserveMC = await protocol.swapReserveMC();
    const swapReserveJBC = await protocol.swapReserveJBC();
    
    console.log(`Swap储备 MC: ${ethers.formatEther(swapReserveMC)} MC`);
    console.log(`Swap储备 JBC: ${ethers.formatEther(swapReserveJBC)} JBC`);
    console.log("");

    // 4. 测试基本功能
    console.log("🧪 测试基本功能...");
    
    // 测试价格查询
    const jbcPrice = await protocol.getJBCPrice();
    console.log(`JBC价格: ${ethers.formatEther(jbcPrice)} MC per JBC`);
    
    // 测试配置查询
    const directRewardPercent = await protocol.directRewardPercent();
    const levelRewardPercent = await protocol.levelRewardPercent();
    const liquidityEnabled = await protocol.liquidityEnabled();
    const redeemEnabled = await protocol.redeemEnabled();
    
    console.log(`直推奖励比例: ${directRewardPercent}%`);
    console.log(`层级奖励比例: ${levelRewardPercent}%`);
    console.log(`流动性启用: ${liquidityEnabled ? '是' : '否'}`);
    console.log(`赎回启用: ${redeemEnabled ? '是' : '否'}`);
    console.log("");

    // 5. 保存部署信息
    console.log("💾 保存部署信息...");
    
    const deploymentInfo = {
      network: "mc",
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: {
        mcToken: EXISTING_MC_TOKEN,
        jbcToken: EXISTING_JBC_TOKEN,
        protocolProxy: protocolAddress,
        protocolImplementation: implementationAddress
      },
      wallets: WALLETS,
      initialLiquidity: {
        mc: ethers.formatEther(INITIAL_MC_LIQUIDITY),
        jbc: ethers.formatEther(INITIAL_JBC_LIQUIDITY)
      },
      swapReserves: {
        mc: ethers.formatEther(swapReserveMC),
        jbc: ethers.formatEther(swapReserveJBC)
      },
      configuration: {
        directRewardPercent: directRewardPercent.toString(),
        levelRewardPercent: levelRewardPercent.toString(),
        liquidityEnabled,
        redeemEnabled,
        jbcPrice: ethers.formatEther(jbcPrice)
      }
    };
    
    const filename = `deployments/fresh-deployment-mc-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ 部署信息已保存: ${filename}`);
    console.log("");

    // 6. 生成前端更新指南
    console.log("📋 前端更新指南:");
    console.log("-".repeat(50));
    console.log("需要更新以下文件中的合约地址:");
    console.log("");
    console.log("src/Web3Context.tsx:");
    console.log(`  PROTOCOL: "${protocolAddress}"`);
    console.log("");
    console.log("其他需要更新的地方:");
    console.log("- 清除本地存储的用户数据");
    console.log("- 通知用户重新绑定推荐人");
    console.log("- 通知用户重新购买门票");
    console.log("- 通知用户重新授权代币");
    console.log("");

    // 7. 部署总结
    console.log("🎉 部署完成总结:");
    console.log("=".repeat(80));
    console.log(`✅ 新协议合约地址: ${protocolAddress}`);
    console.log(`✅ 使用现有MC代币: ${EXISTING_MC_TOKEN}`);
    console.log(`✅ 使用现有JBC代币: ${EXISTING_JBC_TOKEN}`);
    console.log(`✅ 初始MC流动性: ${ethers.formatEther(INITIAL_MC_LIQUIDITY)} MC`);
    console.log(`✅ 初始JBC流动性: ${ethers.formatEther(INITIAL_JBC_LIQUIDITY)} JBC`);
    console.log(`✅ 当前JBC价格: ${ethers.formatEther(jbcPrice)} MC per JBC`);
    console.log("");
    console.log("⚠️  重要提醒:");
    console.log("- 这是全新部署，所有历史数据已清空");
    console.log("- 用户需要重新开始（绑定推荐人、购买门票等）");
    console.log("- 前端需要更新合约地址");
    console.log("- 建议进行充分测试后再公告用户");
    console.log("");

  } catch (error) {
    console.error("❌ 部署失败:", error);
    throw error;
  }
}

main()
  .then(() => {
    console.log("🎉 全新部署成功完成!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 部署过程中出现错误:", error);
    process.exit(1);
  });