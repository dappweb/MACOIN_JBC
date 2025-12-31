// 健康检查API - 带缓存优化

export interface Env {
  CACHE_TTL: string;
  ENVIRONMENT: string;
}

// 内存缓存
const cache = new Map<string, { data: any; timestamp: number }>();

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;
  
  const cacheKey = 'health-check';
  const cacheTTL = parseInt(env.CACHE_TTL || '300') * 1000; // 默认5分钟
  const now = Date.now();
  
  // 检查缓存
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cacheTTL) {
    return new Response(JSON.stringify(cached.data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${Math.floor(cacheTTL / 1000)}`,
        'X-Cache': 'HIT'
      }
    });
  }
  
  // 生成健康检查数据
  const healthData = {
    status: 'healthy',
    timestamp: now,
    environment: env.ENVIRONMENT || 'unknown',
    version: '1.0.0',
    uptime: process.uptime ? Math.floor(process.uptime()) : 0,
    memory: process.memoryUsage ? process.memoryUsage() : null
  };
  
  // 更新缓存
  cache.set(cacheKey, { data: healthData, timestamp: now });
  
  // 清理过期缓存
  for (const [key, value] of cache.entries()) {
    if ((now - value.timestamp) > cacheTTL) {
      cache.delete(key);
    }
  }
  
  return new Response(JSON.stringify(healthData), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${Math.floor(cacheTTL / 1000)}`,
      'X-Cache': 'MISS'
    }
  });
};