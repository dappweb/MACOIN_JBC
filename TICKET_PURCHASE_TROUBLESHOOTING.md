# 🎫 用户购票失败问题诊断与解决方案

## 📋 问题概述

**用户反馈**: 持有MC但购票不成功

**影响范围**: 用户无法购买门票，影响正常使用流程

## 🔍 可能原因分析

### 1. **MC余额不足** (最常见)
- **现象**: 用户认为有MC，但实际余额不够
- **原因**: 
  - 显示余额可能有延迟
  - 需要额外的Gas费用
  - 用户查看的是其他代币余额

### 2. **网络连接问题**
- **现象**: 交易提交失败或长时间pending
- **原因**:
  - 未连接到MC Chain网络 (Chain ID: 88813)
  - RPC节点不稳定
  - 网络拥堵

### 3. **钱包配置问题**
- **现象**: 钱包无法识别MC代币或网络
- **原因**:
  - MC Chain网络未添加到钱包
  - 代币合约地址未添加
  - 钱包版本过旧

### 4. **Gas费设置问题**
- **现象**: 交易被拒绝或失败
- **原因**:
  - Gas费设置过低
  - Gas limit不足
  - 网络拥堵时Gas费不够

### 5. **合约状态问题**
- **现象**: 合约调用失败
- **原因**:
  - 合约暂停状态
  - 门票金额不在允许范围内
  - 重入攻击保护触发

## 🛠️ 诊断步骤

### 第一步：检查基础条件
```javascript
// 1. 检查网络连接
console.log('当前网络:', await provider.getNetwork());
// 应该显示: { chainId: 88813, name: 'MC Chain' }

// 2. 检查MC余额
const balance = await provider.getBalance(userAddress);
console.log('MC余额:', ethers.formatEther(balance));
// 购买150 MC门票需要至少150 MC + Gas费

// 3. 检查合约状态
const isPaused = await protocolContract.paused();
console.log('合约是否暂停:', isPaused);
```

### 第二步：检查交易参数
```javascript
// 1. 验证门票金额
const validAmounts = [100, 300, 500, 1000];
const selectedAmount = 150; // 用户选择的金额
console.log('金额是否有效:', validAmounts.includes(selectedAmount));

// 2. 估算Gas费用
const gasEstimate = await protocolContract.buyTicket.estimateGas({ 
  value: ethers.parseEther(selectedAmount.toString()) 
});
console.log('预估Gas:', gasEstimate.toString());
```

### 第三步：检查用户状态
```javascript
// 1. 检查推荐人绑定状态
const hasReferrer = await protocolContract.hasReferrer(userAddress);
console.log('是否已绑定推荐人:', hasReferrer);

// 2. 检查现有门票状态
const ticket = await protocolContract.userTicket(userAddress);
console.log('现有门票:', {
  amount: ethers.formatEther(ticket.amount),
  exited: ticket.exited
});
```

## ✅ 解决方案

### 方案1：余额不足问题
```javascript
// 前端增强余额检查
const handleBuyTicket = async () => {
  const requiredAmount = ethers.parseEther(selectedTicket.amount.toString());
  const currentBalance = await provider.getBalance(account);
  
  // 预留Gas费用 (估算0.01 MC)
  const gasReserve = ethers.parseEther('0.01');
  const totalRequired = requiredAmount + gasReserve;
  
  if (currentBalance < totalRequired) {
    const shortfall = ethers.formatEther(totalRequired - currentBalance);
    toast.error(`MC余额不足！还需要 ${shortfall} MC（包含Gas费）`);
    return;
  }
  
  // 继续购票流程...
};
```

### 方案2：网络连接问题
```javascript
// 自动检测和切换网络
const ensureCorrectNetwork = async () => {
  const network = await provider.getNetwork();
  
  if (network.chainId !== 88813) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x15A9D' }], // 88813 in hex
      });
    } catch (error) {
      // 如果网络不存在，添加网络
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x15A9D',
          chainName: 'MC Chain',
          rpcUrls: ['https://rpc.mcchain.io'],
          nativeCurrency: {
            name: 'MC',
            symbol: 'MC',
            decimals: 18
          }
        }]
      });
    }
  }
};
```

