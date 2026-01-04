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
];

// JBC Token ABI
const JBC_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external",
];

async function checkTransferOwnershipPermission() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  const jbcToken = new ethers.Contract(JBC_TOKEN_ADDRESS, JBC_ABI, provider);

  console.log("🔍 检查 transferOwnership 权限\n");
  console.log("=" .repeat(60));

  try {
    // 1. 检查当前 Owner
    console.log("📋 步骤 1: 检查当前 Owner");
    const protocolOwner = await protocol.owner();
    const jbcOwner = await jbcToken.owner();
    
    console.log(`    协议 Owner: ${protocolOwner}`);
    console.log(`    JBC Token Owner: ${jbcOwner}`);
    console.log(`    协议 Owner = JBC Token: ${protocolOwner.toLowerCase() === JBC_TOKEN_ADDRESS.toLowerCase() ? '✅ 是' : '❌ 否'}`);
    console.log(`    JBC Token Owner = 目标: ${jbcOwner.toLowerCase() === JBC_TOKEN_OWNER.toLowerCase() ? '✅ 是' : '❌ 否'}\n`);

    // 2. 问题分析
    console.log("📋 步骤 2: 问题分析");
    console.log("=" .repeat(60));
    
    if (protocolOwner.toLowerCase() === JBC_TOKEN_ADDRESS.toLowerCase()) {
      console.log("\n⚠️  问题发现：");
      console.log("    协议 Owner 是 JBC Token 合约本身");
      console.log("    这意味着 transferOwnership 需要由 JBC Token 合约来调用");
      console.log("    而不是由 JBC Token Owner 直接调用\n");
      
      console.log("💡 解决方案：");
      console.log("    需要通过 JBC Token 合约来调用协议合约的 transferOwnership");
      console.log("    但 JBC Token 合约可能没有这个功能\n");
      
      console.log("🔧 可能的解决方法：");
      console.log("    1. 检查 JBC Token 合约是否有调用协议合约的功能");
      console.log("    2. 或者需要先转移 JBC Token 的 Owner，然后通过 JBC Token 调用");
      console.log("    3. 或者需要部署一个中间合约来执行转移");
    }

    // 3. 检查 JBC Token 合约的功能
    console.log("\n📋 步骤 3: 检查 JBC Token 合约功能");
    const jbcCode = await provider.getCode(JBC_TOKEN_ADDRESS);
    console.log(`    JBC Token 代码大小: ${(jbcCode.length - 2) / 2} 字节`);
    
    // 检查是否有调用外部合约的功能
    if (jbcCode.includes("delegatecall") || jbcCode.includes("call")) {
      console.log(`    ✅ JBC Token 合约可能可以调用外部合约`);
    } else {
      console.log(`    ⚠️  JBC Token 合约可能无法调用外部合约`);
    }

    // 4. 尝试理解错误
    console.log("\n📋 步骤 4: 错误分析");
    console.log("    错误: execution reverted (unknown custom error)");
    console.log("    错误数据: 0x118cdaa7...");
    console.log("\n    可能原因：");
    console.log("    1. JBC Token Owner 不是协议 Owner，无法直接调用 transferOwnership");
    console.log("    2. 需要通过 JBC Token 合约来调用（因为协议 Owner 是 JBC Token 合约）");
    console.log("    3. 需要先让 JBC Token 合约有调用协议合约的能力");

    console.log("\n" + "=" .repeat(60));
    console.log("✅ 检查完成");

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    console.error(error.stack);
  }
}

// 执行检查
checkTransferOwnershipPermission().catch(console.error);

