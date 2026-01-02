/**
 * Cloudflare Pages Function - RPC 代理
 * 
 * 作为 RPC 代理的轻量级替代方案（如果不想使用 Workers）
 * 提供基本的缓存和故障转移功能
 */

interface Env {
  RPC_URLS: string; // JSON 数组，多个 RPC 端点
  RPC_CACHE_TTL?: string; // 缓存 TTL（秒），默认 60
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

// 简单的内存缓存（Pages Functions 限制）
const memoryCache = new Map<string, { data: RPCResponse; expires: number }>();
const CACHE_TTL = 60000; // 60秒

/**
 * 获取缓存键
 */
function getCacheKey(method: string, params: any[]): string {
  return `rpc:${method}:${JSON.stringify(params)}`;
}

/**
 * 从缓存获取
 */
function getFromCache(key: string): RPCResponse | null {
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  if (cached) {
    memoryCache.delete(key); // 清理过期缓存
  }
  return null;
}

/**
 * 写入缓存
 */
function setCache(key: string, data: RPCResponse, ttl: number = CACHE_TTL): void {
  memoryCache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
  
  // 限制缓存大小（防止内存溢出）
  if (memoryCache.size > 1000) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
}

/**
 * 判断是否可缓存
 */
function isCacheable(method: string): boolean {
  const cacheableMethods = [
    'eth_blockNumber',
    'eth_getBalance',
    'eth_call',
    'eth_getTransactionReceipt',
    'eth_getBlockByNumber',
  ];
  return cacheableMethods.includes(method);
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
    throw error;
  }
}

/**
 * 尝试多个 RPC 端点（故障转移）
 */
async function executeRPCWithFallback(
  urls: string[],
  request: RPCRequest
): Promise<RPCResponse> {
  const errors: Error[] = [];

  for (const url of urls) {
    try {
      return await executeRPC(url, request);
    } catch (error) {
      console.error(`RPC endpoint failed (${url}):`, error);
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  throw new Error(
    `All RPC endpoints failed. Last error: ${errors[errors.length - 1]?.message}`
  );
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // CORS 处理
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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
    const body: RPCRequest | RPCRequest[] = await request.json();
    const requests: RPCRequest[] = Array.isArray(body) ? body : [body];

    // 处理每个请求
    const responses = await Promise.all(
      requests.map(async (req) => {
        const cacheKey = getCacheKey(req.method, req.params);
        const cacheable = isCacheable(req.method);

        // 尝试从缓存获取
        if (cacheable) {
          const cached = getFromCache(cacheKey);
          if (cached) {
            console.log(`Cache hit: ${req.method}`);
            return cached;
          }
        }

        // 执行 RPC 请求
        console.log(`RPC call: ${req.method}`);
        const response = await executeRPCWithFallback(rpcUrls, req);

        // 写入缓存
        if (cacheable) {
          const ttl = parseInt(env.RPC_CACHE_TTL || '60') * 1000;
          setCache(cacheKey, response, ttl);
        }

        return response;
      })
    );

    const result = Array.isArray(body) ? responses : responses[0];

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        'Cache-Control': 'public, max-age=60, s-maxage=300',
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
        ...corsHeaders,
      },
    });
  }
};

