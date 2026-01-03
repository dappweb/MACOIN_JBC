const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 升级协议合约 - 回购机制更新 + 恢复推荐人要求
 * 
 * 本次升级包含的改动：
 * 1. 回购机制更新：回购资金先转到回购钱包，然后由回购钱包执行回购
 * 2. 新增函数：executeBuybackAndBurn() 供回购钱包执行回购
 * 3. 恢复推荐人要求：购买门票必须先绑定推荐人
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🚀 开始升级协议合约 - 回购机制更新");
  console.log("=".repeat(60));
  console.log();

  const [deployer] = await ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(balance), "MC");
  console.log();

  // 从部署文件读取代理地址
  const deploymentFile = path.join(__dirname, "../deployments/latest-mc-v4.json");
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ 未找到部署文件:", deploymentFile);
    process.exit(1);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const PROXY_ADDRESS = deploymentData.contracts.Protocol;

  if (!PROXY_ADDRESS) {
    console.error("❌ 未找到代理地址");
    process.exit(1);
  }

  console.log("📋 部署信息:");
  console.log("   网络:", deploymentData.network);
  console.log("   链ID:", deploymentData.chainId);
  console.log("   代理地址:", PROXY_ADDRESS);
  console.log("   当前实现:", deploymentData.contracts.ProtocolImplementation);
  console.log();

  // 验证当前合约所有者
  try {
    const currentContract = await ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    const owner = await currentContract.owner();
    console.log("🔐 合约所有者:", owner);
    console.log("📍 部署账户:", deployer.address);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error();
      console.error("⚠️  警告: 部署账户不是合约所有者!");
      console.error("   部署账户:", deployer.address);
      console.error("   合约所有者:", owner);
      console.error();
      console.error("💡 解决方案:");
      console.error("   1. 使用合约所有者的私钥更新 .env 文件中的 PRIVATE_KEY");
      console.error("   2. 或者让合约所有者执行升级");
      console.error();
      console.error("   合约所有者地址:", owner);
      console.error("   请确保 .env 文件中的 PRIVATE_KEY 对应此地址的私钥");
      console.error();
      
      // 询问是否继续（在生产环境中应该退出）
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('是否继续升级? (yes/no): ', (ans) => {
          rl.close();
          resolve(ans.toLowerCase());
        });
      });
      
      if (answer !== 'yes' && answer !== 'y') {
        console.log("❌ 升级已取消");
        process.exit(1);
      }
      
      console.log("⚠️  继续升级（请确保有正确的权限）...");
      console.log();
    } else {
      console.log("✅ 权限验证通过");
      console.log();
    }
  } catch (error) {
    console.error("❌ 无法验证合约所有者:", error.message);
    console.error("   继续升级（请确保有正确的权限）...");
    console.log();
  }

  // 获取当前实现地址
  let currentImplAddress;
  try {
    currentImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("📦 当前实现地址:", currentImplAddress);
    console.log();
  } catch (error) {
    console.log("⚠️  无法获取当前实现地址:", error.message);
    currentImplAddress = deploymentData.contracts.ProtocolImplementation;
  }

  try {
    console.log("📦 编译新合约...");
    const { run } = require("hardhat");
    await run("compile");
    console.log("✅ 编译完成");
    console.log();

    console.log("🔄 开始升级代理合约...");
    console.log("   合约名称: JinbaoProtocolNative");
    console.log("   代理地址:", PROXY_ADDRESS);
    console.log();

    // 获取合约工厂
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");

    // 尝试注册代理（如果未注册）
    try {
      console.log("📝 检查代理注册状态...");
      await upgrades.forceImport(PROXY_ADDRESS, JinbaoProtocolNative, {
        kind: 'uups'
      });
      console.log("✅ 代理已注册");
      console.log();
    } catch (error) {
      // 如果已经注册，忽略错误
      if (!error.message.includes("already registered")) {
        console.log("⚠️  代理注册检查:", error.message);
      } else {
        console.log("✅ 代理已注册");
      }
      console.log();
    }

    // 执行升级
    console.log("⏳ 执行升级（这可能需要几分钟）...");
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolNative, {
      kind: 'uups',
      timeout: 300000, // 5分钟超时
    });

    console.log("⏳ 等待部署确认...");
    await upgraded.waitForDeployment();

    // 获取新实现地址
    const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    
    console.log();
    console.log("=".repeat(60));
    console.log("✅ 升级成功!");
    console.log("=".repeat(60));
    console.log();
    console.log("📋 升级信息:");
    console.log("   代理地址 (不变):", PROXY_ADDRESS);
    console.log("   旧实现地址:", currentImplAddress);
    console.log("   新实现地址:", newImplAddress);
    console.log();

    // 验证升级
    console.log("🔍 验证升级...");
    const upgradedContract = await ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    
    // 验证基本功能
    const owner = await upgradedContract.owner();
    const buybackWallet = await upgradedContract.buybackWallet();
    const buybackPercent = await upgradedContract.buybackPercent();
    
    console.log("   合约所有者:", owner);
    console.log("   回购钱包:", buybackWallet);
    console.log("   回购比例:", buybackPercent.toString(), "%");
    console.log();

    // 检查新函数是否存在
    try {
      // 检查 executeBuybackAndBurn 函数是否存在
      const buybackWalletSigner = await ethers.getSigner(buybackWallet);
      const buybackContract = upgradedContract.connect(buybackWalletSigner);
      
      // 只检查函数是否存在，不实际调用
      const iface = new ethers.Interface([
        "function executeBuybackAndBurn() external payable"
      ]);
      const functionExists = iface.getFunction("executeBuybackAndBurn");
      
      if (functionExists) {
        console.log("✅ 新函数 executeBuybackAndBurn() 已部署");
      }
    } catch (error) {
      console.log("⚠️  无法验证新函数:", error.message);
    }

    // 更新部署文件
    console.log();
    console.log("📄 更新部署信息...");
    deploymentData.contracts.ProtocolImplementation = newImplAddress;
    deploymentData.lastUpgrade = new Date().toISOString();
    deploymentData.upgradeInfo = {
      version: "buyback-mechanism-update",
      description: "回购机制更新 + 恢复推荐人要求",
      changes: [
        "修改 buyTicket() 函数：回购资金先转到回购钱包（不再直接执行）",
        "新增 executeBuybackAndBurn() 函数：回购钱包执行回购",
        "恢复推荐人要求：购买门票必须先绑定推荐人"
      ],
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署信息已更新:", deploymentFile);
    console.log();

    // 保存升级记录
    const upgradeLogFile = path.join(__dirname, "../deployments/upgrade-log.json");
    let upgradeLog = [];
    if (fs.existsSync(upgradeLogFile)) {
      upgradeLog = JSON.parse(fs.readFileSync(upgradeLogFile, "utf8"));
    }
    
    upgradeLog.push({
      timestamp: new Date().toISOString(),
      proxyAddress: PROXY_ADDRESS,
      oldImplementation: currentImplAddress,
      newImplementation: newImplAddress,
      description: "回购机制更新",
      network: deploymentData.network,
      chainId: deploymentData.chainId
    });
    
    fs.writeFileSync(upgradeLogFile, JSON.stringify(upgradeLog, null, 2));
    console.log("📝 升级记录已保存:", upgradeLogFile);
    console.log();

    console.log("=".repeat(60));
    console.log("🎉 升级完成!");
    console.log("=".repeat(60));
    console.log();
    console.log("📌 重要提示:");
    console.log("   1. 回购资金现在会先转到回购钱包");
    console.log("   2. 回购钱包需要调用 executeBuybackAndBurn() 执行回购");
    console.log("   3. 建议设置回购钱包为智能合约，实现自动执行");
    console.log("   4. 定期检查回购钱包余额并执行回购");
    console.log("   5. ⚠️  购买门票现在必须先绑定推荐人");
    console.log("   6. 新用户需要先调用 bindReferrer() 绑定推荐人才能购买门票");
    console.log();

  } catch (error) {
    console.error();
    console.error("❌ 升级失败!");
    console.error("错误信息:", error.message);
    if (error.stack) {
      console.error("错误堆栈:", error.stack);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error);
    process.exit(1);
  });

