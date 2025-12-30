# Cloudflare Pages 部署指南

## 🚀 快速部署步骤

### 1. 登录 Cloudflare
```bash
wrangler login
```
这会打开浏览器，请完成 Cloudflare 账户登录。

### 2. 构建项目
```bash
npm run build
```

### 3. 部署到 Cloudflare Pages
```bash
# 部署到生产环境
npm run pages:deploy:prod

# 或者使用 wrangler 直接部署
wrangler pages deploy dist --project-name=jinbao-protocol-prod
```

## 🔧 环境变量配置

### 必需的 Secrets (敏感信息)
在 Cloudflare Dashboard 中设置以下 secrets：

```bash
# 设置生产环境 secrets
wrangler pages secret put JBC_CONTRACT_ADDRESS --project-name=jinbao-protocol-prod
wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS --project-name=jinbao-protocol-prod  
wrangler pages secret put PRIVATE_KEY --project-name=jinbao-protocol-prod
wrangler pages secret put RPC_URL --project-name=jinbao-protocol-prod
wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name=jinbao-protocol-prod
wrangler pages secret put TELEGRAM_CHAT_ID --project-name=jinbao-protocol-prod
```

### 环境变量 (已在 wrangler.toml 中配置)
- `ENVIRONMENT=production`
- `NODE_ENV=production`
- `DAILY_BURN_AMOUNT=500`
- `MAX_BURN_AMOUNT=5000`
- `BURN_PERCENTAGE=0.1`
- `MIN_BALANCE_THRESHOLD=1000`

## 📋 部署前检查清单

### ✅ 已完成的修复
- [x] 修复了 `MiningPanel.tsx` 中的语法错误
- [x] 移除了 `.env.production` 中的 `NODE_ENV=production` 设置
- [x] 项目构建成功 (`npm run build`)
- [x] Cloudflare Functions 配置正确
- [x] wrangler.toml 配置完整

### 🔍 需要确认的配置
- [ ] Cloudflare 账户登录完成
- [ ] 合约地址已部署并获取
- [ ] 私钥和 RPC URL 准备就绪
- [ ] Telegram Bot 配置 (可选)

## 🛠️ 故障排除

### 常见问题

#### 1. 构建失败
```bash
# 清理缓存重新构建
rm -rf node_modules/.vite
npm run build
```

#### 2. 部署权限问题
```bash
# 重新登录 Cloudflare
wrangler logout
wrangler login
```

#### 3. 环境变量未生效
- 检查 wrangler.toml 配置
- 确认 secrets 已正确设置
- 验证项目名称匹配

#### 4. Functions 运行错误
```bash
# 本地测试 Functions
npm run pages:dev
curl -X POST http://localhost:8788/api/burn
```

## 🔄 自动化部署

### GitHub Actions (推荐)
项目已配置 GitHub Actions，推送到 `main` 分支会自动部署。

### 手动部署命令
```bash
# 完整部署流程
npm run build
npm run pages:deploy:prod

# 检查部署状态
wrangler pages deployment list --project-name=jinbao-protocol-prod
```

## 📊 部署后验证

### 1. 检查网站访问
访问: `https://jinbao-protocol-prod.pages.dev`

### 2. 测试 API 端点
```bash
# 健康检查
curl https://jinbao-protocol-prod.pages.dev/api/health

# 状态查询
curl https://jinbao-protocol-prod.pages.dev/api/status

# 燃烧测试 (需要正确的 secrets)
curl -X POST https://jinbao-protocol-prod.pages.dev/api/burn
```

### 3. 检查 Functions 日志
```bash
wrangler pages deployment tail --project-name=jinbao-protocol-prod
```

## 🎯 下一步

1. **完成 Cloudflare 登录**
2. **设置必需的 secrets**
3. **执行部署命令**
4. **验证部署结果**

部署成功后，你的 Jinbao Protocol 将在 Cloudflare Pages 上运行，具备：
- 🌐 全球 CDN 加速
- 🔥 自动代币燃烧 API
- 📊 实时状态监控
- 🔒 安全的环境变量管理
- ⚡ 无服务器 Functions

需要帮助完成任何步骤吗？