# 流动性赎回修复需求文档

## 介绍

用户在尝试赎回流动性质押时遇到交易失败问题。根据代码分析，问题可能出现在以下几个方面：
1. 赎回费用计算和授权机制
2. 合约状态检查逻辑
3. 前端与合约的交互流程
4. 错误处理和用户反馈

## 术语表

- **Protocol_Contract**: 主协议合约，处理流动性质押和赎回
- **MC_Token**: 主要代币合约
- **JBC_Token**: 金本位代币合约
- **Redemption_Fee**: 赎回时收取的手续费
- **Stake_Position**: 用户的流动性质押头寸
- **Frontend_Interface**: 用户界面组件

## 需求

### 需求 1: 赎回费用计算修复

**用户故事:** 作为用户，我希望赎回费用能够正确计算，这样我就能成功完成流动性赎回操作。

#### 验收标准

1. WHEN 用户尝试赎回流动性质押时，THE Protocol_Contract SHALL 正确计算基于门票金额的赎回费用
2. WHEN 用户的maxTicketAmount为0时，THE Protocol_Contract SHALL 使用userTicket.amount作为费用基础
3. WHEN 计算赎回费用时，THE Protocol_Contract SHALL 使用当前设置的redemptionFeePercent比例
4. WHEN 赎回费用大于质押本金时，THE Protocol_Contract SHALL 将费用限制为质押本金金额
5. WHEN 赎回费用计算完成时，THE Protocol_Contract SHALL 返回准确的费用金额供前端验证

### 需求 2: 授权机制优化

**用户故事:** 作为用户，我希望系统能够智能处理代币授权，这样我就不需要手动处理复杂的授权流程。

#### 验收标准

1. WHEN 用户余额不足支付赎回费用时，THE Frontend_Interface SHALL 显示明确的错误信息并阻止交易
2. WHEN 用户授权额度不足时，THE Frontend_Interface SHALL 自动请求足够的授权额度
3. WHEN 授权交易进行中时，THE Frontend_Interface SHALL 显示授权进度状态
4. WHEN 授权完成后，THE Frontend_Interface SHALL 自动继续赎回流程
5. WHEN 授权失败时，THE Frontend_Interface SHALL 显示具体的失败原因

### 需求 3: 合约状态验证

**用户故事:** 作为用户，我希望系统能够准确验证我的质押状态，这样我就能在正确的时间进行赎回操作。

#### 验收标准

1. WHEN 检查质押是否可赎回时，THE Protocol_Contract SHALL 验证质押周期是否已完成
2. WHEN 质押尚未到期时，THE Protocol_Contract SHALL 返回"Not expired"错误
3. WHEN 质押已被赎回时，THE Protocol_Contract SHALL 返回"Invalid stake"错误
4. WHEN 赎回功能被禁用时，THE Protocol_Contract SHALL 返回"Disabled"错误
5. WHEN 质押状态有效时，THE Protocol_Contract SHALL 允许赎回操作继续

### 需求 4: 错误处理和用户反馈

**用户故事:** 作为用户，我希望当赎回失败时能够收到清晰的错误信息，这样我就能了解问题所在并采取相应行动。

#### 验收标准

1. WHEN 赎回交易失败时，THE Frontend_Interface SHALL 解析合约错误并显示用户友好的中文提示
2. WHEN 余额不足时，THE Frontend_Interface SHALL 显示"MC余额不足支付赎回手续费"
3. WHEN 质押未到期时，THE Frontend_Interface SHALL 显示剩余时间和到期时间
4. WHEN 授权失败时，THE Frontend_Interface SHALL 提供重试授权的选项
5. WHEN 网络错误时，THE Frontend_Interface SHALL 显示网络连接问题提示

### 需求 5: 交易流程优化

**用户故事:** 作为用户，我希望赎回流程能够顺畅进行，这样我就能快速完成操作而不会遇到意外中断。

#### 验收标准

1. WHEN 用户点击赎回按钮时，THE Frontend_Interface SHALL 首先验证所有前置条件
2. WHEN 前置条件满足时，THE Frontend_Interface SHALL 按顺序执行授权和赎回操作
3. WHEN 交易进行中时，THE Frontend_Interface SHALL 显示进度指示器并禁用重复操作
4. WHEN 交易完成时，THE Frontend_Interface SHALL 自动刷新用户的质押列表
5. WHEN 交易成功时，THE Frontend_Interface SHALL 显示成功消息和交易详情

### 需求 6: 调试和监控

**用户故事:** 作为开发者，我希望系统能够提供详细的调试信息，这样我就能快速定位和解决问题。

#### 验收标准

1. WHEN 赎回操作执行时，THE Frontend_Interface SHALL 记录详细的调试日志
2. WHEN 合约调用失败时，THE Frontend_Interface SHALL 记录完整的错误堆栈
3. WHEN 用户状态异常时，THE Frontend_Interface SHALL 记录用户的关键状态信息
4. WHEN 交易参数异常时，THE Frontend_Interface SHALL 记录所有相关参数值
5. WHEN 系统错误时，THE Frontend_Interface SHALL 提供错误报告功能