# Cloudflare Pages 部署配置

## 🌍 环境映射

### 📋 分支与环境对应关系

| 分支 | 环境 | 项目名称 | 访问地址 | 用途 |
|------|------|----------|----------|------|
| `p-prod` | Production | `jinbao-protocol-prod` | https://jinbao-protocol-prod.pages.dev | 🏭 生产环境 |
| `test` | Preview | `jinbao-protocol-preview` | https://jinbao-protocol-preview.pages.dev | 🔍 预览环境 |

## 🚀 自动部署配置

### 🏭 生产环境部署 (p-prod → production)

**触发条件:**
- 推送到 `p-prod` 分支
- 手动触发 (workflow_dispatch)

**工作流文件:** `.github/workflows/deploy-production.yml`

**部署流程:**
1. 📦 安装依赖
2. 🔨 构建前端
3. 🧪 运行测试
4. 🚀 部署到 `jinbao-protocol-prod`
5. 🔧 配置生产环境变量
6. 🔍 健康检查
7. 📢 通知结果

**环境变量:**
```bash
ENVIRONMENT=production
NODE_ENV=production
DAILY_BURN_AMOUNT=500
MAX_BURN_AMOUNT=5000
BURN_PERCENTAGE=0.1
MIN_BALANCE_THRESHOLD=1000
```

### 🔍 预览环境部署 (test → preview)

**触发条件:**
- 推送到 `test` 分支
- 手动触发 (workflow_dispatch)

**工作流文件:** `.github/workflows/deploy-preview.yml`

**部署流程:**
1. 📦 安装依赖
2. 🔨 构建前端
3. 🧪 运行测试
4. 🚀 部署到 `jinbao-protocol-preview`
5. 🔧 配置预览环境变量
6. 🔍 健康检查
7. 📢 通知结果

**环境变量:**
```bash
ENVIRONMENT=preview
NODE_ENV=development
DAILY_BURN_AMOUNT=10
MAX_BURN_AMOUNT=100
BURN_PERCENTAGE=0.01
MIN_BALANCE_THRESHOLD=50
```

## 🔧 手动部署命令

### 🏭 部署到生产环境
```bash
# 从 p-prod 分支部署
git checkout p-prod
npm run build
npx wrangler pages deploy dist --project-name=jinbao-protocol-prod
```

### 🔍 部署到预览环境
```bash
# 从 test 分支部署
git checkout test
npm run build
npx wrangler pages deploy dist --project-name=jinbao-protocol-preview
```

## 📊 环境变量管理

### 🔐 Secrets 配置

**生产环境 Secrets:**
- `PROD_JBC_CONTRACT_ADDRESS` - 生产环境 JBC 合约地址
- `PROD_PROTOCOL_CONTRACT_ADDRESS` - 生产环境协议合约地址
- `PROD_PRIVATE_KEY` - 生产环境私钥
- `MC_RPC_URL` - MC Chain RPC URL

**预览环境 Secrets:**
- `TEST_JBC_CONTRACT_ADDRESS` - 测试环境 JBC 合约地址
- `TEST_PROTOCOL_CONTRACT_ADDRESS` - 测试环境协议合约地址
- `TEST_PRIVATE_KEY` - 测试环境私钥
- `SEPOLIA_RPC_URL` - Sepolia 测试网 RPC URL

**通用 Secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare Account ID
- `TELEGRAM_BOT_TOKEN` - Telegram 通知 Bot Token (可选)
- `TELEGRAM_CHAT_ID` - Telegram 通知 Chat ID (可选)

### 🔧 环境变量设置命令

**生产环境:**
```bash
wrangler pages secret put JBC_CONTRACT_ADDRESS --project-name=jinbao-protocol-prod
wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS --project-name=jinbao-protocol-prod
wrangler pages secret put PRIVATE_KEY --project-name=jinbao-protocol-prod
wrangler pages secret put RPC_URL --project-name=jinbao-protocol-prod
```

**预览环境:**
```bash
wrangler pages secret put JBC_CONTRACT_ADDRESS --project-name=jinbao-protocol-preview
wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS --project-name=jinbao-protocol-preview
wrangler pages secret put PRIVATE_KEY --project-name=jinbao-protocol-preview
wrangler pages secret put RPC_URL --project-name=jinbao-protocol-preview
```

## 🔍 监控和验证

### 📊 部署状态检查

**生产环境:**
- 🌐 URL: https://jinbao-protocol-prod.pages.dev
- 🔧 API: https://jinbao-protocol-prod.pages.dev/api/health
- 📊 状态: GitHub Actions 自动检查

**预览环境:**
- 🌐 URL: https://jinbao-protocol-preview.pages.dev
- 🔧 API: https://jinbao-protocol-preview.pages.dev/api/health
- 📊 状态: GitHub Actions 自动检查

### 🚨 故障排除

**常见问题:**
1. **部署失败** - 检查 GitHub Actions 日志
2. **环境变量缺失** - 验证 Secrets 配置
3. **合约地址错误** - 确认网络和合约地址匹配
4. **RPC 连接问题** - 验证 RPC URL 可访问性

**调试命令:**
```bash
# 检查项目状态
wrangler pages project list

# 查看环境变量
wrangler pages secret list --project-name=jinbao-protocol-prod
wrangler pages secret list --project-name=jinbao-protocol-preview

# 查看部署历史
wrangler pages deployment list --project-name=jinbao-protocol-prod
```

## 📝 部署最佳实践

1. **🔄 分支管理**
   - `p-prod` 分支用于生产环境
   - `test` 分支用于预览环境
   - 先在 `test` 分支测试，再合并到 `p-prod`

2. **🧪 测试流程**
   - 每次部署前自动运行测试
   - 可以使用 `force_deploy` 跳过测试（紧急情况）

3. **🔐 安全考虑**
   - 生产和预览环境使用不同的私钥
   - 定期轮换 API Token
   - 监控部署日志

4. **📊 监控**
   - 设置 Telegram 通知获取部署状态
   - 定期检查应用健康状态
   - 监控合约交互是否正常

## 🎯 当前状态

- ✅ **生产环境配置完成** - p-prod 分支 → jinbao-protocol-prod
- ✅ **预览环境配置完成** - test 分支 → jinbao-protocol-preview
- ✅ **自动部署流程就绪** - GitHub Actions 配置完成
- ✅ **环境变量分离** - 生产和预览环境独立配置