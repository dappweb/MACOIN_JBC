const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 验证 setJbcToken 功能...\n");
  
  const PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  console.log("📋 合约地址:", PROXY_ADDRESS);
  
  const [signer] = await ethers.getSigners();
  console.log("📍 查询账户:", signer.address);
  
  try {
    // 获取合约实例
    const protocolContract = await ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);
    
    // 检查基本信息
    console.log("\n📊 合约信息:");
    const owner = await protocolContract.owner();
    console.log("  - 所有者:", owner);
    
    // 检查 JBC Token 地址
    const jbcToken = await protocolContract.jbcToken();
    console.log("  - JBC Token:", jbcToken);
    
    // 检查合约接口中是否有 setJbcToken 函数
    console.log("\n🔍 检查新函数:");
    const contractInterface = protocolContract.interface;
    
    // 检查函数是否存在
    try {
      const hasSetJbcToken = contractInterface.hasFunction("setJbcToken");
      if (hasSetJbcToken) {
        console.log("  ✅ setJbcToken(address) 函数存在");
      } else {
        console.log("  ❌ setJbcToken(address) 函数不存在");
      }
    } catch (err) {
      console.log("  ⚠️  无法检查函数:", err.message);
    }
    
    // 尝试获取函数签名
    try {
      const setJbcTokenFragment = contractInterface.getFunction("setJbcToken");
      console.log("  ✅ 函数签名:", setJbcTokenFragment.format());
    } catch (err) {
      console.log("  ⚠️  无法获取函数签名:", err.message);
    }
    
    // 检查事件
    try {
      const hasEvent = contractInterface.hasEvent("JbcTokenUpdated");
      if (hasEvent) {
        console.log("  ✅ JbcTokenUpdated 事件存在");
      } else {
        console.log("  ❌ JbcTokenUpdated 事件不存在");
      }
    } catch (err) {
      console.log("  ⚠️  无法检查事件:", err.message);
    }
    
    console.log("\n✅ 验证完成!");
    console.log("\n📝 下一步:");
    console.log("  1. 在 Admin Panel 中测试更新 JBC 代币地址功能");
    console.log("  2. 确保新的 JBC 合约中设置了正确的协议地址");
    console.log("  3. 监控合约运行状态");
    
  } catch (error) {
    console.error("❌ 验证失败:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

