# Cloudflare 优化实施指南

## 快速开始

### 1. 增强缓存策略（立即实施）

**文件**: `public/_headers`

已更新，包含：
- 静态资源长期缓存（1年）
- HTML 短期缓存（1小时）
- API 响应缓存（1分钟浏览器，5分钟边缘）

**部署**: 直接提交代码，Cloudflare Pages 会自动应用

### 2. RPC 代理实施

#### 选项 A: 使用 Cloudflare Pages Functions（推荐，简单）

**文件**: `functions/api/rpc-proxy.ts`

**配置环境变量**:
```bash
# 在 Cloudflare Dashboard 或使用 wrangler
wrangler pages secret put RPC_URLS --project-name=jbc-ac-production
# 值: ["https://rpc.mcchain.io", "https://chain.mcerscan.com/"]
```

**使用方式**:
```typescript
// 前端代码
const response = await fetch('/api/rpc-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_getBalance',
    params: [address, 'latest'],
    id: 1,
  }),
});
```

#### 选项 B: 使用 Cloudflare Workers（更强大，需要单独部署）

**文件**: `workers/rpc-proxy.ts`

**部署步骤**:
```bash
cd workers
wrangler deploy --config wrangler-rpc-proxy.toml
```

**配置 KV 命名空间**（用于缓存）:
```bash
wrangler kv:namespace create "RPC_CACHE"
# 将返回的 ID 添加到 wrangler-rpc-proxy.toml
```

### 3. 启用 Brotli 压缩

**在 Cloudflare Dashboard**:
1. 进入你的域名设置
2. 转到 "Speed" > "Optimization"
3. 启用 "Brotli" 压缩

**或通过 API**:
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/brotli" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"value":"on"}'
```

### 4. 配置 Cloudflare Images（可选）

**步骤**:
1. 在 Cloudflare Dashboard 启用 Images
2. 上传图片到 Cloudflare Images
3. 获取图片 URL
4. 更新前端代码使用新的图片 URL

**示例**:
```typescript
// 旧代码
<img src="/bg-3.png" />

// 新代码（使用 Cloudflare Images）
<img src="https://imagedelivery.net/{account_hash}/{image_id}/public" />
```

### 5. 启用 Web Analytics

**在 Cloudflare Dashboard**:
1. 进入 "Analytics" > "Web Analytics"
2. 点击 "Add a site"
3. 复制提供的脚本标签
4. 添加到 `index.html`

**或使用 Cloudflare Web Analytics（无需脚本）**:
1. 在 Dashboard 启用
2. 自动收集数据

## 环境变量配置

### Cloudflare Pages 环境变量

```bash
# RPC 端点列表（JSON 数组）
RPC_URLS='["https://rpc.mcchain.io", "https://chain.mcerscan.com/"]'

# 缓存 TTL（秒）
RPC_CACHE_TTL=60

# 其他环境变量...
```

**设置方式**:
```bash
# 使用 wrangler CLI
wrangler pages secret put RPC_URLS --project-name=jbc-ac-production

# 或在 Cloudflare Dashboard
# Settings > Environment Variables
```

## 性能监控

### 1. Cloudflare Web Analytics

- 实时访问统计
- 性能指标
- 地理位置分析

### 2. Core Web Vitals

在 Cloudflare Dashboard 查看：
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

### 3. 自定义监控

使用 Cloudflare Workers 添加自定义监控：
```typescript
// 记录性能指标
const perfData = {
  url: request.url,
  responseTime: Date.now() - startTime,
  cacheHit: cacheHit,
};

// 发送到分析服务
```

## 故障排查

### 缓存不生效

1. 检查 `_headers` 文件是否正确部署
2. 验证 Cloudflare 缓存设置
3. 清除 Cloudflare 缓存（Dashboard > Caching > Purge Cache）

### RPC 代理失败

1. 检查环境变量是否正确设置
2. 验证 RPC 端点是否可访问
3. 查看 Cloudflare Workers/Pages Functions 日志

### 图片加载慢

1. 检查是否启用了 Cloudflare Images
2. 验证图片 URL 是否正确
3. 检查图片格式和大小

## 最佳实践

1. **缓存策略**
   - 静态资源：长期缓存（1年）
   - HTML：短期缓存（1小时）
   - API：根据数据更新频率设置

2. **RPC 调用**
   - 使用代理统一管理
   - 实现智能缓存
   - 配置故障转移

3. **监控**
   - 定期检查性能指标
   - 监控错误率
   - 优化慢速请求

4. **安全**
   - 启用 WAF
   - 配置 Rate Limiting
   - 使用 HTTPS

## 相关文档

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare Images 文档](https://developers.cloudflare.com/images/)
- [性能优化文档](./PERFORMANCE_OPTIMIZATION.md)