### 方案3：增强错误处理
```javascript
// 更详细的错误信息
const handleBuyTicketWithDiagnostics = async () => {
  try {
    // 预检查
    await ensureCorrectNetwork();
    await checkBalance();
    await checkContractStatus();
    
    // 执行购票
    const tx = await protocolContract.buyTicket({ 
      value: ethers.parseEther(selectedTicket.amount.toString()),
      gasLimit: 300000 // 设置足够的Gas limit
    });
    
    await tx.wait();
    toast.success('门票购买成功！');
    
  } catch (error) {
    // 详细错误诊断
    console.error('购票失败详情:', error);
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      toast.error('MC余额不足，请检查余额后重试');
    } else if (error.code === 'ACTION_REJECTED') {
      toast.error('交易被用户取消');
    } else if (error.message.includes('InvalidAmount')) {
      toast.error('无效的门票金额，请选择100/300/500/1000 MC');
    } else {
      showFriendlyError(error, 'buyTicket');
    }
  }
};
```

### 方案4：用户引导优化
```javascript
// 添加购票前的检查清单
const PurchaseChecklist = () => {
  const [checks, setChecks] = useState({
    network: false,
    balance: false,
    referrer: false
  });
  
  useEffect(() => {
    const runChecks = async () => {
      // 检查网络
      const network = await provider.getNetwork();
      const networkOk = network.chainId === 88813;
      
      // 检查余额
      const balance = await provider.getBalance(account);
      const balanceOk = balance >= ethers.parseEther(selectedTicket.amount.toString());
      
      // 检查推荐人
      const referrerOk = await protocolContract.hasReferrer(account) || isOwner;
      
      setChecks({
        network: networkOk,
        balance: balanceOk,
        referrer: referrerOk
      });
    };
    
    runChecks();
  }, [account, selectedTicket]);
  
  return (
    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 mb-4">
      <h4 className="font-bold text-white mb-3">购票前检查</h4>
      <div className="space-y-2">
        <CheckItem 
          label="网络连接 (MC Chain)" 
          checked={checks.network}
          action={() => ensureCorrectNetwork()}
        />
        <CheckItem 
          label={`MC余额 (需要${selectedTicket.amount} MC)`} 
          checked={checks.balance}
          action={() => window.open('https://mcchain.io/faucet', '_blank')}
        />
        <CheckItem 
          label="推荐人绑定" 
          checked={checks.referrer}
          action={() => setCurrentStep(0)} // 跳转到绑定推荐人
        />
      </div>
    </div>
  );
};
```

## 🚨 紧急修复建议

### 立即实施的修复
1. **增强余额检查**: 在购票前检查实际余额和Gas费
2. **网络自动检测**: 自动提示用户切换到MC Chain
3. **错误信息优化**: 提供更清晰的中文错误提示
4. **交易状态跟踪**: 显示交易进度和状态

