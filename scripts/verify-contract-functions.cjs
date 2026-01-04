const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 完整的协议合约 ABI（用于功能验证）
const PROTOCOL_ABI = [
  // Owner 和配置
  "function owner() view returns (address)",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "function marketingPercent() view returns (uint256)",
  "function buybackPercent() view returns (uint256)",
  "function lpInjectionPercent() view returns (uint256)",
  "function treasuryPercent() view returns (uint256)",
  "function marketingWallet() view returns (address)",
  "function treasuryWallet() view returns (address)",
  "function lpInjectionWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function jbcToken() view returns (address)",
  "function redemptionFeePercent() view returns (uint256)",
  "function swapBuyTax() view returns (uint256)",
  "function swapSellTax() view returns (uint256)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  
  // 余额和状态
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function levelRewardPool() view returns (uint256)",
  "function nextTicketId() view returns (uint256)",
  "function nextStakeId() view returns (uint256)",
  "function lastBurnTime() view returns (uint256)",
  
  // 用户数据
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function directReferrals(address, uint256) view returns (address)",
  
  // 业务功能（只读验证）
  "function hasReferrer(address) view returns (bool)",
  "function getPendingRewards(address) view returns (uint256)",
];

async function verifyContractFunctions(contractAddress, contractName) {
  console.log(`\n🔍 验证 ${contractName} 合约功能\n`);
  console.log("=" .repeat(60));
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(contractAddress, PROTOCOL_ABI, provider);
  
  const results = {
    contractAddress,
    contractName,
    timestamp: new Date().toISOString(),
    functions: {},
    errors: []
  };
  
  // 验证所有函数
  const functionsToVerify = [
    // 配置函数
    { name: "owner", type: "address" },
    { name: "directRewardPercent", type: "uint256" },
    { name: "levelRewardPercent", type: "uint256" },
    { name: "marketingPercent", type: "uint256" },
    { name: "buybackPercent", type: "uint256" },
    { name: "lpInjectionPercent", type: "uint256" },
    { name: "treasuryPercent", type: "uint256" },
    { name: "marketingWallet", type: "address" },
    { name: "treasuryWallet", type: "address" },
    { name: "lpInjectionWallet", type: "address" },
    { name: "buybackWallet", type: "address" },
    { name: "jbcToken", type: "address" },
    { name: "redemptionFeePercent", type: "uint256" },
    { name: "swapBuyTax", type: "uint256" },
    { name: "swapSellTax", type: "uint256" },
    { name: "ticketFlexibilityDuration", type: "uint256" },
    { name: "liquidityEnabled", type: "bool" },
    { name: "redeemEnabled", type: "bool" },
    { name: "emergencyPaused", type: "bool" },
    
    // 状态函数
    { name: "swapReserveMC", type: "uint256" },
    { name: "swapReserveJBC", type: "uint256" },
    { name: "levelRewardPool", type: "uint256" },
    { name: "nextTicketId", type: "uint256" },
    { name: "nextStakeId", type: "uint256" },
    { name: "lastBurnTime", type: "uint256" },
  ];
  
  console.log(`📋 验证 ${functionsToVerify.length} 个函数...\n`);
  
  for (const func of functionsToVerify) {
    try {
      const result = await contract[func.name]();
      results.functions[func.name] = {
        exists: true,
        value: result.toString ? result.toString() : result,
        type: func.type
      };
      console.log(`    ✅ ${func.name}: ${result.toString ? result.toString() : result}`);
    } catch (e) {
      results.functions[func.name] = {
        exists: false,
        error: e.message
      };
      results.errors.push({
        function: func.name,
        error: e.message
      });
      console.log(`    ❌ ${func.name}: ${e.message}`);
    }
  }
  
  // 验证用户数据函数（使用示例地址）
  console.log(`\n📋 验证用户数据函数...\n`);
  const testAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
  
  const userFunctions = [
    { name: "userInfo", params: [testAddress] },
    { name: "userTicket", params: [testAddress] },
    { name: "hasReferrer", params: [testAddress] },
  ];
  
  for (const func of userFunctions) {
    try {
      const result = await contract[func.name](...func.params);
      results.functions[func.name] = {
        exists: true,
        value: Array.isArray(result) ? result.map(r => r.toString ? r.toString() : r) : (result.toString ? result.toString() : result)
      };
      console.log(`    ✅ ${func.name}(${func.params.join(", ")}): 可调用`);
    } catch (e) {
      results.functions[func.name] = {
        exists: false,
        error: e.message
      };
      results.errors.push({
        function: func.name,
        error: e.message
      });
      console.log(`    ❌ ${func.name}(${func.params.join(", ")}): ${e.message}`);
    }
  }
  
  return results;
}

