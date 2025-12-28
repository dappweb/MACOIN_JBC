// Cloudflare Worker for Daily JBC Token Burn
import { ethers } from 'ethers';

// 环境变量接口
interface Env {
  PRIVATE_KEY: string;
  RPC_URL: string;
  PROTOCOL_CONTRACT_ADDRESS: string;
  JBC_CONTRACT_ADDRESS: string;
  DAILY_BURN_AMOUNT?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  MAX_BURN_AMOUNT?: string;
}

// 合约ABI
const JBC_ABI = [
  "function burn(uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

const PROTOCOL_ABI = [
  "function lastBurnTime() external view returns (uint256)",
  "function owner() external view returns (address)",
  "function jbcToken() external view returns (address)"
];

export default {
  // 定时触发器 - 每日UTC 00:00执行
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('🔥 [Scheduled] 开始执行每日代币燃烧任务...');
    console.log('🕐 [Scheduled] 执行时间:', new Date().toISOString());
    
    try {
      const result = await performDailyBurn(env);
      console.log('✅ [Scheduled] 每日燃烧执行成功:', result);
      
      // 发送成功通知
      if (result.burned) {
        await sendNotification(env, {
          type: 'success',
          message: `🔥 每日燃烧成功\n💰 燃烧数量: ${result.amount} JBC\n📝 交易哈希: ${result.txHash}`,
          data: result
        });
      } else {
        console.log('ℹ️ [Scheduled] 本次无需燃烧:', result.reason);
      }
    } catch (error) {
      console.error('❌ [Scheduled] 每日燃烧执行失败:', error);
      
      // 发送失败通知
      await sendNotification(env, {
        type: 'error',
        message: `❌ 每日燃烧失败\n🚨 错误信息: ${error.message}`,
        error: error.message
      });
    }
  },

  // HTTP请求处理
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // 手动触发燃烧
      if (path === '/burn' && request.method === 'POST') {
        console.log('🔥 [Manual] 手动触发燃烧...');
        const result = await performDailyBurn(env);
        
        return new Response(JSON.stringify({
          success: true,
          message: '燃烧执行完成',
          data: result
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 查看燃烧状态
      if (path === '/status') {
        console.log('📊 [Status] 查询燃烧状态...');
        const status = await getBurnStatus(env);
        
        return new Response(JSON.stringify({
          success: true,
          data: status
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 健康检查
      if (path === '/health') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Cloudflare Daily Burn Service is running',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 默认响应
      return new Response(JSON.stringify({
        success: true,
        message: 'Jinbao Daily Burn Service',
        endpoints: {
          'POST /burn': '手动触发燃烧',
          'GET /status': '查看燃烧状态',
          'GET /health': '健康检查'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('❌ [HTTP] 请求处理失败:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// 执行每日燃烧的主要函数
async function performDailyBurn(env: Env): Promise<any> {
  console.log('🚀 [Burn] 初始化燃烧流程...');
  
  // 1. 验证环境变量
  if (!env.PRIVATE_KEY || !env.RPC_URL || !env.JBC_CONTRACT_ADDRESS) {
    throw new Error('缺少必要的环境变量');
  }
  
  // 2. 初始化区块链连接
  console.log('🔗 [Burn] 连接区块链...');
  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
  
  console.log('👛 [Burn] 燃烧钱包地址:', wallet.address);
  
  // 3. 连接JBC合约
  const jbcContract = new ethers.Contract(
    env.JBC_CONTRACT_ADDRESS,
    JBC_ABI,
    wallet
  );
  
  // 4. 检查钱包余额
  const walletBalance = await jbcContract.balanceOf(wallet.address);
  console.log('💰 [Burn] 钱包JBC余额:', ethers.formatEther(walletBalance));
  
  if (walletBalance.eq(0)) {
    return {
      burned: false,
      reason: '钱包JBC余额为0',
      walletBalance: '0'
    };
  }
  
  // 5. 计算燃烧数量
  const burnAmount = await calculateBurnAmount(jbcContract, walletBalance, env);
  console.log('🔥 [Burn] 计算燃烧数量:', ethers.formatEther(burnAmount));
  
  if (burnAmount.eq(0)) {
    return {
      burned: false,
      reason: '计算燃烧数量为0',
      walletBalance: ethers.formatEther(walletBalance)
    };
  }
  
  // 6. 安全检查
  if (walletBalance.lt(burnAmount)) {
    throw new Error(`钱包余额不足: ${ethers.formatEther(walletBalance)} < ${ethers.formatEther(burnAmount)}`);
  }
  
  // 7. 检查最大燃烧限制
  const maxBurnAmount = env.MAX_BURN_AMOUNT ? ethers.parseEther(env.MAX_BURN_AMOUNT) : ethers.parseEther("10000");
  if (burnAmount.gt(maxBurnAmount)) {
    throw new Error(`燃烧数量超过限制: ${ethers.formatEther(burnAmount)} > ${ethers.formatEther(maxBurnAmount)}`);
  }
  
  // 8. 执行燃烧交易
  console.log('📝 [Burn] 提交燃烧交易...');
  const tx = await jbcContract.burn(burnAmount, {
    gasLimit: 100000 // 设置gas限制
  });
  
  console.log('⏳ [Burn] 等待交易确认:', tx.hash);
  const receipt = await tx.wait();
  
  if (receipt.status !== 1) {
    throw new Error(`交易失败: ${tx.hash}`);
  }
  
  console.log('✅ [Burn] 燃烧交易成功:', receipt.transactionHash);
  
  // 9. 获取燃烧后的状态
  const newBalance = await jbcContract.balanceOf(wallet.address);
  const totalSupply = await jbcContract.totalSupply();
  
  return {
    burned: true,
    amount: ethers.formatEther(burnAmount),
    txHash: receipt.transactionHash,
    gasUsed: receipt.gasUsed.toString(),
    walletBalanceBefore: ethers.formatEther(walletBalance),
    walletBalanceAfter: ethers.formatEther(newBalance),
    totalSupply: ethers.formatEther(totalSupply),
    timestamp: Math.floor(Date.now() / 1000)
  };
}

// 计算燃烧数量
async function calculateBurnAmount(
  jbcContract: ethers.Contract, 
  walletBalance: ethers.BigNumber, 
  env: Env
): Promise<ethers.BigNumber> {
  
  // 方案1: 固定数量燃烧
  if (env.DAILY_BURN_AMOUNT && env.DAILY_BURN_AMOUNT !== '0') {
    const fixedAmount = ethers.parseEther(env.DAILY_BURN_AMOUNT);
    console.log('📊 [Calc] 使用固定燃烧数量:', ethers.formatEther(fixedAmount));
    return fixedAmount.gt(walletBalance) ? walletBalance : fixedAmount;
  }
  
  // 方案2: 基于钱包余额的百分比燃烧 (默认1%)
  const burnPercentage = 100; // 1% = 100/10000
  const percentageAmount = walletBalance.mul(burnPercentage).div(10000);
  console.log('📊 [Calc] 使用百分比燃烧 (1%):', ethers.formatEther(percentageAmount));
  
  // 最小燃烧数量检查 (至少1个JBC)
  const minBurnAmount = ethers.parseEther("1");
  if (percentageAmount.lt(minBurnAmount)) {
    console.log('📊 [Calc] 燃烧数量低于最小值，使用最小值:', ethers.formatEther(minBurnAmount));
    return walletBalance.gte(minBurnAmount) ? minBurnAmount : walletBalance;
  }
  
  return percentageAmount;
}

// 获取燃烧状态
async function getBurnStatus(env: Env): Promise<any> {
  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
  
  const jbcContract = new ethers.Contract(
    env.JBC_CONTRACT_ADDRESS,
    JBC_ABI,
    provider
  );
  
  const [walletBalance, totalSupply] = await Promise.all([
    jbcContract.balanceOf(wallet.address),
    jbcContract.totalSupply()
  ]);
  
  const currentTime = Math.floor(Date.now() / 1000);
  const nextBurnTime = getNextBurnTime();
  
  return {
    walletAddress: wallet.address,
    walletBalance: ethers.formatEther(walletBalance),
    totalSupply: ethers.formatEther(totalSupply),
    currentTime,
    nextBurnTime,
    timeUntilNextBurn: Math.max(0, nextBurnTime - currentTime),
    canBurnNow: currentTime >= nextBurnTime,
    dailyBurnAmount: env.DAILY_BURN_AMOUNT || 'auto (1% of wallet balance)',
    maxBurnAmount: env.MAX_BURN_AMOUNT || '10000'
  };
}

// 获取下次燃烧时间 (每日UTC 00:00)
function getNextBurnTime(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return Math.floor(tomorrow.getTime() / 1000);
}

// 发送通知
async function sendNotification(env: Env, notification: any): Promise<void> {
  console.log('📢 [Notification]', notification.type, ':', notification.message);
  
  // Telegram通知
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🤖 Jinbao Daily Burn Bot\n\n${notification.message}`,
          parse_mode: 'HTML'
        })
      });
      
      if (response.ok) {
        console.log('✅ [Notification] Telegram通知发送成功');
      } else {
        console.error('❌ [Notification] Telegram通知发送失败:', await response.text());
      }
    } catch (error) {
      console.error('❌ [Notification] Telegram通知异常:', error);
    }
  }
  
  // 可以添加其他通知方式 (Discord, Email等)
}