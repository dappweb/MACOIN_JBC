const { ethers } = require("ethers");

// 合约地址配置
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0x77601aC473dB1195A1A9c82229C9bD008a69987A",
};

// 钱包地址（从部署信息获取）
const WALLETS = {
  marketing: "0xdb817e0d21a134f649d24b91e39d42e7eec52a65",
  treasury: "0x5067d182d5f15511f0c71194a25cc67b05c20b02",
  lpInjection: "0x03c5d3cf3e358a00fa446e3376eab047d1ce46f2",
  buyback: "0x979373c675c25e6cb2fd49b571dcadcb15a5d6d8"
};

// RPC URLs
const RPC_URLS = [
  process.env.MC_RPC_URL,
  "https://rpc.mcchain.io",
  "https://chain.mcerscan.com/",
  "https://mcchain.io/rpc"
].filter(Boolean);

// Protocol ABI (只需要查询钱包地址的函数)
const PROTOCOL_ABI = [
  "function marketingWallet() view returns (address)",
  "function treasuryWallet() view returns (address)",
  "function lpInjectionWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function marketingPercent() view returns (uint256)",
  "function buybackPercent() view returns (uint256)",
  "function lpInjectionPercent() view returns (uint256)",
  "function treasuryPercent() view returns (uint256)",
];

/**
 * 获取可用的 Provider
 */
async function getProvider() {
  for (const url of RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
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
  console.log("🔍 检查门票购买金额分配钱包状态");
  console.log("=".repeat(60));
  console.log();

  try {
    // 1. 连接 Provider
    const provider = await getProvider();
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 当前区块高度: ${currentBlock.toLocaleString()}`);
    console.log();

    // 2. 创建合约实例
    const protocolContract = new ethers.Contract(
      CONTRACT_ADDRESSES.PROTOCOL,
      PROTOCOL_ABI,
      provider
    );

    console.log("📋 协议合约地址:");
    console.log(`   ${CONTRACT_ADDRESSES.PROTOCOL}`);
    console.log();

    // 3. 查询合约中的钱包地址和分配比例
    console.log("⚙️  合约配置:");
    try {
      const [
        contractMarketingWallet,
        contractTreasuryWallet,
        contractLpWallet,
        contractBuybackWallet,
        marketingPercent,
        buybackPercent,
        lpPercent,
        treasuryPercent
      ] = await Promise.all([
        protocolContract.marketingWallet().catch(() => ethers.ZeroAddress),
        protocolContract.treasuryWallet().catch(() => ethers.ZeroAddress),
        protocolContract.lpInjectionWallet().catch(() => ethers.ZeroAddress),
        protocolContract.buybackWallet().catch(() => ethers.ZeroAddress),
        protocolContract.marketingPercent().catch(() => 0n),
        protocolContract.buybackPercent().catch(() => 0n),
        protocolContract.lpInjectionPercent().catch(() => 0n),
        protocolContract.treasuryPercent().catch(() => 0n),
      ]);

      console.log(`   营销钱包: ${contractMarketingWallet}`);
      console.log(`   国库钱包: ${contractTreasuryWallet}`);
      console.log(`   流动性钱包: ${contractLpWallet}`);
      console.log(`   回购钱包: ${contractBuybackWallet}`);
      console.log();
      console.log(`   营销比例: ${Number(marketingPercent)}%`);
      console.log(`   回购比例: ${Number(buybackPercent)}%`);
      console.log(`   流动性比例: ${Number(lpPercent)}%`);
      console.log(`   国库比例: ${Number(treasuryPercent)}%`);
      console.log();
    } catch (error) {
      console.log("   ⚠️  无法获取合约配置:", error.message);
    }

    // 4. 查询各钱包余额
    console.log("💰 钱包余额:");
    console.log();

    const walletInfo = [
      { name: "营销钱包", address: WALLETS.marketing, percent: 5 },
      { name: "国库钱包", address: WALLETS.treasury, percent: 25 },
      { name: "流动性钱包", address: WALLETS.lpInjection, percent: 25 },
      { name: "回购钱包", address: WALLETS.buyback, percent: 5 },
    ];

    for (const wallet of walletInfo) {
      try {
        const balance = await provider.getBalance(wallet.address);
        const balanceFormatted = formatNumber(balance);
        
        console.log(`   ${wallet.name} (${wallet.percent}%):`);
        console.log(`     地址: ${wallet.address}`);
        console.log(`     余额: ${balanceFormatted} MC`);
        console.log();
      } catch (error) {
        console.log(`   ${wallet.name}:`);
        console.log(`     地址: ${wallet.address}`);
        console.log(`     ⚠️  查询失败: ${error.message}`);
        console.log();
      }
    }

    // 5. 计算示例分配
    console.log("📊 示例分配（购买 1000 MC 门票）:");
    console.log();
    
    const ticketAmount = 1000;
    walletInfo.forEach(wallet => {
      const allocation = ticketAmount * wallet.percent / 100;
      console.log(`   ${wallet.name}: ${allocation} MC (${wallet.percent}%)`);
    });
    console.log();

    // 6. 总结
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







