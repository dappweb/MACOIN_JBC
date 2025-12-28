// Cloudflare Pages Function - 健康检查API
export async function onRequestGet() {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const healthData = {
    success: true,
    message: 'Jinbao Burn API is healthy',
    service: 'Jinbao Daily Token Burn',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? Math.floor(process.uptime()) : 'N/A',
    environment: 'Cloudflare Pages',
    endpoints: {
      'POST /api/burn': '执行代币燃烧',
      'GET /api/status': '查看燃烧状态',
      'GET /api/health': '健康检查'
    },
    features: [
      'Automated daily token burning',
      'Manual burn trigger',
      'Real-time status monitoring',
      'Telegram notifications',
      'Security controls'
    ]
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}