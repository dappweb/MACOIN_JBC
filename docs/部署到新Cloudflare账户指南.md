# 部署到新 Cloudflare 账户指南

## 📋 前置准备

在开始之前，请确保你有：
1. 新的 Cloudflare 账户
2. Cloudflare API Token（具有 Pages 和 Account 权限）
3. Cloudflare Account ID
4. GitHub 仓库的访问权限（用于设置 Secrets）

## 🔑 步骤 1: 获取 Cloudflare 凭证

### 1.1 获取 Account ID

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 在右侧边栏找到 **Account ID**
3. 复制 Account ID（格式类似：`1234567890abcdef1234567890abcdef`）

### 1.2 创建 API Token

1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 **Create Token**
3. 选择 **Edit Cloudflare Workers** 模板，或自定义权限：
   - **Account** → **Cloudflare Pages** → **Edit**
   - **Account** → **Account Settings** → **Read**
4. 设置 Account Resources：
   - 选择你的账户
5. 点击 **Continue to summary** → **Create Token**
6. **重要**: 立即复制 Token（只显示一次）

## 🔐 步骤 2: 配置 GitHub Secrets

在 GitHub 仓库中设置以下 Secrets：

### 2.1 访问 GitHub Secrets

1. 进入仓库：`https://github.com/dappweb/MACOIN_JBC`
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**

### 2.2 添加必需的 Secrets

添加以下 Secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | `your-api-token-here` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | `1234567890abcdef...` |

### 2.3 添加生产环境 Secrets（如果需要）

| Secret 名称 | 说明 |
|------------|------|
| `PROD_JBC_CONTRACT_ADDRESS` | 生产环境 JBC 合约地址 |
| `PROD_PROTOCOL_CONTRACT_ADDRESS` | 生产环境协议合约地址 |
| `PROD_PRIVATE_KEY` | 生产环境私钥（用于自动化操作） |
| `MC_RPC_URL` | MC 链 RPC 节点地址 |

## 🚀 步骤 3: 在 Cloudflare 中创建 Pages 项目

### 3.1 创建新项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **Pages**
3. 点击 **Create a project**
4. 选择 **Connect to Git**
5. 授权 GitHub 并选择仓库：`dappweb/MACOIN_JBC`
6. 选择分支：`p-prod`

### 3.2 配置构建设置

**项目名称**: `jbc-ac-production`（或你自定义的名称）

**构建设置**:
- **Framework preset**: `None` 或 `React`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/`（项目根目录）

**环境变量**（在项目设置中配置）:
- `NODE_VERSION`: `18`
- 其他环境变量会在部署时通过 `wrangler pages secret` 设置

### 3.3 自定义域名（可选）

1. 在项目设置中点击 **Custom domains**
2. 添加你的域名（例如：`jbc.ac`）
3. 按照提示配置 DNS 记录

## 📝 步骤 4: 更新部署配置（如果需要）

如果项目名称或域名不同，需要更新以下文件：

### 4.1 更新 `.github/workflows/deploy-production.yml`

```yaml
env:
  PRODUCTION_PROJECT: 'your-project-name'  # 更新为你的项目名称
  PRODUCTION_DOMAIN: 'your-domain.com'     # 更新为你的域名
```

### 4.2 更新 `package.json`（可选）

```json
{
  "scripts": {
    "pages:deploy:prod": "npm run build && wrangler pages deploy dist --project-name=your-project-name"
  }
}
```

## ✅ 步骤 5: 验证部署

### 5.1 触发部署

推送到 `p-prod` 分支会自动触发部署，或手动触发：

1. 进入 GitHub Actions: `https://github.com/dappweb/MACOIN_JBC/actions`
2. 选择 **Deploy P-Prod Branch to Production**
3. 点击 **Run workflow**
4. 选择分支 `p-prod`
5. 点击 **Run workflow**

### 5.2 检查部署状态

1. 查看 GitHub Actions 日志
2. 检查 Cloudflare Pages 部署状态
3. 访问部署的 URL 验证

### 5.3 验证环境变量

部署完成后，验证环境变量是否正确设置：

```bash
# 使用 wrangler CLI 查看 secrets
wrangler pages secret list --project-name=your-project-name
```

## 🔧 步骤 6: 配置环境变量（通过 wrangler）

部署脚本会自动配置环境变量，但也可以手动设置：

```bash
# 登录 Cloudflare
wrangler login

# 设置环境变量
wrangler pages secret put JBC_CONTRACT_ADDRESS \
  --text "0x..." \
  --project-name=your-project-name

wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS \
  --text "0x..." \
  --project-name=your-project-name

# ... 其他环境变量
```

## 📊 部署后检查清单

- [ ] GitHub Secrets 已正确配置
- [ ] Cloudflare Pages 项目已创建
- [ ] 构建配置正确
- [ ] 环境变量已设置
- [ ] 部署成功完成
- [ ] 网站可以正常访问
- [ ] 自定义域名已配置（如果使用）

## 🆘 常见问题

### Q: 部署失败，提示 "Authentication failed"
**A**: 检查 `CLOUDFLARE_API_TOKEN` 是否正确，是否有足够的权限

### Q: 找不到项目
**A**: 确保项目名称与 GitHub Actions 中的 `PRODUCTION_PROJECT` 一致

### Q: 环境变量未生效
**A**: 确保使用 `wrangler pages secret put` 设置，而不是在 Cloudflare Dashboard 中设置（Pages 项目不支持 Dashboard 中的环境变量）

### Q: 如何切换到新的 Cloudflare 账户？
**A**: 只需更新 GitHub Secrets 中的 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 即可

## 📚 相关文档

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)

---

**注意**: 部署到新账户后，旧的部署将不再更新。如果需要同时维护多个账户的部署，可以创建不同的 GitHub Actions 工作流。
