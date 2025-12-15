# Cloudflare D1 数据库配置指南

本指南将帮助您配置 Cloudflare D1 数据库和 Worker，以启用多语言公告功能。

## 前置要求

1.  拥有一个 Cloudflare 账号。
2.  安装 [Node.js](https://nodejs.org/)。
3.  安装 Wrangler CLI (Cloudflare 的命令行工具)：
    ```bash
    npm install -g wrangler
    ```

## 步骤 1: 登录 Cloudflare

在终端中运行以下命令并按提示登录：

```bash
wrangler login
```

## 步骤 2: 创建 D1 数据库

在项目根目录下运行以下命令来创建一个名为 `macoin-jbc-db` 的数据库：

```bash
wrangler d1 create macoin-jbc-db
```

命令执行成功后，您会看到类似以下的输出：

```json
{
  "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "database_name": "macoin-jbc-db",
  "binding": "DB"
}
```

**请复制并保存这段信息，后续配置需要用到。**

## 步骤 3: 配置 `wrangler.toml`

在 `workers` 目录下创建一个名为 `wrangler.toml` 的文件，并填入以下内容（**请将 `database_id` 替换为您上一步获取的真实 ID**）：

```toml
name = "macoin-jbc-api"
main = "index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB" # 必须与代码中的 env.DB 保持一致
database_name = "macoin-jbc-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" # 替换为您的真实 ID

[vars]
# 替换为您的管理员钱包地址（必须小写）
ADMIN_ADDRESS = "0xYourAdminWalletAddressHere" 
```

## 步骤 4: 初始化数据库表结构

运行以下命令将 `schema.sql` 中的表结构应用到 D1 数据库：

**本地测试环境：**
```bash
wrangler d1 execute macoin-jbc-db --local --file=workers/schema.sql
```

**生产环境（部署）：**
```bash
wrangler d1 execute macoin-jbc-db --remote --file=workers/schema.sql
```

## 步骤 5: 本地测试 Worker

进入 `workers` 目录并启动本地开发服务器：

```bash
cd workers
wrangler dev
```

Worker 启动后，通常运行在 `http://localhost:8787`。您可以尝试访问 `http://localhost:8787/announcement` 来测试。

## 步骤 6: 部署到 Cloudflare

确认无误后，将 Worker 部署到 Cloudflare 全球网络：

```bash
cd workers
wrangler deploy
```

部署成功后，您会获得一个类似 `https://macoin-jbc-api.您的子域名.workers.dev` 的 URL。

## 步骤 7: 更新前端配置

打开项目中的 `c:\Users\Administrator\Documents\GitHub\MACOIN_JBC\constants.ts` 文件，将 `API_BASE_URL` 替换为您刚刚获得的 Worker URL：

```typescript
// Cloudflare Worker API URL
export const API_BASE_URL = "https://macoin-jbc-api.您的子域名.workers.dev";
```

## 步骤 8: 重新部署前端

提交代码并重新构建/部署您的前端项目（例如部署到 Vercel 或 GitHub Pages）。

---

## 常见问题

*   **管理员权限验证失败？**
    请确保 `wrangler.toml` 中的 `ADMIN_ADDRESS` 变量已设置为您在前端连接钱包时使用的同一个地址（注意大小写，建议全部小写）。

*   **跨域错误 (CORS)？**
    Worker 代码中已经配置了 `Access-Control-Allow-Origin: *`，通常可以直接使用。如果遇到问题，请检查请求头是否包含特殊字段。
