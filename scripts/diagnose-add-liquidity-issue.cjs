/**
 * 诊断脚本：检查管理员无法添加 swap pool 的原因
 * 
 * 使用方法：
 * 1. 在项目根目录运行: node scripts/diagnose-add-liquidity-issue.cjs
 * 2. 或者使用 hardhat: npx hardhat run scripts/diagnose-add-liquidity-issue.cjs --network <network>
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log("\n🔍 开始诊断：管理员无法添加 Swap Pool 问题\n", 'cyan');
  
  // 1. 加载部署地址
  let protocolAddress, jbcAddress;
  try {
    const deploymentPath = path.join(__dirname, '../deployments.json');
    if (fs.existsSync(deploymentPath)) {
      const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      protocolAddress = deployments.protocol;
      jbcAddress = deployments.jbc;
      log(`✅ 从 deployments.json 加载地址`, 'green');
    } else {
      // 尝试从环境变量或硬编码地址
      protocolAddress = process.env.PROTOCOL_ADDRESS || "0x298578A691f10A85f027BDD2D9a8D007540FCBB4";
      jbcAddress = process.env.JBC_ADDRESS;
      log(`⚠️  使用默认/环境变量地址`, 'yellow');
    }
  } catch (error) {
    log(`❌ 加载部署地址失败: ${error.message}`, 'red');
    process.exit(1);
  }

  if (!protocolAddress) {
    log("❌ 未找到协议合约地址，请设置 PROTOCOL_ADDRESS 环境变量", 'red');
    process.exit(1);
  }

  log(`\n📋 合约地址:`, 'blue');
  log(`   协议合约: ${protocolAddress}`, 'reset');
  if (jbcAddress) {
    log(`   JBC合约: ${jbcAddress}`, 'reset');
  }

  // 2. 获取签名者
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  log(`\n👤 当前账户: ${signerAddress}`, 'blue');

  // 3. 获取合约实例
  let protocolContract, jbcContract;
  try {
    const protocolABI = require("../artifacts/contracts/JinbaoProtocolNative.sol/JinbaoProtocolNative.json").abi;
    protocolContract = new ethers.Contract(protocolAddress, protocolABI, signer);
    log(`✅ 协议合约连接成功`, 'green');
  } catch (error) {
    log(`❌ 连接协议合约失败: ${error.message}`, 'red');
    process.exit(1);
  }

  if (jbcAddress) {
    try {
      const jbcABI = require("../artifacts/contracts/JBC.sol/JBC.json").abi;
      jbcContract = new ethers.Contract(jbcAddress, jbcABI, signer);
      log(`✅ JBC合约连接成功`, 'green');
    } catch (error) {
      log(`⚠️  连接JBC合约失败: ${error.message}`, 'yellow');
      log(`   继续诊断其他问题...`, 'yellow');
    }
  }

  // 4. 检查权限（Owner）
  log(`\n🔐 检查权限...`, 'cyan');
  try {
    const owner = await protocolContract.owner();
    const isOwner = owner.toLowerCase() === signerAddress.toLowerCase();
    
    log(`   合约Owner: ${owner}`, 'reset');
    log(`   当前账户: ${signerAddress}`, 'reset');
    
    if (isOwner) {
      log(`   ✅ 权限检查通过：当前账户是合约Owner`, 'green');
    } else {
      log(`   ❌ 权限检查失败：当前账户不是合约Owner`, 'red');
      log(`   💡 解决方案：使用正确的Owner地址或联系合约Owner`, 'yellow');
    }
  } catch (error) {
    log(`   ❌ 检查Owner失败: ${error.message}`, 'red');
  }

  // 5. 检查MC余额
  log(`\n💰 检查MC余额...`, 'cyan');
  try {
    const mcBalance = await signer.provider.getBalance(signerAddress);
    const mcBalanceFormatted = ethers.formatEther(mcBalance);
    log(`   MC余额: ${mcBalanceFormatted} MC`, 'reset');
    
    if (mcBalance === 0n) {
      log(`   ⚠️  MC余额为0，无法支付Gas费用或添加MC流动性`, 'yellow');
    } else if (mcBalance < ethers.parseEther("0.01")) {
      log(`   ⚠️  MC余额较低，可能不足以支付Gas费用`, 'yellow');
    } else {
      log(`   ✅ MC余额充足`, 'green');
    }
  } catch (error) {
    log(`   ❌ 检查MC余额失败: ${error.message}`, 'red');
  }

  // 6. 检查JBC余额和授权
  if (jbcContract) {
    log(`\n🪙 检查JBC余额和授权...`, 'cyan');
    try {
      const jbcBalance = await jbcContract.balanceOf(signerAddress);
      const jbcBalanceFormatted = ethers.formatEther(jbcBalance);
      log(`   JBC余额: ${jbcBalanceFormatted} JBC`, 'reset');
      
      if (jbcBalance === 0n) {
        log(`   ⚠️  JBC余额为0，无法添加JBC流动性`, 'yellow');
      } else {
        log(`   ✅ JBC余额充足`, 'green');
      }

      // 检查授权
      const allowance = await jbcContract.allowance(signerAddress, protocolAddress);
      const allowanceFormatted = ethers.formatEther(allowance);
      log(`   JBC授权额度: ${allowanceFormatted} JBC`, 'reset');
      
      if (allowance === 0n) {
        log(`   ⚠️  JBC未授权，需要先授权才能添加JBC流动性`, 'yellow');
        log(`   💡 解决方案：调用 jbcContract.approve(${protocolAddress}, MaxUint256)`, 'yellow');
      } else if (allowance < ethers.parseEther("1000")) {
        log(`   ⚠️  JBC授权额度较低，可能不足以添加大量流动性`, 'yellow');
      } else {
        log(`   ✅ JBC授权充足`, 'green');
      }
    } catch (error) {
      log(`   ❌ 检查JBC失败: ${error.message}`, 'red');
    }
  } else {
    log(`\n⚠️  跳过JBC检查（未找到JBC合约地址）`, 'yellow');
  }

  // 7. 检查当前池子状态
  log(`\n🏊 检查当前池子状态...`, 'cyan');
  try {
    const poolMC = await protocolContract.swapReserveMC();
    const poolJBC = await protocolContract.swapReserveJBC();
    log(`   池子MC储备: ${ethers.formatEther(poolMC)} MC`, 'reset');
    log(`   池子JBC储备: ${ethers.formatEther(poolJBC)} JBC`, 'reset');
    
    if (poolMC === 0n && poolJBC === 0n) {
      log(`   ⚠️  池子为空，需要初始化`, 'yellow');
    } else {
      log(`   ✅ 池子已有流动性`, 'green');
    }
  } catch (error) {
    log(`   ❌ 检查池子状态失败: ${error.message}`, 'red');
  }

  // 8. 测试静态调用
  log(`\n🧪 测试静态调用（模拟添加流动性）...`, 'cyan');
  try {
    const testJbcAmount = ethers.parseEther("1");
    const testMcAmount = ethers.parseEther("1");
    
    // 检查是否有权限
    const owner = await protocolContract.owner();
    const isOwner = owner.toLowerCase() === signerAddress.toLowerCase();
    
    if (!isOwner) {
      log(`   ⚠️  跳过测试（当前账户不是Owner）`, 'yellow');
    } else {
      try {
        await protocolContract.addLiquidity.staticCall(testJbcAmount, {
          value: testMcAmount
        });
        log(`   ✅ 静态调用成功，理论上可以添加流动性`, 'green');
      } catch (staticError) {
        log(`   ❌ 静态调用失败: ${staticError.message}`, 'red');
        if (staticError.reason) {
          log(`   失败原因: ${staticError.reason}`, 'red');
        }
        
        // 解析常见错误
        if (staticError.message.includes('OwnableUnauthorizedAccount')) {
          log(`   💡 原因：权限不足（不是Owner）`, 'yellow');
        } else if (staticError.message.includes('TransferFromFailed') || 
                   staticError.message.includes('allowance')) {
          log(`   💡 原因：JBC授权不足`, 'yellow');
        } else if (staticError.message.includes('InsufficientBalance')) {
          log(`   💡 原因：余额不足`, 'yellow');
        }
      }
    }
  } catch (error) {
    log(`   ❌ 测试失败: ${error.message}`, 'red');
  }

  // 9. 检查网络
  log(`\n🌐 检查网络信息...`, 'cyan');
  try {
    const network = await signer.provider.getNetwork();
    log(`   链ID: ${network.chainId}`, 'reset');
    log(`   网络名称: ${network.name}`, 'reset');
    
    // MC Chain 的链ID通常是 88813
    if (network.chainId.toString() === "88813") {
      log(`   ✅ 网络正确（MC Chain）`, 'green');
    } else {
      log(`   ⚠️  网络可能不正确，MC Chain 的链ID应该是 88813`, 'yellow');
    }
  } catch (error) {
    log(`   ❌ 检查网络失败: ${error.message}`, 'red');
  }

  // 10. 总结
  log(`\n📊 诊断总结:`, 'cyan');
  log(`   请根据上述检查结果，确认问题所在。`, 'reset');
  log(`   常见问题：`, 'reset');
  log(`   1. 权限问题：当前账户不是合约Owner`, 'reset');
  log(`   2. 余额问题：MC或JBC余额不足`, 'reset');
  log(`   3. 授权问题：JBC未授权或授权不足`, 'reset');
  log(`   4. 网络问题：连接到错误的网络`, 'reset');
  log(`\n💡 更多信息请查看: docs/ADMIN_ADD_SWAP_POOL_ISSUES.md\n`, 'cyan');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log(`\n❌ 诊断过程出错: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

