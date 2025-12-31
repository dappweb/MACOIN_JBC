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
  
  // 静态资源缓存
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff|woff2)$/i)) {
    newHeaders.set('Cache-Control', 'public, max-age=86400'); // 1天缓存
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
};