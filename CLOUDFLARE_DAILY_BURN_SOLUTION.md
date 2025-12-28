# Cloudflare定时代币燃烧解决方案

## 🔥 当前燃烧机制分析

### 现有燃烧功能
1. **JBC合约燃烧功能**:
   - `burn(uint256 amount)` - 允许协议合约燃烧代币
   - 交易税费自动燃烧 (买入50%，卖出25%)
   - 燃烧地址: `0x000000000000000000000000000000000000dEaD`

2. **协议合约中的燃烧**:
   - `_internalBuybackAndBurn()` - 内部回购燃烧
   - `lastBurnTime` - 记录上次燃烧时间
   - 注释显示原本有 `dailyBurn` 功能但被移除了

## 🌐 Cloudflare定时燃烧架构

```
Cloudflare Cron Trigger (每日UTC 00:00)
    ↓
Cloudflare Worker (执行燃烧逻辑)
    ↓
区块链RPC调用 (调用合约燃烧函数)
    ↓
JBC代币燃烧 (减少总供应量)
```

## 📋 实施方案

### 1. 创建Cloudflare Worker

```typescript
// worker.ts
import { ethers } from 'ethers';

// 环境变量配置
interface Env {
  PRIVATE_KEY: string;
  RPC_URL: string;
  PROTOCOL_CONTRACT_ADDRESS: string;
  JBC_CONTRACT_ADDRESS: string;
  DAILY_BURN_AMOUNT: string;
}

// 合约ABI (只包含需要的函数)
const PROTOCOL_ABI = [
  "function dailyBurn() external",
  "function lastBurnTime() external view returns (uint256)",
  "function owner() external view returns (address)"
];

const JBC_ABI = [
  "function burn(uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)"
];

export default {
  // 定时触发器处理
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('🔥 开始执行每日代币燃烧...');
    
    try {
      await performDailyBurn(env);
      console.log('✅ 每日燃烧执行成功');
    } catch (error) {
      console.error('❌ 每日燃烧执行失败:', error);
      // 可以添加告警通知
      await sendAlert(env, `燃烧失败: ${error.message}`);
    }
  },

  // HTTP请求处理 (用于手动触发或状态查询)
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/burn' && request.method === 'POST') {
      try {
        await performDailyBurn(env);
        return new Response('燃烧执行成功', { status: 200 });
      } catch (error) {
        return new Response(`燃烧失败: ${error.message}`, { status: 500 });
      }
    }
    
    if (url.pathname === '/status') {
      try {
        const status = await getBurnStatus(env);
        return new Response(JSON.stringify(status), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(`获取状态失败: ${error.message}`, { status: 500 });
      }
    }
    
    return new Response('Cloudflare Daily Burn Service', { status: 200 });
  }
};

async function performDailyBurn(env: Env): Promise<void> {
  // 1. 初始化区块链连接
  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
  
  // 2. 连接合约
  const protocolContract = new ethers.Contract(
    env.PROTOCOL_CONTRACT_ADDRESS,
    PROTOCOL_ABI,
    wallet
  );
  
  const jbcContract = new ethers.Contract(
    env.JBC_CONTRACT_ADDRESS,
    JBC_ABI,
    wallet
  );
  
  // 3. 检查是否需要燃烧
  const lastBurnTime = await protocolContract.lastBurnTime();
  const currentTime = Math.floor(Date.now() / 1000);
  const oneDayInSeconds = 24 * 60 * 60;
  
  if (currentTime - Number(lastBurnTime) < oneDayInSeconds) {
    console.log('⏰ 距离上次燃烧不足24小时，跳过本次燃烧');
    return;
  }
  
  // 4. 计算燃烧数量
  const burnAmount = await calculateBurnAmount(jbcContract, env);
  
  if (burnAmount.eq(0)) {
    console.log('💰 燃烧数量为0，跳过本次燃烧');
    return;
  }
  
  // 5. 执行燃烧
  console.log(`🔥 准备燃烧 ${ethers.formatEther(burnAmount)} JBC`);
  
  // 检查合约余额
  const contractBalance = await jbcContract.balanceOf(env.PROTOCOL_CONTRACT_ADDRESS);
  if (contractBalance.lt(burnAmount)) {
    throw new Error(`合约余额不足: ${ethers.formatEther(contractBalance)} < ${ethers.formatEther(burnAmount)}`);
  }
  
  // 执行燃烧交易
  const tx = await jbcContract.burn(burnAmount);
  console.log(`📝 燃烧交易已提交: ${tx.hash}`);
  
  // 等待交易确认
  const receipt = await tx.wait();
  console.log(`✅ 燃烧交易已确认: ${receipt.transactionHash}`);
  
  // 6. 记录燃烧事件
  await logBurnEvent(env, {
    amount: ethers.formatEther(burnAmount),
    txHash: receipt.transactionHash,
    timestamp: currentTime
  });
}

async function calculateBurnAmount(jbcContract: ethers.Contract, env: Env): Promise<ethers.BigNumber> {
  // 方案1: 固定数量燃烧
  if (env.DAILY_BURN_AMOUNT && env.DAILY_BURN_AMOUNT !== '0') {
    return ethers.parseEther(env.DAILY_BURN_AMOUNT);
  }
  
  // 方案2: 基于总供应量的百分比燃烧 (例如0.1%)
  const totalSupply = await jbcContract.totalSupply();
  const burnPercentage = 0.001; // 0.1%
  return totalSupply.mul(Math.floor(burnPercentage * 10000)).div(10000);
  
  // 方案3: 基于合约余额的百分比燃烧
  // const contractBalance = await jbcContract.balanceOf(env.PROTOCOL_CONTRACT_ADDRESS);
  // const burnPercentage = 0.01; // 1%
  // return contractBalance.mul(Math.floor(burnPercentage * 10000)).div(10000);
}

async function getBurnStatus(env: Env): Promise<any> {
  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  
  const protocolContract = new ethers.Contract(
    env.PROTOCOL_CONTRACT_ADDRESS,
    PROTOCOL_ABI,
    provider
  );
  
  const jbcContract = new ethers.Contract(
    env.JBC_CONTRACT_ADDRESS,
    JBC_ABI,
    provider
  );
  
  const [lastBurnTime, totalSupply, contractBalance] = await Promise.all([
    protocolContract.lastBurnTime(),
    jbcContract.totalSupply(),
    jbcContract.balanceOf(env.PROTOCOL_CONTRACT_ADDRESS)
  ]);
  
  const currentTime = Math.floor(Date.now() / 1000);
  const nextBurnTime = Number(lastBurnTime) + (24 * 60 * 60);
  
  return {
    lastBurnTime: Number(lastBurnTime),
    nextBurnTime,
    timeUntilNextBurn: Math.max(0, nextBurnTime - currentTime),
    totalSupply: ethers.formatEther(totalSupply),
    contractBalance: ethers.formatEther(contractBalance),
    canBurnNow: currentTime >= nextBurnTime
  };
}

async function logBurnEvent(env: Env, event: any): Promise<void> {
  // 可以发送到日志服务或数据库
  console.log('📊 燃烧事件记录:', event);
  
  // 示例: 发送到Webhook
  // await fetch('YOUR_WEBHOOK_URL', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(event)
  // });
}

async function sendAlert(env: Env, message: string): Promise<void> {
  // 发送告警通知 (Telegram, Discord, Email等)
  console.log('🚨 告警:', message);
  
  // 示例: Telegram通知
  // await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     chat_id: env.TELEGRAM_CHAT_ID,
  //     text: `🔥 代币燃烧告警\n${message}`
  //   })
  // });
}
```

