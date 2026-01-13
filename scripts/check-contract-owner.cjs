/**
 * 查询合约的owner地址
 */

const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
];

async function main() {
    console.log("🔍 查询合约owner地址...\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    try {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

        console.log("📡 连接RPC...");
      const owner = await protocol.owner();
        
        console.log("\n" + "=".repeat(80));
        console.log("📊 合约Owner信息");
        console.log("=".repeat(80));
        console.log(`Owner地址: ${owner}`);
        console.log(`Owner地址(小写): ${owner.toLowerCase()}`);
        console.log("\n✅ 查询完成！");
        
    } catch (error) {
        console.error("❌ 查询失败:", error.message);
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            console.error("\n⚠️  RPC连接超时，可能是网络问题");
            console.error("   请稍后重试或检查RPC节点状态");
    }
        process.exit(1);
  }
}

main();
