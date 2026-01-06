const { ethers } = require("hardhat");
const fs = require("path");

/**
 * 完整迁移缺失用户的所有数据
 * 包括：推荐关系、门票数据、质押数据、团队数据、奖励数据等
 */
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const DRY_RUN = process.env.DRY_RUN !== "false";

const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function directReferrals(address, uint256) view returns (address)",
  "function adminSetReferrer(address user, address newReferrer) external",
  "function adminSetUserTicket(address user, uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited) external",
  "function adminSetActiveDirects(address user, uint256 newActiveDirects) external",
  "function adminSetTeamCount(address user, uint256 newTeamCount) external",
  "function adminSetTotalRevenue(address user, uint256 newTotalRevenue) external",
  "function adminSetCurrentCap(address user, uint256 newCurrentCap) external",
  "function adminSetMaxTicketAmounts(address user, uint256 newMaxTicketAmount, uint256 newMaxSingleTicketAmount) external",
  "function adminAddUserStake(address user, uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid) external",
  "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
  "function adminSetTeamTotalCap(address user, uint256 newTeamTotalCap) external",
  "function adminAddDirectReferral(address user, address referral) external",
];

// 需要迁移的用户列表
const MISSING_USERS = [
  "0x30a1d966e4c30fc07a972a8d0261925fea0d6f07",
  "0x1e33131ebf57e8d65f221280ba0fe5cf9e1f30fe",
  "0x637f879a4625f067824f95d7d5a5b4e771b771af",
  "0x7f26fdb3ddeb8c3868da3d52af0300ffd97f6987",
  "0x1095ac56d0e2b579ed8935e610a94b9c5249f525",
  "0x71877cba63c96f8ad3be3495b9d597f317c09e2f",
  "0xd789977de408e7325a757b31e49cf4c6e3add3e8",
  "0x1d02cc58dcc1b24b071d17e354033925fa0540c9",
  "0xc7c9693f26b10b5b93ccac2469eb3ae7b4638dac",
  "0x0ea4a4b654cd77e9ea5b088633e6d5d5b4bbb720", // 有门票但无推荐人
];

