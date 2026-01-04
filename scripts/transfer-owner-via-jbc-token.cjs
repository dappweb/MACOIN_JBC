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

async function transferOwnerViaJbcToken() {
  console.log("🔐 通过 JBC Token 合约转移协议 Owner\n");
  console.log("=" .repeat(60));
  
  // 获取私钥
  const JBC_TOKEN_OWNER_PRIVATE_KEY = process.env.JBC_TOKEN_OWNER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.argv[2];
  
  if (!JBC_TOKEN_OWNER_PRIVATE_KEY) {
    console.error("❌ 错误: 请提供 JBC Token Owner 的私钥");
    console.log("\n使用方法:");
    console.log("  JBC_TOKEN_OWNER_PRIVATE_KEY=0x... node scripts/transfer-owner-via-jbc-token.cjs");
    console.log("  或");
    console.log("  node scripts/transfer-owner-via-jbc-token.cjs <JBC Token Owner私钥>");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(JBC_TOKEN_OWNER_PRIVATE_KEY, provider);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  const jbcToken = new ethers.Contract(JBC_TOKEN_ADDRESS, JBC_ABI, provider);

  console.log("协议合约地址:", PROTOCOL_ADDRESS);
  console.log("JBC Token 地址:", JBC_TOKEN_ADDRESS);
  console.log("JBC Token Owner:", JBC_TOKEN_OWNER);
  console.log("当前签名者:", wallet.address);
  console.log("新 Owner (目标):", JBC_TOKEN_OWNER);
  console.log("=" .repeat(60) + "\n");

  try {
    // 验证签名者
    if (wallet.address.toLowerCase() !== JBC_TOKEN_OWNER.toLowerCase()) {
      console.error("❌ 错误: 签名者不是 JBC Token Owner");
      process.exit(1);
    }
    console.log("📋 步骤 1: 验证签名者身份");
    console.log(`    ✅ 验证通过：签名者是 JBC Token Owner\n`);

    // 检查当前 Owner
    console.log("📋 步骤 2: 检查当前 Owner");
    const protocolOwner = await protocol.owner();
    const jbcOwner = await jbcToken.owner();
    
    console.log(`    当前协议 Owner: ${protocolOwner}`);
    console.log(`    JBC Token Owner: ${jbcOwner}`);
    
    if (protocolOwner.toLowerCase() !== JBC_TOKEN_ADDRESS.toLowerCase()) {
      console.error(`\n❌ 错误: 协议 Owner 不是 JBC Token 合约`);
      console.log(`    预期: ${JBC_TOKEN_ADDRESS}`);
      console.log(`    实际: ${protocolOwner}`);
      process.exit(1);
    }
    
    if (jbcOwner.toLowerCase() !== JBC_TOKEN_OWNER.toLowerCase()) {
      console.error(`\n❌ 错误: JBC Token Owner 不匹配`);
      console.log(`    预期: ${JBC_TOKEN_OWNER}`);
      console.log(`    实际: ${jbcOwner}`);
      process.exit(1);
    }
    
    console.log(`    ✅ 确认：协议 Owner 是 JBC Token 合约`);
    console.log(`    ✅ 确认：JBC Token Owner 是目标地址\n`);

    // 问题分析
    console.log("📋 步骤 3: 问题分析");
    console.log("=" .repeat(60));
    console.log("\n⚠️  关键问题：");
    console.log("    协议 Owner 是 JBC Token 合约本身");
    console.log("    这意味着 transferOwnership 只能由 JBC Token 合约来调用");
    console.log("    但是 JBC Token 合约没有调用协议合约的功能\n");
    
    console.log("💡 解决方案：");
    console.log("    由于 JBC Token 合约没有调用协议合约的功能，");
    console.log("    我们需要通过以下方式之一来解决：\n");
    console.log("    方案 1: 修改 JBC Token 合约（需要升级，可能不可行）");
    console.log("    方案 2: 部署一个中间合约，让 JBC Token 合约能够调用");
    console.log("    方案 3: 检查是否有其他方式（例如通过代理升级）\n");
    
    console.log("🔧 当前状态：");
    console.log("    JBC Token 合约代码大小: 3404 字节");
    console.log("    JBC Token 合约没有调用外部合约的功能");
    console.log("    无法直接通过 JBC Token Owner 调用协议合约的 transferOwnership\n");

    console.log("=" .repeat(60));
    console.log("❌ 无法直接执行转移");
    console.log("\n建议：");
    console.log("1. 检查 JBC Token 合约是否可以升级");
    console.log("2. 如果可以升级，添加一个函数来调用协议合约的 transferOwnership");
    console.log("3. 或者，部署一个中间合约，并修改 JBC Token 合约以调用该中间合约");
    console.log("4. 或者，联系合约开发者寻求帮助");

  } catch (error) {
    console.error("❌ 执行失败:", error.message);
    if (error.data) {
      console.error("错误数据:", error.data);
    }
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行
transferOwnerViaJbcToken().catch(console.error);

