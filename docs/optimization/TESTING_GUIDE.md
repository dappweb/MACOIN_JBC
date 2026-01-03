# 首页累计收益优化 - 测试指南

## 🧪 测试环境准备

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 打开浏览器

访问: http://localhost:5173

### 3. 打开开发者工具

- **Chrome/Edge**: F12 或 Ctrl+Shift+I
- **Firefox**: F12 或 Ctrl+Shift+I
- **Safari**: Cmd+Option+I

## 📋 测试清单

### 测试1: 缓存机制 ✅

**目标**: 验证缓存读写功能

**步骤**:
1. 清除浏览器 localStorage
2. 连接钱包
3. 打开首页
4. 等待数据加载完成
5. 打开开发者工具 → Application → Local Storage
6. 查找 `revenue_cache_<你的地址>` 键

**预期结果**:
- ✅ 缓存数据存在
- ✅ 包含 `baseRevenue`, `referralRevenue`, `combinedRevenue` 等字段
- ✅ `lastUpdatedTimestamp` 是当前时间戳
- ✅ `version` 是 "1.0.0"

**验证代码**:
```javascript
// 在浏览器控制台运行
const account = "0x你的地址";
const cacheKey = `revenue_cache_${account.toLowerCase()}`;
const cached = localStorage.getItem(cacheKey);
console.log('缓存数据:', JSON.parse(cached));
```

---

### 测试2: 快速初始加载 ✅

**目标**: 验证缓存加速初始加载

**步骤**:
1. 清除浏览器缓存和 localStorage
2. 首次加载页面（记录时间 T1）
3. 刷新页面（记录时间 T2）

**预期结果**:
- ✅ 首次加载: 3-5秒
- ✅ 第二次加载（使用缓存）: 0.5-1秒
- ✅ 第二次加载明显更快

**验证方法**:
```javascript
// 在浏览器控制台运行
console.time('首次加载');
// 等待页面加载完成
console.timeEnd('首次加载');
```

---

### 测试3: 刷新频率优化 ✅

**目标**: 验证智能刷新策略

**步骤**:
1. 连接钱包
2. 打开 Network 标签（开发者工具）
3. 筛选 "Fetch/XHR" 请求
4. 观察 RPC 调用频率

**预期结果**:
- ✅ 活跃状态：约30秒刷新一次
- ✅ 切换到其他标签页（后台）：约5分钟刷新一次
- ✅ 切换回页面：恢复30秒刷新

