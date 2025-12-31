# JBC.AC Cloudflare Pages 部署配置

## 🌍 环境映射

### 📋 分支与环境对应关系

| 分支 | 环境 | 项目名称 | 访问地址 | 用途 |
|------|------|----------|----------|------|
| `p-prod` | Production | `jbc-ac-production` | https://jbc.ac | 🏭 生产环境 |
| `test` | Preview | `jbc-ac-preview` | https://jbc-ac-preview.pages.dev | 🔍 预览环境 |

## 🚀 部署状态

### ✅ 已完成配置

1. **Cloudflare Pages 项目创建**
   - ✅ `jbc-ac-production` - 生产环境项目 (p-prod 分支)
   - ✅ `jbc-ac-preview` - 预览环境项目 (test 分支)

2. **配置文件更新**
   - ✅ `wrangler.toml` - 更新项目配置
   - ✅ `.github/workflows/deploy-production.yml` - 生产环境工作流
   - ✅ `.github/workflows/deploy-preview.yml` - 预览环境工作流

3. **分支部署完成**
   - ✅ 生产环境 (p-prod): https://25cf6d14.jbc-ac-production.pages.dev
   - ✅ 预览环境 (test): https://723e9ccb.jbc-ac-preview.pages.dev

## 🔧 域名配置

### 🌐 自定义域名设置

**生产环境域名配置 (jbc.ac):**

1. **在 Cloudflare Pages 控制台中配置:**
   ```
   项目: jbc-ac-production
   自定义域名: jbc.ac
   ```

2. **DNS 记录配置:**
   ```
   类型: CNAME
   名称: @
   目标: jbc-ac-production.pages.dev
   ```

3. **SSL/TLS 设置:**
   - 启用 "Always Use HTTPS"
   - 设置 SSL/TLS 加密模式为 "Full (strict)"

## 🔐 环境变量配置

### 🏭 生产环境 Secrets

需要在 GitHub Secrets 中配置以下变量：

```bash
# Cloudflare 配置
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# 生产环境合约地址
PROD_JBC_CONTRACT_ADDRESS=0x1Bf9ACe2485BC3391150762a109886d0B85f40Da
PROD_PROTOCOL_CONTRACT_ADDRESS=0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5
PROD_PRIVATE_KEY=your_production_private_key

# 网络配置
MC_RPC_URL=https://mc-rpc.com

# 通知配置 (可选)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 🔍 预览环境 Secrets

```bash
# 预览环境合约地址 (可以使用测试网络)
TEST_JBC_CONTRACT_ADDRESS=test_jbc_address
TEST_PROTOCOL_CONTRACT_ADDRESS=test_protocol_address
TEST_PRIVATE_KEY=your_test_private_key

# 测试网络配置
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_key
```

## 🚀 自动部署流程

### 🏭 生产环境部署 (p-prod → jbc.ac)

**触发条件:**
- 推送到 `p-prod` 分支
- 手动触发 (workflow_dispatch)

**部署流程:**
1. 📦 安装依赖
2. 🔨 构建前端
3. 🧪 运行测试
4. 🚀 部署到 `jbc-ac-production`
5. 🔧 配置生产环境变量
6. 🔍 健康检查 (jbc.ac)
7. 📢 通知结果

### 🔍 预览环境部署 (test → preview)

**触发条件:**
- 推送到 `test` 分支
- 手动触发 (workflow_dispatch)

**部署流程:**
1. 📦 安装依赖
2. 🔨 构建前端
3. 🧪 运行测试
4. 🚀 部署到 `jbc-ac-preview`
5. 🔧 配置预览环境变量
6. 🔍 健康检查
7. 📢 通知结果

## 🔧 手动部署命令

### 🏭 部署到生产环境
```bash
# 构建应用
npm run build

# 部署到生产环境
npx wrangler pages deploy dist --project-name=jbc-ac-production
```

### 🔍 部署到预览环境
```bash
# 构建应用
npm run build

# 部署到预览环境
npx wrangler pages deploy dist --project-name=jbc-ac-preview
```

## 📊 监控和验证

### 📊 部署状态检查

**生产环境:**
- 🌐 主域名: https://jbc.ac
- 📦 备用URL: https://jbc-ac-production.pages.dev
- 🔧 API: https://jbc.ac/api/health

**预览环境:**
- 🌐 URL: https://jbc-ac-preview.pages.dev
- 🔧 API: https://jbc-ac-preview.pages.dev/api/health

### 🔧 管理命令

```bash
# 查看项目列表
npx wrangler pages project list

# 查看部署历史
npx wrangler pages deployment list --project-name=jbc-ac-production
npx wrangler pages deployment list --project-name=jbc-ac-preview

# 管理环境变量
npx wrangler pages secret list --project-name=jbc-ac-production
npx wrangler pages secret put VARIABLE_NAME --project-name=jbc-ac-production
```

## 🎯 下一步操作

### 🔧 域名配置

1. **配置 jbc.ac 域名:**
   - 在 Cloudflare Pages 控制台添加自定义域名
   - 配置 DNS 记录指向 jbc-ac-production.pages.dev
   - 启用 SSL/TLS 加密

2. **验证域名配置:**
   - 确认 https://jbc.ac 可以正常访问
   - 检查 SSL 证书是否正确配置
   - 测试所有功能是否正常工作

### 🔐 安全配置

1. **配置生产环境 Secrets:**
   - 在 GitHub 仓库设置中添加所有必需的 Secrets
   - 确保生产环境使用正确的合约地址
   - 验证 RPC 连接配置

2. **测试自动部署:**
   - 推送代码到 p-prod 分支测试生产部署
   - 推送代码到 test 分支测试预览部署
   - 验证 GitHub Actions 工作流正常运行

## 🎉 总结

**JBC.AC Cloudflare Pages 部署配置已完成：**

✅ **项目创建完成** - jbc-ac-production & jbc-ac-preview
✅ **工作流配置完成** - 自动部署到对应环境
✅ **初始部署成功** - 两个环境都已部署
✅ **配置文件更新** - wrangler.toml 和 GitHub Actions

**当前状态:**
- 🏭 生产环境 (p-prod): https://jbc-ac-production.pages.dev (待配置 jbc.ac 域名)
- 🔍 预览环境 (test): https://jbc-ac-preview.pages.dev

**待完成:**
- 🌐 配置 jbc.ac 自定义域名
- 🔐 设置 GitHub Secrets
- 🧪 测试自动部署流程