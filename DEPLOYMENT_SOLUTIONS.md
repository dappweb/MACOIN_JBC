# 🚀 Jinbao Protocol 部署解决方案

## 问题诊断

✅ **已解决的问题:**
- 修复了 `MiningPanel.tsx` 语法错误
- 移除了 `.env.production` 中的 `NODE_ENV=production`
- 项目构建成功

⚠️ **当前问题:**
- Cloudflare 登录超时
- 需要完成身份验证

## 🎯 解决方案

### 方案 1: 重新尝试 Cloudflare 登录

```bash
# 清理之前的登录状态
npx wrangler logout

# 重新登录 (确保网络稳定)
npx wrangler login

# 如果浏览器没有自动打开，手动访问显示的 URL
```

### 方案 2: 使用 API Token 登录

1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 创建自定义 Token，权限包括:
   - `Cloudflare Pages:Edit`
   - `Account:Read`
   - `Zone:Read`

3. 设置环境变量:
```bash
export CLOUDFLARE_API_TOKEN="your-api-token-here"
```

4. 验证登录:
```bash
npx wrangler whoami
```

### 方案 3: 通过 Cloudflare Dashboard 手动部署

1. **访问 Cloudflare Dashboard**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - 进入 "Pages" 部分

2. **创建新项目**
   - 点击 "Create a project"
   - 选择 "Upload assets"
   - 项目名称: `jinbao-protocol-prod`

3. **上传构建文件**
   ```bash
   # 确保项目已构建
   npm run build
   
   # 压缩 dist 目录
   cd dist
   zip -r ../jinbao-protocol-dist.zip .
   cd ..
   ```
   
4. **上传 ZIP 文件**
   - 在 Cloudflare Pages 中上传 `jinbao-protocol-dist.zip`
   - 等待部署完成

5. **配置 Functions**
   - 在项目设置中，确保 Functions 已启用
   - 兼容性日期设置为 `2024-01-01`

### 方案 4: 使用 GitHub 集成 (推荐)

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "Fix deployment issues"
   git push origin main
   ```

2. **连接 GitHub 到 Cloudflare Pages**
   - 在 Cloudflare Dashboard 中选择 "Connect to Git"
   - 选择你的 GitHub 仓库
   - 配置构建设置:
     - 构建命令: `npm run build`
     - 构建输出目录: `dist`
     - Node.js 版本: `18`

3. **自动部署**
   - 每次推送到 main 分支都会自动部署
   - 支持预览部署和生产部署

## 🔧 环境变量配置

无论使用哪种部署方式，都需要配置以下环境变量：

### 在 Cloudflare Dashboard 中设置

1. 进入项目 → Settings → Environment variables

2. **生产环境变量:**
   ```
   ENVIRONMENT = production
   NODE_ENV = production
   DAILY_BURN_AMOUNT = 500
   MAX_BURN_AMOUNT = 5000
   BURN_PERCENTAGE = 0.1
   MIN_BALANCE_THRESHOLD = 1000
   ```

3. **敏感信息 (Secrets):**
   ```
   JBC_CONTRACT_ADDRESS = 0x...
   PROTOCOL_CONTRACT_ADDRESS = 0x...
   PRIVATE_KEY = 0x...
   RPC_URL = https://rpc.mcchain.io
   TELEGRAM_BOT_TOKEN = (可选)
   TELEGRAM_CHAT_ID = (可选)
   ```

## 🧪 部署验证

部署完成后，验证以下端点：

```bash
# 健康检查
curl https://your-project.pages.dev/api/health

# 状态查询
curl https://your-project.pages.dev/api/status

# 主页访问
curl https://your-project.pages.dev
```

## 🔍 故障排除

### 常见错误及解决方案

1. **Functions 运行时错误**
   - 检查环境变量是否正确设置
   - 确认合约地址有效
   - 验证私钥格式正确

2. **构建失败**
   - 清理 node_modules: `rm -rf node_modules && npm install`
   - 检查 TypeScript 错误: `npx tsc --noEmit`

3. **API 调用失败**
   - 检查 CORS 设置
   - 验证 Functions 路由配置
   - 查看 Cloudflare 日志

## 📞 获取帮助

如果遇到问题，可以：

1. **查看 Cloudflare 日志**
   ```bash
   npx wrangler pages deployment tail --project-name=your-project
   ```

2. **检查构建日志**
   - 在 Cloudflare Dashboard 中查看部署历史
   - 查看详细的构建和部署日志

3. **本地测试**
   ```bash
   npm run pages:dev
   # 访问 http://localhost:8788
   ```

## 🎉 成功部署后

部署成功后，你将拥有：
- 🌐 全球 CDN 加速的 Web 应用
- 🔥 自动代币燃烧 API
- 📊 实时状态监控
- 🔒 安全的环境变量管理
- ⚡ 无服务器架构

**下一步:** 设置自动化燃烧计划任务和监控系统。

---

选择最适合你的部署方案，我可以协助完成任何步骤！