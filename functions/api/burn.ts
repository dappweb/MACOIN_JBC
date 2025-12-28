// Cloudflare Pages Function - 代币燃烧API
import { ethers } from 'ethers';

interface Env {
  PRIVATE_KEY: string;
  RPC_URL: string;
  JBC_CONTRACT_ADDRESS: string;
  DAILY_BURN_AMOUNT?: string;
  MAX_BURN_AMOUNT?: string;
  API_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const JBC_ABI = [
  "function burn(uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)"
];

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    console.log('🔥 [API] 收到燃烧请求...');
    
    // 验证API密钥 (可选但推荐)
    if (env.API_SECRET) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
        console.log('❌ [API] 未授权访问');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Unauthorized' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 执行燃烧逻辑
    const result = await performBurn(env);
    
    // 发送成功通知
    if (result.burned) {
      await sendTelegramNotification(env, {
        type: 'success',
        message: `🔥 代币燃烧成功\n💰 燃烧数量: ${result.amount} JBC\n📝 交易哈希: ${result.txHash}\n⏰ 时间: ${new Date().toLocaleString()}`
      });
      
      console.log('✅ [API] 燃烧执行成功:', result.amount, 'JBC');
    } else {
      console.log('ℹ️ [API] 本次无需燃烧:', result.reason);
    }

    return new Response(JSON.stringify({
      success: true,
      message: result.burned ? '燃烧执行成功' : '无需燃烧',
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [API] 燃烧执行失败:', error);
    
    // 发送错误通知
    await sendTelegramNotification(env, {
      type: 'error',
      message: `❌ 代币燃烧失败\n🚨 错误信息: ${error.message}\n⏰ 时间: ${new Date().toLocaleString()}`
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: '燃烧执行失败'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function performBurn(env: Env) {
  console.log('🚀 [Burn] 开始燃烧流程...');
  
  // 验证必要的环境变量
  if (!env.PRIVATE_KEY || !env.RPC_URL || !env.JBC_CONTRACT_ADDRESS) {
    throw new Error('缺少必要的环境变量');
  }

  // 初始化区块链连接
  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
  
  console.log('👛 [Burn] 燃烧钱包:', wallet.address);

  // 连接JBC合约
  const jbcContract = new ethers.Contract(
    env.JBC_CONTRACT_ADDRESS,
    JBC_ABI,
    wallet
  );

  // 检查钱包余额
  const balance = await jbcContract.balanceOf(wallet.address);
  console.log('💰 [Burn] 钱包JBC余额:', ethers.formatEther(balance));

  if (balance.eq(0)) {
    return {
      burned: false,
      reason: '钱包JBC余额为0',
      walletBalance: '0',
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  // 计算燃烧数量
  const burnAmount = calculateBurnAmount(balance, env);
  console.log('🔥 [Burn] 计算燃烧数量:', ethers.formatEther(burnAmount));
  
  if (burnAmount.eq(0)) {
    return {
      burned: false,
      reason: '计算燃烧数量为0',
      walletBalance: ethers.formatEther(balance),
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  // 安全检查 - 最大燃烧限制
  const maxBurnAmount = env.MAX_BURN_AMOUNT ? 
    ethers.parseEther(env.MAX_BURN_AMOUNT) : 
    ethers.parseEther("10000");
    
  if (burnAmount.gt(maxBurnAmount)) {
    throw new Error(`燃烧数量超过限制: ${ethers.formatEther(burnAmount)} > ${ethers.formatEther(maxBurnAmount)}`);
  }

  // 余额充足性检查
  if (balance.lt(burnAmount)) {
    throw new Error(`钱包余额不足: ${ethers.formatEther(balance)} < ${ethers.formatEther(burnAmount)}`);
  }

  // 执行燃烧交易
  console.log('📝 [Burn] 提交燃烧交易...');
  const tx = await jbcContract.burn(burnAmount, {
    gasLimit: 100000 // 设置合理的gas限制
  });

  console.log('⏳ [Burn] 等待交易确认:', tx.hash);
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error(`燃烧交易失败: ${tx.hash}`);
  }

  console.log('✅ [Burn] 燃烧交易成功确认');

  // 获取燃烧后状态
  const newBalance = await jbcContract.balanceOf(wallet.address);
  const totalSupply = await jbcContract.totalSupply();

  return {
    burned: true,
    amount: ethers.formatEther(burnAmount),
    txHash: receipt.transactionHash,
    gasUsed: receipt.gasUsed.toString(),
    walletBalanceBefore: ethers.formatEther(balance),
    walletBalanceAfter: ethers.formatEther(newBalance),
    totalSupply: ethers.formatEther(totalSupply),
    timestamp: Math.floor(Date.now() / 1000)
  };
}

function calculateBurnAmount(balance: ethers.BigNumber, env: Env): ethers.BigNumber {
  // 方案1: 固定数量燃烧
  if (env.DAILY_BURN_AMOUNT && env.DAILY_BURN_AMOUNT !== '0') {
    const fixedAmount = ethers.parseEther(env.DAILY_BURN_AMOUNT);
    console.log('📊 [Calc] 使用固定燃烧数量:', ethers.formatEther(fixedAmount));
    return fixedAmount.gt(balance) ? balance : fixedAmount;
  }
  
  // 方案2: 基于余额的百分比燃烧 (默认1%)
  const burnPercentage = 100; // 1% = 100/10000
  const percentageAmount = balance.mul(burnPercentage).div(10000);
  console.log('📊 [Calc] 使用百分比燃烧 (1%):', ethers.formatEther(percentageAmount));
  
  // 最小燃烧数量检查 (至少1个JBC)
  const minBurnAmount = ethers.parseEther("1");
  if (percentageAmount.lt(minBurnAmount)) {
    console.log('📊 [Calc] 燃烧数量低于最小值，使用最小值');
    return balance.gte(minBurnAmount) ? minBurnAmount : balance;
  }
  
  return percentageAmount;
}

async function sendTelegramNotification(env: Env, notification: any) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.log('📢 [Notification] Telegram配置未设置，跳过通知');
    return;
  }

  try {
    const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `🤖 Jinbao Burn Bot\n\n${notification.message}`,
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