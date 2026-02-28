/**
 * 详细检查所有权者和管理员列表
 */

const { ethers } = require("ethers");

const RPC_URL = "https://chain.mcerscan.com/";

const ADDRS = {
  JBC: "0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D",
  PROTOCOL_NEW: "0x0897Cee05E43B2eCf331cd80f881c211eb86844E",
  PROTOCOL_OLD: "0x77601aC473dB1195A1A9c82229C9bD008a69987A",
};

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("🔐 完整权限与所有者映射\n");
  console.log("=".repeat(80) + "\n");

  // 简单的owner查询ABI
  const OWNER_ABI = ["function owner() view returns (address)"];

  const addresses = [
    { name: "JBC Token", addr: ADDRS.JBC },
    { name: "新Protocol", addr: ADDRS.PROTOCOL_NEW },
    { name: "旧Protocol", addr: ADDRS.PROTOCOL_OLD },
  ];

  console.log("📋 各合约当前Owner：\n");

  const owners = {};

  for (const { name, addr } of addresses) {
    const contract = new ethers.Contract(addr, OWNER_ABI, provider);
    try {
      const owner = await contract.owner();
      console.log(`${name}:`);
      console.log(`  合约: ${addr}`);
      console.log(`  Owner: ${owner}\n`);
      owners[name] = owner;
    } catch (e) {
      console.log(`${name}: 无法读取 (${e.message})\n`);
    }
  }

  // 显示唯一的Owner地址
  console.log("=".repeat(80));
  console.log("\n🔑 权限所有者列表：\n");

  const uniqueOwners = new Set(Object.values(owners));
  for (const owner of uniqueOwners) {
    console.log(`◆ ${owner}`);
    
    // 检查是否是合约
    const code = await provider.getCode(owner);
    if (code !== "0x") {
      console.log(`  类型: 合约地址 (可能是Multisig或DAO)`)
    } else {
      console.log(`  类型: 普通账户地址`)
    }
    
    // 显示哪些合约被这个地址控制
    const controlled = Object.entries(owners)
      .filter(([_, o]) => o === owner)
      .map(([name]) => name);
    console.log(`  控制合约: ${controlled.join(" + ")}\n`);
  }

  // 总结
  console.log("=".repeat(80));
  console.log("\n📊 权限总结：\n");

  if (owners["JBC Token"] === owners["新Protocol"]) {
    console.log("✅ JBC Token和新Protocol有相同的Owner，便于集中管理");
  } else {
    console.log("⚠️  JBC Token和新Protocol的Owner不同，需要两个权限才能完全控制");
  }

  console.log("\n所有者信息：");
  for (const [name, owner] of Object.entries(owners)) {
    console.log(`  ${name}: ${owner}`);
  }

  console.log("\n💡 建议：");
  console.log("如果您需要完全控制权，需要拥有以下地址之一的私钥：");
  for (const owner of uniqueOwners) {
    console.log(`  - ${owner}`);
  }
}

main().catch(console.error);
