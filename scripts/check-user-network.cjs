const { ethers } = require("hardhat");

// 合约地址和ABI
const PROTOCOL_ADDRESS = "0x7a216BeA62eF7629904E0d30b24F6842c9b0d660"; // 最新的代理地址

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function getDirectReferrals(address) view returns (address[])",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)"
];

async function getAllDownlineUsers(protocolContract, userAddress, visited = new Set(), level = 0, maxLevel = 10) {
  // 防止无限递归和重复访问
  if (visited.has(userAddress.toLowerCase()) || level > maxLevel) {
    return [];
  }
  
  visited.add(userAddress.toLowerCase());
  
  try {
    // 获取直推用户
    const directReferrals = await protocolContract.getDirectReferrals(userAddress);
    console.log(`Level ${level} - ${userAddress}: ${directReferrals.length} direct referrals`);
    
    let allDownline = [];
    
    // 添加直推用户信息
    for (const referral of directReferrals) {
      try {
        const userInfo = await protocolContract.userInfo(referral);
        const ticketInfo = await protocolContract.userTicket(referral);
        
        const userDetail = {
          address: referral,
          level: level + 1,
          referrer: userInfo.referrer,
          activeDirects: userInfo.activeDirects.toString(),
          teamCount: userInfo.teamCount.toString(),
          totalRevenue: ethers.formatEther(userInfo.totalRevenue),
          isActive: userInfo.isActive,
          ticketAmount: ethers.formatEther(ticketInfo.amount),
          ticketExited: ticketInfo.exited
        };
        
        allDownline.push(userDetail);
        
        // 递归获取下级用户
        const subDownline = await getAllDownlineUsers(protocolContract, referral, visited, level + 1, maxLevel);
        allDownline = allDownline.concat(subDownline);
        
      } catch (error) {
        console.warn(`Failed to get info for ${referral}:`, error.message);
      }
    }
    
    return allDownline;
    
  } catch (error) {
    console.error(`Error getting referrals for ${userAddress}:`, error.message);
    return [];
  }
}

async function checkUserNetwork() {
  try {
    console.log("🔍 检查用户网络信息...");
    console.log("=".repeat(80));
    
    // 目标用户地址
    const targetUser = "0x5B7E080Daa6A6437B50eb881d84b66158Bb10fE5";
    
    // 连接到MC链
    const provider = new ethers.JsonRpcProvider("https://rpc.mchains.io");
    const protocolContract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    console.log(`📋 目标用户: ${targetUser}`);
    console.log(`📋 合约地址: ${PROTOCOL_ADDRESS}`);
    console.log("");
    
    // 1. 获取用户基本信息
    console.log("📊 用户基本信息:");
    console.log("-".repeat(50));
    
    const userInfo = await protocolContract.userInfo(targetUser);
    const ticketInfo = await protocolContract.userTicket(targetUser);
    
    console.log(`推荐人: ${userInfo.referrer}`);
    console.log(`直推人数: ${userInfo.activeDirects.toString()}`);
    console.log(`团队总数: ${userInfo.teamCount.toString()}`);
    console.log(`总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
    console.log(`当前上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
    console.log(`是否活跃: ${userInfo.isActive ? '是' : '否'}`);
    console.log(`门票金额: ${ethers.formatEther(ticketInfo.amount)} MC`);
    console.log(`是否退出: ${ticketInfo.exited ? '是' : '否'}`);
    console.log("");
    
    // 2. 获取直推用户列表
    console.log("👥 直推用户列表:");
    console.log("-".repeat(50));
    
    const directReferrals = await protocolContract.getDirectReferrals(targetUser);
    console.log(`直推用户数量: ${directReferrals.length}`);
    
    if (directReferrals.length > 0) {
      console.log("\n直推用户详情:");
      for (let i = 0; i < directReferrals.length; i++) {
        const referral = directReferrals[i];
        try {
          const refUserInfo = await protocolContract.userInfo(referral);
          const refTicketInfo = await protocolContract.userTicket(referral);
          
          console.log(`\n${i + 1}. ${referral}`);
          console.log(`   - 直推数: ${refUserInfo.activeDirects.toString()}`);
          console.log(`   - 团队数: ${refUserInfo.teamCount.toString()}`);
          console.log(`   - 门票: ${ethers.formatEther(refTicketInfo.amount)} MC`);
          console.log(`   - 活跃: ${refUserInfo.isActive ? '是' : '否'}`);
          console.log(`   - 退出: ${refTicketInfo.exited ? '是' : '否'}`);
        } catch (error) {
          console.log(`   - 获取信息失败: ${error.message}`);
        }
      }
    }
    
    console.log("");
    
    // 3. 获取所有伞下用户（递归查询）
    console.log("🌳 伞下所有用户网络:");
    console.log("-".repeat(50));
    console.log("正在递归查询所有伞下用户...");
    
    const allDownlineUsers = await getAllDownlineUsers(protocolContract, targetUser);
    
    console.log(`\n📈 网络统计:`);
    console.log(`总伞下用户数: ${allDownlineUsers.length}`);
    
    // 按层级统计
    const levelStats = {};
    allDownlineUsers.forEach(user => {
      levelStats[user.level] = (levelStats[user.level] || 0) + 1;
    });
    
    console.log("\n按层级分布:");
    Object.keys(levelStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      console.log(`  Level ${level}: ${levelStats[level]} 用户`);
    });
    
    // 活跃用户统计
    const activeUsers = allDownlineUsers.filter(user => user.isActive);
    const ticketUsers = allDownlineUsers.filter(user => parseFloat(user.ticketAmount) > 0);
    
    console.log(`\n活跃用户: ${activeUsers.length}/${allDownlineUsers.length}`);
    console.log(`有门票用户: ${ticketUsers.length}/${allDownlineUsers.length}`);
    
    // 4. 详细用户列表
    if (allDownlineUsers.length > 0) {
      console.log("\n📋 所有伞下用户详情:");
      console.log("-".repeat(80));
      
      allDownlineUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. Level ${user.level} - ${user.address}`);
        console.log(`   推荐人: ${user.referrer}`);
        console.log(`   直推数: ${user.activeDirects}`);
        console.log(`   团队数: ${user.teamCount}`);
        console.log(`   门票: ${user.ticketAmount} MC`);
        console.log(`   收益: ${user.totalRevenue} MC`);
        console.log(`   活跃: ${user.isActive ? '是' : '否'}`);
        console.log(`   退出: ${user.ticketExited ? '是' : '否'}`);
      });
    }
    
    // 5. 生成CSV报告
    console.log("\n📄 生成CSV报告...");
    const csvHeader = "序号,层级,地址,推荐人,直推数,团队数,门票金额,总收益,是否活跃,是否退出\n";
    let csvContent = csvHeader;
    
    allDownlineUsers.forEach((user, index) => {
      csvContent += `${index + 1},${user.level},${user.address},${user.referrer},${user.activeDirects},${user.teamCount},${user.ticketAmount},${user.totalRevenue},${user.isActive ? '是' : '否'},${user.ticketExited ? '是' : '否'}\n`;
    });
    
    // 保存CSV文件
    const fs = require('fs');
    const filename = `user_network_${targetUser.slice(2, 8)}_${Date.now()}.csv`;
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`CSV报告已保存: ${filename}`);
    
    console.log("\n✅ 查询完成!");
    
  } catch (error) {
    console.error("❌ 查询失败:", error);
  }
}

// 运行查询
checkUserNetwork().catch(console.error);