### 代码修复示例
```javascript
// 在 MiningPanel.tsx 的 handleBuyTicket 函数中添加
const handleBuyTicket = async () => {
  if (!protocolContract) return;
  
  setTxPending(true);
  try {
    // 1. 网络检查
    const network = await provider.getNetwork();
    if (network.chainId !== 88813) {
      toast.error('请切换到MC Chain网络 (Chain ID: 88813)');
      return;
    }
    
    // 2. 余额检查（包含Gas费预留）
    const amountWei = ethers.parseEther(selectedTicket.amount.toString());
    const currentBalance = await provider.getBalance(account);
    const gasEstimate = await protocolContract.buyTicket.estimateGas({ value: amountWei });
    const feeData = await provider.getFeeData();
    const gasCost = gasEstimate * (feeData.gasPrice || 0n);
    const totalRequired = amountWei + gasCost;
    
    if (currentBalance < totalRequired) {
      const shortfall = ethers.formatEther(totalRequired - currentBalance);
      toast.error(`MC余额不足！还需要 ${shortfall} MC（含Gas费）`);
      return;
    }
    
    // 3. 推荐人检查
    if (!hasReferrer && !isOwner) {
      toast.error('请先绑定推荐人后再购买门票');
      return;
    }
    
    // 4. 执行购票
    const tx = await protocolContract.buyTicket({ 
      value: amountWei,
      gasLimit: gasEstimate + 50000n // 增加50k gas buffer
    });
    
    toast.loading('🎫 正在购买门票...', { id: 'buy-ticket' });
    await tx.wait();
    toast.success('🎉 门票购买成功！', { id: 'buy-ticket' });
    
    // 刷新状态
    await onTransactionSuccess('ticket_purchase');
    setCurrentStep(2);
    
  } catch (err: any) {
    console.error('购票失败:', err);
    toast.dismiss('buy-ticket');
    
    // 详细错误处理
    if (err.code === 'INSUFFICIENT_FUNDS') {
      toast.error(`MC余额不足！需要 ${selectedTicket.amount} MC + Gas费`);
    } else if (err.code === 'ACTION_REJECTED') {
      toast.error('交易已取消');
    } else if (err.message?.includes('InvalidAmount')) {
      toast.error('无效的门票金额，请选择100/300/500/1000 MC');
    } else if (err.message?.includes('paused')) {
      toast.error('合约暂时暂停，请稍后重试');
    } else {
      showFriendlyError(err, 'buyTicket');
    }
  } finally {
    setTxPending(false);
  }
};
```

## 📊 监控和预防

### 添加诊断工具
```javascript
// 创建诊断面板
const DiagnosticPanel = () => {
  const [diagnostics, setDiagnostics] = useState(null);
  
  const runDiagnostics = async () => {
    const results = {
      network: await provider.getNetwork(),
      balance: await provider.getBalance(account),
      contractStatus: await protocolContract.paused(),
      hasReferrer: await protocolContract.hasReferrer(account),
      gasPrice: await provider.getFeeData()
    };
    
    setDiagnostics(results);
  };
  
  return (
    <div className="bg-gray-800 p-4 rounded-xl">
      <button onClick={runDiagnostics} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded">
        运行诊断
      </button>
      {diagnostics && (
        <pre className="text-xs text-gray-300 overflow-auto">
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      )}
    </div>
  );
};
```

## 🎯 用户支持指南

### 常见问题解答
1. **Q: 为什么我有MC但买不了门票？**
   A: 请检查：1) 是否连接MC Chain网络 2) 余额是否足够（需要门票金额+Gas费） 3) 是否已绑定推荐人

2. **Q: 交易一直pending怎么办？**
   A: 可能是Gas费过低或网络拥堵，建议提高Gas费或稍后重试

3. **Q: 显示"Invalid amount"错误？**
   A: 只能购买100/300/500/1000 MC的门票，请选择正确金额

### 用户自助检查清单
- [ ] 钱包已连接到MC Chain网络 (Chain ID: 88813)
- [ ] MC余额充足（门票金额 + 0.01 MC Gas费）
- [ ] 已绑定推荐人（非管理员用户）
- [ ] 网络连接稳定
- [ ] 钱包版本最新

---

## 📋 总结

购票失败的主要原因是**余额不足**和**网络配置问题**。通过增强前端检查、优化错误提示和添加用户引导，可以显著改善用户体验并减少购票失败的情况。

**立即行动项**:
1. 部署增强的余额检查逻辑
2. 添加网络自动检测和切换
3. 优化错误提示信息
4. 创建用户自助诊断工具

---
*诊断报告生成时间: 2025-12-31*
*状态: 待实施修复*