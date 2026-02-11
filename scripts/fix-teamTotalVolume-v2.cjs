/**
 * 修复所有用户的 teamTotalVolume (V2 - 正确版本)
 * 
 * 正确计算方法：
 * teamTotalVolume = 所有下级用户（基于新合约推荐树）的历史购票总额
 * 历史购票 = 旧合约 TicketPurchased + 新合约 TicketPurchased 事件之和
 * 
 * teamTotalVolume 是累计值，只增不减（退出/赎回不会扣减）
 */

const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = "https://chain.mcerscan.com/";
const OLD_CONTRACT = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const NEW_CONTRACT = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const abi = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function getDirectReferrals(address) view returns (address[])",
  "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
  "function owner() view returns (address)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)"
];

const DRY_RUN = process.env.DRY_RUN !== "false";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const oldContract = new ethers.Contract(OLD_CONTRACT, abi, provider);
  const newContract = new ethers.Contract(NEW_CONTRACT, abi, provider);

  console.log("=== 修复 teamTotalVolume (V2 - 旧+新合约事件) ===\n");
  console.log("DRY_RUN:", DRY_RUN, DRY_RUN ? "(模拟运行，不写链)" : "(真实执行!)");
  console.log();

  // Step 1: 获取所有 TicketPurchased 事件（旧+新合约）
  console.log("Step 1: 获取 TicketPurchased 事件...");
  const oldTicketEvents = await oldContract.queryFilter("TicketPurchased", 0, "latest");
  console.log(`  旧合约: ${oldTicketEvents.length} 个买票事件`);
  const newTicketEvents = await newContract.queryFilter("TicketPurchased", 0, "latest");
  console.log(`  新合约: ${newTicketEvents.length} 个买票事件`);

  // 汇总每个用户的历史购票总额
  const purchaseMap = {};
  for (const e of [...oldTicketEvents, ...newTicketEvents]) {
    const user = e.args[0].toLowerCase();
    const amount = e.args[1];
    purchaseMap[user] = (purchaseMap[user] || 0n) + amount;
  }
  console.log(`  有购票记录的用户: ${Object.keys(purchaseMap).length}`);

  let totalVol = 0n;
  for (const v of Object.values(purchaseMap)) totalVol += v;
  console.log(`  所有购票总金额: ${ethers.formatEther(totalVol)} MC`);

  // Step 2: 收集所有用户地址
  console.log("\nStep 2: 收集用户列表...");
  const oldBoundEvents = await oldContract.queryFilter("BoundReferrer", 0, "latest");
  const newBoundEvents = await newContract.queryFilter("BoundReferrer", 0, "latest");
  console.log(`  旧合约绑定事件: ${oldBoundEvents.length}`);
  console.log(`  新合约绑定事件: ${newBoundEvents.length}`);

  const allUsers = new Set();
  for (const e of [...oldBoundEvents, ...newBoundEvents]) {
    allUsers.add(e.args[0].toLowerCase());
    allUsers.add(e.args[1].toLowerCase());
  }
  for (const k of Object.keys(purchaseMap)) allUsers.add(k);
  allUsers.delete(ethers.ZeroAddress.toLowerCase());
  console.log(`  总用户数: ${allUsers.size}`);

  // Step 3: 加载新合约中的用户数据（推荐关系+当前teamTotalVolume）
  console.log("\nStep 3: 加载用户数据...");
  const userData = {};
  const addrs = [...allUsers];
  for (let i = 0; i < addrs.length; i++) {
    try {
      const [info, directs] = await Promise.all([
        newContract.userInfo(addrs[i]),
        newContract.getDirectReferrals(addrs[i])
      ]);
      userData[addrs[i]] = {
        addr: ethers.getAddress(addrs[i]),
        referrer: info.referrer.toLowerCase(),
        teamTotalVolume: info.teamTotalVolume,
        directReferrals: directs.map(a => a.toLowerCase()),
      };
    } catch (e) { }
    if (i % 100 === 0) process.stderr.write(`  加载: ${i}/${addrs.length}\r`);
  }
  console.log(`  加载完成: ${Object.keys(userData).length} 个用户`);

  // Step 4: BFS 计算正确的 teamTotalVolume
  console.log("\nStep 4: 计算正确的 teamTotalVolume...");

  function calcCorrectVolume(addr) {
    const u = userData[addr];
    if (!u) return 0n;
    let total = 0n;
    const visited = new Set();
    visited.add(addr);
    const queue = [...u.directReferrals];
    while (queue.length > 0) {
      const child = queue.shift();
      if (visited.has(child)) continue;
      visited.add(child);
      // 该下级的历史购票总额（从事件）
      total += purchaseMap[child] || 0n;
      // 继续遍历下级的直推
      if (userData[child]) {
        for (const sub of userData[child].directReferrals) {
          if (!visited.has(sub)) queue.push(sub);
        }
      }
    }
    return total;
  }

  // 找出差异
  const fixes = [];
  for (const key in userData) {
    const correct = calcCorrectVolume(key);
    const current = userData[key].teamTotalVolume;
    if (correct !== current) {
      fixes.push({
        addr: userData[key].addr,
        currentWei: current,
        correctWei: correct,
        current: ethers.formatEther(current),
        correct: ethers.formatEther(correct),
        diff: ethers.formatEther(correct - current),
      });
    }
  }

  fixes.sort((a, b) => Math.abs(parseFloat(b.diff)) - Math.abs(parseFloat(a.diff)));

  console.log(`  需修复: ${fixes.length} 个用户`);
  console.log(`  无需修复: ${Object.keys(userData).length - fixes.length}`);

  // 显示详情
  console.log("\n=== 需修复列表 ===");
  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i];
    const sign = parseFloat(f.diff) > 0 ? "+" : "";
    console.log(`[${i + 1}] ${f.addr}`);
    console.log(`    当前: ${f.current} MC → 正确: ${f.correct} MC (${sign}${f.diff})`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] 模拟运行完成，不会写链。");
    console.log("请设置 DRY_RUN=false 运行以执行修复。");
    return;
  }

  // Step 5: 执行修复
  console.log("\n=== Step 5: 执行链上修复 ===");
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("错误: 未设置 PRIVATE_KEY 环境变量");
    process.exit(1);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const protocolWithSigner = new ethers.Contract(NEW_CONTRACT, abi, wallet);

  // 验证 owner
  const owner = await newContract.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`错误: 钱包 ${wallet.address} 不是合约 owner (${owner})`);
    process.exit(1);
  }
  console.log(`钱包: ${wallet.address}`);
  console.log(`待修复: ${fixes.length} 个用户\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i];
    try {
      console.log(`[${i + 1}/${fixes.length}] ${f.addr}`);
      console.log(`  ${f.current} → ${f.correct} MC`);

      const tx = await protocolWithSigner.adminSetTeamTotalVolume(f.addr, f.correctWei);
      const receipt = await tx.wait();
      console.log(`  ✅ tx: ${receipt.hash}`);
      successCount++;

      // 简短延迟避免 nonce 问题
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ❌ 失败: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`成功: ${successCount}, 失败: ${failCount}`);
}

main().catch(console.error);
