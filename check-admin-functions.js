// 检查超级管理员功能
import { ethers } from 'ethers';

// 合约地址和配置
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

// MC Chain RPC
const RPC_URL = "https://chain.mcerscan.com/";

// 合约ABI - 包含所有管理员函数
const PROTOCOL_ABI = [
  // 查询函数
  "function owner() view returns (address)",
  "function emergencyPaused() view returns (bool)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "function marketingPercent() view returns (uint256)",
  "function buybackPercent() view returns (uint256)",
  "function lpInjectionPercent() view returns (uint256)",
  "function treasuryPercent() view returns (uint256)",
  "function redemptionFeePercent() view returns (uint256)",
  "function swapBuyTax() view returns (uint256)",
  "function swapSellTax() view returns (uint256)",
  "function marketingWallet() view returns (address)",
  "function treasuryWallet() view returns (address)",
  "function lpInjectionWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function levelRewardPool() view returns (uint256)",
  
  // 管理员函数 (只能查看，不能调用)
  "function emergencyPause() external",
  "function emergencyUnpause() external", 
  "function setWallets(address,address,address,address) external",
  "function setDistributionConfig(uint256,uint256,uint256,uint256,uint256,uint256) external",
  "function setSwapTaxes(uint256,uint256) external",
  "function setRedemptionFeePercent(uint256) external",
  "function setOperationalStatus(bool,bool) external",
  "function setTicketFlexibilityDuration(uint256) external",
  "function addLiquidity(uint256,uint256) external",
  "function withdrawLevelRewardPool(address,uint256) external",
  "function withdrawSwapReserves(address,uint256,address,uint256) external",
  "function rescueTokens(address,address,uint256) external",
  "function adminSetReferrer(address,address) external"
];

