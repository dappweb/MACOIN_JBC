const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 部署新的测试环境合约 (分钟单位)...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);
  
  // 获取账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC");

  // 确保使用 MC Chain 网络
  const networkName = hre.network.name;
  console.log("🌐 当前网络:", networkName);
  
  if (networkName !== "mc") {
    console.log("⚠️  警告: 当前不在 MC Chain 网络");
    console.log("💡 请使用: npx hardhat run scripts/deploy-test-time-unit-new.cjs --network mc");
  }

  // 合约参数配置
  const contractParams = {
    jbcToken: "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da", // JBC Token 地址
    marketing: deployer.address, // 使用部署者作为营销钱包
    treasury: "0x5067d182d5f15511f0c71194a25cc67b05c20b02",
    lpInjection: "0x03c5d3cf3e358a00fa446e3376eab047d1ce46f2", 
    buyback: "0x979373c675c25e6cb2fd49b571dcadcb15a5a6d8"
  };

  console.log("\n📋 部署参数:");
  console.log("   JBC Token:", contractParams.jbcToken);
  console.log("   营销钱包:", contractParams.marketing);
  console.log("   国库钱包:", contractParams.treasury);
  console.log("   LP注入钱包:", contractParams.lpInjection);
  console.log("   回购钱包:", contractParams.buyback);

  try {
    // 编译合约
    console.log("\n📦 编译合约...");
    await hre.run("compile");

    // 获取合约工厂
    const JinbaoProtocolNative = await hre.ethers.getContractFactory("JinbaoProtocolNative");
    
    console.log("\n🚀 开始部署可升级合约...");
    console.log("   时间单位: 60秒 (分钟)");
    console.log("   质押周期: 7分钟、15分钟、30分钟");
    
    // 部署可升级合约
    const protocol = await upgrades.deployProxy(
      JinbaoProtocolNative,
      [
        contractParams.jbcToken,
        contractParams.marketing,
        contractParams.treasury,
        contractParams.lpInjection,
        contractParams.buyback
      ],
      {
        initializer: 'initialize',
        timeout: 300000, // 5分钟超时
        pollingInterval: 5000 // 5秒轮询间隔
      }
    );

    console.log("⏳ 等待部署交易确认...");
    await protocol.waitForDeployment();

    const proxyAddress = await protocol.getAddress();
    const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

    console.log("\n✅ 部署成功完成!");
    console.log("📍 代理合约地址:", proxyAddress);
    console.log("📍 实现合约地址:", implAddress);

    // 验证部署
    console.log("\n🔍 验证部署结果...");
    
    const deployedContract = await hre.ethers.getContractAt("JinbaoProtocolNative", proxyAddress);
    
    try {
      const secondsInUnit = await deployedContract.SECONDS_IN_UNIT();
      const owner = await deployedContract.owner();
      const jbcToken = await deployedContract.jbcToken();
      
      console.log("✅ 合约验证结果:");
      console.log("   - 时间单位:", secondsInUnit.toString(), "秒");
      console.log("   - 环境类型:", secondsInUnit.toString() === "60" ? "✅ 测试环境 (分钟)" : "❌ 生产环境 (天)");
      console.log("   - 合约所有者:", owner);
      console.log("   - JBC Token:", jbcToken);
      
      if (secondsInUnit.toString() !== "60") {
        throw new Error("❌ 时间单位配置错误，期望60秒，实际: " + secondsInUnit.toString());
      }

      // 测试质押周期计算
      console.log("\n📊 质押周期验证:");
      const cycles = [7, 15, 30];
      for (const cycle of cycles) {
        const totalSeconds = cycle * Number(secondsInUnit);
        const minutes = totalSeconds / 60;
        console.log(`   - ${cycle}周期 = ${minutes}分钟 (${totalSeconds}秒)`);
      }

    } catch (error) {
      console.log("❌ 合约验证失败:", error.message);
      throw error;
    }

    // 保存部署信息
    console.log("\n📝 保存部署配置...");
    
    const deploymentData = {
      network: "mc",
      chainId: "88813",
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contractType: "JinbaoProtocolNative",
      timeUnit: "minutes",
      secondsInUnit: 60,
      addresses: {
        protocolProxy: proxyAddress,
        protocolImplementation: implAddress,
        jbcToken: contractParams.jbcToken,
        marketingWallet: contractParams.marketing,
        treasuryWallet: contractParams.treasury,
        lpInjectionWallet: contractParams.lpInjection,
        buybackWallet: contractParams.buyback
      },
      features: [
        "Native MC token support (no ERC20 wrapper needed)",
        "Test environment with minute-based cycles",
        "SECONDS_IN_UNIT = 60 (minutes)",
        "Staking cycles: 7min, 15min, 30min",
        "Upgradeable UUPS proxy pattern",
        "All original features maintained"
      ],
      stakingCycles: {
        short: { duration: 7, unit: "minutes", rate: "1.33% per minute" },
        medium: { duration: 15, unit: "minutes", rate: "1.67% per minute" },
        long: { duration: 30, unit: "minutes", rate: "2.00% per minute" }
      }
    };

    // 保存到测试环境配置文件
    const testDeploymentPath = path.join(__dirname, '../deployments/test-mc.json');
    fs.writeFileSync(testDeploymentPath, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 测试环境配置已保存:", testDeploymentPath);

    // 创建部署记录
    const deploymentDir = path.join(__dirname, '../deployments/records');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    const recordPath = path.join(deploymentDir, `test-deployment-${Date.now()}.json`);
    fs.writeFileSync(recordPath, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署记录已保存:", recordPath);

    // 显示部署总结
    console.log("\n🎉 测试环境合约部署完成!");
    console.log("=" .repeat(60));
    console.log("📋 部署总结:");
    console.log("   ✅ 新合约使用分钟作为时间单位");
    console.log("   ✅ 质押周期: 7分钟、15分钟、30分钟");
    console.log("   ✅ 支持原生MC代币 (无需授权)");
    console.log("   ✅ 可升级合约架构");
    console.log("   ✅ 所有原有功能完整保留");
    
    console.log("\n📍 重要地址:");
    console.log("   测试合约地址:", proxyAddress);
    console.log("   实现合约地址:", implAddress);
    console.log("   JBC Token:", contractParams.jbcToken);
    
    console.log("\n⏱️ 测试时间表:");
    console.log("   - 7分钟质押: 约9.33%总收益 (1.33% × 7)");
    console.log("   - 15分钟质押: 约25%总收益 (1.67% × 15)");
    console.log("   - 30分钟质押: 约60%总收益 (2.00% × 30)");
    
    console.log("\n💡 下一步:");
    console.log("   1. 更新前端配置使用新的合约地址");
    console.log("   2. 测试购买门票和质押功能");
    console.log("   3. 验证时间单位自动检测");
    console.log("   4. 进行完整的用户流程测试");
    
    console.log("\n🔧 前端配置更新:");
    console.log("   将 Web3Context.tsx 中的 PROTOCOL_ADDRESS 更新为:");
    console.log("   " + proxyAddress);

  } catch (error) {
    console.log("\n❌ 部署失败:");
    console.error(error);
    
    console.log("\n🔧 故障排除建议:");
    console.log("1. 检查网络连接是否稳定");
    console.log("2. 确认账户余额足够支付gas费用");
    console.log("3. 验证所有钱包地址格式正确");
    console.log("4. 检查JBC Token地址是否有效");
    
    throw error;
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('❌ 未处理的错误:', error);
  process.exit(1);
});

main()
  .then(() => {
    console.log("\n✅ 测试环境部署脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 部署脚本执行失败:");
    console.error(error);
    process.exit(1);
  });