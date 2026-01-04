const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "function marketingWallet() view returns (address)",
  "function treasuryWallet() view returns (address)",
  "function lpInjectionWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function jbcToken() view returns (address)",
];

async function safeTransferOwnership() {
  // 从环境变量或命令行参数获取新 owner 地址和私钥
  const NEW_OWNER_ADDRESS = process.env.NEW_OWNER_ADDRESS || process.argv[2];
  const CURRENT_OWNER_PRIVATE_KEY = process.env.CURRENT_OWNER_PRIVATE_KEY || process.argv[3];

  if (!NEW_OWNER_ADDRESS) {
    console.error("❌ 错误: 请提供新 Owner 地址");
    console.log("使用方法:");
    console.log("  NEW_OWNER_ADDRESS=0x... CURRENT_OWNER_PRIVATE_KEY=0x... node scripts/safe-transfer-ownership.cjs");
    console.log("  或");
    console.log("  node scripts/safe-transfer-ownership.cjs <新Owner地址> <当前Owner私钥>");
    process.exit(1);
  }

  if (!CURRENT_OWNER_PRIVATE_KEY) {
    console.error("❌ 错误: 请提供当前 Owner 的私钥");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(CURRENT_OWNER_PRIVATE_KEY, provider);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔐 安全转移 Owner 地址\n");
  console.log("=" .repeat(60));
  console.log(`协议合约地址: ${PROTOCOL_ADDRESS}`);
  console.log(`当前签名者: ${wallet.address}`);
  console.log(`新 Owner 地址: ${NEW_OWNER_ADDRESS}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 步骤1: 验证当前 Owner
    console.log("📋 步骤 1: 验证当前 Owner");
    const currentOwner = await protocol.owner();
    console.log(`    当前 Owner: ${currentOwner}`);
    console.log(`    签名者地址: ${wallet.address}`);
    
    if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error(`    ❌ 错误: 签名者不是当前 Owner！`);
      console.error(`    当前 Owner: ${currentOwner}`);
      console.error(`    签名者: ${wallet.address}`);
      process.exit(1);
    }
    console.log(`    ✅ 验证通过：签名者是当前 Owner\n`);

    // 步骤2: 验证新 Owner 地址
    console.log("📋 步骤 2: 验证新 Owner 地址");
    if (!ethers.isAddress(NEW_OWNER_ADDRESS)) {
      console.error(`    ❌ 错误: 新 Owner 地址无效！`);
      process.exit(1);
    }
    
    if (NEW_OWNER_ADDRESS.toLowerCase() === currentOwner.toLowerCase()) {
      console.error(`    ❌ 错误: 新 Owner 地址与当前 Owner 相同！`);
      process.exit(1);
    }
    
    // 检查新 Owner 地址是否有代码（可能是合约）
    const newOwnerCode = await provider.getCode(NEW_OWNER_ADDRESS);
    if (newOwnerCode !== "0x") {
      console.log(`    ⚠️  警告: 新 Owner 是一个合约地址（有代码）`);
      console.log(`    请确保该合约可以接收 Owner 权限`);
    } else {
      console.log(`    ✅ 新 Owner 是普通地址（EOA）`);
    }
    console.log(`    ✅ 新 Owner 地址验证通过\n`);

    // 步骤3: 备份当前关键数据（确保数据不变）
    console.log("📋 步骤 3: 备份当前关键数据");
    const backupData = {
      timestamp: new Date().toISOString(),
      blockNumber: await provider.getBlockNumber(),
      contractAddress: PROTOCOL_ADDRESS,
      currentOwner: currentOwner,
      newOwner: NEW_OWNER_ADDRESS,
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

    // 备份示例用户数据（随机选择几个用户）
    try {
      // 这里可以添加一些已知的用户地址来验证
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
    const backupFile = `scripts/ownership-transfer-backup-${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`    ✅ 备份数据已保存到: ${backupFile}\n`);

    // 步骤4: 执行转移
    console.log("📋 步骤 4: 执行 Owner 转移");
    console.log(`    从: ${currentOwner}`);
    console.log(`    到: ${NEW_OWNER_ADDRESS}`);
    
    const protocolWithSigner = protocol.connect(wallet);
    
    // 估算 Gas
    try {
      const gasEstimate = await protocolWithSigner.transferOwnership.estimateGas(NEW_OWNER_ADDRESS);
      console.log(`    Gas 估算: ${gasEstimate.toString()}`);
    } catch (e) {
      console.log(`    ⚠️  Gas 估算失败: ${e.message}`);
    }

    // 执行转移
    console.log(`\n    ⚠️  准备执行转移...`);
    console.log(`    请确认新 Owner 地址正确: ${NEW_OWNER_ADDRESS}`);
    console.log(`    按 Ctrl+C 取消，或等待 5 秒后继续...\n`);
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    const tx = await protocolWithSigner.transferOwnership(NEW_OWNER_ADDRESS);
    console.log(`    ✅ 交易已发送`);
    console.log(`    交易哈希: ${tx.hash}`);
    console.log(`    区块浏览器: https://mcerscan.com/tx/${tx.hash}`);
    
    console.log(`\n    ⏳ 等待交易确认...`);
    const receipt = await tx.wait();
    console.log(`    ✅ 交易已确认`);
    console.log(`    区块号: ${receipt.blockNumber}`);
    console.log(`    Gas 使用: ${receipt.gasUsed.toString()}\n`);

    // 步骤5: 验证转移结果
    console.log("📋 步骤 5: 验证转移结果");
    const newOwner = await protocol.owner();
    console.log(`    新 Owner: ${newOwner}`);
    
    if (newOwner.toLowerCase() === NEW_OWNER_ADDRESS.toLowerCase()) {
      console.log(`    ✅ Owner 转移成功！`);
    } else {
      console.error(`    ❌ Owner 转移失败！`);
      console.error(`    期望: ${NEW_OWNER_ADDRESS}`);
      console.error(`    实际: ${newOwner}`);
      process.exit(1);
    }

    // 步骤6: 验证数据完整性
    console.log("\n📋 步骤 6: 验证数据完整性");
    
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
    } catch (e) {
      console.log(`    ⚠️  无法验证 directRewardPercent: ${e.message}`);
    }

    // 验证余额
    try {
      const newSwapReserveMC = await protocol.swapReserveMC();
      if (newSwapReserveMC.toString() !== backupData.balances.swapReserveMC) {
        console.log(`    ⚠️  swapReserveMC 已变化（可能是正常交易）`);
      } else {
        console.log(`    ✅ swapReserveMC 一致`);
      }
    } catch (e) {
      console.log(`    ⚠️  无法验证余额: ${e.message}`);
    }

    // 验证用户数据
    let userDataValid = true;
    for (const sample of backupData.sampleUsers) {
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

    // 步骤7: 测试新 Owner 权限
    console.log("\n📋 步骤 7: 测试新 Owner 权限");
    console.log(`    新 Owner 地址: ${newOwner}`);
    console.log(`    请使用新 Owner 地址测试以下功能:`);
    console.log(`    1. 调用 owner() 函数确认权限`);
    console.log(`    2. 测试只允许 Owner 的函数（如 setWallets）`);
    console.log(`    3. 确认所有功能正常`);

    console.log("\n" + "=" .repeat(60));
    console.log("✅ Owner 转移完成！");
    console.log("\n📋 总结:");
    console.log(`    旧 Owner: ${currentOwner}`);
    console.log(`    新 Owner: ${newOwner}`);
    console.log(`    备份文件: ${backupFile}`);
    console.log(`    交易哈希: ${tx.hash}`);
    console.log("\n⚠️  重要提示:");
    console.log("    1. 请妥善保管备份文件");
    console.log("    2. 请验证新 Owner 可以正常执行管理功能");
    console.log("    3. 请确保新 Owner 私钥安全");

  } catch (error) {
    console.error("\n❌ 转移失败:", error.message);
    if (error.data) {
      console.error("错误数据:", error.data);
    }
    if (error.reason) {
      console.error("错误原因:", error.reason);
    }
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行转移
safeTransferOwnership().catch(console.error);

