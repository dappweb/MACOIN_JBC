# 切换 Cloudflare 账户并部署

## 🔄 切换账户步骤

### 步骤 1: 退出当前账户

wrangler 没有直接的 `logout` 命令，可以通过以下方式清除认证：

**方法 A: 清除本地配置（推荐）**
```bash
# 清除 wrangler 认证信息
rm -rf ~/.wrangler/config

# 或者只清除认证 token
rm -rf ~/.wrangler/config/default.toml
```

**方法 B: 直接重新登录（会覆盖）**
```bash
# 直接运行登录，会覆盖当前登录
npx wrangler login
```

### 步骤 2: 使用新账户登录

```bash
# 运行登录命令
npx wrangler login
```

这会：
1. 打开浏览器
2. 提示你登录 Cloudflare
3. 授权 wrangler 访问你的账户
4. 保存新的认证信息

### 步骤 3: 验证新账户

```bash
# 检查当前登录的账户
npx wrangler whoami
```

确认显示的是新账户的信息。

### 步骤 4: 部署到新账户

```bash
# 部署到新账户的 Cloudflare Pages
npm run pages:deploy:prod
```

或者指定新的项目名称：

```bash
npm run build
npx wrangler pages deploy dist --project-name=your-new-project-name
```

## 📋 重要提示

### 1. 项目名称

如果新账户中还没有项目，wrangler 会自动创建。确保：
- 项目名称唯一
- 与 GitHub Actions 配置一致（如果需要）

### 2. Account ID

新账户的 Account ID 会不同，如果需要更新 GitHub Actions：
- 更新 GitHub Secrets 中的 `CLOUDFLARE_ACCOUNT_ID`
- 更新 `CLOUDFLARE_API_TOKEN`（如果需要）

### 3. 环境变量

部署后需要在新账户中设置环境变量：

```bash
npx wrangler pages secret put JBC_CONTRACT_ADDRESS \
  --text "0x..." \
  --project-name=your-project-name

# ... 其他环境变量
```

## 🔧 使用 API Token 方式（替代方案）

如果不想使用 `wrangler login`，可以使用 API Token：

```bash
# 设置环境变量
export CLOUDFLARE_API_TOKEN="new-account-api-token"
export CLOUDFLARE_ACCOUNT_ID="new-account-id"

# 直接部署（不需要登录）
npm run pages:deploy:prod
```

## ✅ 验证部署

部署成功后：
1. 检查部署状态：`npx wrangler pages deployment list --project-name=your-project-name`
2. 访问部署的 URL
3. 验证环境变量是否正确

---

**注意**: 切换账户后，旧账户的部署将不再更新。如果需要同时维护两个账户，建议使用不同的项目名称。