async function compareContracts(oldAddress, newAddress) {
  console.log("🔍 对比新旧合约功能\n");
  console.log("=" .repeat(60));
  
  const oldResults = await verifyContractFunctions(oldAddress, "旧合约");
  const newResults = await verifyContractFunctions(newAddress, "新合约");
  
  console.log("\n📊 功能对比结果\n");
  console.log("=" .repeat(60));
  
  const comparison = {
    timestamp: new Date().toISOString(),
    oldContract: oldAddress,
    newContract: newAddress,
    matches: [],
    mismatches: [],
    missing: []
  };
  
  // 对比所有函数
  const allFunctions = new Set([
    ...Object.keys(oldResults.functions),
    ...Object.keys(newResults.functions)
  ]);
  
  for (const funcName of allFunctions) {
    const oldFunc = oldResults.functions[funcName];
    const newFunc = newResults.functions[funcName];
    
    if (!oldFunc || !oldFunc.exists) {
      comparison.missing.push({
        function: funcName,
        issue: "旧合约中不存在"
      });
      continue;
    }
    
    if (!newFunc || !newFunc.exists) {
      comparison.missing.push({
        function: funcName,
        issue: "新合约中不存在"
      });
      continue;
    }
    
    // 对比值（对于配置函数）
    if (oldFunc.value !== undefined && newFunc.value !== undefined) {
      if (oldFunc.value === newFunc.value) {
        comparison.matches.push({
          function: funcName,
          value: oldFunc.value
        });
      } else {
        comparison.mismatches.push({
          function: funcName,
          oldValue: oldFunc.value,
          newValue: newFunc.value
        });
      }
    } else {
      // 函数存在但无法获取值
      comparison.matches.push({
        function: funcName,
        note: "函数存在"
      });
    }
  }
  
  // 输出对比结果
  console.log(`✅ 匹配的函数: ${comparison.matches.length}`);
  comparison.matches.slice(0, 10).forEach(m => {
    console.log(`   - ${m.function}${m.value ? `: ${m.value}` : ""}`);
  });
  if (comparison.matches.length > 10) {
    console.log(`   ... 还有 ${comparison.matches.length - 10} 个匹配的函数`);
  }
  
  if (comparison.mismatches.length > 0) {
    console.log(`\n⚠️  不匹配的函数: ${comparison.mismatches.length}`);
    comparison.mismatches.forEach(m => {
      console.log(`   - ${m.function}:`);
      console.log(`     旧值: ${m.oldValue}`);
      console.log(`     新值: ${m.newValue}`);
    });
  }
  
  if (comparison.missing.length > 0) {
    console.log(`\n❌ 缺失的函数: ${comparison.missing.length}`);
    comparison.missing.forEach(m => {
      console.log(`   - ${m.function}: ${m.issue}`);
    });
  }
  
  // 保存对比结果
  const backupDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const filename = `contract-comparison-${Date.now()}.json`;
  const filepath = path.join(backupDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify({
    comparison,
    oldResults,
    newResults
  }, null, 2));
  
  console.log(`\n📄 对比结果已保存: ${filepath}`);
  
  return comparison;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 只验证旧合约
    await verifyContractFunctions(OLD_PROTOCOL_ADDRESS, "旧协议合约");
  } else if (args.length === 1) {
    // 验证新合约
    const newAddress = args[0];
    await verifyContractFunctions(newAddress, "新协议合约");
  } else if (args.length === 2) {
    // 对比新旧合约
    const oldAddress = args[0];
    const newAddress = args[1];
    await compareContracts(oldAddress, newAddress);
  } else {
    console.log("使用方法:");
    console.log("  验证旧合约: node scripts/verify-contract-functions.cjs");
    console.log("  验证新合约: node scripts/verify-contract-functions.cjs <新合约地址>");
    console.log("  对比合约: node scripts/verify-contract-functions.cjs <旧合约地址> <新合约地址>");
  }
}

main().catch(console.error);

