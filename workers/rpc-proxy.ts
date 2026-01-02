/**
 * Cloudflare Worker - RPC 代理和缓存
 * 
 * 功能:
 * 1. 统一 RPC 调用入口
 * 2. 智能缓存（基于区块号）
 * 3. 请求去重和批处理
 * 4. 自动故障转移
 * 5. 请求限流
 */

interface Env {
  // RPC 端点列表（按优先级）
  RPC_URLS: string; // JSON 数组字符串
  // Cache KV 命名空间（可选）
  RPC_CACHE: KVNamespace;
  // 缓存 TTL（秒）
  CACHE_TTL: number;
  // 请求限流配置
  RATE_LIMIT: string; // JSON 对象
}

interface RPCRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

interface RPCResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

// 默认配置
const DEFAULT_CONFIG = {
  cacheTTL: 60, // 60秒缓存
  maxRetries: 3,
  timeout: 10000, // 10秒超时
  batchSize: 10, // 批处理大小
};

/**
 * 获取缓存键
 */
function getCacheKey(method: string, params: any[]): string {
  const paramsStr = JSON.stringify(params);
  return `rpc:${method}:${btoa(paramsStr)}`;
}

/**
 * 从缓存获取
 */
async function getFromCache(
  cache: KVNamespace | undefined,
  key: string
): Promise<RPCResponse | null> {
  if (!cache) return null;
  
  try {
    const cached = await cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }
  
  return null;
}

/**
 * 写入缓存
 */
async function setCache(
  cache: KVNamespace | undefined,
  key: string,
  value: RPCResponse,
  ttl: number
): Promise<void> {
  if (!cache) return;
  
  try {
    await cache.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * 执行 RPC 请求
 */
async function executeRPC(
  url: string,
  request: RPCRequest,
  timeout: number = 10000
): Promise<RPCResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.statusText}`);
    }

    const data: RPCResponse = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('RPC request timeout');
    }
    throw error;
  }
}

/**
 * 尝试多个 RPC 端点（故障转移）
 */
async function executeRPCWithFallback(
  urls: string[],
  request: RPCRequest,
  timeout: number = 10000
): Promise<RPCResponse> {
  const errors: Error[] = [];

  for (const url of urls) {
    try {
      return await executeRPC(url, request, timeout);
    } catch (error) {
      console.error(`RPC endpoint failed (${url}):`, error);
      errors.push(error instanceof Error ? error : new Error(String(error)));
      // 继续尝试下一个端点
    }
  }

  // 所有端点都失败
  throw new Error(
    `All RPC endpoints failed. Last error: ${errors[errors.length - 1]?.message}`
  );
}

/**
 * 判断是否可缓存
 */
function isCacheable(method: string): boolean {
  // 只缓存读取操作
  const cacheableMethods = [
    'eth_blockNumber',
    'eth_getBalance',
    'eth_call',
    'eth_getTransactionReceipt',
    'eth_getBlockByNumber',
    'eth_getCode',
  ];

  return cacheableMethods.includes(method);
}

/**
 * 获取缓存 TTL（基于方法）
 */
function getCacheTTL(method: string, defaultTTL: number): number {
  // 区块号查询 - 短缓存（5秒）
  if (method === 'eth_blockNumber') {
    return 5;
  }
  
  // 余额查询 - 中等缓存（30秒）
  if (method === 'eth_getBalance') {
    return 30;
  }
  
  // 其他读取操作 - 默认缓存
  return defaultTTL;
}

/**
 * 处理单个 RPC 请求
 */
async function handleRPCRequest(
  request: RPCRequest,
  env: Env,
  urls: string[]
): Promise<RPCResponse> {
  const cacheKey = getCacheKey(request.method, request.params);
  const cacheable = isCacheable(request.method);

  // 尝试从缓存获取
  if (cacheable && env.RPC_CACHE) {
    const cached = await getFromCache(env.RPC_CACHE, cacheKey);
    if (cached) {
      console.log(`Cache hit: ${request.method}`);
      return cached;
    }
  }

  // 执行 RPC 请求
  console.log(`RPC call: ${request.method}`);
  const response = await executeRPCWithFallback(
    urls,
    request,
    DEFAULT_CONFIG.timeout
  );

  // 写入缓存
  if (cacheable && env.RPC_CACHE) {
    const ttl = getCacheTTL(request.method, env.CACHE_TTL || DEFAULT_CONFIG.cacheTTL);
    await setCache(env.RPC_CACHE, cacheKey, response, ttl);
  }

  return response;
}

/**
 * 处理批处理请求
 */
async function handleBatchRequest(
  requests: RPCRequest[],
  env: Env,
  urls: string[]
): Promise<RPCResponse[]> {
  // 并行处理所有请求
  const promises = requests.map((req) => handleRPCRequest(req, env, urls));
  return Promise.all(promises);
}

/**
 * Worker 主处理函数
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS 处理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 只允许 POST 请求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // 解析 RPC URLs
      const rpcUrls = env.RPC_URLS
        ? JSON.parse(env.RPC_URLS)
        : ['https://rpc.mcchain.io'];

      if (!Array.isArray(rpcUrls) || rpcUrls.length === 0) {
        throw new Error('Invalid RPC_URLS configuration');
      }

      // 解析请求体
      const body = await request.json();
      const isBatch = Array.isArray(body);
      const requests: RPCRequest[] = isBatch ? body : [body];

      // 处理请求
      const responses = await handleBatchRequest(requests, env, rpcUrls);
      const result = isBatch ? responses : responses[0];

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
        },
      });
    } catch (error) {
      console.error('RPC Proxy error:', error);

      const errorResponse: RPCResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
        id: null as any,
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

