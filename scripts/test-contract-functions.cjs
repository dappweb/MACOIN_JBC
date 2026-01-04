const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || process.argv[2];

if (!PROTOCOL_ADDRESS) {
  console.error("❌ 请提供协议合约地址");
  console.log("使用方法: PROTOCOL_ADDRESS=0x... node scripts/test-contract-functions.cjs");
  console.log("或: node scripts/test-contract-functions.cjs <合约地址>");
  process.exit(1);
}

// 协议合约 ABI（业务功能）
const PROTOCOL_ABI = [
  // 只读函数
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function hasReferrer(address) view returns (bool)",
  "function getPendingRewards(address) view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function levelRewardPool() view returns (uint256)",
  
  // 业务功能（需要交易）
  "function bindReferrer(address referrer) external",
  "function buyTicket() external payable",
  "function stakeLiquidity(uint256 amount, uint256 cycleDays) external",
  "function claimRewards() external",
  "function redeem() external",
  "function swapMCToJBC() external payable",
  "function swapJBCToMC(uint256 jbcAmount) external",
];

async function testContractFunctions() {
  console.log("🧪 测试协议合约业务功能\n");
  console.log("=" .repeat(60));
  console.log(`合约地址: ${PROTOCOL_ADDRESS}\n`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  
  const testResults = {
    contractAddress: PROTOCOL_ADDRESS,
    timestamp: new Date().toISOString(),
    readTests: {},
    writeTests: {},
    errors: []
  };
  
  // 测试只读函数
  console.log("📋 测试只读函数\n");
  
  const testAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
  
  try {
    const userInfo = await contract.userInfo(testAddress);
    testResults.readTests.userInfo = {
      success: true,
      data: {
        referrer: userInfo.referrer,
        activeDirects: userInfo.activeDirects.toString(),
        teamCount: userInfo.teamCount.toString(),
        totalRevenue: userInfo.totalRevenue.toString(),
        isActive: userInfo.isActive
      }
    };
    console.log(`    ✅ userInfo(${testAddress}): 成功`);
    console.log(`       推荐人: ${userInfo.referrer}`);
    console.log(`       活跃直推: ${userInfo.activeDirects}`);
    console.log(`       团队数量: ${userInfo.teamCount}`);
  } catch (e) {
    testResults.readTests.userInfo = { success: false, error: e.message };
    testResults.errors.push({ function: "userInfo", error: e.message });
    console.log(`    ❌ userInfo(${testAddress}): ${e.message}`);
  }
  
  try {
    const userTicket = await contract.userTicket(testAddress);
    testResults.readTests.userTicket = {
      success: true,
      data: {
        ticketId: userTicket.ticketId.toString(),
        amount: userTicket.amount.toString(),
        purchaseTime: userTicket.purchaseTime.toString(),
        exited: userTicket.exited
      }
    };
    console.log(`    ✅ userTicket(${testAddress}): 成功`);
  } catch (e) {
    testResults.readTests.userTicket = { success: false, error: e.message };
    testResults.errors.push({ function: "userTicket", error: e.message });
    console.log(`    ❌ userTicket(${testAddress}): ${e.message}`);
  }
  
  try {
    const hasReferrer = await contract.hasReferrer(testAddress);
    testResults.readTests.hasReferrer = { success: true, value: hasReferrer };
    console.log(`    ✅ hasReferrer(${testAddress}): ${hasReferrer}`);
  } catch (e) {
    testResults.readTests.hasReferrer = { success: false, error: e.message };
    testResults.errors.push({ function: "hasReferrer", error: e.message });
    console.log(`    ❌ hasReferrer(${testAddress}): ${e.message}`);
  }
  
  try {
    const swapReserveMC = await contract.swapReserveMC();
    testResults.readTests.swapReserveMC = {
      success: true,
      value: swapReserveMC.toString()
    };
    console.log(`    ✅ swapReserveMC(): ${ethers.formatEther(swapReserveMC)} MC`);
  } catch (e) {
    testResults.readTests.swapReserveMC = { success: false, error: e.message };
    testResults.errors.push({ function: "swapReserveMC", error: e.message });
    console.log(`    ❌ swapReserveMC(): ${e.message}`);
  }
  
  try {
    const swapReserveJBC = await contract.swapReserveJBC();
    testResults.readTests.swapReserveJBC = {
      success: true,
      value: swapReserveJBC.toString()
    };
    console.log(`    ✅ swapReserveJBC(): ${ethers.formatEther(swapReserveJBC)} JBC`);
  } catch (e) {
    testResults.readTests.swapReserveJBC = { success: false, error: e.message };
    testResults.errors.push({ function: "swapReserveJBC", error: e.message });
    console.log(`    ❌ swapReserveJBC(): ${e.message}`);
  }
  
  // 测试写入函数（仅检查函数是否存在，不实际执行）
  console.log("\n📋 检查写入函数（不实际执行）\n");
  
  const writeFunctions = [
    "bindReferrer",
    "buyTicket",
    "stakeLiquidity",
    "claimRewards",
    "redeem",
    "swapMCToJBC",
    "swapJBCToMC"
  ];
  
  for (const funcName of writeFunctions) {
    try {
      // 检查函数是否存在
      const func = contract.interface.getFunction(funcName);
      if (func) {
        testResults.writeTests[funcName] = {
          exists: true,
          signature: func.format()
        };
        console.log(`    ✅ ${funcName}: 存在`);
        console.log(`       签名: ${func.format()}`);
      }
    } catch (e) {
      testResults.writeTests[funcName] = {
        exists: false,
        error: e.message
      };
      testResults.errors.push({ function: funcName, error: e.message });
      console.log(`    ❌ ${funcName}: ${e.message}`);
    }
  }
  
  // 输出摘要
  console.log("\n" + "=" .repeat(60));
  console.log("📊 测试摘要");
  console.log("=" .repeat(60));
  
  const readSuccess = Object.values(testResults.readTests).filter(t => t.success).length;
  const readTotal = Object.keys(testResults.readTests).length;
  const writeExists = Object.values(testResults.writeTests).filter(t => t.exists).length;
  const writeTotal = Object.keys(testResults.writeTests).length;
  
  console.log(`\n只读函数: ${readSuccess}/${readTotal} 成功`);
  console.log(`写入函数: ${writeExists}/${writeTotal} 存在`);
  
  if (testResults.errors.length > 0) {
    console.log(`\n⚠️  错误: ${testResults.errors.length} 个`);
    testResults.errors.forEach(e => {
      console.log(`   - ${e.function}: ${e.error}`);
    });
  }
  
  return testResults;
}

// 执行测试
if (require.main === module) {
  testContractFunctions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ 测试失败:", error);
      process.exit(1);
    });
}

module.exports = { testContractFunctions };

