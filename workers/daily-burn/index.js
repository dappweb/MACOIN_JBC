/**
 * 每日燃烧自动化 Worker
 * 使用 Cloudflare Workers Cron Triggers 每天自动执行 dailyBurn()
 */

const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

// dailyBurn() function selector
const DAILY_BURN_SELECTOR = '0x4e8c7f68'; // keccak256("dailyBurn()")[:4]

// ABI for reading contract state
const ABI_FRAGMENTS = {
  lastBurnTime: '0xd5d09021',
  swapReserveJBC: '0x7a8d84b6',
  owner: '0x8da5cb5b',
};

/**
 * 发送 RPC 请求
 */
async function rpcCall(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

/**
 * 调用合约只读方法
 */
async function callContract(selector) {
  return await rpcCall('eth_call', [
    { to: PROTOCOL_ADDRESS, data: selector },
    'latest',
  ]);
}

/**
 * 签名并发送交易
 */
async function signAndSendTransaction(privateKey, to, data) {
  // 获取 nonce
  const fromAddress = getAddressFromPrivateKey(privateKey);
  const nonce = await rpcCall('eth_getTransactionCount', [fromAddress, 'latest']);
  
  // 获取 gas price
  const gasPrice = await rpcCall('eth_gasPrice', []);
  
  // 估算 gas
  let gasLimit;
  try {
    gasLimit = await rpcCall('eth_estimateGas', [{ from: fromAddress, to, data }]);
    // 增加 20% buffer
    gasLimit = '0x' + (Math.floor(parseInt(gasLimit, 16) * 1.2)).toString(16);
  } catch (e) {
    gasLimit = '0x30000'; // 默认 196608
  }

  // 构建交易
  const tx = {
    nonce,
    gasPrice,
    gasLimit,
    to,
    value: '0x0',
    data,
    chainId: 88813, // MC Chain ID
  };

  // 签名交易 (使用简化的签名逻辑)
  const signedTx = await signTransaction(tx, privateKey);
  
  // 发送交易
  const txHash = await rpcCall('eth_sendRawTransaction', [signedTx]);
  return txHash;
}

/**
 * 从私钥获取地址 (简化版本)
 */
function getAddressFromPrivateKey(privateKey) {
  // 这里使用预设的 owner 地址，实际生产中应该从私钥派生
  return '0x4C10831CBcF9884ba72051b5287b6c87E4F74A48';
}

/**
 * 签名交易 (需要 ethers 或类似库)
 * 注意: Cloudflare Workers 环境下需要使用 Web Crypto API
 */
async function signTransaction(tx, privateKey) {
  // 由于 Cloudflare Workers 限制，我们使用外部签名服务或预签名
  // 这里返回一个占位符，实际实现需要使用 secp256k1 签名
  throw new Error('需要实现交易签名逻辑');
}

/**
 * 检查是否可以执行燃烧
 */
async function canBurn() {
  const lastBurnTimeHex = await callContract(ABI_FRAGMENTS.lastBurnTime);
  const lastBurnTime = parseInt(lastBurnTimeHex, 16);
  const now = Math.floor(Date.now() / 1000);
  const nextBurnTime = lastBurnTime + 24 * 3600;
  
  return {
    canBurn: now >= nextBurnTime,
    lastBurnTime,
    nextBurnTime,
    secondsUntilBurn: Math.max(0, nextBurnTime - now),
  };
}

/**
 * 获取当前 JBC 储备
 */
async function getJBCReserve() {
  const reserveHex = await callContract(ABI_FRAGMENTS.swapReserveJBC);
  return BigInt(reserveHex);
}

/**
 * 主处理函数 - Cron 触发
 */
async function handleScheduled(event, env) {
  console.log('🔥 Daily Burn Cron Job Started');
  
  try {
    // 检查是否可以燃烧
    const burnStatus = await canBurn();
    
    if (!burnStatus.canBurn) {
      const hours = Math.floor(burnStatus.secondsUntilBurn / 3600);
      const minutes = Math.floor((burnStatus.secondsUntilBurn % 3600) / 60);
      console.log(`⏳ 还需等待 ${hours}小时${minutes}分钟`);
      return { success: false, reason: 'too_early', waitTime: burnStatus.secondsUntilBurn };
    }

    // 获取 JBC 储备
    const jbcReserve = await getJBCReserve();
    if (jbcReserve === 0n) {
      console.log('❌ JBC 储备为 0，无法燃烧');
      return { success: false, reason: 'no_reserve' };
    }

    const burnAmount = jbcReserve / 100n;
    console.log(`预计燃烧: ${Number(burnAmount) / 1e18} JBC`);

    // 检查私钥
    const privateKey = env.OWNER_PRIVATE_KEY;
    if (!privateKey) {
      console.log('❌ 未配置 OWNER_PRIVATE_KEY');
      return { success: false, reason: 'no_private_key' };
    }

    // 发送交易
    const txHash = await signAndSendTransaction(
      privateKey,
      PROTOCOL_ADDRESS,
      DAILY_BURN_SELECTOR
    );

    console.log(`✅ 交易已发送: ${txHash}`);
    return { success: true, txHash, burnAmount: Number(burnAmount) / 1e18 };

  } catch (error) {
    console.error('❌ 燃烧失败:', error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * HTTP 请求处理 - 用于手动触发或状态查询
 */
async function handleRequest(request, env) {
  const url = new URL(request.url);
  
  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // 状态查询
  if (url.pathname === '/status') {
    try {
      const burnStatus = await canBurn();
      const jbcReserve = await getJBCReserve();
      const expectedBurn = jbcReserve / 100n;

      return new Response(JSON.stringify({
        canBurn: burnStatus.canBurn,
        lastBurnTime: new Date(burnStatus.lastBurnTime * 1000).toISOString(),
        nextBurnTime: new Date(burnStatus.nextBurnTime * 1000).toISOString(),
        secondsUntilBurn: burnStatus.secondsUntilBurn,
        jbcReserve: Number(jbcReserve) / 1e18,
        expectedBurnAmount: Number(expectedBurn) / 1e18,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  // 手动触发燃烧 (需要验证)
  if (url.pathname === '/trigger' && request.method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.TRIGGER_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const result = await handleScheduled(null, env);
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response('Daily Burn Worker', {
    headers: { 'Content-Type': 'text/plain' },
  });
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};

