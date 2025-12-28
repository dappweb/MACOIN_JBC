# Cloudflare Pages 部署指南

## 🌐 部署概述

本项目将使用Cloudflare Pages + Functions的方式部署，结合GitHub Actions实现每日自动代币燃烧。

## 📁 项目结构

```
project/
├── functions/              # Cloudflare Pages Functions (API后端)
│   ├── api/
│   │   ├── burn.ts        # 燃烧API
│   │   ├── status.ts      # 状态查询API
│   │   └── health.ts      # 健康检查API
│   └── _middleware.ts     # 中间件 (CORS等)
├── .github/workflows/
│   └── daily-burn.yml     # GitHub Actions定时任务
├── dist/                  # 构建输出目录
├── src/                   # 前端源码 (现有的React应用)
├── pages-wrangler.toml    # Pages配置文件
└── package.json           # 项目配置
```

## 🚀 部署步骤

### 1. 准备GitHub仓库

确保你的代码已推送到GitHub仓库，包含以下新增文件：
- `functions/` 目录下的所有API文件
- `.github/workflows/daily-burn.yml` 定时任务配置
- `pages-wrangler.toml` Pages配置文件

### 2. 设置GitHub Secrets

在GitHub仓库的 Settings → Secrets and variables → Actions 中添加：

```bash
# 必需的Secrets
BURN_API_URL=https://your-pages-domain.pages.dev
API_SECRET=your-secure-api-secret-key

# 可选的Telegram通知Secrets
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
```

### 3. 连接Cloudflare Pages

1. **登录Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com
   - 进入 Pages 部分

2. **创建新项目**
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 授权并选择你的GitHub仓库

3. **配置构建设置**
   ```
   Framework preset: React (或根据你的前端框架选择)
   Build command: npm run build
   Build output directory: dist
   Root directory: / (项目根目录)
   ```

4. **启用Functions**
   - 在项目设置中确保Functions已启用
   - Pages会自动识别 `functions/` 目录

### 4. 设置环境变量

在Cloudflare Pages项目的 Settings → Environment variables 中设置：

#### Production环境变量
```bash
# 必需变量
PRIVATE_KEY=0x你的燃烧钱包私钥
RPC_URL=https://your-mainnet-rpc-url
JBC_CONTRACT_ADDRESS=0x你的JBC代币合约地址

# 可选变量
API_SECRET=your-secure-api-secret-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
DAILY_BURN_AMOUNT=500
MAX_BURN_AMOUNT=5000
```

#### Preview环境变量 (测试用)
```bash
# 测试网配置
PRIVATE_KEY=0x测试钱包私钥
RPC_URL=https://your-testnet-rpc-url
JBC_CONTRACT_ADDRESS=0x测试网JBC合约地址
DAILY_BURN_AMOUNT=10
MAX_BURN_AMOUNT=100
```

### 5. 部署验证

1. **触发部署**
   - 推送代码到GitHub主分支
   - Cloudflare Pages会自动构建和部署

2. **测试API端点**
   ```bash
   # 健康检查
   curl https://your-domain.pages.dev/api/health
   
   # 查看状态
   curl https://your-domain.pages.dev/api/status
   
   # 手动触发燃烧 (需要API密钥)
   curl -X POST https://your-domain.pages.dev/api/burn \
     -H "Authorization: Bearer your-api-secret"
   ```

3. **验证GitHub Actions**
   - 在GitHub仓库的Actions标签页查看工作流
   - 可以手动触发测试定时任务

## 🔧 配置说明

