# 门票购买限制逻辑测试用例

## 测试场景

### 场景1：首次购买门票
**初始状态**：
- `ticketInfo` = null
- `maxUnredeemedTicket` = 0
- `hasTicket` = false

**预期结果**：
- 所有门票档位都可选择 ✅
- `getMaxSingleTicketAmount()` = 0
- 所有 `isDisabled` = false

### 场景2：购买单张300MC门票
**状态**：
- `ticketInfo.amount` = 300MC
- `ticketInfo.maxSingleTicketAmount` = 300MC
- `maxUnredeemedTicket` = 300
- `hasTicket` = true, `isExited` = false

**预期结果**：
- `getMaxSingleTicketAmount()` = 300
- 100MC, 200MC 档位禁用 ❌
- 300MC, 500MC 档位可选 ✅

### 场景3：购买2张300MC门票（聚合）
**状态**：
- `ticketInfo.amount` = 600MC (聚合)
- `ticketInfo.maxSingleTicketAmount` = 300MC (单张最大)
- `maxUnredeemedTicket` = 300
- `hasTicket` = true, `isExited` = false

**预期结果**：
- `getMaxSingleTicketAmount()` = 300 (使用单张最大，不是聚合)
- 100MC, 200MC 档位禁用 ❌
- 300MC, 500MC 档位可选 ✅

### 场景4：先买100MC，后买300MC
**状态**：
- `ticketInfo.amount` = 400MC (聚合)
- `ticketInfo.maxSingleTicketAmount` = 300MC (单张最大)
- `maxUnredeemedTicket` = 300
- `hasTicket` = true, `isExited` = false

**预期结果**：
- `getMaxSingleTicketAmount()` = 300 (使用单张最大)
- 100MC, 200MC 档位禁用 ❌
- 300MC, 500MC 档位可选 ✅

### 场景5：合约函数不可用，使用历史数据
**状态**：
- `ticketInfo.amount` = 300MC
- `ticketInfo.maxSingleTicketAmount` = 0n (合约函数失败)
- `maxUnredeemedTicket` = 300 (前端计算)
- `hasTicket` = true, `isExited` = false

**预期结果**：
- `getMaxSingleTicketAmount()` = 300 (使用历史数据)
- 100MC, 200MC 档位禁用 ❌
- 300MC, 500MC 档位可选 ✅

### 场景6：门票已退出
**状态**：
- `ticketInfo.amount` = 300MC
- `ticketInfo.maxSingleTicketAmount` = 300MC
- `isExited` = true

**预期结果**：
- 所有门票档位都可选择 ✅ (因为 isExited = true)
- `isDisabled` = false (对所有档位)

## 逻辑优先级测试

### 优先级1：合约记录的单张最大金额
```typescript
if (ticketInfo?.maxSingleTicketAmount && ticketInfo.maxSingleTicketAmount > 0n) {
  return parseFloat(ethers.formatEther(ticketInfo.maxSingleTicketAmount));
}
```

### 优先级2：前端计算的历史单张最大
```typescript
if (maxUnredeemedTicket > 0) {
  return maxUnredeemedTicket;
}
```

### 优先级3：当前金额（如果是标准档位）
```typescript
const currentAmount = ticketInfo ? parseFloat(ethers.formatEther(ticketInfo.amount)) : 0;
if (TICKET_TIERS.some(t => Math.abs(t.amount - currentAmount) < 0.1)) {
  return currentAmount;
}
```

### 优先级4：默认值
```typescript
return 0;
```

## 边界情况测试

### 边界1：金额精度问题
- 测试 `Math.abs(t.amount - currentAmount) < 0.1` 的精度处理
- 确保浮点数比较的准确性

### 边界2：合约调用失败
- `getUserMaxSingleTicketAmount` 函数不存在
- 网络错误导致调用失败
- 应该优雅降级到历史数据

### 边界3：空数据状态
- `ticketInfo` = null
- `maxUnredeemedTicket` = 0
- 应该返回 0，允许所有档位

## 调试信息验证

控制台应该输出：
```javascript
🎫 [Ticket Selection Logic] {
  tierAmount: 100,
  currentTotalAmount: 600,           // 聚合金额
  maxSingleFromContract: 300,        // 合约单张最大
  maxSingleFromHistory: 300,         // 历史单张最大
  finalMaxSingle: 300,               // 最终使用的限制值
  isDisabled: true,                  // 100 < 300，所以禁用
  hasTicket: true,
  isExited: false
}
```

## 用户界面验证

### 提示信息
```
升级限制
您已购买过最大单张 300MC 的门票，只能购买更大金额的门票进行升级。
```

### 按钮状态
- 禁用的档位：灰色，带锁图标，不可点击
- 可用的档位：正常颜色，可点击
- 选中的档位：高亮显示，带勾选标记

## 测试通过标准

✅ 所有场景的 `getMaxSingleTicketAmount()` 返回正确值
✅ 门票档位的禁用状态符合预期
✅ 提示信息显示正确的单张最大金额
✅ 调试信息输出完整且准确
✅ 边界情况处理正确
✅ 用户界面状态正确