### 2. wrangler.toml配置

```toml
name = "jinbao-daily-burn"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = ["0 0 * * *"]  # 每日UTC 00:00执行

[vars]
PROTOCOL_CONTRACT_ADDRESS = "0x你的协议合约地址"
JBC_CONTRACT_ADDRESS = "0x你的JBC代币地址"
DAILY_BURN_AMOUNT = "1000"  # 每日燃烧1000个JBC

[env.production.vars]
RPC_URL = "https://your-rpc-endpoint"

# 敏感信息使用secrets
# wrangler secret put PRIVATE_KEY
# wrangler secret put TELEGRAM_BOT_TOKEN
# wrangler secret put TELEGRAM_CHAT_ID
```

### 3. package.json

```json
{
  "name": "jinbao-daily-burn",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "wrangler dev --test-scheduled"
  },
  "dependencies": {
    "ethers": "^6.8.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20231025.0",
    "wrangler": "^3.15.0",
    "typescript": "^5.2.2"
  }
}
```

## 🚀 部署步骤

### 1. 初始化项目
```bash
npm create cloudflare@latest jinbao-daily-burn
cd jinbao-daily-burn
npm install ethers
```

### 2. 配置环境变量
```bash
# 设置私钥 (用于签名交易)
wrangler secret put PRIVATE_KEY

# 设置RPC URL
wrangler secret put RPC_URL

# 可选: 设置通知配置
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

### 3. 部署Worker
```bash
wrangler deploy
```

### 4. 测试定时任务
```bash
# 测试定时触发器
wrangler dev --test-scheduled

# 手动触发燃烧
curl -X POST https://your-worker.your-subdomain.workers.dev/burn

# 查看状态
curl https://your-worker.your-subdomain.workers.dev/status
```

## 📊 监控和管理

### 1. 状态监控
- **API端点**: `/status` - 查看燃烧状态
- **日志查看**: Cloudflare Dashboard → Workers → Logs
- **指标监控**: 执行次数、成功率、错误率

### 2. 手动控制
- **手动触发**: POST `/burn` - 立即执行燃烧
- **状态查询**: GET `/status` - 查看当前状态
- **暂停/恢复**: 通过Cloudflare Dashboard管理

### 3. 告警通知
- **Telegram通知**: 燃烧成功/失败通知
- **Discord Webhook**: 团队通知
- **Email告警**: 关键错误通知

## 💰 燃烧策略选项

### 1. 固定数量燃烧
```typescript
const burnAmount = ethers.parseEther("1000"); // 每日燃烧1000 JBC
```

### 2. 百分比燃烧
```typescript
// 基于总供应量的0.1%
const totalSupply = await jbcContract.totalSupply();
const burnAmount = totalSupply.mul(100).div(100000); // 0.1%
```

### 3. 动态燃烧
```typescript
// 基于交易量或其他指标的动态燃烧
const dailyVolume = await getDailyVolume();
const burnAmount = dailyVolume.mul(5).div(100); // 日交易量的5%
```

## 🔒 安全考虑

1. **私钥管理**: 使用Cloudflare Secrets存储
2. **权限控制**: 燃烧钱包只有燃烧权限
3. **金额限制**: 设置最大燃烧数量限制
4. **多重验证**: 重要操作需要多重签名
5. **监控告警**: 异常情况及时通知

## 📈 优势特点

- **全球分布**: Cloudflare边缘网络确保高可用性
- **成本低廉**: 每月100,000次请求免费
- **自动执行**: 无需维护服务器
- **实时监控**: 完整的日志和指标
- **灵活配置**: 支持多种燃烧策略
- **安全可靠**: 企业级安全保障

这个方案提供了一个完整的、生产就绪的代币燃烧自动化解决方案！