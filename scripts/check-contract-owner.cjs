const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function isOwner(address) view returns (bool)",
];

async function checkContractOwner() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔍 检查合约 Owner 地址\n");
  console.log("=" .repeat(60));
  console.log(`协议合约地址: ${PROTOCOL_ADDRESS}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 方法1: 调用 owner() 函数
    console.log("📋 方法1: 调用 owner() 函数");
    try {
      const owner = await protocol.owner();
      console.log(`    ✅ Owner 地址: ${owner}`);
      
      // 检查是否是零地址
      if (owner === ethers.ZeroAddress) {
        console.log(`    ⚠️  警告：Owner 为零地址！`);
      } else {
        // 检查地址是否有代码（可能是合约地址）
        const code = await provider.getCode(owner);
        if (code !== "0x") {
          console.log(`    📌 Owner 是一个合约地址（有代码）`);
        } else {
          console.log(`    📌 Owner 是一个普通地址（EOA）`);
        }
        
        // 检查余额
        const balance = await provider.getBalance(owner);
        console.log(`    💰 Owner 余额: ${ethers.formatEther(balance)} MC`);
      }
    } catch (error) {
      console.log(`    ⚠️  无法调用 owner(): ${error.message}`);
    }

    // 方法2: 检查是否是 OwnableUpgradeable 合约
    console.log("\n📋 方法2: 检查 OwnableUpgradeable 存储槽");
    try {
      // OwnableUpgradeable 的 owner 存储在特定存储槽
      // 通常是 slot 0（在 UUPS 代理中可能不同）
      const slot0 = await provider.getStorage(PROTOCOL_ADDRESS, "0x0");
      const ownerFromSlot = "0x" + slot0.slice(-40);
      
      if (ownerFromSlot !== "0x0000000000000000000000000000000000000000") {
        console.log(`    从 Slot 0 读取的地址: ${ownerFromSlot}`);
        
        // 验证这个地址是否是 owner
        try {
          const isOwner = await protocol.isOwner(ownerFromSlot);
          if (isOwner) {
            console.log(`    ✅ 确认是 Owner 地址`);
          }
        } catch (e) {
          // 忽略
        }
      }
    } catch (error) {
      console.log(`    ⚠️  无法读取存储槽: ${error.message}`);
    }

    // 方法3: 检查代理合约的管理员
    console.log("\n📋 方法3: 检查代理合约管理员");
    try {
      // EIP-1967 管理员存储槽
      const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
      const adminSlot = await provider.getStorage(PROTOCOL_ADDRESS, ADMIN_SLOT);
      const adminAddress = "0x" + adminSlot.slice(-40);
      
      if (adminAddress !== "0x0000000000000000000000000000000000000000") {
        console.log(`    代理管理员地址: ${adminAddress}`);
        
        // 检查是否是 owner
        try {
          const isOwner = await protocol.isOwner(adminAddress);
          if (isOwner) {
            console.log(`    ✅ 代理管理员也是 Owner`);
          }
        } catch (e) {
          // 忽略
        }
      } else {
        console.log(`    ⚠️  代理管理员为零地址（可能是 UUPS 模式，owner 在实现合约中）`);
      }
    } catch (error) {
      console.log(`    ⚠️  无法读取管理员存储槽: ${error.message}`);
    }

    console.log("\n" + "=" .repeat(60));
    console.log("✅ 检查完成");

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    if (error.data) {
      console.error("错误数据:", error.data);
    }
    console.error(error.stack);
  }
}

// 执行检查
checkContractOwner().catch(console.error);

