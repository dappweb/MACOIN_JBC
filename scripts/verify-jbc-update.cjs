const { ethers } = require("hardhat");

async function main() {
  console.log("✅ 验证 JBC 地址更新结果...\n");
  
  const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  const EXPECTED_JBC = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";
  
  try {
    // 方法1: 通过 getter 函数
    const protocolContract = await ethers.getContractAt("JinbaoProtocol", PROTOCOL_ADDRESS);
    const jbcFromGetter = await protocolContract.jbcToken();
    console.log("📋 通过 jbcToken() getter:");
    console.log("  地址:", jbcFromGetter);
    console.log("  匹配预期:", jbcFromGetter.toLowerCase() === EXPECTED_JBC.toLowerCase() ? "✅ 是" : "❌ 否");
    
    // 方法2: 直接读取存储槽
    console.log("\n📋 通过存储槽读取:");
    const slot0 = await ethers.provider.getStorage(PROTOCOL_ADDRESS, 0);
    const slot1 = await ethers.provider.getStorage(PROTOCOL_ADDRESS, 1);
    
    const addr0 = "0x" + slot0.slice(-40);
    const addr1 = "0x" + slot1.slice(-40);
    
    console.log("  Slot 0 地址:", addr0);
    console.log("  Slot 1 地址:", addr1);
    
    // 检查哪个存储槽包含正确的地址
    if (addr0.toLowerCase() === EXPECTED_JBC.toLowerCase()) {
      console.log("  ✅ Slot 0 包含正确的 JBC 地址");
    }
    if (addr1.toLowerCase() === EXPECTED_JBC.toLowerCase()) {
      console.log("  ✅ Slot 1 包含正确的 JBC 地址");
    }
    
    // 检查 getter 读取的是哪个槽
    if (jbcFromGetter.toLowerCase() === addr0.toLowerCase()) {
      console.log("\n📋 getter 读取的是 Slot 0");
    } else if (jbcFromGetter.toLowerCase() === addr1.toLowerCase()) {
      console.log("\n📋 getter 读取的是 Slot 1");
    } else {
      console.log("\n⚠️  getter 读取的地址与存储槽不匹配");
    }
    
    // 总结
    console.log("\n📊 总结:");
    if (addr0.toLowerCase() === EXPECTED_JBC.toLowerCase()) {
      console.log("  ✅ JBC 地址已成功更新到 Slot 0");
      console.log("  ✅ 新地址:", EXPECTED_JBC);
      if (jbcFromGetter.toLowerCase() !== EXPECTED_JBC.toLowerCase()) {
        console.log("  ⚠️  但 getter 函数返回的地址不正确");
        console.log("     这可能是因为存储布局变化或 getter 读取了错误的槽");
      } else {
        console.log("  ✅ getter 函数也返回正确的地址");
      }
    } else {
      console.log("  ❌ JBC 地址未更新");
    }
    
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


