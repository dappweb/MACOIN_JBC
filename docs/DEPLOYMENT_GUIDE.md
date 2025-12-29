# 生产环境部署指南

## 概述

本指南详细说明如何将 Jinbao Protocol 部署到生产环境。部署包括智能合约部署到 MC Chain 和前端应用部署到 Cloudflare Pages。

## 部署架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub Repo   │───▶│  GitHub Actions  │───▶│ Cloudflare Pages│
│     (prod)      │    │   (CI/CD Pipeline)│    │   (Production)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │    MC Chain      │
                       │ (Smart Contracts)│
                       └──────────────────┘
```

## 前置要求

### 1. 环境准备
- Node.js 18+
- npm 或 yarn
- Git
- Cloudflare 账户
- MC Chain 钱包 (用于合约部署)

### 2. 必要的 Secrets 配置

在 GitHub Repository Settings > Secrets and variables > Actions 中配置以下 secrets:

#### 智能合约相关
```bash
PROD_PRIVATE_KEY=0x...                    # 生产环境部署私钥
MC_RPC_URL=https://rpc.mcchain.io         # MC Chain RPC 地址
PROD_JBC_CONTRACT_ADDRESS=0x...           # JBC 代币合约地址
PROD_PROTOCOL_CONTRACT_ADDRESS=0x...      # 协议合约地址
```

#### Cloudflare 相关
```bash
CLOUDFLARE_API_TOKEN=...                  # Cloudflare API Token
CLOUDFLARE_ACCOUNT_ID=...                 # Cloudflare Account ID
PROD_FRONTEND_URL=https://your-domain.com # 生产环境前端地址
```

#### 通知相关 (可选)
```bash
TELEGRAM_BOT_TOKEN=...                    # Telegram 机器人 Token
TELEGRAM_CHAT_ID=...                      # Telegram 聊天 ID
```

## 部署方式

### 方式一: 自动部署 (推荐)

1. **推送到 prod 分支触发自动部署**
   ```bash
   git checkout prod
   git merge main  # 或其他分支
   git push origin prod
   ```

2. **手动触发部署**
   - 访问 GitHub Actions 页面
   - 选择 "Deploy to Production" workflow
   - 点击 "Run workflow"
   - 可选择 "强制部署" 跳过测试

### 方式二: 本地部署

1. **克隆仓库并切换到 prod 分支**
   ```bash
   git clone https://github.com/your-org/jinbao-protocol.git
   cd jinbao-protocol
   git checkout prod
   ```

2. **设置环境变量**
   ```bash
   export PROD_PRIVATE_KEY="0x..."
   export MC_RPC_URL="https://rpc.mcchain.io"
   export CLOUDFLARE_API_TOKEN="..."
   export CLOUDFLARE_ACCOUNT_ID="..."
   ```

3. **执行部署脚本**
   ```bash
   ./scripts/deploy-prod.sh
   ```

## 部署流程详解

### 1. 构建和测试阶段
- 安装依赖
- 编译智能合约
- 运行测试套件
- 构建前端应用

### 2. 智能合约部署
- 部署到 MC Chain 主网
- 验证合约部署
- 保存部署信息

### 3. 前端部署
- 部署到 Cloudflare Pages
- 配置环境变量
- 设置域名和 SSL

### 4. 部署后验证
- 健康检查
- API 端点测试
- 功能验证

## Cloudflare Pages 配置

### 1. 项目设置
- **项目名称**: `jinbao-protocol-prod`
- **构建命令**: `npm run build`
- **构建输出目录**: `dist`
- **Node.js 版本**: `18`

### 2. 环境变量配置
在 Cloudflare Pages 项目设置中配置:

```bash
# 公共变量
ENVIRONMENT=production
NODE_ENV=production
DAILY_BURN_AMOUNT=500
MAX_BURN_AMOUNT=5000

# 敏感变量 (使用 Encrypted)
JBC_CONTRACT_ADDRESS=0x...
PROTOCOL_CONTRACT_ADDRESS=0x...
PRIVATE_KEY=0x...
RPC_URL=https://rpc.mcchain.io
```

### 3. 自定义域名
1. 在 Cloudflare Pages 项目中添加自定义域名
2. 配置 DNS 记录
3. 启用 SSL/TLS

## 监控和维护

### 1. 日常燃烧监控
- GitHub Actions 每日自动执行燃烧任务
- Telegram 通知燃烧结果
- 可通过 API 查询燃烧状态

### 2. 健康检查端点
```bash
# 系统健康状态
GET /api/health

# 燃烧状态查询
GET /api/status

# 手动触发燃烧 (需要认证)
POST /api/burn
```

### 3. 日志和监控
- Cloudflare Analytics
- GitHub Actions 执行日志
- 智能合约事件监控

## 故障排除

### 常见问题

1. **合约部署失败**
   - 检查私钥和 RPC 地址
   - 确认钱包有足够的 MC 代币
   - 检查网络连接

2. **前端部署失败**
   - 检查 Cloudflare API Token 权限
   - 确认构建过程无错误
   - 检查环境变量配置

3. **燃烧任务失败**
   - 检查合约地址配置
   - 确认钱包有足够的 JBC 代币
   - 检查 RPC 连接状态

### 回滚策略

1. **智能合约回滚**
   ```bash
   # 使用之前的部署版本
   npm run deploy:mc -- --use-previous-version
   ```

2. **前端回滚**
   ```bash
   # 回滚到上一个部署
   wrangler pages deployment list --project-name="jinbao-protocol-prod"
   wrangler pages deployment activate <deployment-id> --project-name="jinbao-protocol-prod"
   ```

## 安全注意事项

1. **私钥管理**
   - 使用专用的部署钱包
   - 定期轮换私钥
   - 限制钱包权限

2. **环境隔离**
   - 生产和测试环境完全分离
   - 使用不同的合约地址
   - 独立的 Cloudflare 项目

3. **访问控制**
   - 限制 GitHub Actions 权限
   - 使用最小权限原则
   - 定期审查访问权限

## 联系支持

如果在部署过程中遇到问题，请:

1. 检查 GitHub Actions 日志
2. 查看 Cloudflare Pages 部署日志
3. 联系技术团队: support@jinbao.io

---

**最后更新**: 2024-12-29
**版本**: 1.0.0