# 部署到 jbc-pages 项目指南

## 问题说明

当前登录的 Cloudflare 账户与 `jbc-pages` 项目所在的账户不匹配：

- **当前账户**: `137655747@qq.com` (Account ID: `acb6471710adbd7e73a05cc665a6fb94`)
- **目标账户**: `suiyiwan1@outlook.com` (Account ID: `91682bb238aa911811c831ff0e29b5a5`)

## 解决方案

### 方法 1: 使用 API Token（推荐）

如果你有 `suiyiwan1@outlook.com` 账户的 API Token：

1. **获取 API Token**:
   - 登录 Cloudflare Dashboard: https://dash.cloudflare.com/profile/api-tokens
   - 创建新的 API Token，权限需要：
     - Account → Cloudflare Pages → Edit
     - Account Settings → Read

2. **设置环境变量并部署**:
   ```bash
   export CLOUDFLARE_API_TOKEN='your-api-token-here'
   export CLOUDFLARE_ACCOUNT_ID='91682bb238aa911811c831ff0e29b5a5'
   
   # 运行部署脚本
   ./scripts/deploy-to-jbc-pages.sh
   ```

   或者直接使用 wrangler 命令：
   ```bash
   CLOUDFLARE_API_TOKEN='your-api-token' \
   CLOUDFLARE_ACCOUNT_ID='91682bb238aa911811c831ff0e29b5a5' \
   npx wrangler pages deploy dist --project-name=jbc-pages
   ```

### 方法 2: 重新登录正确的账户

1. **退出当前账户**:
   ```bash
   npx wrangler logout
   ```

2. **登录正确的账户**:
   ```bash
   npx wrangler login
   ```
   - 使用邮箱: `suiyiwan1@outlook.com`
   - 按照提示完成登录

3. **验证登录**:
   ```bash
   npx wrangler whoami
   ```
   应该显示：
   - Email: `suiyiwan1@outlook.com`
   - Account ID: `91682bb238aa911811c831ff0e29b5a5`

4. **部署**:
   ```bash
   # 确保已构建
   npm run build
   
   # 部署
   npx wrangler pages deploy dist --project-name=jbc-pages
   ```

## 快速部署命令

如果已经登录了正确的账户，可以直接运行：

```bash
# 构建并部署
npm run build && npx wrangler pages deploy dist --project-name=jbc-pages
```

或者使用部署脚本：

```bash
./scripts/deploy-to-jbc-pages.sh
```

## 验证部署

部署成功后，可以：

1. **查看部署列表**:
   ```bash
   npx wrangler pages deployment list --project-name=jbc-pages
   ```

2. **访问部署的网站**:
   - 项目 URL: https://jbc-pages.pages.dev
   - 具体部署 URL 会在部署输出中显示

3. **检查项目信息**:
   ```bash
   npx wrangler pages project list
   ```

## 设置环境变量（如需要）

如果需要在 Cloudflare Pages 中设置环境变量：

```bash
# 设置环境变量
npx wrangler pages secret put JBC_CONTRACT_ADDRESS \
  --text "0x..." \
  --project-name=jbc-pages

npx wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS \
  --text "0x..." \
  --project-name=jbc-pages

# 查看所有环境变量
npx wrangler pages secret list --project-name=jbc-pages
```

## 注意事项

1. **账户权限**: 确保使用的账户有权限访问 `jbc-pages` 项目
2. **构建产物**: 确保 `dist/` 目录存在且包含最新的构建产物
3. **网络连接**: 确保网络连接正常，能够访问 Cloudflare API

## 故障排除

如果遇到问题：

1. **认证错误**: 检查账户是否正确，或使用 API Token
2. **项目不存在**: 如果项目不存在，wrangler 会自动创建
3. **部署失败**: 查看详细错误信息，检查网络连接和权限
