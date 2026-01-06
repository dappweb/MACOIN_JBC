const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 恢复剩余数据脚本
 * 从备份文件中恢复系统状态和余额数据到新合约
 */
const BACKUP_FILE = process.env.BACKUP_FILE || "scripts/backups/protocol-backup-1767522095585.json";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || process.argv[2];
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!NEW_PROTOCOL_ADDRESS) {
  console.error("❌ 请提供新协议合约地址");
  console.log("使用方法: NEW_PROTOCOL_ADDRESS=0x... node scripts/restore-remaining-data.cjs");
  console.log("或: node scripts/restore-remaining-data.cjs <新合约地址>");
  process.exit(1);
}

const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function adminSetSwapReserves(uint256 newSwapReserveMC, uint256 newSwapReserveJBC) external",
  "function adminSetNextTicketId(uint256 newNextTicketId) external",
  "function adminSetNextStakeId(uint256 newNextStakeId) external",
  "function adminSetLastBurnTime(uint256 newLastBurnTime) external",
  "function adminSetRefundFeeAmount(address user, uint256 newRefundFeeAmount) external",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function nextTicketId() view returns (uint256)",
  "function nextStakeId() view returns (uint256)",
  "function lastBurnTime() view returns (uint256)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function restoreRemainingData() {
  console.log("🚀 开始恢复剩余数据\n");
  console.log("=".repeat(60));
  
  // 1. 读取备份数据
  console.log("📋 步骤 1: 读取备份数据");
  if (!fs.existsSync(BACKUP_FILE)) {
    throw new Error(`备份文件不存在: ${BACKUP_FILE}`);
  }
  
  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
  console.log(`    ✅ 已读取备份文件: ${BACKUP_FILE}`);
  console.log(`    备份时间: ${backupData.timestamp}\n`);
  
  // 2. 连接到新合约
  console.log("📋 步骤 2: 连接到新合约");
  const [deployer] = await ethers.getSigners();
  const protocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
  
  console.log(`    部署者地址: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`    部署者余额: ${ethers.formatEther(balance)} MC`);
  
  // 验证 Owner
  const owner = await protocol.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${deployer.address}`);
  }
  console.log(`    ✅ Owner 验证通过\n`);
  
  if (DRY_RUN) {
    console.log("⚠️  干运行模式 - 不会实际执行恢复\n");
  }
  
  // 3. 恢复系统状态数据
  console.log("📋 步骤 3: 恢复系统状态数据");
  console.log("=".repeat(60));
  
  const restoreResults = {
    timestamp: new Date().toISOString(),
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    restored: {},
    failed: []
  };
  
  // 3.1 恢复交换储备
  const backupSwapReserveMC = backupData.balances?.swapReserveMC || "0";
  const backupSwapReserveJBC = backupData.balances?.swapReserveJBC || "0";
  const currentSwapReserveMC = await protocol.swapReserveMC();
  const currentSwapReserveJBC = await protocol.swapReserveJBC();
  
  console.log(`\n📊 交换储备数据:`);
  console.log(`    备份 MC 储备: ${ethers.formatEther(backupSwapReserveMC)} MC`);
  console.log(`    当前 MC 储备: ${ethers.formatEther(currentSwapReserveMC)} MC`);
  console.log(`    备份 JBC 储备: ${ethers.formatEther(backupSwapReserveJBC)} JBC`);
  console.log(`    当前 JBC 储备: ${ethers.formatEther(currentSwapReserveJBC)} JBC`);
  
  if (backupSwapReserveMC !== "0" || backupSwapReserveJBC !== "0") {
    try {
      if (DRY_RUN) {
        console.log(`    🔍 [干运行] 将设置交换储备`);
        restoreResults.restored.swapReserves = {
          status: "dry_run",
          swapReserveMC: ethers.formatEther(backupSwapReserveMC),
          swapReserveJBC: ethers.formatEther(backupSwapReserveJBC)
        };
      } else {
        console.log(`    📤 设置交换储备...`);
        const tx = await protocol.adminSetSwapReserves(backupSwapReserveMC, backupSwapReserveJBC);
        console.log(`    交易哈希: ${tx.hash}`);
        await tx.wait();
        
        const restoredMC = await protocol.swapReserveMC();
        const restoredJBC = await protocol.swapReserveJBC();
        console.log(`    ✅ 交换储备恢复成功`);
        restoreResults.restored.swapReserves = {
          status: "success",
          swapReserveMC: ethers.formatEther(restoredMC),
          swapReserveJBC: ethers.formatEther(restoredJBC)
        };
      }
    } catch (error) {
      console.log(`    ❌ 交换储备恢复失败: ${error.message}`);
      restoreResults.failed.push({
        item: "swapReserves",
        error: error.message
      });
    }
  } else {
    console.log(`    ⏭️  跳过交换储备恢复（备份为 0）`);
    restoreResults.restored.swapReserves = {
      status: "skipped",
      reason: "备份为 0"
    };
  }
  
  // 3.2 恢复系统状态
  const backupNextTicketId = backupData.systemState?.nextTicketId || "0";
  const backupNextStakeId = backupData.systemState?.nextStakeId || "0";
  const backupLastBurnTime = backupData.systemState?.lastBurnTime || "0";
  
  const currentNextTicketId = await protocol.nextTicketId();
  const currentNextStakeId = await protocol.nextStakeId();
  const currentLastBurnTime = await protocol.lastBurnTime();
  
  console.log(`\n📊 系统状态数据:`);
  console.log(`    备份 nextTicketId: ${backupNextTicketId}`);
  console.log(`    当前 nextTicketId: ${currentNextTicketId.toString()}`);
  console.log(`    备份 nextStakeId: ${backupNextStakeId}`);
  console.log(`    当前 nextStakeId: ${currentNextStakeId.toString()}`);
  console.log(`    备份 lastBurnTime: ${backupLastBurnTime}`);
  console.log(`    当前 lastBurnTime: ${currentLastBurnTime.toString()}`);
  
  // 恢复 nextTicketId
  if (backupNextTicketId !== "0" && currentNextTicketId.toString() !== backupNextTicketId) {
    try {
      if (DRY_RUN) {
        console.log(`    🔍 [干运行] 将设置 nextTicketId 为: ${backupNextTicketId}`);
        restoreResults.restored.nextTicketId = { status: "dry_run", value: backupNextTicketId };
      } else {
        const tx = await protocol.adminSetNextTicketId(backupNextTicketId);
        await tx.wait();
        console.log(`    ✅ nextTicketId 恢复成功: ${backupNextTicketId}`);
        restoreResults.restored.nextTicketId = { status: "success", value: backupNextTicketId };
      }
    } catch (error) {
      console.log(`    ❌ nextTicketId 恢复失败: ${error.message}`);
      restoreResults.failed.push({ item: "nextTicketId", error: error.message });
    }
  } else {
    console.log(`    ⏭️  跳过 nextTicketId 恢复`);
    restoreResults.restored.nextTicketId = { status: "skipped" };
  }
  
  // 恢复 nextStakeId
  if (backupNextStakeId !== "0" && currentNextStakeId.toString() !== backupNextStakeId) {
    try {
      if (DRY_RUN) {
        console.log(`    🔍 [干运行] 将设置 nextStakeId 为: ${backupNextStakeId}`);
        restoreResults.restored.nextStakeId = { status: "dry_run", value: backupNextStakeId };
      } else {
        const tx = await protocol.adminSetNextStakeId(backupNextStakeId);
        await tx.wait();
        console.log(`    ✅ nextStakeId 恢复成功: ${backupNextStakeId}`);
        restoreResults.restored.nextStakeId = { status: "success", value: backupNextStakeId };
      }
    } catch (error) {
      console.log(`    ❌ nextStakeId 恢复失败: ${error.message}`);
      restoreResults.failed.push({ item: "nextStakeId", error: error.message });
    }
  } else {
    console.log(`    ⏭️  跳过 nextStakeId 恢复`);
    restoreResults.restored.nextStakeId = { status: "skipped" };
  }
  
  // 恢复 lastBurnTime
  if (backupLastBurnTime !== "0" || currentLastBurnTime.toString() !== backupLastBurnTime) {
    try {
      if (DRY_RUN) {
        console.log(`    🔍 [干运行] 将设置 lastBurnTime 为: ${backupLastBurnTime}`);
        restoreResults.restored.lastBurnTime = { status: "dry_run", value: backupLastBurnTime };
      } else {
        const tx = await protocol.adminSetLastBurnTime(backupLastBurnTime);
        await tx.wait();
        console.log(`    ✅ lastBurnTime 恢复成功: ${backupLastBurnTime}`);
        restoreResults.restored.lastBurnTime = { status: "success", value: backupLastBurnTime };
      }
    } catch (error) {
      console.log(`    ❌ lastBurnTime 恢复失败: ${error.message}`);
      restoreResults.failed.push({ item: "lastBurnTime", error: error.message });
    }
  } else {
    console.log(`    ⏭️  跳过 lastBurnTime 恢复`);
    restoreResults.restored.lastBurnTime = { status: "skipped" };
  }
  
  // 3.3 恢复用户退款手续费
  console.log(`\n📊 用户退款手续费数据:`);
  const usersWithRefundFee = backupData.users.filter(user => {
    const refundFee = user.userInfo?.refundFeeAmount || "0";
    return refundFee !== "0" && refundFee !== 0;
  });
  
  console.log(`    有退款手续费的用户: ${usersWithRefundFee.length}`);
  
  if (usersWithRefundFee.length > 0) {
    let refundFeeCount = 0;
    for (const user of usersWithRefundFee.slice(0, 10)) { // 只显示前10个
      const refundFee = user.userInfo.refundFeeAmount;
      if (DRY_RUN) {
        console.log(`    🔍 [干运行] ${user.address}: ${ethers.formatEther(refundFee)} MC`);
      } else {
        try {
          const currentInfo = await protocol.userInfo(user.address);
          if (currentInfo.refundFeeAmount.toString() !== refundFee) {
            const tx = await protocol.adminSetRefundFeeAmount(user.address, refundFee);
            await tx.wait();
            refundFeeCount++;
          }
        } catch (error) {
          console.log(`    ⚠️  ${user.address} 恢复失败: ${error.message}`);
        }
      }
    }
    
    if (!DRY_RUN) {
      console.log(`    ✅ 已恢复 ${refundFeeCount} 个用户的退款手续费`);
      restoreResults.restored.refundFeeAmount = {
        status: "success",
        count: refundFeeCount,
        total: usersWithRefundFee.length
      };
    } else {
      restoreResults.restored.refundFeeAmount = {
        status: "dry_run",
        total: usersWithRefundFee.length
      };
    }
  } else {
    console.log(`    ⏭️  无需恢复退款手续费`);
    restoreResults.restored.refundFeeAmount = { status: "skipped" };
  }
  
  // 4. 保存恢复结果
  console.log("\n" + "=".repeat(60));
  console.log("📊 恢复摘要");
  console.log("=".repeat(60));
  
  const restoredCount = Object.keys(restoreResults.restored).length;
  const failedCount = restoreResults.failed.length;
  
  console.log(`\n恢复项: ${restoredCount}`);
  console.log(`失败项: ${failedCount}`);
  
  // 保存结果
  const resultsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `remaining-restore-results-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(restoreResults, null, 2));
  console.log(`\n📄 恢复结果已保存: ${resultsFile}`);
  
  return restoreResults;
}

restoreRemainingData()
  .then(() => {
    console.log("\n" + "=".repeat(60));
    console.log("✅ 脚本执行完成");
    console.log("=".repeat(60));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n" + "=".repeat(60));
    console.error("❌ 脚本执行失败");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  });



