#!/usr/bin/env node
/**
 * 快速诊断和修复添加流动性问题
 * Quick diagnostic and fix for Add Liquidity issues
 */

const { ethers } = require('ethers');
require('dotenv').config();

// Colors
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

// 合约地址 (从 Web3Context.tsx)
const CONTRACT_ADDRESSES = {
  JBC_TOKEN: "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da",
  PROTOCOL: "0x0897Cee05E43B2eCf331cd80f881c211eb86844E",
};

// ABIs
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function addLiquidity(uint256 jbcAmount) external payable",
];

const JBC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

async function main() {
  log("\n🔍 快速诊断：添加流动性池失败问题\n", 'cyan');
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", 'cyan');

  // 连接到 MC Chain
  const rpcUrl = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    log("❌ 错误：未找到 PRIVATE_KEY 环境变量", 'red');
    log("请在 .env 文件中设置 PRIVATE_KEY", 'yellow');
    process.exit(1);
  }

  log(`📡 连接到 MC Chain RPC: ${rpcUrl}`, 'blue');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = wallet.address;

  log(`👤 当前账户: ${address}\n`, 'blue');

  // 连接合约
  const protocolContract = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, wallet);
  const jbcContract = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, JBC_ABI, wallet);

  // 检查1: 权限
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  log("1️⃣  检查权限（Owner）", 'cyan');
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  try {
    const owner = await protocolContract.owner();
    const isOwner = owner.toLowerCase() === address.toLowerCase();
    
    log(`   合约 Owner: ${owner}`, 'reset');
    log(`   当前账户: ${address}`, 'reset');
    
    if (isOwner) {
      log(`   ✅ 您是合约 Owner，权限检查通过\n`, 'green');
    } else {
      log(`   ❌ 您不是合约 Owner，无法添加流动性\n`, 'red');
      log(`💡 解决方案：`, 'yellow');
      log(`   - 使用正确的 Owner 地址（私钥）`, 'yellow');
      log(`   - 或联系合约 Owner 添加流动性\n`, 'yellow');
      process.exit(1);
    }
  } catch (error) {
    log(`   ❌ 检查 Owner 失败: ${error.message}\n`, 'red');
    process.exit(1);
  }

  // 检查2: 余额
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  log("2️⃣  检查余额", 'cyan');
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  try {
    const mcBalance = await provider.getBalance(address);
    const jbcBalance = await jbcContract.balanceOf(address);
    
    log(`   MC 余额: ${ethers.formatEther(mcBalance)} MC`, 'reset');
    log(`   JBC 余额: ${ethers.formatEther(jbcBalance)} JBC`, 'reset');
    
    if (mcBalance < ethers.parseEther("0.01")) {
      log(`   ⚠️  MC 余额较低，可能不足以支付 Gas 费用`, 'yellow');
    } else {
      log(`   ✅ MC 余额充足`, 'green');
    }
    
    if (jbcBalance > 0) {
      log(`   ✅ JBC 余额充足\n`, 'green');
    } else {
      log(`   ⚠️  JBC 余额为 0，无法添加 JBC 流动性\n`, 'yellow');
    }
  } catch (error) {
    log(`   ❌ 检查余额失败: ${error.message}\n`, 'red');
  }

  // 检查3: JBC 授权
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  log("3️⃣  检查 JBC 授权（最重要！）", 'cyan');
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  try {
    const allowance = await jbcContract.allowance(address, CONTRACT_ADDRESSES.PROTOCOL);
    const allowanceFormatted = ethers.formatEther(allowance);
    
    log(`   当前授权额度: ${allowanceFormatted} JBC`, 'reset');
    
    if (allowance === 0n) {
      log(`   ❌ JBC 未授权！这很可能是问题所在\n`, 'red');
      log(`💡 是否现在授权 JBC 代币？(y/n)`, 'yellow');
      
      // 自动授权（生产环境应该让用户确认）
      log(`   正在授权 JBC 代币...`, 'yellow');
      const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, ethers.MaxUint256);
      log(`   📝 授权交易已发送: ${approveTx.hash}`, 'blue');
      log(`   ⏳ 等待交易确认...`, 'yellow');
      
      const receipt = await approveTx.wait();
      log(`   ✅ JBC 授权成功！区块: ${receipt.blockNumber}\n`, 'green');
      
    } else if (allowance < ethers.parseEther("1000")) {
      log(`   ⚠️  JBC 授权额度较低`, 'yellow');
      log(`   建议重新授权以避免问题\n`, 'yellow');
    } else {
      log(`   ✅ JBC 授权充足\n`, 'green');
    }
  } catch (error) {
    log(`   ❌ 检查/授权 JBC 失败: ${error.message}\n`, 'red');
    if (error.message.includes('user rejected') || error.message.includes('User denied')) {
      log(`   用户取消了授权\n`, 'yellow');
    }
  }

  // 检查4: 池子状态
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  log("4️⃣  检查池子状态", 'cyan');
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  try {
    const poolMC = await protocolContract.swapReserveMC();
    const poolJBC = await protocolContract.swapReserveJBC();
    
    log(`   池子 MC 储备: ${ethers.formatEther(poolMC)} MC`, 'reset');
    log(`   池子 JBC 储备: ${ethers.formatEther(poolJBC)} JBC`, 'reset');
    
    if (poolMC === 0n && poolJBC === 0n) {
      log(`   ⚠️  池子为空，这是第一次添加流动性\n`, 'yellow');
    } else {
      log(`   ✅ 池子已有流动性\n`, 'green');
    }
  } catch (error) {
    log(`   ❌ 检查池子失败: ${error.message}\n`, 'red');
  }

  // 检查5: 网络
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  log("5️⃣  检查网络", 'cyan');
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  try {
    const network = await provider.getNetwork();
    log(`   链 ID: ${network.chainId}`, 'reset');
    log(`   网络名称: ${network.name}`, 'reset');
    
    if (network.chainId.toString() === "88813") {
      log(`   ✅ 网络正确（MC Chain）\n`, 'green');
    } else {
      log(`   ⚠️  网络可能不正确，MC Chain 的链 ID 应该是 88813\n`, 'yellow');
    }
  } catch (error) {
    log(`   ❌ 检查网络失败: ${error.message}\n`, 'red');
  }

  // 总结
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  log("📊 诊断总结", 'cyan');
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan');
  log("\n✅ 诊断完成！", 'green');
  log("\n💡 常见问题解决方案：", 'yellow');
  log("   1. 如果 JBC 未授权 → 运行此脚本会自动授权", 'reset');
  log("   2. 如果不是 Owner → 使用正确的私钥", 'reset');
  log("   3. 如果余额不足 → 充值 MC 或 JBC", 'reset');
  log("   4. 如果网络错误 → 检查 RPC URL 和钱包网络设置\n", 'reset');
  
  log("📖 详细诊断文档:", 'cyan');
  log("   查看 liquidity_error_diagnosis.md 获取更多信息\n", 'reset');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log(`\n❌ 脚本执行失败: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
