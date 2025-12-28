# Jinbao Daily Burn - Cloudflare Worker

自动化每日JBC代币燃烧的Cloudflare Worker服务。

## 🔥 功能特性

- **自动燃烧**: 每日UTC 00:00自动执行代币燃烧
- **灵活配置**: 支持固定数量或百分比燃烧策略
- **安全可靠**: 多重安全检查和限制机制
- **实时监控**: 完整的日志记录和状态查询
- **通知系统**: Telegram自动通知燃烧结果
- **手动控制**: 支持手动触发和状态查询

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 设置私钥 (用于签名燃烧交易)
wrangler secret put PRIVATE_KEY

# 设置RPC节点URL
wrangler secret put RPC_URL

# 可选: 设置Telegram通知
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

### 3. 更新配置文件

编辑 `wrangler.toml` 文件，设置正确的合约地址：

```toml
[vars]
JBC_CONTRACT_ADDRESS = "0x你的JBC代币合约地址"
PROTOCOL_CONTRACT_ADDRESS = "0x你的协议合约地址"
DAILY_BURN_AMOUNT = "1000"  # 每日燃烧数量
MAX_BURN_AMOUNT = "10000"   # 最大燃烧限制
```

### 4. 本地测试

```bash
# 启动开发服务器
npm run dev

# 测试定时任务
npm run test

# 手动触发燃烧 (测试)
curl -X POST http://localhost:8787/burn

# 查看状态
curl http://localhost:8787/status
```

### 5. 部署到Cloudflare

```bash
# 部署到测试环境
npm run deploy:staging

# 部署到生产环境
npm run deploy:production
```

## 📊 API接口

### POST /burn
手动触发代币燃烧

```bash
curl -X POST https://your-worker.workers.dev/burn
```

**响应示例:**
```json
{
  "success": true,
  "message": "燃烧执行完成",
  "data": {
    "burned": true,
    "amount": "1000.0",
    "txHash": "0x...",
    "gasUsed": "50000",
    "walletBalanceBefore": "10000.0",
    "walletBalanceAfter": "9000.0",
    "totalSupply": "99000000.0",
    "timestamp": 1703980800
  }
}
```

### GET /status
查看燃烧状态和配置信息

```bash
curl https://your-worker.workers.dev/status
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "walletBalance": "10000.0",
    "totalSupply": "99000000.0",
    "currentTime": 1703980800,
    "nextBurnTime": 1704067200,
    "timeUntilNextBurn": 86400,
    "canBurnNow": false,
    "dailyBurnAmount": "1000",
    "maxBurnAmount": "10000"
  }
}
```

### GET /health
健康检查

```bash
curl https://your-worker.workers.dev/health
```

## ⚙️ 配置选项

### 燃烧策略

1. **固定数量燃烧**
   ```toml
   DAILY_BURN_AMOUNT = "1000"  # 每日燃烧1000个JBC
   ```

2. **百分比燃烧**
   ```toml
   DAILY_BURN_AMOUNT = ""  # 空值或0，使用钱包余额的1%
   ```

### 安全限制

- `MAX_BURN_AMOUNT`: 单次燃烧最大数量限制
- 钱包余额检查: 确保有足够余额
- Gas限制: 防止交易失败

### 通知配置

设置Telegram通知：

```bash
# 创建Telegram Bot并获取Token
wrangler secret put TELEGRAM_BOT_TOKEN

# 获取Chat ID并设置
wrangler secret put TELEGRAM_CHAT_ID
```

## 🔒 安全考虑

1. **私钥安全**: 使用Cloudflare Secrets存储，永不暴露
2. **权限最小化**: 燃烧钱包只持有需要燃烧的代币
3. **数量限制**: 设置最大燃烧数量防止意外
4. **多重验证**: 交易前进行多项检查
5. **监控告警**: 异常情况及时通知

## 📈 监控和日志

### 查看日志
```bash
# 实时日志
npm run logs

# 生产环境日志
npm run logs:production
```

### Cloudflare Dashboard
- 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
- 进入 Workers & Pages → 选择你的Worker
- 查看 Metrics、Logs、Settings

### 关键指标
- 执行成功率
- 燃烧数量统计
- Gas使用情况
- 错误率和类型

## 🛠️ 故障排除

### 常见问题

1. **交易失败**
   - 检查钱包余额是否充足
   - 确认RPC节点连接正常
   - 验证合约地址正确

2. **权限错误**
   - 确认私钥对应的地址有燃烧权限
   - 检查合约是否允许该地址燃烧

3. **通知失败**
   - 验证Telegram Bot Token和Chat ID
   - 确认Bot已添加到对应群组

### 调试步骤

1. 检查环境变量设置
2. 查看Worker日志
3. 测试RPC连接
4. 验证合约交互

## 📝 更新日志

### v1.0.0
- 初始版本发布
- 支持自动定时燃烧
- 集成Telegram通知
- 完整的API接口

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 📄 许可证

MIT License