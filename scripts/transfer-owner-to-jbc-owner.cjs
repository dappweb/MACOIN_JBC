const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const JBC_TOKEN_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";
const JBC_TOKEN_OWNER = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "function marketingWallet() view returns (address)",
  "function treasuryWallet() view returns (address)",
  "function lpInjectionWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function jbcToken() view returns (address)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
];

async function transferOwnerToJbcOwner() {
  // 从环境变量或命令行参数获取 JBC Token Owner 私钥
  const JBC_TOKEN_OWNER_PRIVATE_KEY = process.env.JBC_TOKEN_OWNER_PRIVATE_KEY || process.argv[2];

  if (!JBC_TOKEN_OWNER_PRIVATE_KEY) {
    console.error("❌ 错误: 请提供 JBC Token Owner 的私钥");
    console.log("\n使用方法:");
    console.log("  JBC_TOKEN_OWNER_PRIVATE_KEY=0x... node scripts/transfer-owner-to-jbc-owner.cjs");
    console.log("  或");
    console.log("  node scripts/transfer-owner-to-jbc-owner.cjs <JBC Token Owner私钥>");
    console.log("\n注意:");
    console.log("  - JBC Token Owner 地址: 0x4C10831CBcF9884ba72051b5287b6c87E4F74A48");
    console.log("  - 新 Owner 将是: 0x4C10831CBcF9884ba72051b5287b6c87E4F74A48 (JBC Token Owner)");
    console.log("  - 确保 JBC Token Owner 有足够的 MC 支付 Gas 费用");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(JBC_TOKEN_OWNER_PRIVATE_KEY, provider);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔐 将协议 Owner 转移给 JBC Token Owner\n");
  console.log("=" .repeat(60));
  console.log(`协议合约地址: ${PROTOCOL_ADDRESS}`);
  console.log(`JBC Token 地址: ${JBC_TOKEN_ADDRESS}`);
  console.log(`JBC Token Owner: ${JBC_TOKEN_OWNER}`);
  console.log(`当前签名者: ${wallet.address}`);
  console.log(`新 Owner (目标): ${JBC_TOKEN_OWNER}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 步骤1: 验证签名者身份
    console.log("📋 步骤 1: 验证签名者身份");
    if (wallet.address.toLowerCase() !== JBC_TOKEN_OWNER.toLowerCase()) {
      console.error(`    ❌ 错误: 签名者不是 JBC Token Owner！`);
      console.error(`    期望: ${JBC_TOKEN_OWNER}`);
      console.error(`    实际: ${wallet.address}`);
      process.exit(1);
    }
    console.log(`    ✅ 验证通过：签名者是 JBC Token Owner\n`);

    // 步骤2: 验证当前协议 Owner
    console.log("📋 步骤 2: 验证当前协议 Owner");
    const currentOwner = await protocol.owner();
    console.log(`    当前协议 Owner: ${currentOwner}`);
    
    if (currentOwner.toLowerCase() !== JBC_TOKEN_ADDRESS.toLowerCase()) {
      console.log(`    ⚠️  警告: 当前协议 Owner 不是 JBC Token 合约！`);
      console.log(`    期望: ${JBC_TOKEN_ADDRESS}`);
      console.log(`    实际: ${currentOwner}`);
      console.log(`    继续执行转移...\n`);
    } else {
      console.log(`    ✅ 确认：协议 Owner 是 JBC Token 合约\n`);
    }

    // 步骤3: 检查新 Owner 是否已经是当前 Owner
    console.log("📋 步骤 3: 检查目标 Owner");
    if (currentOwner.toLowerCase() === JBC_TOKEN_OWNER.toLowerCase()) {
      console.log(`    ✅ 协议 Owner 已经是 JBC Token Owner！`);
      console.log(`    无需转移。`);
      return;
    }
    console.log(`    ✅ 目标 Owner 验证通过\n`);

    // 步骤4: 备份当前关键数据（确保数据不变）
    console.log("📋 步骤 4: 备份当前关键数据");
    const backupData = {
      timestamp: new Date().toISOString(),
      blockNumber: await provider.getBlockNumber(),
      contractAddress: PROTOCOL_ADDRESS,
      currentOwner: currentOwner,
      newOwner: JBC_TOKEN_OWNER,
      jbcTokenOwner: JBC_TOKEN_OWNER,
      config: {},
      balances: {},
      sampleUsers: []
    };

    // 备份配置参数
    try {
      backupData.config = {
        directRewardPercent: (await protocol.directRewardPercent()).toString(),
        levelRewardPercent: (await protocol.levelRewardPercent()).toString(),
        marketingWallet: await protocol.marketingWallet(),
        treasuryWallet: await protocol.treasuryWallet(),
        lpInjectionWallet: await protocol.lpInjectionWallet(),
        buybackWallet: await protocol.buybackWallet(),
        jbcToken: await protocol.jbcToken(),
      };
      console.log(`    ✅ 配置参数已备份`);
    } catch (e) {
      console.log(`    ⚠️  无法备份部分配置: ${e.message}`);
    }

    // 备份余额
    try {
      backupData.balances = {
        swapReserveMC: (await protocol.swapReserveMC()).toString(),
        swapReserveJBC: (await protocol.swapReserveJBC()).toString(),
        contractBalance: (await provider.getBalance(PROTOCOL_ADDRESS)).toString(),
      };
      console.log(`    ✅ 余额信息已备份`);
    } catch (e) {
      console.log(`    ⚠️  无法备份余额: ${e.message}`);
    }

    // 备份示例用户数据
    try {
      const sampleAddresses = [
        "0xb6A10c3F6492e5FEfdC03909E1638FE3A8ce5C75",
        "0xaA4D3862ea0A72d83D6399D6700FcA1952d8e64d",
      ];
      
      for (const addr of sampleAddresses) {
        try {
          const userInfo = await protocol.userInfo(addr);
          const userTicket = await protocol.userTicket(addr);
          backupData.sampleUsers.push({
            address: addr,
            userInfo: {
              referrer: userInfo.referrer,
              activeDirects: userInfo.activeDirects.toString(),
              teamCount: userInfo.teamCount.toString(),
              totalRevenue: userInfo.totalRevenue.toString(),
              currentCap: userInfo.currentCap.toString(),
              isActive: userInfo.isActive,
            },
            ticket: {
              ticketId: userTicket.ticketId.toString(),
              amount: userTicket.amount.toString(),
              purchaseTime: userTicket.purchaseTime.toString(),
              exited: userTicket.exited,
            }
          });
        } catch (e) {
          // 忽略单个用户错误
        }
      }
      console.log(`    ✅ 示例用户数据已备份`);
    } catch (e) {
      console.log(`    ⚠️  无法备份用户数据: ${e.message}`);
    }

    // 保存备份数据
    const fs = require('fs');
    const backupFile = `scripts/owner-transfer-to-jbc-owner-backup-${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`    ✅ 备份数据已保存到: ${backupFile}\n`);

    // 步骤5: 执行转移
    console.log("📋 步骤 5: 执行协议 Owner 转移");
    console.log(`    从: ${currentOwner}`);
    console.log(`    到: ${JBC_TOKEN_OWNER} (JBC Token Owner)`);
    console.log(`    执行者: ${wallet.address} (JBC Token Owner)`);
    
    const protocolWithSigner = protocol.connect(wallet);
    
    // 估算 Gas
    try {
      const gasEstimate = await protocolWithSigner.transferOwnership.estimateGas(JBC_TOKEN_OWNER);
      console.log(`    Gas 估算: ${gasEstimate.toString()}`);
      
      // 检查余额
      const balance = await provider.getBalance(wallet.address);
      const feeData = await provider.getFeeData();
      const gasCost = gasEstimate * (feeData.gasPrice || 0n);
      
      console.log(`    签名者余额: ${ethers.formatEther(balance)} MC`);
      console.log(`    预估 Gas 费用: ${ethers.formatEther(gasCost)} MC`);
      
      if (balance < gasCost) {
        console.error(`    ❌ 错误: 余额不足支付 Gas 费用！`);
        console.error(`    需要: ${ethers.formatEther(gasCost)} MC`);
        console.error(`    当前: ${ethers.formatEther(balance)} MC`);
        console.error(`    请向 JBC Token Owner 地址充值: ${JBC_TOKEN_OWNER}`);
        process.exit(1);
      }
    } catch (e) {
      console.log(`    ⚠️  Gas 估算失败: ${e.message}`);
      console.log(`    继续执行...`);
    }

    // 执行转移
    console.log(`\n    ⚠️  准备执行转移...`);
    console.log(`    当前 Owner: ${currentOwner}`);
    console.log(`    新 Owner: ${JBC_TOKEN_OWNER} (JBC Token Owner)`);
    console.log(`    按 Ctrl+C 取消，或等待 10 秒后继续...\n`);
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log(`    📤 发送交易...`);
    const tx = await protocolWithSigner.transferOwnership(JBC_TOKEN_OWNER);
    console.log(`    ✅ 交易已发送`);
    console.log(`    交易哈希: ${tx.hash}`);
    console.log(`    区块浏览器: https://mcerscan.com/tx/${tx.hash}`);
    
    console.log(`\n    ⏳ 等待交易确认...`);
    const receipt = await tx.wait();
    console.log(`    ✅ 交易已确认`);
    console.log(`    区块号: ${receipt.blockNumber}`);
    console.log(`    Gas 使用: ${receipt.gasUsed.toString()}\n`);

    // 步骤6: 验证转移结果
    console.log("📋 步骤 6: 验证转移结果");
    const newOwner = await protocol.owner();
    console.log(`    新 Owner: ${newOwner}`);
    
    if (newOwner.toLowerCase() === JBC_TOKEN_OWNER.toLowerCase()) {
      console.log(`    ✅ Owner 转移成功！`);
      console.log(`    协议 Owner 现在是: ${newOwner} (JBC Token Owner)`);
    } else {
      console.error(`    ❌ Owner 转移失败！`);
      console.error(`    期望: ${JBC_TOKEN_OWNER}`);
      console.error(`    实际: ${newOwner}`);
      process.exit(1);
    }

    // 步骤7: 验证数据完整性
    console.log("\n📋 步骤 7: 验证数据完整性");
    
    // 验证配置参数
    let configValid = true;
    try {
      const newDirectReward = await protocol.directRewardPercent();
      if (newDirectReward.toString() !== backupData.config.directRewardPercent) {
        console.log(`    ❌ directRewardPercent 不匹配！`);
        configValid = false;
      } else {
        console.log(`    ✅ directRewardPercent 一致`);
      }
      
      const newLevelReward = await protocol.levelRewardPercent();
      if (newLevelReward.toString() !== backupData.config.levelRewardPercent) {
        console.log(`    ❌ levelRewardPercent 不匹配！`);
        configValid = false;
      } else {
        console.log(`    ✅ levelRewardPercent 一致`);
      }
    } catch (e) {
      console.log(`    ⚠️  无法验证配置参数: ${e.message}`);
    }

    // 验证用户数据
    let userDataValid = true;
    for (const sample of backupData.sampleUsers || []) {
      try {
        const userInfo = await protocol.userInfo(sample.address);
        if (userInfo.referrer.toLowerCase() !== sample.userInfo.referrer.toLowerCase() ||
            userInfo.totalRevenue.toString() !== sample.userInfo.totalRevenue.toString()) {
          console.log(`    ⚠️  用户 ${sample.address} 数据已变化（可能是正常交易）`);
        } else {
          console.log(`    ✅ 用户 ${sample.address} 数据一致`);
        }
      } catch (e) {
        console.log(`    ⚠️  无法验证用户 ${sample.address}: ${e.message}`);
      }
    }

    if (configValid && userDataValid) {
      console.log(`\n    ✅ 数据完整性验证通过！`);
    }

    console.log("\n" + "=" .repeat(60));
    console.log("✅ 协议 Owner 转移完成！");
    console.log("\n📋 总结:");
    console.log(`    旧 Owner: ${currentOwner}`);
    console.log(`    新 Owner: ${newOwner} (JBC Token Owner)`);
    console.log(`    执行者: ${wallet.address} (JBC Token Owner)`);
    console.log(`    备份文件: ${backupFile}`);
    console.log(`    交易哈希: ${tx.hash}`);
    console.log("\n✅ 现在 JBC Token Owner 可以直接管理协议合约！");
    console.log("\n⚠️  重要提示:");
    console.log("    1. 请妥善保管备份文件");
    console.log("    2. 请验证新 Owner 可以正常执行管理功能");
    console.log("    3. 建议使用多签钱包作为 Owner 以提高安全性");

  } catch (error) {
    console.error("\n❌ 转移失败:", error.message);
    if (error.data) {
      console.error("错误数据:", error.data);
    }
    if (error.reason) {
      console.error("错误原因:", error.reason);
    }
    if (error.code === "INSUFFICIENT_FUNDS") {
      console.error("\n💡 提示: 余额不足，请向 JBC Token Owner 地址充值 MC");
      console.error(`   JBC Token Owner 地址: ${JBC_TOKEN_OWNER}`);
    }
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行转移
transferOwnerToJbcOwner().catch(console.error);

