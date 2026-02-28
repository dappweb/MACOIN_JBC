/**
 * 查询JBC和Protocol合约的所有权和控制权
 * 确认用户账号的权限级别
 */

const { ethers } = require("ethers");

const RPC_URL = "https://chain.mcerscan.com/";

// 合约地址
const CONTRACTS = {
  JBC_TOKEN: "0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D",
  NEW_PROTOCOL: "0x0897Cee05E43B2eCf331cd80f881c211eb86844E",
  OLD_PROTOCOL: "0x77601aC473dB1195A1A9c82229C9bD008a69987A",
};

const ABIS = {
  TOKEN: [
    "function owner() view returns (address)",
    "function admin() view returns (address)",
  ],
  PROTOCOL: [
    "function owner() view returns (address)",
    "function admin() view returns (address)",
    "function getImplementation() view returns (address)",
    "function IMPLEMENTATION_SLOT() view returns (bytes32)",
  ],
};

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("🔐 JBC Token & Protocol 权限与所有权检查\n");
  console.log("=".repeat(80) + "\n");

  try {
    // 检查JBC Token
    console.log("📋 JBC Token 权限：\n");
    const jbcToken = new ethers.Contract(
      CONTRACTS.JBC_TOKEN,
      ABIS.TOKEN,
      provider
    );

    try {
      const jbcOwner = await jbcToken.owner();
      console.log(`  Owner: ${jbcOwner}`);
      console.log(`  是否为proxy: 需要检查字节码`);
    } catch (e) {
      console.log(`  Owner: 无法获取 (${e.message})`);
    }

    // 检查新Protocol
    console.log("\n📋 新Protocol合约 (0x0897Cee05...) 权限：\n");
    const newProtocol = new ethers.Contract(
      CONTRACTS.NEW_PROTOCOL,
      ABIS.PROTOCOL,
      provider
    );

    try {
      const newProtocolOwner = await newProtocol.owner();
      console.log(`  Owner: ${newProtocolOwner}`);
    } catch (e) {
      console.log(`  Owner: 无法直接获取`);
    }

    // 检查旧Protocol
    console.log("\n📋 旧Protocol合约 (0x77601A...) 权限：\n");
    const oldProtocol = new ethers.Contract(
      CONTRACTS.OLD_PROTOCOL,
      ABIS.PROTOCOL,
      provider
    );

    try {
      const oldProtocolOwner = await oldProtocol.owner();
      console.log(`  Owner: ${oldProtocolOwner}`);
    } catch (e) {
      console.log(`  Owner: 无法直接获取`);
    }

    // 使用storage slot查询proxy信息（标准UUPS）
    console.log("\n📋 Proxy信息（UUPS标准）：\n");

    // EIP-1967标准slot
    const IMPL_SLOT =
      "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d4e31a0";
    const ADMIN_SLOT =
      "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

    try {
      const implStorage = await provider.getStorage(
        CONTRACTS.NEW_PROTOCOL,
        IMPL_SLOT
      );
      const implAddress =
        "0x" + implStorage.slice(-40);
      console.log(`  新Protocol Implementation: ${implAddress}`);
    } catch (e) {
      console.log(`  新Protocol Implementation: 无法读取 (${e.message})`);
    }

    try {
      const adminStorage = await provider.getStorage(
        CONTRACTS.NEW_PROTOCOL,
        ADMIN_SLOT
      );
      const adminAddress = "0x" + adminStorage.slice(-40);
      if (adminAddress !== "0x0000000000000000000000000000000000000000") {
        console.log(`  新Protocol Admin: ${adminAddress}`);
      } else {
        console.log(`  新Protocol Admin: 无（透明代理）`);
      }
    } catch (e) {
      console.log(`  新Protocol Admin: 无法读取`);
    }

    // 尝试调用管理函数检查权限
    console.log("\n📊 管理函数列表：\n");
    
    const adminFunctions = [
      "setLevelRewardPercent",
      "setPaused",
      "transferOwnership",
      "renounceOwnership",
      "setTicketFlexibilityDuration",
      "setLiquidityEnabled",
      "setRedeemEnabled",
      "withdrawLevelRewardPool",
      "setAdminUser",
      "removeAdminUser",
      "modifyUserTeamCount",
      "modifyUserTeamVolume",
    ];

    console.log(`  可能的admin函数：${adminFunctions.join(", ")}\n`);

    // 检查是否是multisig
    console.log("📋 检查是否使用了Multisig钱包：\n");

    const newOwner = await newProtocol.owner();
    const jbcOwner2 = await jbcToken.owner();

    console.log(`  新Protocol Owner: ${newOwner}`);
    console.log(`  JBC Token Owner: ${jbcOwner2}`);

    // 检查这个地址是否是合约（可能是multisig）
    const ownerCode = await provider.getCode(newOwner);
    const jbcOwnerCode = await provider.getCode(jbcOwner2);

    if (ownerCode !== "0x") {
      console.log(`  ⚠️  Protocol Owner是合约地址 → 可能是Multisig或其他控制合约`);
    } else {
      console.log(`  ✓ Protocol Owner是普通账户地址`);
    }

    if (jbcOwnerCode !== "0x") {
      console.log(`  ⚠️  JBC Owner是合约地址 → 可能是Multisig或其他控制合约`);
    } else {
      console.log(`  ✓ JBC Owner是普通账户地址`);
    }

    // 输出完整信息
    console.log("\n" + "=".repeat(80));
    console.log("\n🔑 完整权限映射：\n");

    console.log(`Protocol新合约权限：`);
    console.log(`  合约地址: ${CONTRACTS.NEW_PROTOCOL}`);
    console.log(`  Owner: ${newOwner}`);
    console.log(`  是否控制权: ${newOwner === (await provider.getSigner()?.getAddress()).catch(() => "unknown") ? "是（你的账号）" : "否（其他账户）"}`);

    console.log(`\nJBC Token权限：`);
    console.log(`  合约地址: ${CONTRACTS.JBC_TOKEN}`);
    console.log(`  Owner: ${jbcOwner2}`);
    console.log(`  是否控制权: ${jbcOwner2 === (await provider.getSigner()?.getAddress()).catch(() => "unknown") ? "是（你的账号）" : "否（其他账户）"}`);

    console.log(`\n⚠️  注意事项：`);
    console.log(`  1. Owner可以升级合约实现`);
    console.log(`  2. Owner可以修改关键参数`);
    console.log(`  3. Owner可以提取奖励池资金`);
    console.log(`  4. 如果Owner是Multisig，需要多个签名者同意`);
    console.log(`  5. 检查是否有Timelock锁定（延迟执行）\n`);
  } catch (error) {
    console.error("❌ 错误:", error.message);
  }
}

main().catch(console.error);
