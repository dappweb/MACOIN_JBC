/**
 * Cloudflare Pages Function to fetch user earnings data
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
    const url = new URL(request.url);
    const userAddress = url.searchParams.get('address');
    
    if (!userAddress) {
      return new Response(JSON.stringify({ error: 'Address parameter required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Mock data for now - replace with actual contract calls
    const mockEarningsData = {
      balanceMC: 0.0000,
      balanceJBC: 0.0000,
      staticRewards: 0.00,
      directRewards: 0.00,
      layerRewards: 0.00,
      totalRewards: 0.00,
      contracts: {
        protocol: env.PROTOCOL_CONTRACT_ADDRESS,
        jbc: env.JBC_CONTRACT_ADDRESS,
      },
      rpcUrl: env.RPC_URL,
    };

    return new Response(JSON.stringify(mockEarningsData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error fetching earnings:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch earnings data',
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