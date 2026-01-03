const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 查询协议合约中的 JBC 代币地址...\n");
  
  const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  console.log("📋 协议合约地址:", PROTOCOL_ADDRESS);
  
  const [signer] = await ethers.getSigners();
  console.log("📍 查询账户:", signer.address);
  
  try {
    // 获取合约实例
    const protocolContract = await ethers.getContractAt("JinbaoProtocol", PROTOCOL_ADDRESS);
    
    // 查询 JBC Token 地址
    console.log("\n⏳ 正在查询...");
    const jbcTokenAddress = await protocolContract.jbcToken();
    
    console.log("\n✅ 查询结果:");
    console.log("  JBC 代币地址:", jbcTokenAddress);
    
    // 检查是否是预期的地址
    const expectedAddress = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";
    if (jbcTokenAddress.toLowerCase() === expectedAddress.toLowerCase()) {
      console.log("  ✅ 地址匹配预期值");
    } else {
      console.log("  ⚠️  地址与预期值不同");
      console.log("  预期地址:", expectedAddress);
    }
    
    // 验证地址是否有效
    if (jbcTokenAddress === ethers.ZeroAddress) {
      console.log("  ⚠️  警告: JBC 地址为零地址！");
    } else {
      // 尝试获取代币信息
      try {
        // 使用完整的合约路径来避免冲突
        const jbcContract = await ethers.getContractAt("contracts/JinbaoProtocol.sol:IJBC", jbcTokenAddress);
        
        // 尝试获取代币基本信息（如果合约支持）
        try {
          const code = await ethers.provider.getCode(jbcTokenAddress);
          if (code === "0x") {
            console.log("  ⚠️  警告: 该地址不是合约地址！");
          } else {
            console.log("  ✅ 地址是有效的合约");
            
            // 尝试调用标准 ERC20 函数
            try {
              const balance = await jbcContract.balanceOf(jbcTokenAddress);
              console.log("  合约自身余额:", ethers.formatEther(balance), "JBC");
            } catch (err) {
              // 忽略错误，可能不是标准 ERC20
            }
          }
        } catch (err) {
          console.log("  ⚠️  无法验证合约:", err.message);
        }
      } catch (err) {
        console.log("  ⚠️  无法获取代币信息:", err.message);
      }
    }
    
    console.log("\n📝 配置文件中的地址:");
    console.log("  Web3Context.tsx:", "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da");
    
  } catch (error) {
    console.error("❌ 查询失败:", error.message);
    
    if (error.message.includes("could not decode")) {
      console.log("\n💡 可能的原因:");
      console.log("  1. 合约可能还没有升级到包含 jbcToken() 函数的版本");
      console.log("  2. 合约地址可能不正确");
      console.log("  3. 网络连接问题");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

