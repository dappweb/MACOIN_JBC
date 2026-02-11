/**
 * 修复所有用户的 teamTotalVolume
 * 1. 遍历整个推荐树，计算每个用户正确的 teamTotalVolume
 * 2. 对比合约记录，找出差异
 * 3. 用 adminSetTeamTotalVolume 修正
 */

const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = "https://chain.mcerscan.com/";
const CONTRACT = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const abi = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function getDirectReferrals(address) view returns (address[])",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
  "function owner() view returns (address)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(CONTRACT, abi, provider);

  console.log("=== 修复 teamTotalVolume ===\n");

  // Step 1: Collect all users from events
  console.log("Step 1: 收集所有用户地址...");
  const boundEvents = await protocol.queryFilter("BoundReferrer", 0, "latest");
  const ticketEvents = await protocol.queryFilter("TicketPurchased", 0, "latest");

  const allAddrs = new Set();
  for (const e of boundEvents) {
    allAddrs.add(e.args[0].toLowerCase());
    allAddrs.add(e.args[1].toLowerCase());
  }
  for (const e of ticketEvents) {
    allAddrs.add(e.args[0].toLowerCase());
  }
  allAddrs.delete(ethers.ZeroAddress.toLowerCase());
  console.log("总用户数:", allAddrs.size);

  // Step 2: Load all user data
  console.log("\nStep 2: 加载所有用户数据...");
  const users = {};
  const addrs = [...allAddrs];
  let loaded = 0;

  for (let i = 0; i < addrs.length; i++) {
    try {
      const [info, ticket, directs] = await Promise.all([
        protocol.userInfo(addrs[i]),
        protocol.userTicket(addrs[i]),
        protocol.getDirectReferrals(addrs[i])
      ]);
      users[addrs[i]] = {
        addr: ethers.getAddress(addrs[i]),
        referrer: info.referrer.toLowerCase(),
        ticketAmount: ticket.amount,
        teamTotalVolume: info.teamTotalVolume,
        directReferrals: directs.map(a => a.toLowerCase()),
      };
      loaded++;
    } catch (e) {
      // skip
    }
    if (i % 50 === 0) process.stderr.write(`  加载: ${i}/${addrs.length}\r`);
  }
  console.log(`\n  已加载: ${loaded} 用户`);

  // Step 3: Find root nodes
  const roots = [];
  for (const key in users) {
    if (users[key].referrer === ethers.ZeroAddress.toLowerCase()) {
      roots.push(key);
    }
  }
  console.log("根节点:", roots.length);

  // Step 4: Calculate correct teamTotalVolume using post-order DFS
  // teamTotalVolume = sum of all ticket amounts in the entire subtree (excluding self)
  console.log("\nStep 3: 计算正确的 teamTotalVolume...");

  function calcSubtreeVolume(addr, visited) {
    if (visited.has(addr)) return 0n;
    visited.add(addr);

    const u = users[addr];
    if (!u) return 0n;

    let subtreeSum = u.ticketAmount; // This user's own ticket

    for (const child of u.directReferrals) {
      subtreeSum += calcSubtreeVolume(child, visited);
    }

    return subtreeSum;
  }

  // For each user, teamTotalVolume = total tickets of all descendants (NOT including self)
  const correctVolumes = {};
  
  for (const key in users) {
    const u = users[key];
    let teamVol = 0n;
    
    for (const child of u.directReferrals) {
      const visited = new Set();
      visited.add(key); // exclude self
      teamVol += calcSubtreeVolume(child, visited);
    }
    
    correctVolumes[key] = teamVol;
  }

  // Step 5: Find discrepancies
  console.log("\nStep 4: 对比合约数据，找出差异...\n");
  const fixes = [];

  for (const key in users) {
    const contractVol = users[key].teamTotalVolume;
    const correctVol = correctVolumes[key];

    if (contractVol !== correctVol) {
      const diff = correctVol - contractVol;
      fixes.push({
        addr: users[key].addr,
        contractVol: ethers.formatEther(contractVol),
        correctVol: ethers.formatEther(correctVol),
        diff: ethers.formatEther(diff),
        correctVolWei: correctVol
      });
    }
  }

  console.log(`需要修复的用户数: ${fixes.length}`);
  console.log(`无需修复的用户数: ${Object.keys(users).length - fixes.length}\n`);

  if (fixes.length === 0) {
    console.log("✅ 所有用户的 teamTotalVolume 都是正确的！");
    return;
  }

  // Sort by diff descending
  fixes.sort((a, b) => parseFloat(b.diff) - parseFloat(a.diff));

  console.log("=== 需要修复的用户 ===");
  console.log("地址                                       | 合约值      | 正确值      | 差异");
  console.log("-".repeat(95));
  for (const f of fixes) {
    console.log(
      `${f.addr} | ${f.contractVol.padStart(11)} | ${f.correctVol.padStart(11)} | ${f.diff}`
    );
  }

  // Step 6: Execute fixes
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log("\n⚠️ 未设置 PRIVATE_KEY 环境变量，仅输出修复清单");
    console.log("设置后重新运行即可自动修复");
    return;
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const protocolWithSigner = protocol.connect(wallet);
  
  const owner = await protocol.owner();
  if (wallet.address.toLowerCase() !== owner.toLowerCase()) {
    console.log("\n❌ 当前钱包不是合约 owner，无法修复");
    console.log("  钱包地址:", wallet.address);
    console.log("  合约 owner:", owner);
    return;
  }

  console.log(`\n开始修复 ${fixes.length} 个用户...`);
  let fixed = 0, failed = 0;

  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i];
    try {
      process.stdout.write(`  [${i + 1}/${fixes.length}] ${f.addr.slice(0, 8)}... ${f.contractVol} -> ${f.correctVol} ... `);
      const tx = await protocolWithSigner.adminSetTeamTotalVolume(f.addr, f.correctVolWei);
      await tx.wait();
      console.log("✅");
      fixed++;
    } catch (e) {
      console.log("❌", e.message?.slice(0, 80));
      failed++;
    }
    
    // Rate limit
    if (i % 10 === 9) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== 修复完成 ===`);
  console.log(`成功: ${fixed}, 失败: ${failed}`);
}

main().catch(console.error);
