const { ethers } = require('ethers');

// 合约地址和ABI
const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external"
];

// MC Chain RPC
const RPC_URL = "https://rpc.mcchain.info";

async function checkOwner() {
  try {
    console.log("🔍 检查合约owner状态...");
    console.log("合约地址:", PROTOCOL_ADDRESS);
    
    // 连接到MC Chain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    // 获取当前owner
    const currentOwner = await contract.owner();
    console.log("当前合约owner:", currentOwner);
    
    // 检查网络连接
    const network = await provider.getNetwork();
    console.log("网络信息:", {
      chainId: network.chainId.toString(),
      name: network.name
    });
    
    // 检查合约是否存在
    const code = await provider.getCode(PROTOCOL_ADDRESS);
    console.log("合约代码长度:", code.length);
    
    if (code === "0x") {
      console.log("❌ 合约不存在或地址错误");
    } else {
      console.log("✅ 合约存在");
    }
    
  } catch (error) {
    console.error("❌ 检查失败:", error.message);
  }
}

checkOwner();