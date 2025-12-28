const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 查询合约超级管理员信息...");
  console.log("=".repeat(60));

  // 新部署的合约地址
  const PROTOCOL_ADDRESS = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";

  try {
    // 连接到MC链
    const provider = new ethers.JsonRpcProvider("https://rpc.mchains.io");
    const protocolContract = new ethers.Contract(
      PROTOCOL_ADDRESS, 
      ["function owner() view returns (address)"], 
      provider
    );

    console.log(`📋 合约地址: ${PROTOCOL_ADDRESS}`);
    
    // 查询合约所有者
    const owner = await protocolContract.owner();
    console.log(`👑 超级管理员地址: ${owner}`);
    
    console.log("");
    console.log("📊 管理员权限说明:");
    console.log("- 可以修改系统参数（奖励比例、税费等）");
    console.log("- 可以管理流动性池");
    console.log("- 可以设置钱包地址");
    console.log("- 可以暂停/恢复合约功能");
    console.log("- 可以转移所有权");
    console.log("- 可以升级合约实现");

  } catch (error) {
    console.error("❌ 查询失败:", error);
  }
}

main().catch(console.error);