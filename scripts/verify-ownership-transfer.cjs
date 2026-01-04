const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
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
];

async function verifyOwnershipTransfer() {
  const backupFile = process.argv[2];
  
  if (!backupFile) {
    console.error("❌ 错误: 请提供备份文件路径");
    console.log("使用方法: node scripts/verify-ownership-transfer.cjs <备份文件路径>");
    process.exit(1);
  }

  const fs = require('fs');
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ 错误: 备份文件不存在: ${backupFile}`);
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔍 验证 Owner 转移后的数据完整性\n");
  console.log("=" .repeat(60));
  console.log(`协议合约地址: ${PROTOCOL_ADDRESS}`);
  console.log(`备份时间: ${backupData.timestamp}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 验证 Owner
    console.log("📋 验证 Owner");
    const currentOwner = await protocol.owner();
    console.log(`    备份时 Owner: ${backupData.currentOwner}`);
    console.log(`    当前 Owner: ${currentOwner}`);
    console.log(`    新 Owner (预期): ${backupData.newOwner}`);
    
    if (currentOwner.toLowerCase() === backupData.newOwner.toLowerCase()) {
      console.log(`    ✅ Owner 已成功转移\n`);
    } else {
      console.log(`    ⚠️  Owner 地址不匹配\n`);
    }

    // 2. 验证配置参数
    console.log("📋 验证配置参数");
    const configChecks = [
      { name: 'directRewardPercent', func: () => protocol.directRewardPercent() },
      { name: 'levelRewardPercent', func: () => protocol.levelRewardPercent() },
      { name: 'marketingWallet', func: () => protocol.marketingWallet() },
      { name: 'treasuryWallet', func: () => protocol.treasuryWallet() },
      { name: 'lpInjectionWallet', func: () => protocol.lpInjectionWallet() },
      { name: 'buybackWallet', func: () => protocol.buybackWallet() },
      { name: 'jbcToken', func: () => protocol.jbcToken() },
    ];

    let allConfigValid = true;
    for (const check of configChecks) {
      try {
        const current = await check.func();
        const backup = backupData.config[check.name];
        
        if (typeof current === 'string' || typeof current === 'object') {
          const currentStr = current.toLowerCase();
          const backupStr = (backup || '').toLowerCase();
          if (currentStr === backupStr) {
            console.log(`    ✅ ${check.name}: 一致`);
          } else {
            console.log(`    ❌ ${check.name}: 不一致`);
            console.log(`       备份: ${backup}`);
            console.log(`       当前: ${current}`);
            allConfigValid = false;
          }
        } else {
          const currentStr = current.toString();
          const backupStr = (backup || '').toString();
          if (currentStr === backupStr) {
            console.log(`    ✅ ${check.name}: 一致`);
          } else {
            console.log(`    ❌ ${check.name}: 不一致`);
            console.log(`       备份: ${backup}`);
            console.log(`       当前: ${current}`);
            allConfigValid = false;
          }
        }
      } catch (e) {
        console.log(`    ⚠️  ${check.name}: 无法验证 - ${e.message}`);
      }
    }

    if (allConfigValid) {
      console.log(`\n    ✅ 所有配置参数一致\n`);
    } else {
      console.log(`\n    ⚠️  部分配置参数不一致\n`);
    }

    // 3. 验证用户数据
    console.log("📋 验证用户数据");
    let allUsersValid = true;
    for (const sample of backupData.sampleUsers || []) {
      try {
        const userInfo = await protocol.userInfo(sample.address);
        const backupInfo = sample.userInfo;
        
        const checks = [
          { name: 'referrer', current: userInfo.referrer.toLowerCase(), backup: backupInfo.referrer.toLowerCase() },
          { name: 'totalRevenue', current: userInfo.totalRevenue.toString(), backup: backupInfo.totalRevenue.toString() },
          { name: 'currentCap', current: userInfo.currentCap.toString(), backup: backupInfo.currentCap.toString() },
          { name: 'isActive', current: userInfo.isActive.toString(), backup: backupInfo.isActive.toString() },
        ];

        let userValid = true;
        for (const check of checks) {
          if (check.current !== check.backup) {
            console.log(`    ⚠️  用户 ${sample.address} 的 ${check.name} 已变化`);
            console.log(`       备份: ${check.backup}`);
            console.log(`       当前: ${check.current}`);
            userValid = false;
            allUsersValid = false;
          }
        }

        if (userValid) {
          console.log(`    ✅ 用户 ${sample.address} 数据一致`);
        }
      } catch (e) {
        console.log(`    ⚠️  无法验证用户 ${sample.address}: ${e.message}`);
      }
    }

    if (allUsersValid) {
      console.log(`\n    ✅ 所有用户数据一致\n`);
    } else {
      console.log(`\n    ⚠️  部分用户数据已变化（可能是正常交易）\n`);
    }

    console.log("=" .repeat(60));
    console.log("✅ 验证完成");
    console.log("\n📋 总结:");
    if (allConfigValid && allUsersValid) {
      console.log("    ✅ 所有数据完整性验证通过");
      console.log("    ✅ 用户利益未受影响");
    } else {
      console.log("    ⚠️  部分数据已变化，请检查是否为正常交易导致");
    }

  } catch (error) {
    console.error("❌ 验证失败:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行验证
verifyOwnershipTransfer().catch(console.error);

