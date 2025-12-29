# 静态奖励机制验证与显示修复需求文档

## 介绍

用户反映静态奖励的页面显示与预期的 50% MC + 50% MC(兑换为JBC) 机制不符。需要验证合约实现是否正确，并确保前端页面能够准确显示这一分配机制。

## 术语表

- **静态奖励 (Static Reward)**: 基于用户质押金额和时间产生的固定收益，应按 50% MC + 50% JBC 分配
- **MC部分**: 静态奖励中直接发放的 MC 代币部分（50%）
- **JBC部分**: 静态奖励中按当前价格兑换为 JBC 代币的部分（50%）
- **价格兑换**: 根据 AMM 池中的 MC/JBC 储备比例计算的兑换价格
- **RewardClaimed事件**: 合约触发的奖励领取事件，包含 MC 和 JBC 的实际发放数量

## 需求

### 需求1：合约机制验证

**用户故事**: 作为开发者，我需要验证合约中的静态奖励分配机制是否正确实现了 50% MC + 50% JBC 的逻辑。

#### 验收标准

1. WHEN 用户领取静态奖励时，THE 系统 SHALL 将总奖励的50%作为MC直接发放
2. WHEN 用户领取静态奖励时，THE 系统 SHALL 将总奖励的50%按当前JBC价格兑换为JBC发放
3. WHEN 计算JBC数量时，THE 系统 SHALL 使用 AMM 池的实时价格进行兑换
4. WHEN AMM池流动性不足时，THE 系统 SHALL 使用默认价格 1:1 进行兑换
5. WHEN 发放奖励时，THE 系统 SHALL 触发包含准确MC和JBC数量的RewardClaimed事件

### 需求2：前端显示验证

**用户故事**: 作为用户，我希望在前端页面上能够清楚地看到静态奖励的 50% MC + 50% JBC 分配详情。

#### 验收标准

1. WHEN 显示待领取静态奖励时，THE 前端 SHALL 显示MC部分和JBC部分的预估数量
2. WHEN 显示历史奖励记录时，THE 前端 SHALL 正确解析并显示实际发放的MC和JBC数量
3. WHEN 计算24小时统计时，THE 前端 SHALL 分别统计MC和JBC的静态奖励总量
4. WHEN 显示奖励详情时，THE 前端 SHALL 显示当前的MC/JBC兑换价格
5. WHEN 用户查看奖励时，THE 前端 SHALL 清楚标识这是50/50分配机制

### 需求3：价格计算准确性

**用户故事**: 作为用户，我希望JBC兑换价格的计算是准确和实时的，反映当前市场状况。

#### 验收标准

1. WHEN 计算JBC价格时，THE 系统 SHALL 使用公式 (swapReserveMC * 1e18) / swapReserveJBC
2. WHEN swapReserveJBC为0时，THE 系统 SHALL 使用默认价格 1 ether
3. WHEN swapReserveMC小于最小流动性时，THE 系统 SHALL 使用默认价格 1 ether
4. WHEN 价格计算完成时，THE 前端 SHALL 显示当前的MC/JBC汇率
5. WHEN 价格发生变化时，THE 前端 SHALL 实时更新JBC兑换预估

### 需求4：奖励分配测试

**用户故事**: 作为测试人员，我需要验证不同场景下静态奖励分配的正确性。

#### 验收标准

1. WHEN 总奖励为偶数时，THE 系统 SHALL 精确分配50%给MC和50%给JBC
2. WHEN 总奖励为奇数时，THE 系统 SHALL 合理处理余数分配
3. WHEN 合约MC余额不足时，THE 系统 SHALL 记录实际转账的MC数量
4. WHEN 合约JBC余额不足时，THE 系统 SHALL 记录实际转账的JBC数量
5. WHEN 部分转账失败时，THE 系统 SHALL 在事件中准确反映实际发放数量

### 需求5：用户界面优化

**用户故事**: 作为用户，我希望有清晰直观的界面显示静态奖励的分配机制和实际数量。

#### 验收标准

1. WHEN 显示待领取奖励时，THE 界面 SHALL 显示"50% MC + 50% JBC"的标识
2. WHEN 显示具体数量时，THE 界面 SHALL 分别显示MC数量和JBC数量
3. WHEN 显示历史记录时，THE 界面 SHALL 区分显示MC收益和JBC收益
4. WHEN 显示汇率信息时，THE 界面 SHALL 显示当前的1 MC = X JBC汇率
5. WHEN 用户查看详情时，THE 界面 SHALL 提供分配机制的说明文字

### 需求6：数据一致性验证

**用户故事**: 作为系统管理员，我需要确保合约事件数据与前端显示数据的一致性。

#### 验收标准

1. WHEN RewardClaimed事件被触发时，THE 事件数据 SHALL 包含准确的MC和JBC数量
2. WHEN 前端解析事件时，THE 解析结果 SHALL 与事件原始数据一致
3. WHEN 计算统计数据时，THE 前端计算 SHALL 基于事件中的实际发放数量
4. WHEN 显示总收益时，THE 前端 SHALL 正确累加MC和JBC的价值
5. WHEN 数据不一致时，THE 系统 SHALL 提供调试信息和修复机制