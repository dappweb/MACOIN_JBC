// Cloudflare Pages Function - 燃烧状态查询API
import { ethers } from 'ethers';

interface Env {
  PRIVATE_KEY: string;
  RPC_URL: string;
  JBC_CONTRACT_ADDRESS: string;
  DAILY_BURN_AMOUNT?: string;
  MAX_BURN_AMOUNT?: string;
}

const JBC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)"
];

export async function onRequestGet(context: { env: Env }) {
  const { env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    console.log('📊 [Status] 查询燃烧状态...');
    
    // 验证环境变量
    if (!env.PRIVATE_KEY || !env.RPC_URL || !env.JBC_CONTRACT_ADDRESS) {
      throw new Error('缺少必要的环境变量');
    }

    // 初始化区块链连接
    const provider = new ethers.JsonRpcProvider(env.RPC_URL);
    const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
    
    const jbcContract = new ethers.Contract(
      env.JBC_CONTRACT_ADDRESS,
      JBC_ABI,
      provider
    );

    console.log('🔗 [Status] 查询链上数据...');
    
    // 并行查询链上数据
    const [walletBalance, totalSupply] = await Promise.all([
      jbcContract.balanceOf(wallet.address),
      jbcContract.totalSupply()
    ]);

    // 计算下次燃烧时间 (基于GitHub Actions cron)
    const now = new Date();
    const nextBurn = new Date(now);
    nextBurn.setUTCDate(nextBurn.getUTCDate() + 1);
    nextBurn.setUTCHours(0, 0, 0, 0);
    
    const currentTime = Math.floor(Date.now() / 1000);
    const nextBurnTime = Math.floor(nextBurn.getTime() / 1000);

    // 计算预估燃烧数量
    const estimatedBurnAmount = calculateEstimatedBurn(walletBalance, env);

    const status = {
      // 基本信息
      walletAddress: wallet.address,
      walletBalance: ethers.formatEther(walletBalance),
      totalSupply: ethers.formatEther(totalSupply),
      
      // 燃烧配置
      dailyBurnAmount: env.DAILY_BURN_AMOUNT || 'auto (1% of wallet balance)',
      maxBurnAmount: env.MAX_BURN_AMOUNT || '10000',
      estimatedNextBurn: ethers.formatEther(estimatedBurnAmount),
      
      // 时间信息
      currentTime,
      nextBurnTime,
      timeUntilNextBurn: Math.max(0, nextBurnTime - currentTime),
      nextBurnDate: nextBurn.toISOString(),
      
      // 状态信息
      canBurnNow: walletBalance.gt(0),
      hasEnoughBalance: walletBalance.gte(estimatedBurnAmount),
      
      // 统计信息
      burnPercentage: walletBalance.gt(0) ? 
        (estimatedBurnAmount.mul(10000).div(walletBalance).toNumber() / 100).toFixed(2) + '%' : '0%',
      
      // 元数据
      timestamp: currentTime,
      version: '1.0.0'
    };

    console.log('✅ [Status] 状态查询完成');

    return new Response(JSON.stringify({
      success: true,
      data: status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [Status] 状态查询失败:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: '状态查询失败'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function calculateEstimatedBurn(balance: ethers.BigNumber, env: Env): ethers.BigNumber {
  if (balance.eq(0)) {
    return ethers.BigNumber.from(0);
  }

  // 固定数量燃烧
  if (env.DAILY_BURN_AMOUNT && env.DAILY_BURN_AMOUNT !== '0') {
    const fixedAmount = ethers.parseEther(env.DAILY_BURN_AMOUNT);
    return fixedAmount.gt(balance) ? balance : fixedAmount;
  }
  
  // 百分比燃烧 (1%)
  const percentageAmount = balance.mul(100).div(10000);
  const minBurnAmount = ethers.parseEther("1");
  
  if (percentageAmount.lt(minBurnAmount)) {
    return balance.gte(minBurnAmount) ? minBurnAmount : balance;
  }
  
  return percentageAmount;
}