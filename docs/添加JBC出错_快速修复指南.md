# 添加JBC出错 - 快速修复指南

## 错误信息
- **错误代码**: `0x82a6e09c`
- **错误类型**: `TransferFromFailedLowLevel`
- **含义**: JBC代币转账失败

## 快速解决方案

### 方案1: 检查并授权JBC代币（最常见）

**步骤**:
1. 打开浏览器控制台（F12）
2. 执行以下代码检查授权：
   ```javascript
   // 获取合约实例（需要从DApp中获取）
   const allowance = await jbcContract.allowance(account, await protocolContract.getAddress());
   console.log('当前JBC授权:', ethers.formatEther(allowance));
   console.log('需要数量: 200000 JBC');
   ```

3. 如果授权不足，执行授权：
   ```javascript
   const protocolAddress = await protocolContract.getAddress();
   const approveTx = await jbcContract.approve(protocolAddress, ethers.MaxUint256);
   console.log('授权交易哈希:', approveTx.hash);
   await approveTx.wait();
   console.log('授权成功！');
   ```

4. **重要**: 等待授权交易确认后，再等待5-10秒让状态更新

5. 重新尝试添加JBC流动性

---

### 方案2: 检查JBC余额

**步骤**:
1. 在浏览器控制台执行：
   ```javascript
   const balance = await jbcContract.balanceOf(account);
   console.log('当前JBC余额:', ethers.formatEther(balance));
   console.log('需要数量: 200000 JBC');
   console.log('余额是否足够:', balance >= ethers.parseEther('200000'));
   ```

2. 如果余额不足，需要先充值JBC代币

---

### 方案3: 使用DApp界面授权

**步骤**:
1. 在添加JBC流动性前，系统会自动检查授权
2. 如果授权不足，会提示"正在授权JBC代币..."
3. 在钱包中确认授权交易
4. 等待授权交易确认
5. 等待几秒让状态更新
6. 再次尝试添加流动性

---

## 常见问题

### Q1: 授权后仍然失败？

**可能原因**:
- 授权交易未确认
- 链上状态未更新

**解决方案**:
1. 在区块浏览器查看授权交易状态
2. 等待交易确认
3. 等待10秒让状态更新
4. 重新尝试

---

### Q2: 授权和余额都足够，但仍然失败？

**可能原因**:
- 网络延迟
- RPC节点问题

**解决方案**:
1. 刷新页面
2. 重新连接钱包
3. 等待几秒后重试

---

### Q3: 如何确认授权是否成功？

**检查方法**:
```javascript
// 在浏览器控制台执行
const protocolAddress = await protocolContract.getAddress();
const allowance = await jbcContract.allowance(account, protocolAddress);
console.log('JBC授权额度:', ethers.formatEther(allowance));

// 如果显示很大的数字（如 115792089237316195423570985008687907853269984665640564039457.584007913129639935）
// 说明已授权MaxUint256，授权成功
```

---

## 完整检查清单

在添加JBC流动性前，请确认：

- [ ] JBC余额 ≥ 200000 JBC
- [ ] JBC授权 ≥ 200000 JBC（或MaxUint256）
- [ ] MC余额 ≥ 0.01 MC（用于Gas费用）
- [ ] 当前账户是合约Owner
- [ ] 授权交易已确认
- [ ] 等待了5-10秒让状态更新
- [ ] 网络连接正常

---

## 错误代码说明

| 错误代码 | 错误名称 | 原因 | 解决方案 |
|---------|---------|------|---------|
| `0x82a6e09c` | `TransferFromFailedLowLevel` | JBC转账失败 | 检查授权和余额 |
| `0x87a26b75` | `TransferFromFailed` | JBC转账失败（带原因） | 检查授权和余额 |

---

## 联系支持

如果以上方案都无法解决问题，请提供：

1. 浏览器控制台的完整错误日志
2. JBC授权额度（执行检查代码的输出）
3. JBC余额（执行检查代码的输出）
4. 使用的钱包地址
5. 尝试添加的JBC数量

---

**创建时间**: 2024年
**最后更新**: 2024年