async function migrateMissingUsers() {
  console.log("🚀 开始完整迁移缺失用户的所有数据\n");
  console.log("=".repeat(60));
  
  // 1. 连接到合约
  console.log("📋 步骤 1: 连接到合约");
  const [deployer] = await ethers.getSigners();
  const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
  const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
  
  console.log(`    部署者地址: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`    部署者余额: ${ethers.formatEther(balance)} MC`);
  
  // 验证 Owner
  const owner = await newProtocol.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${deployer.address}`);
  }
  console.log(`    ✅ Owner 验证通过`);
  console.log(`    旧合约地址: ${OLD_PROTOCOL_ADDRESS}`);
  console.log(`    新合约地址: ${NEW_PROTOCOL_ADDRESS}`);
  console.log(`    需要迁移的用户数: ${MISSING_USERS.length}\n`);
  
  if (DRY_RUN) {
    console.log("⚠️  干运行模式 - 不会实际执行迁移\n");
  }
  
  // 2. 从旧合约读取所有用户数据
  console.log("📋 步骤 2: 从旧合约读取用户数据");
  console.log("=".repeat(60));
  
  const userData = [];
  
  for (let i = 0; i < MISSING_USERS.length; i++) {
    const userAddress = MISSING_USERS[i];
    console.log(`\n[${i + 1}/${MISSING_USERS.length}] 读取用户数据: ${userAddress}`);
    
    try {
      // 读取用户信息
      const userInfo = await oldProtocol.userInfo(userAddress);
      console.log(`    ✅ 用户信息已读取`);
      
      // 读取门票数据
      const userTicket = await oldProtocol.userTicket(userAddress);
      console.log(`    ✅ 门票数据已读取`);
      
      // 读取质押数据
      const stakes = [];
      let stakeIndex = 0;
      while (true) {
        try {
          const stake = await oldProtocol.userStakes(userAddress, stakeIndex);
          if (stake.id === 0n && stake.amount === 0n) break;
          stakes.push({
            id: stake.id.toString(),
            amount: stake.amount.toString(),
            startTime: stake.startTime.toString(),
            cycleDays: stake.cycleDays.toString(),
            active: stake.active,
            paid: stake.paid.toString()
          });
          stakeIndex++;
        } catch (error) {
          break;
        }
      }
      console.log(`    ✅ 质押数据已读取 (${stakes.length} 条)`);
      
      // 读取直推列表
      const referrals = [];
      let referralIndex = 0;
      while (true) {
        try {
          const referral = await oldProtocol.directReferrals(userAddress, referralIndex);
          if (referral === ethers.ZeroAddress) break;
          referrals.push(referral.toLowerCase());
          referralIndex++;
        } catch (error) {
          break;
        }
      }
      console.log(`    ✅ 直推列表已读取 (${referrals.length} 个)`);
      
      userData.push({
        address: userAddress,
        userInfo: {
          referrer: userInfo.referrer.toLowerCase(),
          activeDirects: userInfo.activeDirects.toString(),
          teamCount: userInfo.teamCount.toString(),
          totalRevenue: userInfo.totalRevenue.toString(),
          currentCap: userInfo.currentCap.toString(),
          isActive: userInfo.isActive,
          refundFeeAmount: userInfo.refundFeeAmount.toString(),
          teamTotalVolume: userInfo.teamTotalVolume.toString(),
          teamTotalCap: userInfo.teamTotalCap.toString(),
          maxTicketAmount: userInfo.maxTicketAmount.toString(),
          maxSingleTicketAmount: userInfo.maxSingleTicketAmount.toString()
        },
        userTicket: {
          ticketId: userTicket.ticketId.toString(),
          amount: userTicket.amount.toString(),
          purchaseTime: userTicket.purchaseTime.toString(),
          exited: userTicket.exited
        },
        userStakes: stakes,
        directReferrals: referrals
      });
      
    } catch (error) {
      console.log(`    ❌ 读取失败: ${error.message}`);
      userData.push({
        address: userAddress,
        error: error.message
      });
    }
  }
  
  console.log(`\n✅ 数据读取完成\n`);
  
  // 3. 迁移数据到新合约
  console.log("📋 步骤 3: 迁移数据到新合约");
  console.log("=".repeat(60));
  
  const migrationResults = {
    timestamp: new Date().toISOString(),
    newProtocolAddress: NEW_PROTOCOL_ADDRESS,
    oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
    totalUsers: MISSING_USERS.length,
    migrated: [],
    failed: []
  };
  
  for (let i = 0; i < userData.length; i++) {
    const user = userData[i];
    if (user.error) {
      console.log(`\n[${i + 1}/${userData.length}] 跳过用户 ${user.address} (读取失败)`);
      migrationResults.failed.push({
        address: user.address,
        error: user.error,
        step: "read_data"
      });
      continue;
    }
    
    console.log(`\n[${i + 1}/${userData.length}] 迁移用户: ${user.address}`);
    
    try {
      // 3.1 迁移推荐关系
      if (user.userInfo.referrer && user.userInfo.referrer !== ethers.ZeroAddress.toLowerCase()) {
        try {
          const currentReferrer = await newProtocol.userInfo(user.address);
          if (!currentReferrer.referrer || currentReferrer.referrer === ethers.ZeroAddress) {
            if (DRY_RUN) {
              console.log(`    🔍 [干运行] 将设置推荐人: ${user.userInfo.referrer}`);
            } else {
              const tx = await newProtocol.adminSetReferrer(user.address, user.userInfo.referrer);
              await tx.wait();
              console.log(`    ✅ 推荐关系已迁移`);
            }
          } else {
            console.log(`    ⏭️  推荐关系已存在，跳过`);
          }
        } catch (error) {
          console.log(`    ❌ 推荐关系迁移失败: ${error.message}`);
        }
      }
      
      // 3.2 迁移门票数据
      if (user.userTicket.ticketId !== "0" && user.userTicket.ticketId !== 0) {
        try {
          const currentTicket = await newProtocol.userTicket(user.address);
          if (currentTicket.ticketId === 0n) {
            if (DRY_RUN) {
              console.log(`    🔍 [干运行] 将设置门票数据`);
            } else {
              const tx = await newProtocol.adminSetUserTicket(
                user.address,
                user.userTicket.ticketId,
                user.userTicket.amount,
                user.userTicket.purchaseTime,
                user.userTicket.exited
              );
              await tx.wait();
              console.log(`    ✅ 门票数据已迁移`);
            }
          } else {
            console.log(`    ⏭️  门票数据已存在，跳过`);
          }
        } catch (error) {
          console.log(`    ❌ 门票数据迁移失败: ${error.message}`);
        }
      }
      
      // 3.3 迁移用户状态数据
      const needsStatusUpdate = 
        user.userInfo.activeDirects !== "0" ||
        user.userInfo.teamCount !== "0" ||
        user.userInfo.totalRevenue !== "0" ||
        user.userInfo.currentCap !== "0" ||
        user.userInfo.maxTicketAmount !== "0" ||
        user.userInfo.maxSingleTicketAmount !== "0";
      
      if (needsStatusUpdate) {
        try {
          if (DRY_RUN) {
            console.log(`    🔍 [干运行] 将设置用户状态数据`);
          } else {
            // 迁移活跃直推数
            if (user.userInfo.activeDirects !== "0") {
              const tx1 = await newProtocol.adminSetActiveDirects(user.address, user.userInfo.activeDirects);
              await tx1.wait();
            }
            
            // 迁移团队数量
            if (user.userInfo.teamCount !== "0") {
              const tx2 = await newProtocol.adminSetTeamCount(user.address, user.userInfo.teamCount);
              await tx2.wait();
            }
            
            // 迁移总收益
            if (user.userInfo.totalRevenue !== "0") {
              const tx3 = await newProtocol.adminSetTotalRevenue(user.address, user.userInfo.totalRevenue);
              await tx3.wait();
            }
            
            // 迁移收益上限
            if (user.userInfo.currentCap !== "0") {
              const tx4 = await newProtocol.adminSetCurrentCap(user.address, user.userInfo.currentCap);
              await tx4.wait();
            }
            
            // 迁移最大门票金额
            if (user.userInfo.maxTicketAmount !== "0" || user.userInfo.maxSingleTicketAmount !== "0") {
              const tx5 = await newProtocol.adminSetMaxTicketAmounts(
                user.address,
                user.userInfo.maxTicketAmount,
                user.userInfo.maxSingleTicketAmount
              );
              await tx5.wait();
            }
            
            console.log(`    ✅ 用户状态数据已迁移`);
          }
        } catch (error) {
          console.log(`    ❌ 用户状态数据迁移失败: ${error.message}`);
        }
      }
      
      // 3.4 迁移质押数据
      if (user.userStakes.length > 0) {
        try {
          for (const stake of user.userStakes) {
            if (DRY_RUN) {
              console.log(`    🔍 [干运行] 将添加质押数据: ID ${stake.id}`);
            } else {
              const tx = await newProtocol.adminAddUserStake(
                user.address,
                stake.id,
                stake.amount,
                stake.startTime,
                stake.cycleDays,
                stake.active,
                stake.paid
              );
              await tx.wait();
            }
          }
          if (!DRY_RUN) {
            console.log(`    ✅ 质押数据已迁移 (${user.userStakes.length} 条)`);
          }
        } catch (error) {
          console.log(`    ❌ 质押数据迁移失败: ${error.message}`);
        }
      }
      
      // 3.5 迁移团队数据
      const needsTeamUpdate = 
        user.userInfo.teamTotalVolume !== "0" ||
        user.userInfo.teamTotalCap !== "0" ||
        user.directReferrals.length > 0;
      
      if (needsTeamUpdate) {
        try {
          if (DRY_RUN) {
            console.log(`    🔍 [干运行] 将设置团队数据`);
          } else {
            // 迁移团队总交易量
            if (user.userInfo.teamTotalVolume !== "0") {
              const tx1 = await newProtocol.adminSetTeamTotalVolume(user.address, user.userInfo.teamTotalVolume);
              await tx1.wait();
            }
            
            // 迁移团队总上限
            if (user.userInfo.teamTotalCap !== "0") {
              const tx2 = await newProtocol.adminSetTeamTotalCap(user.address, user.userInfo.teamTotalCap);
              await tx2.wait();
            }
            
            // 迁移直推列表
            for (const referral of user.directReferrals) {
              try {
                const tx3 = await newProtocol.adminAddDirectReferral(user.address, referral);
                await tx3.wait();
              } catch (error) {
                // 可能已存在，忽略
              }
            }
            
            console.log(`    ✅ 团队数据已迁移`);
          }
        } catch (error) {
          console.log(`    ❌ 团队数据迁移失败: ${error.message}`);
        }
      }
      
      migrationResults.migrated.push({
        address: user.address,
        referrer: user.userInfo.referrer,
        ticket: user.userTicket.ticketId !== "0",
        stakes: user.userStakes.length,
        referrals: user.directReferrals.length
      });
      
      console.log(`    ✅ 用户数据迁移完成`);
      
    } catch (error) {
      console.log(`    ❌ 迁移失败: ${error.message}`);
      migrationResults.failed.push({
        address: user.address,
        error: error.message,
        step: "migrate"
      });
    }
  }
  
  // 4. 生成报告
  console.log("\n" + "=".repeat(60));
  console.log("📊 迁移结果");
  console.log("=".repeat(60));
  
  console.log(`\n总用户数: ${MISSING_USERS.length}`);
  console.log(`成功迁移: ${migrationResults.migrated.length}`);
  console.log(`迁移失败: ${migrationResults.failed.length}`);
  
  if (migrationResults.migrated.length > 0) {
    console.log(`\n✅ 成功迁移的用户:`);
    migrationResults.migrated.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.address}`);
      console.log(`     推荐人: ${user.referrer || "无"}`);
      console.log(`     门票: ${user.ticket ? "有" : "无"}`);
      console.log(`     质押: ${user.stakes} 条`);
      console.log(`     直推: ${user.referrals} 个`);
    });
  }
  
  if (migrationResults.failed.length > 0) {
    console.log(`\n❌ 迁移失败的用户:`);
    migrationResults.failed.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.address}`);
      console.log(`     错误: ${user.error}`);
      console.log(`     步骤: ${user.step}`);
    });
  }
  
  // 保存结果
  const resultsDir = require("path").join(__dirname, "backups");
  if (!require("fs").existsSync(resultsDir)) {
    require("fs").mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = require("path").join(resultsDir, `missing-users-migration-${Date.now()}.json`);
  require("fs").writeFileSync(resultsFile, JSON.stringify({
    ...migrationResults,
    userData: userData
  }, null, 2));
  console.log(`\n📄 迁移结果已保存: ${resultsFile}`);
  
  return migrationResults;
}

migrateMissingUsers()
  .then(() => {
    console.log("\n" + "=".repeat(60));
    console.log("✅ 迁移完成");
    console.log("=".repeat(60));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n" + "=".repeat(60));
    console.error("❌ 迁移失败");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  });

