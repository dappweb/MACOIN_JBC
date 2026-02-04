# 使用 API Token 部署到 Cloudflare Pages

## 📋 步骤

### 1. 获取 Cloudflare API Token

1. 访问：https://dash.cloudflare.com/profile/api-tokens
2. 点击 **"Create Token"**
3. 使用 **"Edit Cloudflare Workers"** 模板，或自定义：
   - **Token name**: `jbc-pages-deploy`
   - **Permissions**:
     - **Account** → **Cloudflare Pages** → **Edit**
     - **Zone** → **Zone Settings** → **Read** (如果需要)
   - **Account Resources**:
     - 选择: **suiyiwan1@outlook.com's Account**
   - **Zone Resources**: 留空或选择特定域名
4. 点击 **"Continue to summary"** → **"Create Token"**
5. **复制生成的 Token**（只显示一次，请保存好）

### 2. 设置环境变量

在终端运行：

```bash
export CLOUDFLARE_API_TOKEN='your-api-token-here'
export CLOUDFLARE_ACCOUNT_ID='91682bb238aa911811c831ff0e29b5a5'
```

### 3. 部署

运行部署脚本：

```bash
bash scripts/deploy-with-token.sh
```

或者直接运行：

```bash
CLOUDFLARE_API_TOKEN='your-token' \
CLOUDFLARE_ACCOUNT_ID='91682bb238aa911811c831ff0e29b5a5' \
npx wrangler pages deploy dist --project-name=jbc-pages
```

## 🔐 安全提示

- API Token 具有账户访问权限，请妥善保管
- 不要将 Token 提交到 Git 仓库
- 建议使用环境变量文件（`.env`）存储，并添加到 `.gitignore`

## ✅ 验证部署

部署成功后，访问：
- 最新部署: https://jbc-pages.pages.dev
- 查看部署列表: `npx wrangler pages deployment list --project-name=jbc-pages`
