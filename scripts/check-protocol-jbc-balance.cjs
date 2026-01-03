const { ethers } = require("ethers");

// 合约地址配置
const CONTRACT_ADDRESSES = {
  JBC_TOKEN: "0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D",
  PROTOCOL: "0x77601aC473dB1195A1A9c82229C9bD008a69987A",
};

// RPC URLs (按优先级排序)
const RPC_URLS = [
  process.env.MC_RPC_URL,
  "https://rpc.mcchain.io",
  "https://chain.mcerscan.com/",
  "https://mcchain.io/rpc"
].filter(Boolean);

// JBC Token ABI (只需要 balanceOf 函数)
const JBC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

// Protocol Contract ABI (查询交换储备)
const PROTOCOL_ABI = [
  "function swapReserveMC() external view returns (uint256)",
  "function swapReserveJBC() external view returns (uint256)",
];

/**
 * 获取可用的 Provider
 */
async function getProvider() {
  for (const url of RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      // 测试连接
      await provider.getBlockNumber();
      console.log("✅ 使用 RPC URL:", url);
      return provider;
    } catch (error) {
      console.log("⚠️  RPC URL 不可用:", url);
      continue;
    }
  }
  throw new Error("❌ 所有 RPC URL 都不可用");
}

/**
 * 格式化大数字
 */
function formatNumber(value, decimals = 18) {
  const formatted = ethers.formatEther(value);
  return parseFloat(formatted).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

/**
 * 主函数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🔍 检查协议合约 JBC 余额");
  console.log("=".repeat(60));
  console.log();

  try {
    // 1. 连接 Provider
    const provider = await getProvider();
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 当前区块高度: ${currentBlock.toLocaleString()}`);
    console.log();

    // 2. 创建合约实例
    const jbcToken = new ethers.Contract(
      CONTRACT_ADDRESSES.JBC_TOKEN,
      JBC_ABI,
      provider
    );

    const protocolContract = new ethers.Contract(
      CONTRACT_ADDRESSES.PROTOCOL,
      PROTOCOL_ABI,
      provider
    );

    console.log("📋 合约地址:");
    console.log(`   JBC Token: ${CONTRACT_ADDRESSES.JBC_TOKEN}`);
    console.log(`   Protocol:  ${CONTRACT_ADDRESSES.PROTOCOL}`);
    console.log();

    // 3. 查询 JBC 总供应量
    console.log("📊 JBC 代币信息:");
    try {
      const totalSupply = await jbcToken.totalSupply();
      const decimals = await jbcToken.decimals();
      console.log(`   总供应量: ${formatNumber(totalSupply, decimals)} JBC`);
      console.log(`   小数位数: ${decimals}`);
    } catch (error) {
      console.log("   ⚠️  无法获取总供应量:", error.message);
    }
    console.log();

    // 4. 查询协议合约的 JBC 余额
    console.log("💰 协议合约 JBC 余额:");
    const protocolBalance = await jbcToken.balanceOf(CONTRACT_ADDRESSES.PROTOCOL);
    const balanceFormatted = formatNumber(protocolBalance);
    console.log(`   余额: ${balanceFormatted} JBC`);
    console.log(`   原始值: ${protocolBalance.toString()}`);
    console.log();

    // 5. 查询交换储备池
    console.log("💧 交换储备池状态:");
    try {
      const reserveMC = await protocolContract.swapReserveMC();
      const reserveJBC = await protocolContract.swapReserveJBC();
      
      console.log(`   MC 储备: ${formatNumber(reserveMC)} MC`);
      console.log(`   JBC 储备: ${formatNumber(reserveJBC)} JBC`);
      
      if (reserveMC > 0n && reserveJBC > 0n) {
        const jbcPrice = Number(reserveMC) / Number(reserveJBC);
        console.log(`   JBC 价格: 1 JBC = ${jbcPrice.toFixed(6)} MC`);
      } else {
        console.log(`   ⚠️  储备池流动性不足`);
      }
    } catch (error) {
      console.log("   ⚠️  无法获取储备池信息:", error.message);
    }
    console.log();

    // 6. 计算和分析
    console.log("📈 分析:");
    const totalSupply = await jbcToken.totalSupply().catch(() => null);
    if (totalSupply) {
      const totalSupplyNum = Number(ethers.formatEther(totalSupply));
      const protocolBalanceNum = Number(ethers.formatEther(protocolBalance));
      const percentage = (protocolBalanceNum / totalSupplyNum) * 100;
      
      console.log(`   协议合约持有: ${percentage.toFixed(2)}% 的总供应量`);
      
      // 初始分配应该是 95,000,000 JBC
      const initialAllocation = 95_000_000;
      const remaining = protocolBalanceNum;
      const used = initialAllocation - remaining;
      const usedPercentage = (used / initialAllocation) * 100;
      
      console.log(`   初始分配: ${initialAllocation.toLocaleString()} JBC`);
      console.log(`   已使用: ${used.toLocaleString()} JBC (${usedPercentage.toFixed(2)}%)`);
      console.log(`   剩余: ${remaining.toLocaleString()} JBC`);
      
      // 预警
      if (percentage < 10) {
        console.log();
        console.log("   ⚠️  警告: 协议合约 JBC 余额低于总供应量的 10%");
      }
      if (remaining < 1_000_000) {
        console.log();
        console.log("   🚨 严重警告: 协议合约 JBC 余额不足 100 万，可能影响奖励分配！");
      }
    }
    console.log();

    // 7. 总结
    console.log("=".repeat(60));
    console.log("✅ 检查完成");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 执行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error);
    process.exit(1);
  });

