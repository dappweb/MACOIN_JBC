const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "function marketingPercent() view returns (uint256)",
  "function buybackPercent() view returns (uint256)",
  "function lpInjectionPercent() view returns (uint256)",
  "function treasuryPercent() view returns (uint256)",
  "function marketingWallet() view returns (address)",
  "function treasuryWallet() view returns (address)",
  "function lpInjectionWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function jbcToken() view returns (address)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function levelRewardPool() view returns (uint256)",
  "function redemptionFeePercent() view returns (uint256)",
  "function swapBuyTax() view returns (uint256)",
  "function swapSellTax() view returns (uint256)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function directReferrals(address, uint256) view returns (address)",
  "function nextTicketId() view returns (uint256)",
  "function nextStakeId() view returns (uint256)",
  "function lastBurnTime() view returns (uint256)",
  "function ticketOwner(uint256) view returns (address)",
  "function stakeOwner(uint256) view returns (address)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 indexed ticketId)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event ReferrerChanged(address indexed user, address indexed oldReferrer, address indexed newReferrer)",
];

async function backupProtocolData() {
  console.log("📦 开始备份协议数据\n");
  console.log("=" .repeat(60));
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  const backupData = {
    timestamp: new Date().toISOString(),
    protocolAddress: PROTOCOL_ADDRESS,
    network: "MC Chain",
    rpcUrl: RPC_URL,
    config: {},
    balances: {},
    systemState: {},
    users: [],
    events: {
      ticketPurchases: [],
      referrerBindings: [],
      liquidityStakes: [],
      rewardClaims: [],
      referrerChanges: []
    }
  };

  try {
    // 1. 备份配置参数
    console.log("📋 步骤 1: 备份配置参数");
    try {
      backupData.config = {
        owner: await protocol.owner(),
        directRewardPercent: (await protocol.directRewardPercent()).toString(),
        levelRewardPercent: (await protocol.levelRewardPercent()).toString(),
        marketingPercent: (await protocol.marketingPercent()).toString(),
        buybackPercent: (await protocol.buybackPercent()).toString(),
        lpInjectionPercent: (await protocol.lpInjectionPercent()).toString(),
        treasuryPercent: (await protocol.treasuryPercent()).toString(),
        marketingWallet: await protocol.marketingWallet(),
        treasuryWallet: await protocol.treasuryWallet(),
        lpInjectionWallet: await protocol.lpInjectionWallet(),
        buybackWallet: await protocol.buybackWallet(),
        jbcToken: await protocol.jbcToken(),
        redemptionFeePercent: (await protocol.redemptionFeePercent()).toString(),
        swapBuyTax: (await protocol.swapBuyTax()).toString(),
        swapSellTax: (await protocol.swapSellTax()).toString(),
        ticketFlexibilityDuration: (await protocol.ticketFlexibilityDuration()).toString(),
        liquidityEnabled: await protocol.liquidityEnabled(),
        redeemEnabled: await protocol.redeemEnabled(),
        emergencyPaused: await protocol.emergencyPaused(),
      };
      console.log(`    ✅ 配置参数已备份 (${Object.keys(backupData.config).length} 项)`);
    } catch (e) {
      console.log(`    ⚠️  无法备份部分配置: ${e.message}`);
    }

    // 2. 备份余额信息
    console.log("\n📋 步骤 2: 备份余额信息");
    try {
      backupData.balances = {
        swapReserveMC: (await protocol.swapReserveMC()).toString(),
        swapReserveJBC: (await protocol.swapReserveJBC()).toString(),
        levelRewardPool: (await protocol.levelRewardPool()).toString(),
        contractBalance: (await provider.getBalance(PROTOCOL_ADDRESS)).toString(),
      };
      console.log(`    ✅ 余额信息已备份`);
      console.log(`        Swap Reserve MC: ${ethers.formatEther(backupData.balances.swapReserveMC)} MC`);
      console.log(`        Swap Reserve JBC: ${ethers.formatEther(backupData.balances.swapReserveJBC)} JBC`);
      console.log(`        Level Reward Pool: ${ethers.formatEther(backupData.balances.levelRewardPool)} MC`);
      console.log(`        Contract Balance: ${ethers.formatEther(backupData.balances.contractBalance)} MC`);
    } catch (e) {
      console.log(`    ⚠️  无法备份余额: ${e.message}`);
    }

    // 3. 备份系统状态
    console.log("\n📋 步骤 3: 备份系统状态");
    try {
      backupData.systemState = {
        nextTicketId: (await protocol.nextTicketId()).toString(),
        nextStakeId: (await protocol.nextStakeId()).toString(),
        lastBurnTime: (await protocol.lastBurnTime()).toString(),
      };
      console.log(`    ✅ 系统状态已备份`);
      console.log(`        Next Ticket ID: ${backupData.systemState.nextTicketId}`);
      console.log(`        Next Stake ID: ${backupData.systemState.nextStakeId}`);
      console.log(`        Last Burn Time: ${backupData.systemState.lastBurnTime}`);
    } catch (e) {
      console.log(`    ⚠️  无法备份系统状态: ${e.message}`);
    }

    // 4. 备份事件数据（获取所有用户）
    console.log("\n📋 步骤 4: 备份事件数据（获取所有用户地址）");
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = 0; // 从合约部署开始
      
      console.log(`    扫描区块范围: ${fromBlock} - ${currentBlock}`);
      
      // 获取所有相关事件
      const ticketFilter = protocol.filters.TicketPurchased();
      const ticketEvents = await protocol.queryFilter(ticketFilter, fromBlock, currentBlock);
      console.log(`    ✅ 找到 ${ticketEvents.length} 个 TicketPurchased 事件`);
      
      const referrerFilter = protocol.filters.BoundReferrer();
      const referrerEvents = await protocol.queryFilter(referrerFilter, fromBlock, currentBlock);
      console.log(`    ✅ 找到 ${referrerEvents.length} 个 BoundReferrer 事件`);
      
      const stakeFilter = protocol.filters.LiquidityStaked();
      const stakeEvents = await protocol.queryFilter(stakeFilter, fromBlock, currentBlock);
      console.log(`    ✅ 找到 ${stakeEvents.length} 个 LiquidityStaked 事件`);
      
      const rewardFilter = protocol.filters.RewardClaimed();
      const rewardEvents = await protocol.queryFilter(rewardFilter, fromBlock, currentBlock);
      console.log(`    ✅ 找到 ${rewardEvents.length} 个 RewardClaimed 事件`);
      
      const referrerChangeFilter = protocol.filters.ReferrerChanged();
      const referrerChangeEvents = await protocol.queryFilter(referrerChangeFilter, fromBlock, currentBlock);
      console.log(`    ✅ 找到 ${referrerChangeEvents.length} 个 ReferrerChanged 事件`);
      
      // 收集所有用户地址
      const userAddresses = new Set();
      
      ticketEvents.forEach(event => {
        if (event.args && event.args.user) {
          userAddresses.add(event.args.user.toLowerCase());
        }
      });
      
      referrerEvents.forEach(event => {
        if (event.args && event.args.user) {
          userAddresses.add(event.args.user.toLowerCase());
        }
        if (event.args && event.args.referrer) {
          userAddresses.add(event.args.referrer.toLowerCase());
        }
      });
      
      stakeEvents.forEach(event => {
        if (event.args && event.args.user) {
          userAddresses.add(event.args.user.toLowerCase());
        }
      });
      
      rewardEvents.forEach(event => {
        if (event.args && event.args.user) {
          userAddresses.add(event.args.user.toLowerCase());
        }
      });
      
      referrerChangeEvents.forEach(event => {
        if (event.args && event.args.user) {
          userAddresses.add(event.args.user.toLowerCase());
        }
        if (event.args && event.args.oldReferrer) {
          userAddresses.add(event.args.oldReferrer.toLowerCase());
        }
        if (event.args && event.args.newReferrer) {
          userAddresses.add(event.args.newReferrer.toLowerCase());
        }
      });
      
      console.log(`    ✅ 找到 ${userAddresses.size} 个唯一用户地址`);
      
      // 5. 备份用户数据
      console.log("\n📋 步骤 5: 备份用户数据");
      const userArray = Array.from(userAddresses);
      const totalUsers = userArray.length;
      let processed = 0;
      
      for (const userAddr of userArray) {
        try {
          const [userInfo, userTicket] = await Promise.all([
            protocol.userInfo(userAddr),
            protocol.userTicket(userAddr)
          ]);
          
          const userData = {
            address: userAddr,
            userInfo: {
              referrer: userInfo.referrer,
              activeDirects: userInfo.activeDirects.toString(),
              teamCount: userInfo.teamCount.toString(),
              totalRevenue: userInfo.totalRevenue.toString(),
              currentCap: userInfo.currentCap.toString(),
              isActive: userInfo.isActive,
              refundFeeAmount: userInfo.refundFeeAmount.toString(),
              teamTotalVolume: userInfo.teamTotalVolume.toString(),
              teamTotalCap: userInfo.teamTotalCap.toString(),
              maxTicketAmount: userInfo.maxTicketAmount.toString(),
              maxSingleTicketAmount: userInfo.maxSingleTicketAmount.toString(),
            },
            userTicket: {
              ticketId: userTicket.ticketId.toString(),
              amount: userTicket.amount.toString(),
              purchaseTime: userTicket.purchaseTime.toString(),
              exited: userTicket.exited,
            },
            userStakes: [],
            directReferrals: []
          };
          
          // 备份用户质押数据
          try {
            // 尝试获取质押数量（通过事件或估算）
            const userStakeEvents = stakeEvents.filter(e => 
              e.args && e.args.user && e.args.user.toLowerCase() === userAddr
            );
            
            for (let i = 0; i < userStakeEvents.length; i++) {
              try {
                const stake = await protocol.userStakes(userAddr, i);
                userData.userStakes.push({
                  id: stake.id.toString(),
                  amount: stake.amount.toString(),
                  startTime: stake.startTime.toString(),
                  cycleDays: stake.cycleDays.toString(),
                  active: stake.active,
                  paid: stake.paid.toString(),
                });
              } catch (e) {
                // 如果索引超出范围，停止
                break;
              }
            }
          } catch (e) {
            // 忽略质押数据获取错误
          }
          
          // 备份推荐关系
          try {
            const referralEvents = referrerEvents.filter(e => 
              e.args && e.args.referrer && e.args.referrer.toLowerCase() === userAddr
            );
            
            for (let i = 0; i < referralEvents.length; i++) {
              try {
                const referral = await protocol.directReferrals(userAddr, i);
                if (referral && referral !== ethers.ZeroAddress) {
                  userData.directReferrals.push(referral);
                }
              } catch (e) {
                break;
              }
            }
          } catch (e) {
            // 忽略推荐关系获取错误
          }
          
          backupData.users.push(userData);
          
          processed++;
          if (processed % 10 === 0) {
            process.stdout.write(`\r    已处理: ${processed}/${totalUsers} 用户`);
          }
        } catch (e) {
          console.log(`\n    ⚠️  无法备份用户 ${userAddr}: ${e.message}`);
        }
      }
      
      if (processed > 0) {
        process.stdout.write(`\r    已处理: ${processed}/${totalUsers} 用户\n`);
      }
      
      console.log(`    ✅ 用户数据已备份 (${backupData.users.length} 个用户)`);
      
      // 保存事件数据
      backupData.events.ticketPurchases = ticketEvents.map(e => ({
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
        user: e.args?.user,
        ticketId: e.args?.ticketId?.toString(),
        amount: e.args?.amount?.toString(),
        purchaseTime: e.args?.purchaseTime?.toString(),
      }));
      
      backupData.events.referrerBindings = referrerEvents.map(e => ({
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
        user: e.args?.user,
        referrer: e.args?.referrer,
      }));
      
      backupData.events.liquidityStakes = stakeEvents.map(e => ({
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
        user: e.args?.user,
        amount: e.args?.amount?.toString(),
        cycleDays: e.args?.cycleDays?.toString(),
        stakeId: e.args?.stakeId?.toString(),
      }));
      
      backupData.events.rewardClaims = rewardEvents.map(e => ({
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
        user: e.args?.user,
        mcAmount: e.args?.mcAmount?.toString(),
        jbcAmount: e.args?.jbcAmount?.toString(),
        rewardType: e.args?.rewardType?.toString(),
        ticketId: e.args?.ticketId?.toString(),
      }));
      
      backupData.events.referrerChanges = referrerChangeEvents.map(e => ({
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
        user: e.args?.user,
        oldReferrer: e.args?.oldReferrer,
        newReferrer: e.args?.newReferrer,
      }));
      
      console.log(`    ✅ 事件数据已备份`);
      console.log(`        TicketPurchased: ${backupData.events.ticketPurchases.length} 个`);
      console.log(`        BoundReferrer: ${backupData.events.referrerBindings.length} 个`);
      console.log(`        LiquidityStaked: ${backupData.events.liquidityStakes.length} 个`);
      console.log(`        RewardClaimed: ${backupData.events.rewardClaims.length} 个`);
      console.log(`        ReferrerChanged: ${backupData.events.referrerChanges.length} 个`);
      
    } catch (e) {
      console.log(`    ⚠️  无法备份事件数据: ${e.message}`);
      console.error(e);
    }

    // 6. 保存备份文件
    console.log("\n📋 步骤 6: 保存备份文件");
    const backupDir = path.join(__dirname, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const filename = `protocol-backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    
    console.log(`    ✅ 备份文件已保存: ${filepath}`);
    console.log(`    文件大小: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);

    // 6. 生成摘要
    console.log("\n" + "=" .repeat(60));
    console.log("✅ 备份完成！");
    console.log("=" .repeat(60));
    console.log(`\n📊 备份摘要:`);
    console.log(`    配置参数: ${Object.keys(backupData.config).length} 项`);
    console.log(`    余额信息: ${Object.keys(backupData.balances).length} 项`);
    console.log(`    系统状态: ${Object.keys(backupData.systemState).length} 项`);
    console.log(`    用户数据: ${backupData.users.length} 个用户`);
    const totalEvents = Object.values(backupData.events).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`    事件数据: ${totalEvents} 个事件`);
    console.log(`\n📄 备份文件: ${filepath}`);
    console.log(`\n⚠️  重要提示:`);
    console.log(`    1. 备份文件包含敏感数据，请妥善保管`);
    console.log(`    2. 重新部署协议需要迁移所有用户数据`);
    console.log(`    3. 需要确保新合约的 Owner 是正确的地址`);

  } catch (error) {
    console.error("❌ 备份失败:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行备份
backupProtocolData().catch(console.error);

