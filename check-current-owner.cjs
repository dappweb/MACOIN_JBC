const { ethers } = require('ethers');

// 当前合约地址（来自最新部署）
const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
const PROTOCOL_ABI = [
  "function owner() view returns (address)"
];

// MC Chain RPC
const RPC_URL = "https://rpc.mcchain.info";

async function checkCurrentOwner() {
  try {
    console.log("🔍 查询Jinbao Protocol当前owner...");
    console.log("合约地址:", PROTOCOL_ADDRESS);
    console.log("网络: MC Chain (88813)");
    console.log("=".repeat(50));
    
    // 连接到MC Chain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    // 获取当前owner
    const currentOwner = await contract.owner();
    console.log("当前合约owner:", currentOwner);
    
    // 检查网络连接
    const network = await provider.getNetwork();
    console.log("网络确认:", {
      chainId: network.chainId.toString(),
      name: network.name || "MC Chain"
    });
    
    // 检查合约是否存在
    const code = await provider.getCode(PROTOCOL_ADDRESS);
    if (code === "0x") {
      console.log("❌ 合约不存在或地址错误");
    } else {
      console.log("✅ 合约存在，代码长度:", code.length);
    }
    
    console.log("=".repeat(50));
    console.log("✅ 查询完成");
    
  } catch (error) {
    console.error("❌ 查询失败:", error.message);
  }
}

checkCurrentOwner();