# 实现合约源代码分析

## 检查时间
2026-01-04

## 源代码分析

### directRewardPercent 变量声明
```solidity
// contracts/JinbaoProtocolNative.sol:73
uint256 public directRewardPercent;
```

这是一个**公共状态变量**，在 UUPS 代理模式下应该存储在**代理合约**的存储中。

### 初始化
```solidity
// contracts/JinbaoProtocolNative.sol:236
directRewardPercent = 25;
```

在 `initialize` 函数中初始化为 25%。

### 使用方式
```solidity
// contracts/JinbaoProtocolNative.sol:558
uint256 directAmt = (amount * directRewardPercent) / 100;
```

在 `buyTicket` 函数中直接使用 `directRewardPercent` 来计算直推奖励。

## 问题分析

### UUPS 代理模式的工作原理
1. **状态存储**: 所有状态变量存储在**代理合约**的存储中
2. **逻辑执行**: 实现合约通过 `delegatecall` 执行逻辑
3. **存储访问**: 实现合约访问的是代理合约的存储，而不是自己的存储

### 理论上应该工作正常
在 UUPS 代理模式下，当通过代理合约调用 `buyTicket` 时：
1. 代理合约使用 `delegatecall` 调用实现合约的 `buyTicket` 函数
2. 实现合约执行时，`directRewardPercent` 的读取应该访问代理合约的存储
3. 因此应该读取到 25%，而不是 0%

### 但实际检查发现
- **代理合约**: `directRewardPercent = 25%` ✅
- **实现合约**: `directRewardPercent = 0%` ❌

### 可能的原因

#### 1. 实现合约未正确初始化
如果实现合约在部署时未调用 `initialize` 函数，`directRewardPercent` 在实现合约的存储中就是 0。

但这不应该影响代理合约，因为代理合约有自己的存储。

#### 2. 存储布局不匹配
如果实现合约和代理合约的存储布局不一致，可能导致读取错误的值。

#### 3. 实现合约版本问题
如果部署的实现合约版本与源代码不一致，可能存在问题。

#### 4. 直接调用实现合约
如果代码直接调用实现合约（而不是通过代理），会读取实现合约自己的存储（0%）。

但根据检查，购买交易是通过代理合约进行的。

## 关键发现

### 代码逻辑是正确的
源代码中的逻辑是正确的：
- `directRewardPercent` 是公共状态变量
- 在 `buyTicket` 中直接使用 `directRewardPercent`
- 在 UUPS 代理模式下，应该访问代理合约的存储

### 问题可能在运行时
1. **实现合约的存储**: 实现合约的 `directRewardPercent` 为 0（未初始化）
2. **代理合约的存储**: 代理合约的 `directRewardPercent` 为 25%（已初始化）
3. **执行时**: 理论上应该读取代理合约的存储（25%）

### 需要进一步检查
1. 检查实现合约的字节码，确认是否有硬编码值
2. 检查购买交易的执行路径，确认是否通过代理
3. 检查存储布局，确认是否匹配

## 结论

源代码本身是正确的，问题可能在于：
1. 实现合约版本与源代码不一致
2. 存储布局不匹配
3. 运行时执行路径问题

需要检查实际部署的合约字节码和交易执行路径。