async function checkAdminFunctions() {
  console.log('🔐 检查Jinbao Protocol超级管理员功能...\n');
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
    
    // 1. 查询当前超级管理员
    console.log('👑 超级管理员信息:');
    console.log('='.repeat(60));
    
    try {
      const owner = await contract.owner();
      console.log(`📍 当前超级管理员: ${owner}`);
      
      // 检查是否是已知的管理员地址
      const knownAdmins = [
        "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48", // 部署者
        "0x5B7E080Daa6A6437B50eb881d84b66158Bb10fE5", // 可能的管理员
      ];
      
      if (knownAdmins.includes(owner)) {
        console.log('✅ 管理员地址已确认');
      } else {
        console.log('⚠️  未知的管理员地址');
      }
    } catch (error) {
      console.log('❌ 无法获取管理员地址');
    }
    
    // 2. 系统状态检查
    console.log('\n🔧 系统状态:');
    console.log('-'.repeat(40));
    
    const emergencyPaused = await contract.emergencyPaused();
    const liquidityEnabled = await contract.liquidityEnabled();
    const redeemEnabled = await contract.redeemEnabled();
    
    console.log(`🚨 紧急暂停: ${emergencyPaused ? '❌ 已暂停' : '✅ 正常运行'}`);
    console.log(`💧 流动性功能: ${liquidityEnabled ? '✅ 已启用' : '❌ 已禁用'}`);
    console.log(`💰 赎回功能: ${redeemEnabled ? '✅ 已启用' : '❌ 已禁用'}`);
    
    // 3. 配置参数检查
    console.log('\n⚙️  系统配置参数:');
    console.log('-'.repeat(40));
    
    const directRewardPercent = await contract.directRewardPercent();
    const levelRewardPercent = await contract.levelRewardPercent();
    const marketingPercent = await contract.marketingPercent();
    const buybackPercent = await contract.buybackPercent();
    const lpInjectionPercent = await contract.lpInjectionPercent();
    const treasuryPercent = await contract.treasuryPercent();
    
    console.log('💰 奖励分配比例:');
    console.log(`  直推奖励: ${directRewardPercent}%`);
    console.log(`  层级奖励: ${levelRewardPercent}%`);
    console.log(`  营销钱包: ${marketingPercent}%`);
    console.log(`  回购销毁: ${buybackPercent}%`);
    console.log(`  流动性注入: ${lpInjectionPercent}%`);
    console.log(`  国库基金: ${treasuryPercent}%`);
    
    const total = Number(directRewardPercent) + Number(levelRewardPercent) + 
                  Number(marketingPercent) + Number(buybackPercent) + 
                  Number(lpInjectionPercent) + Number(treasuryPercent);
    console.log(`  总计: ${total}% ${total === 100 ? '✅' : '❌ 不等于100%'}`);
    
    const redemptionFeePercent = await contract.redemptionFeePercent();
    const swapBuyTax = await contract.swapBuyTax();
    const swapSellTax = await contract.swapSellTax();
    const ticketFlexibilityDuration = await contract.ticketFlexibilityDuration();
    
    console.log('\n🔄 交易参数:');
    console.log(`  赎回手续费: ${redemptionFeePercent}%`);
    console.log(`  买入税费: ${Number(swapBuyTax)/100}%`);
    console.log(`  卖出税费: ${Number(swapSellTax)/100}%`);
    console.log(`  门票灵活期: ${Number(ticketFlexibilityDuration)/3600} 小时`);
    
    // 4. 钱包地址检查
    console.log('\n🏦 系统钱包地址:');
    console.log('-'.repeat(40));
    
    const marketingWallet = await contract.marketingWallet();
    const treasuryWallet = await contract.treasuryWallet();
    const lpInjectionWallet = await contract.lpInjectionWallet();
    const buybackWallet = await contract.buybackWallet();
    
    console.log(`💼 营销钱包: ${marketingWallet}`);
    console.log(`🏛️  国库钱包: ${treasuryWallet}`);
    console.log(`💧 流动性钱包: ${lpInjectionWallet}`);
    console.log(`🔥 回购钱包: ${buybackWallet}`);
    
    // 5. 资金池状态
    console.log('\n💎 资金池状态:');
    console.log('-'.repeat(40));
    
    const swapReserveMC = await contract.swapReserveMC();
    const swapReserveJBC = await contract.swapReserveJBC();
    const levelRewardPool = await contract.levelRewardPool();
    
    console.log(`🪙 MC储备: ${ethers.formatEther(swapReserveMC)} MC`);
    console.log(`🪙 JBC储备: ${ethers.formatEther(swapReserveJBC)} JBC`);
    console.log(`🎁 层级奖励池: ${ethers.formatEther(levelRewardPool)} MC`);
    
    // 6. 管理员功能列表
    console.log('\n🛠️  超级管理员功能列表:');
    console.log('-'.repeat(40));
    
    const adminFunctions = [
      {
        name: 'emergencyPause/emergencyUnpause',
        description: '紧急暂停/恢复系统',
        risk: '🔴 高风险',
        impact: '暂停所有用户操作'
      },
      {
        name: 'setWallets',
        description: '设置系统钱包地址',
        risk: '🔴 高风险', 
        impact: '改变资金流向'
      },
      {
        name: 'setDistributionConfig',
        description: '设置奖励分配比例',
        risk: '🟡 中风险',
        impact: '影响用户收益分配'
      },
      {
        name: 'setSwapTaxes',
        description: '设置交易税费',
        risk: '🟡 中风险',
        impact: '影响交易成本'
      },
      {
        name: 'setRedemptionFeePercent',
        description: '设置赎回手续费',
        risk: '🟡 中风险',
        impact: '影响赎回成本'
      },
      {
        name: 'setOperationalStatus',
        description: '启用/禁用功能模块',
        risk: '🟡 中风险',
        impact: '控制功能可用性'
      },
      {
        name: 'setTicketFlexibilityDuration',
        description: '设置门票灵活期',
        risk: '🟢 低风险',
        impact: '影响门票过期时间'
      },
      {
        name: 'addLiquidity',
        description: '添加AMM流动性',
        risk: '🟢 低风险',
        impact: '增加交易流动性'
      },
      {
        name: 'withdrawLevelRewardPool',
        description: '提取层级奖励池',
        risk: '🔴 高风险',
        impact: '减少奖励池资金'
      },
      {
        name: 'withdrawSwapReserves',
        description: '提取AMM储备',
        risk: '🔴 高风险',
        impact: '减少交易流动性'
      },
      {
        name: 'rescueTokens',
        description: '救援意外代币',
        risk: '🟡 中风险',
        impact: '提取非系统代币'
      },
      {
        name: 'adminSetReferrer',
        description: '管理员设置推荐关系',
        risk: '🟡 中风险',
        impact: '修改用户推荐链'
      }
    ];
    
    for (const func of adminFunctions) {
      console.log(`📋 ${func.name}`);
      console.log(`   描述: ${func.description}`);
      console.log(`   风险: ${func.risk}`);
      console.log(`   影响: ${func.impact}`);
      console.log('');
    }
    
    // 7. 安全建议
    console.log('🛡️  安全建议:');
    console.log('-'.repeat(40));
    console.log('1. 🔐 使用多重签名钱包作为超级管理员');
    console.log('2. 📝 重要操作前进行社区公示');
    console.log('3. 🔍 定期审计管理员操作记录');
    console.log('4. ⏰ 设置时间锁延迟执行重要操作');
    console.log('5. 🚨 建立紧急响应机制');
    console.log('6. 📊 监控系统参数变化');
    console.log('7. 🔄 定期轮换管理员权限');
    
    console.log('\n✅ 超级管理员功能检查完成！');
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

// 执行检查
checkAdminFunctions();