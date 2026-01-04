const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const OWNER_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";

async function checkOwnerMultisig() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("🔍 检查 Owner 地址类型和恢复选项\n");
  console.log("=" .repeat(60));
  console.log(`Owner 地址: ${OWNER_ADDRESS}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 检查地址代码
    console.log("📋 步骤 1: 检查地址代码");
    const code = await provider.getCode(OWNER_ADDRESS);
    
    if (code === "0x") {
      console.log(`    ❌ 这是普通地址（EOA），如果私钥丢失，无法恢复`);
      console.log(`    ⚠️  只能通过私钥恢复，没有其他方法`);
      return;
    }
    
    const codeSize = (code.length - 2) / 2;
    console.log(`    ✅ 这是合约地址（有代码）`);
    console.log(`    代码大小: ${codeSize} 字节`);
    console.log(`    代码前100字符: ${code.substring(0, 100)}...\n`);

    // 2. 检查是否是常见的多签钱包
    console.log("📋 步骤 2: 检查是否是常见多签钱包");
    
    // 检查是否是 Gnosis Safe
    const gnosisSafeABI = [
      "function getThreshold() view returns (uint256)",
      "function getOwners() view returns (address[])",
      "function isOwner(address owner) view returns (bool)",
    ];
    
    try {
      const safeContract = new ethers.Contract(OWNER_ADDRESS, gnosisSafeABI, provider);
      const threshold = await safeContract.getThreshold();
      const owners = await safeContract.getOwners();
      
      console.log(`    ✅ 这是 Gnosis Safe 多签钱包！`);
      console.log(`    阈值: ${threshold.toString()} / ${owners.length}`);
      console.log(`    所有者列表:`);
      owners.forEach((owner, index) => {
        console.log(`      ${index + 1}. ${owner}`);
      });
      console.log(`\n    ✅ 恢复方案: 可以通过其他 ${threshold.toString()} 个签名者恢复 Owner 权限`);
      console.log(`    需要至少 ${threshold.toString()} 个签名者同意才能执行操作`);
      return;
    } catch (e) {
      console.log(`    ⚠️  不是 Gnosis Safe 多签钱包`);
    }

    // 检查是否是其他多签钱包（如 MultiSigWallet）
    const multisigABI = [
      "function required() view returns (uint256)",
      "function owners(uint256) view returns (address)",
      "function getOwners() view returns (address[])",
    ];
    
    try {
      const multisigContract = new ethers.Contract(OWNER_ADDRESS, multisigABI, provider);
      const required = await multisigContract.required();
      console.log(`    ✅ 这是多签钱包！`);
      console.log(`    所需签名数: ${required.toString()}`);
      console.log(`    ✅ 恢复方案: 可以通过其他签名者恢复`);
      return;
    } catch (e) {
      console.log(`    ⚠️  不是标准多签钱包`);
    }

    // 3. 检查是否是时间锁合约
    console.log("\n📋 步骤 3: 检查是否是时间锁合约");
    const timelockABI = [
      "function admin() view returns (address)",
      "function pendingAdmin() view returns (address)",
      "function delay() view returns (uint256)",
    ];
    
    try {
      const timelockContract = new ethers.Contract(OWNER_ADDRESS, timelockABI, provider);
      const admin = await timelockContract.admin();
      const delay = await timelockContract.delay();
      
      console.log(`    ✅ 这是时间锁合约！`);
      console.log(`    管理员: ${admin}`);
      console.log(`    延迟时间: ${delay.toString()} 秒`);
      console.log(`    ✅ 恢复方案: 可以通过管理员 ${admin} 恢复`);
      return;
    } catch (e) {
      console.log(`    ⚠️  不是时间锁合约`);
    }

    // 4. 尝试解析合约代码，查找可能的函数
    console.log("\n📋 步骤 4: 分析合约代码");
    console.log(`    代码大小: ${codeSize} 字节`);
    
    // 检查常见的函数选择器
    const commonSelectors = {
      "0xa97b3d40": "transferOwnership",
      "0x715018a6": "renounceOwnership",
      "0x8da5cb5b": "owner",
      "0x5c60da1b": "implementation",
      "0xf851a440": "admin",
    };
    
    console.log(`    检查常见函数选择器:`);
    for (const [selector, name] of Object.entries(commonSelectors)) {
      if (code.includes(selector.substring(2))) {
        console.log(`      ✅ 找到函数: ${name} (${selector})`);
      }
    }

    // 5. 检查区块浏览器信息
    console.log("\n📋 步骤 5: 建议检查区块浏览器");
    console.log(`    区块浏览器: https://mcerscan.com/address/${OWNER_ADDRESS}`);
    console.log(`    建议:`);
    console.log(`      1. 查看合约的源代码（如果已验证）`);
    console.log(`      2. 查看合约的创建交易`);
    console.log(`      3. 查看合约的调用历史`);
    console.log(`      4. 查找是否有其他管理员或恢复机制`);

    // 6. 可能的恢复方案总结
    console.log("\n📋 步骤 6: 可能的恢复方案");
    console.log("=" .repeat(60));
    
    console.log("\n方案 A: 如果是多签钱包");
    console.log("  ✅ 通过其他签名者恢复");
    console.log("  ✅ 需要足够的签名者同意");
    
    console.log("\n方案 B: 如果是时间锁");
    console.log("  ✅ 通过管理员恢复");
    console.log("  ✅ 需要管理员权限");
    
    console.log("\n方案 C: 检查合约源代码");
    console.log("  ⚠️  查看合约是否有恢复机制");
    console.log("  ⚠️  查看是否有备用 Owner");
    console.log("  ⚠️  查看是否有紧急恢复功能");
    
    console.log("\n方案 D: 升级实现合约（如果可能）");
    console.log("  ⚠️  需要实现合约的升级权限");
    console.log("  ⚠️  可以部署新实现，添加 Owner 恢复功能");
    console.log("  ⚠️  但需要当前 Owner 权限（如果丢失则不可行）");
    
    console.log("\n方案 E: 部署新合约（最后手段）");
    console.log("  ❌ 需要迁移所有用户数据");
    console.log("  ❌ 成本高，影响大");
    console.log("  ❌ 不推荐");

    console.log("\n" + "=" .repeat(60));
    console.log("✅ 检查完成");
    console.log("\n⚠️  重要提示:");
    console.log("  1. 如果这是多签钱包，联系其他签名者");
    console.log("  2. 如果这是时间锁，联系管理员");
    console.log("  3. 检查合约源代码，查找恢复机制");
    console.log("  4. 查看区块浏览器，获取更多信息");

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    console.error(error.stack);
  }
}

// 执行检查
checkOwnerMultisig().catch(console.error);

