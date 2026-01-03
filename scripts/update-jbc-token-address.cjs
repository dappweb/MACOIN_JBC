const { ethers } = require("hardhat");

async function main() {
  console.log("🔄 更新协议合约中的 JBC 代币地址...\n");
  
  const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  const NEW_JBC_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";
  
  console.log("📋 协议合约地址:", PROTOCOL_ADDRESS);
  console.log("📋 新 JBC 代币地址:", NEW_JBC_ADDRESS);
  
  const [signer] = await ethers.getSigners();
  console.log("📍 操作账户:", signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("💰 账户余额:", ethers.formatEther(balance), "MC\n");
  
  try {
    // 获取合约实例
    const protocolContract = await ethers.getContractAt("JinbaoProtocol", PROTOCOL_ADDRESS);
    
    // 检查是否是合约所有者
    const owner = await protocolContract.owner();
    console.log("👤 合约所有者:", owner);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.log("❌ 错误: 当前账户不是合约所有者！");
      console.log("   当前账户:", signer.address);
      console.log("   合约所有者:", owner);
      process.exit(1);
    }
    
    // 获取当前 JBC 地址
    console.log("\n⏳ 查询当前 JBC 地址...");
    const currentJbcAddress = await protocolContract.jbcToken();
    console.log("  当前地址:", currentJbcAddress);
    
    // 检查是否已经是目标地址
    if (currentJbcAddress.toLowerCase() === NEW_JBC_ADDRESS.toLowerCase()) {
      console.log("✅ JBC 地址已经是目标地址，无需更新");
      process.exit(0);
    }
    
    // 验证新地址格式
    if (!ethers.isAddress(NEW_JBC_ADDRESS)) {
      console.log("❌ 错误: 新地址格式无效");
      process.exit(1);
    }
    
    // 验证新地址是否是合约
    const code = await ethers.provider.getCode(NEW_JBC_ADDRESS);
    if (code === "0x") {
      console.log("⚠️  警告: 新地址不是合约地址，但继续执行...");
    } else {
      console.log("✅ 新地址是有效的合约地址");
    }
    
    // 执行更新
    console.log("\n⏳ 正在更新 JBC 代币地址...");
    console.log("   从:", currentJbcAddress);
    console.log("   到:", NEW_JBC_ADDRESS);
    
    const tx = await protocolContract.setJbcToken(NEW_JBC_ADDRESS);
    console.log("📝 交易哈希:", tx.hash);
    console.log("⏳ 等待交易确认...");
    
    const receipt = await tx.wait();
    console.log("✅ 交易已确认!");
    console.log("   区块号:", receipt.blockNumber);
    console.log("   Gas 使用:", receipt.gasUsed.toString());
    
    // 验证更新结果
    console.log("\n🔍 验证更新结果...");
    const updatedJbcAddress = await protocolContract.jbcToken();
    console.log("   更新后的地址:", updatedJbcAddress);
    
    if (updatedJbcAddress.toLowerCase() === NEW_JBC_ADDRESS.toLowerCase()) {
      console.log("✅ 更新成功! JBC 代币地址已更新");
    } else {
      console.log("❌ 更新失败! 地址不匹配");
      console.log("   预期:", NEW_JBC_ADDRESS);
      console.log("   实际:", updatedJbcAddress);
      process.exit(1);
    }
    
    // 检查事件
    console.log("\n📋 检查事件...");
    const events = receipt.logs.filter(log => {
      try {
        const parsed = protocolContract.interface.parseLog(log);
        return parsed && parsed.name === "JbcTokenUpdated";
      } catch {
        return false;
      }
    });
    
    if (events.length > 0) {
      const event = protocolContract.interface.parseLog(events[0]);
      console.log("✅ 找到 JbcTokenUpdated 事件:");
      console.log("   旧地址:", event.args[0]);
      console.log("   新地址:", event.args[1]);
    } else {
      console.log("⚠️  未找到 JbcTokenUpdated 事件");
    }
    
    console.log("\n🎉 更新完成!");
    console.log("\n📝 下一步:");
    console.log("  1. 验证新 JBC 合约中是否设置了正确的协议地址");
    console.log("  2. 测试购买门票功能，确保奖励分配正常");
    console.log("  3. 监控合约运行状态");
    
  } catch (error) {
    console.error("❌ 更新失败:", error.message);
    
    if (error.message.includes("not the owner")) {
      console.log("\n💡 解决方案:");
      console.log("  请确保使用合约owner账户执行此脚本");
    }
    
    if (error.message.includes("Invalid address")) {
      console.log("\n💡 解决方案:");
      console.log("  请检查新 JBC 地址格式是否正确");
    }
    
    if (error.message.includes("setJbcToken")) {
      console.log("\n💡 可能的原因:");
      console.log("  1. 合约可能还没有升级到包含 setJbcToken() 函数的版本");
      console.log("  2. 请先运行升级脚本: npx hardhat run scripts/upgrade-add-setjbc-token.cjs --network mc");
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


