const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const JBC_TOKEN_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// JBC Token ABI
const JBC_ABI = [
  "function owner() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function jbcToken() view returns (address)",
];

async function checkJbcTokenOwner() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("🔍 检查 JBC Token 和协议合约的 Owner 关系\n");
  console.log("=" .repeat(60));
  console.log(`JBC Token 地址: ${JBC_TOKEN_ADDRESS}`);
  console.log(`协议合约地址: ${PROTOCOL_ADDRESS}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 检查 JBC Token 的 Owner
    console.log("📋 步骤 1: 检查 JBC Token 的 Owner");
    const jbcToken = new ethers.Contract(JBC_TOKEN_ADDRESS, JBC_ABI, provider);
    
    try {
      const jbcOwner = await jbcToken.owner();
      const jbcName = await jbcToken.name();
      const jbcSymbol = await jbcToken.symbol();
      
      console.log(`    JBC Token 名称: ${jbcName}`);
      console.log(`    JBC Token 符号: ${jbcSymbol}`);
      console.log(`    JBC Token Owner: ${jbcOwner}`);
      
      // 2. 检查协议合约的 Owner
      console.log("\n📋 步骤 2: 检查协议合约的 Owner");
      const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
      const protocolOwner = await protocol.owner();
      const protocolJbcToken = await protocol.jbcToken();
      
      console.log(`    协议合约 Owner: ${protocolOwner}`);
      console.log(`    协议合约中的 JBC Token: ${protocolJbcToken}`);
      
      // 3. 对比分析
      console.log("\n📋 步骤 3: 对比分析");
      console.log("=" .repeat(60));
      
      const isSameAddress = JBC_TOKEN_ADDRESS.toLowerCase() === protocolOwner.toLowerCase();
      const isJbcInProtocol = JBC_TOKEN_ADDRESS.toLowerCase() === protocolJbcToken.toLowerCase();
      
      console.log(`    JBC Token 地址 = 协议 Owner: ${isSameAddress ? '✅ 是' : '❌ 否'}`);
      console.log(`    协议中的 JBC Token 地址匹配: ${isJbcInProtocol ? '✅ 是' : '❌ 否'}`);
      
      if (isSameAddress) {
        console.log("\n    ⚠️  重要发现：协议合约的 Owner 就是 JBC Token 合约本身！");
        console.log("\n    这意味着：");
        console.log("      1. JBC Token 合约是协议合约的 Owner");
        console.log("      2. 要恢复协议 Owner，需要恢复 JBC Token 的 Owner");
        console.log("      3. 如果 JBC Token 的 Owner 私钥丢失，需要恢复 JBC Token 的 Owner");
        
        console.log("\n    恢复方案：");
        console.log("      方案 1: 恢复 JBC Token 的 Owner");
        console.log("        - 如果 JBC Token Owner 是多签钱包，通过其他签名者恢复");
        console.log("        - 如果 JBC Token Owner 是时间锁，通过管理员恢复");
        console.log("        - 恢复后，JBC Token Owner 可以转移协议 Owner");
        
        console.log("\n      方案 2: 如果 JBC Token Owner 也丢失");
        console.log("        - 检查 JBC Token 是否有恢复机制");
        console.log("        - 查看 JBC Token 的源代码");
        console.log("        - 考虑部署新的 JBC Token 并更新协议（需要协议 Owner，形成循环）");
      }
      
      // 4. 检查 JBC Token Owner 的类型
      console.log("\n📋 步骤 4: 检查 JBC Token Owner 的类型");
      const jbcOwnerCode = await provider.getCode(jbcOwner);
      
      if (jbcOwnerCode !== "0x") {
        console.log(`    JBC Token Owner 是合约地址（有代码）`);
        console.log(`    代码大小: ${(jbcOwnerCode.length - 2) / 2} 字节`);
        console.log(`    ✅ 可能是多签钱包或时间锁，可以恢复`);
      } else {
        console.log(`    JBC Token Owner 是普通地址（EOA）`);
        console.log(`    ❌ 如果私钥丢失，无法直接恢复`);
      }

      console.log("\n" + "=" .repeat(60));
      console.log("✅ 检查完成");
      
      console.log("\n📋 总结:");
      if (isSameAddress) {
        console.log("    协议 Owner = JBC Token 合约");
        console.log("    要恢复协议 Owner，需要恢复 JBC Token 的 Owner");
        console.log("    请检查 JBC Token Owner 的类型和恢复选项");
      }

    } catch (e) {
      console.error(`    ❌ 检查失败: ${e.message}`);
    }

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    console.error(error.stack);
  }
}

// 执行检查
checkJbcTokenOwner().catch(console.error);

