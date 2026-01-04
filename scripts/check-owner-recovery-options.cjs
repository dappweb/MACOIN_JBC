const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// EIP-1967 存储槽
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

// OwnableUpgradeable 的 owner 存储槽（通常是 slot 0，但在 UUPS 中可能不同）
const OWNER_SLOT = "0x0";

async function checkOwnerRecoveryOptions() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("🔍 检查 Owner 恢复选项\n");
  console.log("=" .repeat(60));
  console.log(`协议合约地址: ${PROTOCOL_ADDRESS}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 检查当前 Owner
    console.log("📋 步骤 1: 检查当前 Owner");
    const PROTOCOL_ABI = ["function owner() view returns (address)"];
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    try {
      const currentOwner = await protocol.owner();
      console.log(`    当前 Owner: ${currentOwner}`);
      
      // 检查 Owner 地址类型
      const ownerCode = await provider.getCode(currentOwner);
      if (ownerCode !== "0x") {
        console.log(`    Owner 类型: 合约地址（有代码）`);
        console.log(`    ⚠️  如果是多签钱包，可能可以通过多签恢复`);
      } else {
        console.log(`    Owner 类型: 普通地址（EOA）`);
        console.log(`    ❌ 如果私钥丢失，无法直接恢复`);
      }
    } catch (e) {
      console.log(`    ⚠️  无法读取 Owner: ${e.message}`);
    }

    // 2. 检查代理合约管理员
    console.log("\n📋 步骤 2: 检查代理合约管理员");
    try {
      const adminSlot = await provider.getStorage(PROTOCOL_ADDRESS, ADMIN_SLOT);
      const adminAddress = "0x" + adminSlot.slice(-40);
      
      if (adminAddress !== "0x0000000000000000000000000000000000000000") {
        console.log(`    代理管理员: ${adminAddress}`);
        
        const adminCode = await provider.getCode(adminAddress);
        if (adminCode !== "0x") {
          console.log(`    管理员类型: 合约地址（可能是多签或时间锁）`);
          console.log(`    ✅ 可能可以通过管理员权限恢复 Owner`);
        } else {
          console.log(`    管理员类型: 普通地址`);
        }
      } else {
        console.log(`    代理管理员: 零地址（UUPS 模式，无独立管理员）`);
        console.log(`    ⚠️  无法通过管理员恢复`);
      }
    } catch (e) {
      console.log(`    ⚠️  无法读取管理员: ${e.message}`);
    }

    // 3. 检查实现合约
    console.log("\n📋 步骤 3: 检查实现合约");
    try {
      const implementationSlot = await provider.getStorage(PROTOCOL_ADDRESS, IMPLEMENTATION_SLOT);
      const implAddress = "0x" + implementationSlot.slice(-40);
      console.log(`    实现合约: ${implAddress}`);
      
      // 检查实现合约的 Owner（如果有）
      try {
        const implContract = new ethers.Contract(implAddress, PROTOCOL_ABI, provider);
        const implOwner = await implContract.owner();
        console.log(`    实现合约 Owner: ${implOwner}`);
        console.log(`    ⚠️  在 UUPS 模式下，实现合约的 Owner 通常不重要`);
      } catch (e) {
        console.log(`    实现合约无 Owner 函数或无法访问`);
      }
    } catch (e) {
      console.log(`    ⚠️  无法读取实现合约: ${e.message}`);
    }

    // 4. 检查存储槽中的 Owner
    console.log("\n📋 步骤 4: 检查存储槽中的 Owner");
    try {
      // OwnableUpgradeable 的 owner 通常在特定存储槽
      const slot0 = await provider.getStorage(PROTOCOL_ADDRESS, "0x0");
      const ownerFromSlot = "0x" + slot0.slice(-40);
      console.log(`    Slot 0 中的地址: ${ownerFromSlot}`);
      
      if (ownerFromSlot !== "0x0000000000000000000000000000000000000000") {
        console.log(`    ⚠️  这可能是 Owner 地址，但需要验证`);
      }
    } catch (e) {
      console.log(`    ⚠️  无法读取存储槽: ${e.message}`);
    }

    // 5. 可能的恢复方案
    console.log("\n📋 步骤 5: 可能的恢复方案");
    console.log("=" .repeat(60));
    
    console.log("\n方案 1: 如果 Owner 是多签钱包");
    console.log("  ✅ 可以通过多签钱包的其他签名者恢复");
    console.log("  ✅ 需要多签钱包的恢复机制");
    
    console.log("\n方案 2: 如果 Owner 是时间锁合约");
    console.log("  ✅ 可以通过时间锁的管理员恢复");
    console.log("  ✅ 需要时间锁的管理权限");
    
    console.log("\n方案 3: 升级实现合约（如果可能）");
    console.log("  ⚠️  需要实现合约的升级权限");
    console.log("  ⚠️  可以部署新的实现合约，添加 Owner 恢复功能");
    console.log("  ⚠️  但需要当前 Owner 或代理管理员权限");
    
    console.log("\n方案 4: 检查是否有备份 Owner");
    console.log("  ⚠️  检查合约是否有备用 Owner 机制");
    console.log("  ⚠️  检查是否有紧急恢复地址");
    
    console.log("\n方案 5: 社区治理（如果适用）");
    console.log("  ⚠️  如果有 DAO 或治理机制，可能可以通过治理恢复");
    
    console.log("\n方案 6: 部署新合约（最后手段）");
    console.log("  ❌ 需要迁移所有用户数据");
    console.log("  ❌ 成本高，影响大");
    console.log("  ❌ 不推荐，除非其他方案都不可行");

    // 6. 检查合约是否有紧急恢复功能
    console.log("\n📋 步骤 6: 检查合约紧急恢复功能");
    const FULL_ABI = [
      "function owner() view returns (address)",
      "function emergencyPause() external",
      "function emergencyUnpause() external",
      "function rescueTokens(address token, address to, uint256 amount) external",
      "function emergencyWithdrawNative(address to, uint256 amount) external",
    ];
    
    const fullProtocol = new ethers.Contract(PROTOCOL_ADDRESS, FULL_ABI, provider);
    
    try {
      // 检查是否有紧急暂停功能（通常只有 Owner 可以调用）
      console.log("    检查紧急功能...");
      console.log("    ⚠️  这些功能需要 Owner 权限，如果 Owner 丢失则无法使用");
    } catch (e) {
      // 忽略
    }

    console.log("\n" + "=" .repeat(60));
    console.log("✅ 检查完成");
    console.log("\n⚠️  重要提示:");
    console.log("  1. 如果 Owner 私钥丢失，恢复非常困难");
    console.log("  2. 如果是多签钱包，可以通过其他签名者恢复");
    console.log("  3. 如果是时间锁，可以通过管理员恢复");
    console.log("  4. 建议检查是否有备份或恢复机制");
    console.log("  5. 如果无法恢复，可能需要考虑部署新合约并迁移数据");

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    console.error(error.stack);
  }
}

// 执行检查
checkOwnerRecoveryOptions().catch(console.error);

