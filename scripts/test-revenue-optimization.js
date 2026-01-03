/**
 * 首页累计收益优化 - 自动化测试脚本
 * 
 * 使用方法:
 * 1. 在浏览器控制台运行此脚本
 * 2. 确保已连接钱包
 * 3. 观察测试结果
 */

(function() {
  console.log('🧪 开始测试首页累计收益优化...\n');

  const account = window.ethereum?.selectedAddress || prompt('请输入钱包地址:');
  if (!account) {
    console.error('❌ 未找到钱包地址');
    return;
  }

  const cacheKey = `revenue_cache_${account.toLowerCase()}`;
  let testResults = {
    passed: 0,
    failed: 0,
    total: 0
  };

  function test(name, condition, message) {
    testResults.total++;
    if (condition) {
      testResults.passed++;
      console.log(`✅ ${name}: ${message || '通过'}`);
    } else {
      testResults.failed++;
      console.error(`❌ ${name}: ${message || '失败'}`);
    }
  }

  // 测试1: 缓存机制
  console.log('\n📋 测试1: 缓存机制');
  const cached = localStorage.getItem(cacheKey);
  test('缓存存在', !!cached, cached ? '缓存数据存在' : '缓存数据不存在');
  
  if (cached) {
    try {
      const cacheData = JSON.parse(cached);
      test('缓存结构', 
        cacheData.baseRevenue !== undefined && 
        cacheData.referralRevenue !== undefined &&
        cacheData.combinedRevenue !== undefined,
        '缓存结构完整'
      );
      test('缓存版本', cacheData.version === '1.0.0', '缓存版本正确');
      test('缓存时间戳', 
        cacheData.lastUpdatedTimestamp > 0,
        `时间戳: ${new Date(cacheData.lastUpdatedTimestamp).toLocaleString()}`
      );
      test('缓存区块号', 
        cacheData.lastUpdatedBlock > 0,
        `区块号: ${cacheData.lastUpdatedBlock}`
      );
    } catch (e) {
      test('缓存解析', false, `解析错误: ${e.message}`);
    }
  }

  // 测试2: localStorage支持
  console.log('\n📋 测试2: localStorage支持');
  test('localStorage可用', typeof Storage !== 'undefined', 'localStorage API可用');
  test('localStorage写入', (() => {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return true;
    } catch (e) {
      return false;
    }
  })(), 'localStorage可写入');

  // 测试3: 页面可见性API
  console.log('\n📋 测试3: 页面可见性API');
  test('可见性API支持', typeof document.hidden !== 'undefined', '页面可见性API支持');
  test('当前页面状态', !document.hidden, document.hidden ? '页面隐藏' : '页面显示');

  // 测试4: 缓存有效性检查
  console.log('\n📋 测试4: 缓存有效性');
  if (cached) {
    try {
      const cacheData = JSON.parse(cached);
      const now = Date.now();
      const timeDiff = now - cacheData.lastUpdatedTimestamp;
      const cacheTTL = 5 * 60 * 1000; // 5分钟
      
      test('缓存未过期', timeDiff < cacheTTL, 
        `剩余时间: ${Math.round((cacheTTL - timeDiff) / 1000)}秒`
      );
    } catch (e) {
      test('缓存有效性检查', false, `检查失败: ${e.message}`);
    }
  }

  // 测试5: 性能指标
  console.log('\n📋 测试5: 性能指标');
  if (cached) {
    try {
      const cacheData = JSON.parse(cached);
      const cacheSize = JSON.stringify(cacheData).length;
      test('缓存大小', cacheSize < 10000, `缓存大小: ${cacheSize} bytes`);
    } catch (e) {
      // 忽略
    }
  }

  // 测试6: 网络请求监控
  console.log('\n📋 测试6: 网络请求监控');
  let rpcCallCount = 0;
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && (url.includes('rpc') || url.includes('chain'))) {
      rpcCallCount++;
      console.log(`  📡 RPC调用 #${rpcCallCount}: ${url.substring(0, 50)}...`);
    }
    return originalFetch.apply(this, args);
  };
  test('RPC监控已启用', true, '开始监控RPC调用（等待30秒观察）');

  // 输出测试结果
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(50));
  console.log(`总测试数: ${testResults.total}`);
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  if (testResults.failed === 0) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查上述错误信息');
  }

  // 30秒后显示RPC调用统计
  setTimeout(() => {
    console.log(`\n📡 30秒内RPC调用次数: ${rpcCallCount}`);
    console.log(`预期: 0-2次（优化后应该很少）`);
    if (rpcCallCount <= 2) {
      console.log('✅ RPC调用频率正常');
    } else {
      console.log('⚠️ RPC调用频率可能过高');
    }
    // 恢复原始fetch
    window.fetch = originalFetch;
  }, 30000);

  return {
    results: testResults,
    account,
    cacheKey,
    cached: cached ? JSON.parse(cached) : null
  };
})();

