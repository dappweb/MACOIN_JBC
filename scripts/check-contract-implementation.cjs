const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// EIP-1967 存储槽
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function implementation() view returns (address)",
  "function admin() view returns (address)",
  "function directRewardPercent() view returns (uint256)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function checkContractImplementation() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔍 检查合约实现地址和代理关系\n");
  console.log("=" .repeat(60));
  console.log(`协议合约地址: ${PROTOCOL_ADDRESS}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 检查是否是代理合约（通过 EIP-1967 存储槽）
    console.log("📋 检查代理合约信息:");
    
    // 方法1: 直接读取存储槽
    console.log("\n  方法1: 读取 EIP-1967 存储槽");
    try {
      const implementationSlot = await provider.getStorage(PROTOCOL_ADDRESS, IMPLEMENTATION_SLOT);
      const adminSlot = await provider.getStorage(PROTOCOL_ADDRESS, ADMIN_SLOT);
      
      // 转换存储槽值（取最后20字节作为地址）
      const implAddress = "0x" + implementationSlot.slice(-40);
      const adminAddress = "0x" + adminSlot.slice(-40);
      
      if (implAddress !== "0x0000000000000000000000000000000000000000") {
        console.log(`    ✅ 找到实现合约地址: ${implAddress}`);
        console.log(`    ✅ 找到管理员地址: ${adminAddress}`);
        console.log(`    📌 这是一个代理合约！`);
      } else {
        console.log(`    ⚠️  未找到实现合约地址（可能不是代理合约）`);
      }
    } catch (slotError) {
      console.log(`    ⚠️  无法读取存储槽: ${slotError.message}`);
    }
    
    // 方法2: 尝试调用 implementation() 函数
    console.log("\n  方法2: 调用 implementation() 函数");
    try {
      const implAddress = await protocol.implementation();
      if (implAddress && implAddress !== ethers.ZeroAddress) {
        console.log(`    ✅ 实现合约地址: ${implAddress}`);
      } else {
        console.log(`    ⚠️  未实现 implementation() 函数或返回零地址`);
      }
    } catch (implError) {
      console.log(`    ⚠️  无法调用 implementation(): ${implError.message}`);
    }
    
    // 方法3: 尝试调用 admin() 函数
    console.log("\n  方法3: 调用 admin() 函数");
    try {
      const adminAddress = await protocol.admin();
      if (adminAddress && adminAddress !== ethers.ZeroAddress) {
        console.log(`    ✅ 管理员地址: ${adminAddress}`);
      } else {
        console.log(`    ⚠️  未实现 admin() 函数或返回零地址`);
      }
    } catch (adminError) {
      console.log(`    ⚠️  无法调用 admin(): ${adminError.message}`);
    }

    // 2. 检查合约代码
    console.log("\n📋 检查合约代码:");
    try {
      const code = await provider.getCode(PROTOCOL_ADDRESS);
      if (code === "0x") {
        console.log("    ❌ 合约地址没有代码！");
      } else {
        const codeSize = (code.length - 2) / 2; // 字节数
        console.log(`    ✅ 合约有代码，大小: ${codeSize} 字节`);
        
        // 检查是否是代理合约的典型模式（delegatecall）
        if (code.includes("delegatecall") || code.includes("DELEGATECALL")) {
          console.log(`    ✅ 代码包含 delegatecall，可能是代理合约`);
        }
      }
    } catch (codeError) {
      console.log(`    ⚠️  无法获取合约代码: ${codeError.message}`);
    }

    // 3. 检查关键函数和参数
    console.log("\n📋 检查关键参数:");
    try {
      const directRewardPercent = await protocol.directRewardPercent();
      console.log(`    ✅ 直推奖励比例: ${directRewardPercent.toString()}%`);
      
      if (directRewardPercent.toString() !== "25") {
        console.log(`    ⚠️  警告：直推奖励比例不是 25%！`);
      }
    } catch (paramError) {
      console.log(`    ⚠️  无法获取参数: ${paramError.message}`);
    }

    // 4. 检查实现合约（如果找到）
    console.log("\n📋 检查实现合约:");
    let implAddress = null;
    
    // 尝试多种方法获取实现地址
    try {
      implAddress = await protocol.implementation();
    } catch (e) {
      try {
        const implementationSlot = await provider.getStorage(PROTOCOL_ADDRESS, IMPLEMENTATION_SLOT);
        implAddress = "0x" + implementationSlot.slice(-40);
        if (implAddress === "0x0000000000000000000000000000000000000000") {
          implAddress = null;
        }
      } catch (e2) {
        // 忽略
      }
    }
    
    if (implAddress && implAddress !== ethers.ZeroAddress) {
      console.log(`    实现合约地址: ${implAddress}`);
      
      // 检查实现合约代码
      try {
        const implCode = await provider.getCode(implAddress);
        if (implCode === "0x") {
          console.log(`    ❌ 实现合约地址没有代码！`);
        } else {
          const implCodeSize = (implCode.length - 2) / 2;
          console.log(`    ✅ 实现合约有代码，大小: ${implCodeSize} 字节`);
          
          // 检查实现合约是否包含关键函数
          const implContract = new ethers.Contract(implAddress, PROTOCOL_ABI, provider);
          try {
            const implDirectReward = await implContract.directRewardPercent();
            console.log(`    ✅ 实现合约直推奖励比例: ${implDirectReward.toString()}%`);
          } catch (e) {
            console.log(`    ⚠️  无法从实现合约读取参数`);
          }
        }
      } catch (implCodeError) {
        console.log(`    ⚠️  无法获取实现合约代码: ${implCodeError.message}`);
      }
    } else {
      console.log(`    ⚠️  未找到实现合约地址（可能不是代理合约或使用不同模式）`);
    }

    // 5. 检查购买时的推荐奖励逻辑
    console.log("\n📋 分析推荐奖励问题:");
    
    // 对比代理合约和实现合约的参数
    try {
      const proxyDirectReward = await protocol.directRewardPercent();
      if (implAddress && implAddress !== ethers.ZeroAddress) {
        const implContract = new ethers.Contract(implAddress, PROTOCOL_ABI, provider);
        try {
          const implDirectReward = await implContract.directRewardPercent();
          console.log(`    代理合约直推奖励比例: ${proxyDirectReward.toString()}%`);
          console.log(`    实现合约直推奖励比例: ${implDirectReward.toString()}%`);
          
          if (proxyDirectReward.toString() !== implDirectReward.toString()) {
            console.log(`    ❌ 严重问题：代理合约和实现合约的直推奖励比例不一致！`);
            console.log(`    这说明：`);
            console.log(`      1. 代理合约读取的是代理存储中的值（25%）`);
            console.log(`      2. 实现合约读取的是实现合约存储中的值（0%）`);
            console.log(`      3. 在 UUPS 代理模式下，状态应该存储在代理合约中`);
            console.log(`      4. 如果实现合约的 directRewardPercent 为 0，可能导致奖励计算错误`);
          } else {
            console.log(`    ✅ 代理合约和实现合约的直推奖励比例一致`);
          }
        } catch (e) {
          console.log(`    ⚠️  无法对比参数: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`    ⚠️  无法检查参数对比: ${e.message}`);
    }
    
    console.log("\n    根据检查结果，需要确认：");
    console.log("    1. 实现合约版本是否正确");
    console.log("    2. 代理合约是否正确委托调用");
    console.log("    3. 存储布局是否匹配");
    console.log("    4. 实现合约是否正确初始化");
    
    // 6. 检查是否有其他相关合约
    console.log("\n📋 检查相关合约地址:");
    const knownAddresses = {
      "JBC Token": "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da",
      "Daily Burn Manager": "0x298578A691f10A85f027BDD2D9a8D007540FCBB4",
    };
    
    for (const [name, address] of Object.entries(knownAddresses)) {
      try {
        const code = await provider.getCode(address);
        if (code !== "0x") {
          console.log(`    ✅ ${name}: ${address} (有代码)`);
        } else {
          console.log(`    ⚠️  ${name}: ${address} (无代码)`);
        }
      } catch (e) {
        console.log(`    ⚠️  ${name}: ${address} (无法检查)`);
      }
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
checkContractImplementation().catch(console.error);

