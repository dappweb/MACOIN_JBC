/**
 * Cloudflare Pages Function to check API status
 */

interface Env {
  PROTOCOL_CONTRACT_ADDRESS: string;
  JBC_CONTRACT_ADDRESS: string;
  RPC_URL: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'production',
      contracts: {
        protocol: env.PROTOCOL_CONTRACT_ADDRESS || 'not configured',
        jbc: env.JBC_CONTRACT_ADDRESS || 'not configured',
      },
      rpc: env.RPC_URL || 'not configured',
      version: '1.0.0',
    };

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error checking status:', error);
    
    return new Response(JSON.stringify({ 
      status: 'error',
      error: 'Failed to check status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};