# 挖矿页面加载状态修复

## 问题描述
用户 `0x6BA8221531a30EF41260367fDe92a034c178Bb2b` 无法显示挖矿页面，页面可能一直显示加载状态。

## 根本原因
`MiningPanel` 组件的 `initializeData` 函数缺少错误处理。当数据加载失败（如RPC超时）时，`setIsInitialLoad(false)` 不会被调用，导致页面一直显示加载骨架屏。

## 修复内容

### 修复前的问题代码
```typescript
useEffect(() => {
  const initializeData = async () => {
    setIsInitialLoad(true);
    await Promise.all([
      checkTicketStatus(),
      fetchHistory()
    ]);
    setIsInitialLoad(false);  // 如果上面的Promise失败，这行不会执行
  };
  
  initializeData();
}, [protocolContract, account, isConnected]);
```

### 修复后的代码
```typescript
useEffect(() => {
  const initializeData = async () => {
    setIsInitialLoad(true);
    try {
      await Promise.all([
        checkTicketStatus(),
        fetchHistory()
      ]);
    } catch (error) {
      console.error("Failed to initialize mining panel data:", error);
      // 即使加载失败，也要显示页面内容，而不是一直显示加载状态
    } finally {
      // 确保无论成功或失败，都会隐藏加载状态
      setIsInitialLoad(false);
    }
  };
  
  if (isConnected && account && protocolContract) {
    initializeData();
  } else {
    // 如果未连接，直接隐藏加载状态
    setIsInitialLoad(false);
  }
}, [protocolContract, account, isConnected]);
```

## 修复效果

1. **错误处理**: 添加了 try-catch-finally 块，确保即使数据加载失败，也会隐藏加载状态
2. **条件检查**: 只有在连接钱包且有账户时才尝试加载数据
3. **用户体验**: 即使数据加载失败，用户也能看到页面内容，而不是一直显示加载状态

## 相关文件
- `components/MiningPanel.tsx` - 挖矿面板组件

## 测试建议

1. **正常情况**: 连接钱包，确认页面正常显示
2. **RPC超时**: 模拟RPC超时情况，确认页面不会一直显示加载状态
3. **未连接钱包**: 确认未连接时页面正常显示（不显示加载状态）

## 其他可能的问题

如果修复后仍然无法显示，请检查：

1. **用户是否有推荐人**: 如果没有推荐人，页面会显示推荐人绑定提示
2. **RPC连接**: 检查RPC节点是否正常
3. **浏览器控制台**: 查看是否有其他错误信息
4. **网络连接**: 确认网络连接正常
