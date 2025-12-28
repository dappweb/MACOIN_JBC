# 🔥 Jinbao Protocol - Cloudflare Pages 部署

## 📋 概述

本项目现已支持部署到Cloudflare Pages，集成了自动化代币燃烧功能。

### 🌟 新增功能

- **Cloudflare Pages Functions**: 提供燃烧API后端
- **GitHub Actions定时任务**: 每日自动执行代币燃烧
- **Telegram通知**: 实时燃烧状态通知
- **完整的监控和管理**: 健康检查、状态查询、错误处理

## 🚀 快速部署

### 1. 前置准备

确保你有以下信息：
- JBC代币合约地址
- 燃烧钱包私钥
- 区块链RPC节点地址
- (可选) Telegram Bot配置

### 2. GitHub设置

在仓库的 Settings → Secrets 中添加：
```
BURN_API_URL=https://your-domain.pages.dev
API_SECRET=your-secure-secret
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

### 3. Cloudflare Pages部署

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 Pages → Create a project → Connect to Git
3. 选择此GitHub仓库
4. 配置构建设置：
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 在环境变量中设置：
   - `PRIVATE_KEY`: 燃烧钱包私钥
   - `RPC_URL`: RPC节点地址
   - `JBC_CONTRACT_ADDRESS`: JBC合约地址
   - 其他可选配置...

### 4. 验证部署

```bash
# 健康检查
curl https://your-domain.pages.dev/api/health

# 查看状态
curl https://your-domain.pages.dev/api/status

# 手动燃烧 (需要API密钥)
curl -X POST https://your-domain.pages.dev/api/burn \
  -H "Authorization: Bearer your-api-secret"
```

## 📊 API接口

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/health` | GET | 健康检查 | 无 |
| `/api/status` | GET | 燃烧状态查询 | 无 |
| `/api/burn` | POST | 执行代币燃烧 | Bearer Token |

## ⏰ 自动化燃烧

- **执行时间**: 每日UTC 00:00
- **执行方式**: GitHub Actions自动触发
- **通知方式**: Telegram实时通知
- **监控方式**: GitHub Actions日志 + Cloudflare Analytics

## 🔧 本地开发

```bash
# 安装依赖
npm install

# 启动前端开发服务器
npm run dev

# 启动Pages Functions本地开发
npm run pages:dev

# 测试燃烧API (本地)
npm run burn:test

# 查看燃烧状态 (本地)
npm run burn:status
```

## 📁 新增文件结构

```
├── functions/                 # Cloudflare Pages Functions
│   ├── api/
│   │   ├── burn.ts           # 燃烧API
│   │   ├── status.ts         # 状态查询
│   │   └── health.ts         # 健康检查
│   └── _middleware.ts        # CORS中间件
├── .github/workflows/
│   └── daily-burn.yml        # 定时燃烧任务
├── pages-wrangler.toml       # Pages配置
├── CLOUDFLARE_PAGES_BURN_SOLUTION.md  # 技术方案
├── PAGES_DEPLOYMENT_GUIDE.md # 详细部署指南
└── CLOUDFLARE_PAGES_README.md # 本文件
```

## 🔒 安全特性

- ✅ API密钥认证
- ✅ CORS保护
- ✅ 燃烧数量限制
- ✅ 环境变量隔离
- ✅ 错误处理和通知

## 📈 监控和管理

### Cloudflare Dashboard
- Functions执行统计
- 实时日志查看
- 性能指标监控

### GitHub Actions
- 定时任务执行历史
- 详细执行日志
- 手动触发支持

### Telegram通知
- 燃烧成功/失败通知
- 详细执行信息
- 错误告警

## 🛠️ 故障排除

### 常见问题

1. **API调用失败**
   - 检查环境变量配置
   - 验证RPC节点连接
   - 确认合约地址正确

2. **GitHub Actions失败**
   - 检查Secrets设置
   - 验证API地址可访问
   - 查看工作流日志

3. **燃烧交易失败**
   - 检查钱包余额
   - 确认私钥正确
   - 验证Gas费设置

### 调试命令

```bash
# 检查API健康状态
curl https://your-domain.pages.dev/api/health

# 查看详细状态信息
curl https://your-domain.pages.dev/api/status

# 查看Cloudflare Functions日志
# (在Cloudflare Dashboard中查看)
```

## 📚 相关文档

- [CLOUDFLARE_PAGES_BURN_SOLUTION.md](./CLOUDFLARE_PAGES_BURN_SOLUTION.md) - 完整技术方案
- [PAGES_DEPLOYMENT_GUIDE.md](./PAGES_DEPLOYMENT_GUIDE.md) - 详细部署指南
- [CLOUDFLARE_DAILY_BURN_SOLUTION.md](./CLOUDFLARE_DAILY_BURN_SOLUTION.md) - 原始Worker方案

## 🎯 下一步

1. 完成Cloudflare Pages部署
2. 设置GitHub Actions定时任务
3. 配置Telegram通知
4. 测试完整燃烧流程
5. 监控系统运行状态

---

🔥 **现在你的Jinbao Protocol项目已经具备了完整的自动化代币燃烧功能！**