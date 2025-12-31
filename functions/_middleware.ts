// Cloudflare Pages 性能优化中间件

export interface Env {
  CACHE_TTL: string;
  ENABLE_COMPRESSION: string;
  ENABLE_MINIFICATION: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next, env } = context;
  const url = new URL(request.url);
  
  // 静态资源优化
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|eot|ico)$/i)) {
    const response = await next();
    
    // 设置缓存头
    const cacheControl = url.pathname.match(/\.(js|css)$/i) 
      ? 'public, max-age=31536000, immutable' // JS/CSS 1年缓存
      : 'public, max-age=2592000'; // 图片/字体 30天缓存
    
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cache-Control', cacheControl);
    newHeaders.set('Vary', 'Accept-Encoding');
    
    // 启用压缩
    if (env.ENABLE_COMPRESSION === 'true') {
      newHeaders.set('Content-Encoding', 'br');
    }
    
    // 安全头
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('X-XSS-Protection', '1; mode=block');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  // HTML 页面优化
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    const response = await next();
    
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cache-Control', 'public, max-age=300'); // 5分钟缓存
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
    newHeaders.set('X-XSS-Protection', '1; mode=block');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  return next();
};