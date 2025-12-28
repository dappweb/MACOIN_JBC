# Cloudflare Pages + Functions 代币燃烧解决方案

## 🌐 架构概述

由于项目将部署到Cloudflare Pages，我们需要调整架构：

```
Cloudflare Pages (前端) + Cloudflare Functions (后端API) + Cron Triggers
```

### 方案选择

1. **Cloudflare Pages Functions** - 在Pages项目中集成API函数
2. **外部Cron触发** - 使用外部服务触发燃烧（如GitHub Actions）
3. **混合方案** - Pages + 独立Worker

## 🔧 推荐方案：Pages Functions + 外部Cron

### 1. 项目结构

```
project/
├── functions/           # Cloudflare Pages Functions
│   ├── api/
│   │   ├── burn.ts     # 燃烧API
│   │   ├── status.ts   # 状态查询
│   │   └── health.ts   # 健康检查
│   └── _middleware.ts  # 中间件
├── public/             # 静态文件
├── src/                # 前端源码
├── .github/
│   └── workflows/
│       └── daily-burn.yml  # GitHub Actions定时任务
└── wrangler.toml       # 配置文件
```

## 📁 实现文件

### 1. Cloudflare Pages Functions

#### functions/api/burn.ts
```typescript
import { ethers } from 'ethers';

interface Env {
  PRIVATE_KEY: string;
  RPC_URL: string;
  JBC_CONTRACT_ADDRESS: string;
  DAILY_BURN_AMOUNT?: string;
  MAX_BURN_AMOUNT?: string;
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
    // 验证授权 (可选)
    const authHeader = request.headers.get('Authorization');
    if (env.API_SECRET && authHeader !== `Bearer ${env.API_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    console.log('🔥 [API] 开始执行代币燃烧...');
    
    // 执行燃烧逻辑
    const result = await performBurn(env);
    
    // 发送通知
    if (result.burned) {
      await sendTelegramNotification(env, {
        type: 'success',
        message: `🔥 代币燃烧成功\n💰 数量: ${result.amount} JBC\n📝 交易: ${result.txHash}`
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [API] 燃烧失败:', error);
    
    // 发送错误通知
    await sendTelegramNotification(env, {
      type: 'error',
      message: `❌ 代币燃烧失败\n🚨 错误: ${error.message}`
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function performBurn(env: Env) {
  // 初始化区块链连接
  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
  
  const jbcContract = new ethers.Contract(
    env.JBC_CONTRACT_ADDRESS,
    JBC_ABI,
    wallet
  );

  // 检查余额
  const balance = await jbcContract.balanceOf(wallet.address);
  console.log('💰 钱包余额:', ethers.formatEther(balance));

  if (balance.eq(0)) {
    return { burned: false, reason: '钱包余额为0' };
  }

  // 计算燃烧数量
  const burnAmount = calculateBurnAmount(balance, env);
  
  if (burnAmount.eq(0)) {
    return { burned: false, reason: '燃烧数量为0' };
  }

  // 安全检查
  const maxBurn = env.MAX_BURN_AMOUNT ? ethers.parseEther(env.MAX_BURN_AMOUNT) : ethers.parseEther("10000");
  if (burnAmount.gt(maxBurn)) {
    throw new Error(`燃烧数量超限: ${ethers.formatEther(burnAmount)} > ${ethers.formatEther(maxBurn)}`);
  }

  // 执行燃烧
  console.log('🔥 执行燃烧:', ethers.formatEther(burnAmount));
  const tx = await jbcContract.burn(burnAmount);
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error(`交易失败: ${tx.hash}`);
  }

  return {
    burned: true,
    amount: ethers.formatEther(burnAmount),
    txHash: receipt.transactionHash,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: Math.floor(Date.now() / 1000)
  };
}

function calculateBurnAmount(balance: ethers.BigNumber, env: Env): ethers.BigNumber {
  if (env.DAILY_BURN_AMOUNT && env.DAILY_BURN_AMOUNT !== '0') {
    const fixed = ethers.parseEther(env.DAILY_BURN_AMOUNT);
    return fixed.gt(balance) ? balance : fixed;
  }
  
  // 默认1%
  const percentage = balance.mul(100).div(10000);
  const minBurn = ethers.parseEther("1");
  
  return percentage.lt(minBurn) ? (balance.gte(minBurn) ? minBurn : balance) : percentage;
}

async function sendTelegramNotification(env: Env, notification: any) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `🤖 Jinbao Burn Bot\n\n${notification.message}`,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Telegram通知失败:', error);
  }
}
```

#### functions/api/status.ts
```typescript
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
    const provider = new ethers.JsonRpcProvider(env.RPC_URL);
    const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
    
    const jbcContract = new ethers.Contract(
      env.JBC_CONTRACT_ADDRESS,
      JBC_ABI,
      provider
    );

    const [balance, totalSupply] = await Promise.all([
      jbcContract.balanceOf(wallet.address),
      jbcContract.totalSupply()
    ]);

    const status = {
      walletAddress: wallet.address,
      walletBalance: ethers.formatEther(balance),
      totalSupply: ethers.formatEther(totalSupply),
      dailyBurnAmount: env.DAILY_BURN_AMOUNT || 'auto (1%)',
      maxBurnAmount: env.MAX_BURN_AMOUNT || '10000',
      timestamp: Math.floor(Date.now() / 1000)
    };

    return new Response(JSON.stringify({
      success: true,
      data: status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

#### functions/api/health.ts
```typescript
export async function onRequestGet() {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  return new Response(JSON.stringify({
    success: true,
    message: 'Jinbao Burn API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

#### functions/_middleware.ts
```typescript
export async function onRequest(context: any) {
  const { request } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  // Continue to the next handler
  return context.next();
}
```

### 2. GitHub Actions定时任务

#### .github/workflows/daily-burn.yml
```yaml
name: Daily Token Burn

on:
  schedule:
    # 每日UTC 00:00执行
    - cron: '0 0 * * *'
  workflow_dispatch: # 允许手动触发

jobs:
  burn:
    runs-on: ubuntu-latest
    
    steps:
    - name: Execute Daily Burn
      run: |
        echo "🔥 执行每日代币燃烧..."
        
        # 调用Cloudflare Pages API
        response=$(curl -s -w "%{http_code}" -X POST \
          -H "Authorization: Bearer ${{ secrets.API_SECRET }}" \
          -H "Content-Type: application/json" \
          "${{ secrets.BURN_API_URL }}/api/burn")
        
        http_code="${response: -3}"
        body="${response%???}"
        
        echo "HTTP状态码: $http_code"
        echo "响应内容: $body"
        
        if [ "$http_code" -eq 200 ]; then
          echo "✅ 燃烧执行成功"
        else
          echo "❌ 燃烧执行失败"
          exit 1
        fi

    - name: Send Notification on Failure
      if: failure()
      run: |
        # 发送失败通知到Telegram
        curl -s -X POST \
          "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
          -d "chat_id=${{ secrets.TELEGRAM_CHAT_ID }}" \
          -d "text=❌ GitHub Actions 每日燃烧任务失败"
```

### 3. 配置文件

#### wrangler.toml
```toml
name = "jinbao-protocol"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Pages配置
pages_build_output_dir = "dist"

# 环境变量
[vars]
JBC_CONTRACT_ADDRESS = "0x你的JBC代币合约地址"
DAILY_BURN_AMOUNT = "1000"
MAX_BURN_AMOUNT = "10000"

# 生产环境
[env.production]
[env.production.vars]
JBC_CONTRACT_ADDRESS = "0x生产环境JBC合约地址"
DAILY_BURN_AMOUNT = "500"
MAX_BURN_AMOUNT = "5000"

# 使用secrets管理敏感信息:
# wrangler secret put PRIVATE_KEY
# wrangler secret put RPC_URL
# wrangler secret put API_SECRET
# wrangler secret put TELEGRAM_BOT_TOKEN
# wrangler secret put TELEGRAM_CHAT_ID
```

#### package.json
```json
{
  "name": "jinbao-protocol-pages",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler pages dev dist --compatibility-date=2024-01-01",
    "build": "npm run build:frontend && npm run build:functions",
    "build:frontend": "vite build",
    "build:functions": "echo 'Functions built with Pages'",
    "deploy": "wrangler pages deploy dist",
    "preview": "wrangler pages dev dist"
  },
  "dependencies": {
    "ethers": "^6.8.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20231025.0",
    "wrangler": "^3.15.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
```

## 🚀 部署步骤

### 1. 设置GitHub Secrets
```bash
# 在GitHub仓库设置中添加以下Secrets:
API_SECRET=your-api-secret-key
BURN_API_URL=https://your-pages-domain.pages.dev
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
```

### 2. 设置Cloudflare Pages环境变量
```bash
# 在Cloudflare Pages Dashboard中设置:
PRIVATE_KEY=your-wallet-private-key
RPC_URL=your-rpc-endpoint
JBC_CONTRACT_ADDRESS=your-jbc-contract-address
API_SECRET=your-api-secret-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
```

### 3. 部署到Cloudflare Pages
```bash
# 方法1: 通过GitHub集成 (推荐)
# 1. 在Cloudflare Pages Dashboard连接GitHub仓库
# 2. 设置构建命令: npm run build
# 3. 设置输出目录: dist
# 4. 启用Functions

# 方法2: 手动部署
npm run build
wrangler pages deploy dist
```

## 📊 API使用

### 手动触发燃烧
```bash
curl -X POST https://your-domain.pages.dev/api/burn \
  -H "Authorization: Bearer your-api-secret"
```

### 查看状态
```bash
curl https://your-domain.pages.dev/api/status
```

### 健康检查
```bash
curl https://your-domain.pages.dev/api/health
```

## 🔒 安全特性

1. **API密钥验证**: 防止未授权访问
2. **CORS配置**: 控制跨域访问
3. **环境变量隔离**: 敏感信息安全存储
4. **燃烧限制**: 防止意外大额燃烧
5. **错误处理**: 完整的异常捕获和通知

## 📈 监控方案

1. **GitHub Actions日志**: 定时任务执行记录
2. **Cloudflare Analytics**: Pages访问统计
3. **Telegram通知**: 实时燃烧状态通知
4. **API响应监控**: 健康检查和状态查询

这个方案完美适配Cloudflare Pages部署，提供了完整的代币燃烧自动化功能！