// Cloudflare Pages 简化中间件

export interface Env {
  // 环境变量接口
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // 基本安全头设置
  const response = await next();
  const newHeaders = new Headers(response.headers);
  
  // 设置基本安全头
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  newHeaders.set('X-XSS-Protection', '1; mode=block');
  
  // 静态资源缓存 - 更长的缓存时间
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff|woff2)$/i)) {
    // 带 hash 的文件可以永久缓存（Vite 已添加 hash）
    if (url.pathname.match(/[a-f0-9]{8,}\.(js|css)$/i)) {
      newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1年
    } else {
      newHeaders.set('Cache-Control', 'public, max-age=2592000'); // 30天
    }
  }
  
  // API 响应缓存
  if (url.pathname.startsWith('/api/')) {
    newHeaders.set('Cache-Control', 'public, max-age=60, s-maxage=300'); // 1分钟浏览器，5分钟边缘
  }
  
  // HTML 缓存
  if (url.pathname.match(/\.html?$/i) || url.pathname === '/') {
    newHeaders.set('Cache-Control', 'public, max-age=3600, must-revalidate'); // 1小时
  }
  
  // 启用 Brotli 压缩（如果 Cloudflare 已启用）
  newHeaders.set('Accept-Encoding', 'br, gzip, deflate');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
};