**验证方法**:
```javascript
// 在浏览器控制台运行
let callCount = 0;
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('rpc') || args[0].includes('chain')) {
    callCount++;
    console.log(`RPC调用 #${callCount} at ${new Date().toLocaleTimeString()}`);
  }
  return originalFetch.apply(this, args);
};
```

---

### 测试4: 增量更新机制 ✅

**目标**: 验证增量查询功能

**步骤**:
1. 连接钱包
2. 等待首次数据加载完成
3. 查看控制台日志
4. 等待30秒后观察第二次刷新

**预期结果**:
- ✅ 首次加载：全量查询（50,000区块）
- ✅ 后续刷新：增量查询（<1000区块）
- ✅ 控制台显示 "isIncremental: true"

**验证方法**:
查看浏览器控制台，应该看到类似日志：
```
🔄 [TransactionHistory] Auto-refreshing earnings records (5 minutes)
```

---

### 测试5: 数据验证机制 ✅

**目标**: 验证数据准确性检查

**步骤**:
1. 连接钱包
2. 打开控制台
3. 观察是否有数据验证警告

**预期结果**:
- ✅ 正常情况下无警告
- ✅ 如果数据异常，会显示警告日志
- ✅ 错误时自动使用缓存数据

**验证方法**:
```javascript
// 在浏览器控制台运行
// 检查是否有验证警告
console.log('检查数据验证日志...');
```

---

### 测试6: 页面可见性检测 ✅

**目标**: 验证页面隐藏/显示时的刷新行为

**步骤**:
1. 连接钱包
2. 打开 Network 标签
3. 切换到其他标签页（页面隐藏）
4. 等待1分钟
5. 切换回页面（页面显示）

**预期结果**:
- ✅ 页面隐藏时：停止自动刷新
- ✅ 页面显示时：恢复自动刷新
- ✅ Network 请求在隐藏期间减少

---

### 测试7: 事件触发刷新 ✅

**目标**: 验证关键事件触发立即刷新

**步骤**:
1. 连接钱包
2. 执行一个操作（如购买门票、领取奖励）
3. 观察数据是否立即更新

**预期结果**:
- ✅ 操作后立即清除缓存
- ✅ 立即触发数据刷新
- ✅ 数据更新及时

---

### 测试8: 错误恢复 ✅

**目标**: 验证错误时使用缓存数据

**步骤**:
1. 连接钱包
2. 等待数据加载完成（确保有缓存）
3. 断开网络连接
4. 刷新页面

**预期结果**:
- ✅ 网络错误时使用缓存数据
- ✅ 页面仍能显示（使用缓存）
- ✅ 控制台显示错误日志

---

## 🔍 性能测试

### 测试9: RPC调用次数统计

**步骤**:
1. 清除 Network 缓存
2. 连接钱包
3. 等待5分钟
4. 统计 RPC 调用次数

**预期结果**:
- ✅ 优化前：约60次调用（每5秒×12次）
- ✅ 优化后：约10次调用（每30秒×10次）
- ✅ 减少约80%

---

### 测试10: 加载时间对比

**步骤**:
1. 使用 Performance 标签记录
2. 首次加载（无缓存）
3. 第二次加载（有缓存）

**预期结果**:
- ✅ 首次加载：3-5秒
- ✅ 第二次加载：0.5-1秒
- ✅ 改进：70-80%

---

## 🐛 常见问题排查

### 问题1: 缓存不工作

**检查**:
1. localStorage 是否被禁用
2. 缓存键是否正确
3. 缓存版本是否匹配

**解决**:
```javascript
// 检查 localStorage
console.log('localStorage可用:', typeof Storage !== 'undefined');
console.log('缓存键:', Object.keys(localStorage).filter(k => k.includes('revenue')));
```

---

### 问题2: 刷新频率不正确

**检查**:
1. 页面可见性API是否支持
2. 定时器是否被清除
3. 事件监听器是否正确

**解决**:
```javascript
// 检查页面可见性
console.log('页面可见:', !document.hidden);
console.log('可见性API支持:', typeof document.hidden !== 'undefined');
```

---

### 问题3: 增量更新不工作

**检查**:
1. 区块号是否正确获取
2. 上次更新区块号是否记录
3. 区块差距是否在范围内

**解决**:
```javascript
// 检查缓存中的区块号
const cache = JSON.parse(localStorage.getItem('revenue_cache_你的地址'));
console.log('上次更新区块:', cache?.lastUpdatedBlock);
```

---

## 📊 测试报告模板

```
测试日期: ___________
测试人员: ___________
浏览器: ___________
钱包地址: ___________

测试结果:
[ ] 测试1: 缓存机制 - 通过/失败
[ ] 测试2: 快速初始加载 - 通过/失败
[ ] 测试3: 刷新频率优化 - 通过/失败
[ ] 测试4: 增量更新机制 - 通过/失败
[ ] 测试5: 数据验证机制 - 通过/失败
[ ] 测试6: 页面可见性检测 - 通过/失败
[ ] 测试7: 事件触发刷新 - 通过/失败
[ ] 测试8: 错误恢复 - 通过/失败
[ ] 测试9: RPC调用次数 - 通过/失败
[ ] 测试10: 加载时间对比 - 通过/失败

性能指标:
- 首次加载时间: _____秒
- 缓存加载时间: _____秒
- RPC调用次数（5分钟）: _____次
- 数据准确性: _____%

问题记录:
1. 
2. 
3. 

改进建议:
1. 
2. 
3. 
```

---

## ✅ 验收标准

所有测试通过标准：
- ✅ 缓存机制正常工作
- ✅ 初始加载时间 < 1秒（有缓存）
- ✅ 刷新频率符合预期
- ✅ 增量更新正常工作
- ✅ 数据验证无错误
- ✅ 页面可见性检测正常
- ✅ 事件触发刷新正常
- ✅ 错误恢复正常
- ✅ RPC调用减少 > 60%
- ✅ 数据准确性 > 99%

---

## 🚀 快速测试脚本

在浏览器控制台运行以下脚本进行快速测试：

```javascript
// 快速测试脚本
(async function() {
  console.log('🧪 开始测试...');
  
  // 测试1: 检查缓存
  const account = '0x你的地址';
  const cacheKey = `revenue_cache_${account.toLowerCase()}`;
  const cached = localStorage.getItem(cacheKey);
  console.log('✅ 缓存测试:', cached ? '通过' : '失败');
  
  // 测试2: 检查页面可见性
  console.log('✅ 页面可见性:', typeof document.hidden !== 'undefined' ? '支持' : '不支持');
  
  // 测试3: 检查localStorage
  console.log('✅ localStorage:', typeof Storage !== 'undefined' ? '支持' : '不支持');
  
  console.log('🧪 测试完成');
})();
```