### API端点

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/health` | GET | 健康检查 | 无 |
| `/api/status` | GET | 查看燃烧状态 | 无 |
| `/api/burn` | POST | 执行代币燃烧 | Bearer Token |

### 环境变量说明

| 变量名 | 必需 | 描述 | 示例 |
|--------|------|------|------|
| `PRIVATE_KEY` | ✅ | 燃烧钱包私钥 | `0x123...` |
| `RPC_URL` | ✅ | 区块链RPC地址 | `https://rpc.ankr.com/eth` |
| `JBC_CONTRACT_ADDRESS` | ✅ | JBC代币合约地址 | `0xabc...` |
| `API_SECRET` | 🔶 | API访问密钥 | `secure-key-123` |
| `DAILY_BURN_AMOUNT` | 🔶 | 每日燃烧数量 | `1000` |
| `MAX_BURN_AMOUNT` | 🔶 | 最大燃烧限制 | `10000` |
| `TELEGRAM_BOT_TOKEN` | 🔶 | Telegram机器人Token | `123:ABC...` |
| `TELEGRAM_CHAT_ID` | 🔶 | Telegram聊天ID | `-123456789` |

### 燃烧策略配置

1. **固定数量燃烧**
   ```bash
   DAILY_BURN_AMOUNT=1000  # 每日燃烧1000个JBC
   ```

2. **百分比燃烧**
   ```bash
   DAILY_BURN_AMOUNT=      # 空值，使用钱包余额的1%
   ```

## 📊 监控和管理

### 1. Cloudflare Dashboard监控
- **Analytics**: 查看API调用统计
- **Functions**: 监控函数执行情况
- **Logs**: 实时查看执行日志

### 2. GitHub Actions监控
- **工作流历史**: 查看每日执行记录
- **日志详情**: 详细的执行日志
- **手动触发**: 支持手动执行燃烧任务

### 3. Telegram通知
- **成功通知**: 燃烧成功时的详细信息
- **失败告警**: 燃烧失败时的错误信息
- **状态报告**: 定期状态更新

## 🔒 安全最佳实践

### 1. 私钥安全
- ✅ 使用Cloudflare环境变量存储
- ✅ 不要在代码中硬编码
- ✅ 定期轮换私钥
- ✅ 使用专用燃烧钱包

### 2. API安全
- ✅ 设置API_SECRET进行认证
- ✅ 启用CORS保护
- ✅ 设置燃烧数量限制
- ✅ 监控异常调用

### 3. 权限控制
- ✅ 燃烧钱包只持有需要燃烧的代币
- ✅ 不要给燃烧钱包过多权限
- ✅ 定期检查钱包余额

## 🛠️ 故障排除

### 常见问题

1. **Functions部署失败**
   - 检查 `functions/` 目录结构
   - 确认TypeScript语法正确
   - 查看构建日志

2. **API调用失败**
   - 验证环境变量设置
   - 检查RPC节点连接
   - 确认合约地址正确

3. **GitHub Actions失败**
   - 检查Secrets配置
   - 验证API地址可访问
   - 查看工作流日志

### 调试步骤

1. **检查Pages部署状态**
   ```bash
   # 访问健康检查端点
   curl https://your-domain.pages.dev/api/health
   ```

2. **验证环境变量**
   ```bash
   # 查看状态端点 (不会暴露敏感信息)
   curl https://your-domain.pages.dev/api/status
   ```

3. **测试燃烧功能**
   ```bash
   # 手动触发燃烧 (小心使用)
   curl -X POST https://your-domain.pages.dev/api/burn \
     -H "Authorization: Bearer your-api-secret"
   ```

## 📈 性能优化

### 1. 缓存策略
- API响应缓存
- 静态资源CDN加速
- 智能路由优化

### 2. 成本控制
- 合理设置燃烧频率
- 监控API调用次数
- 优化函数执行时间

### 3. 可靠性保障
- 多重错误处理
- 自动重试机制
- 降级策略

## 🎯 部署检查清单

- [ ] GitHub仓库包含所有必要文件
- [ ] GitHub Secrets已正确设置
- [ ] Cloudflare Pages项目已创建
- [ ] 环境变量已配置完成
- [ ] Functions已成功部署
- [ ] API端点测试通过
- [ ] GitHub Actions工作流正常
- [ ] Telegram通知配置正确
- [ ] 安全设置已检查
- [ ] 监控和告警已设置

完成以上步骤后，你的Cloudflare Pages代币燃烧系统就可以正常运行了！