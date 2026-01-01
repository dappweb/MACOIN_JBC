# Requirements Document

## Introduction

本规范定义了将Jinbao Protocol从V2升级到V3的完整部署流程，以启用动态奖励功能。升级必须确保数据安全、功能完整性和用户体验的连续性。

## Glossary

- **UUPS_Proxy**: Universal Upgradeable Proxy Standard代理合约
- **V2_Contract**: 当前生产环境的JinbaoProtocol合约
- **V3_Contract**: 新的JinbaoProtocolV3合约，包含动态奖励功能
- **Dynamic_Rewards**: 动态奖励系统，包括直推、层级、极差三种奖励
- **MC_Chain**: MC链生产环境 (Chain ID: 88813)
- **Contract_Address**: 当前合约地址 0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5

## Requirements

### Requirement 1: 合约升级部署

**User Story:** 作为系统管理员，我需要将合约从V2升级到V3，以便用户可以使用动态奖励功能。

#### Acceptance Criteria

1. WHEN 执行UUPS代理升级 THEN 系统应保持所有现有用户数据完整性
2. WHEN 升级完成后 THEN 所有V2功能应继续正常工作
3. WHEN 升级完成后 THEN V3新功能应可正常调用
4. WHEN 升级过程中 THEN 系统应最小化停机时间
5. WHEN 升级失败时 THEN 系统应能回滚到V2状态

### Requirement 2: V3功能初始化

**User Story:** 作为系统管理员，我需要初始化V3功能，以便动态奖励系统正常运行。

#### Acceptance Criteria

1. WHEN 调用initializeV3函数 THEN 系统应成功初始化动态奖励存储
2. WHEN 初始化完成后 THEN getVersionV3应返回"3.0.0"
3. WHEN 初始化完成后 THEN getUserDynamicRewards应正常工作
4. WHEN 初始化完成后 THEN 应发出DynamicRewardSystemInitialized事件
5. WHEN 重复初始化时 THEN 系统应防止重复初始化

### Requirement 3: 数据完整性验证

**User Story:** 作为系统管理员，我需要验证升级后数据完整性，以确保用户资产安全。

#### Acceptance Criteria

1. WHEN 升级完成后 THEN 所有用户余额应与升级前一致
2. WHEN 升级完成后 THEN 所有门票信息应与升级前一致
3. WHEN 升级完成后 THEN 所有推荐关系应与升级前一致
4. WHEN 升级完成后 THEN 所有质押记录应与升级前一致
5. WHEN 升级完成后 THEN 合约总资产应与升级前一致

### Requirement 4: 功能测试验证

**User Story:** 作为系统管理员，我需要验证所有功能正常工作，以确保系统稳定性。

#### Acceptance Criteria

1. WHEN 测试购买门票 THEN 应正常记录直推和层级动态奖励
2. WHEN 测试质押流动性 THEN 应正常记录极差动态奖励
3. WHEN 测试提取动态奖励 THEN 应正常转账纯MC到用户钱包
4. WHEN 测试静态奖励 THEN 应继续按50% MC + 50% JBC分配
5. WHEN 测试所有V2功能 THEN 应与升级前行为完全一致

### Requirement 5: 前端自动适配

**User Story:** 作为用户，我希望前端自动检测并显示新的动态奖励功能，无需任何手动操作。

#### Acceptance Criteria

1. WHEN 访问StatsPanel THEN 应自动显示动态奖励统计
2. WHEN 访问MiningPanel THEN 应自动显示动态奖励管理面板
3. WHEN 有可提取动态奖励时 THEN 应显示提取按钮
4. WHEN 动态奖励数据更新时 THEN 前端应实时刷新显示
5. WHEN V3功能不可用时 THEN 前端应优雅降级不显示动态奖励

### Requirement 6: 安全性保障

**User Story:** 作为系统管理员，我需要确保升级过程的安全性，防止任何资产损失。

#### Acceptance Criteria

1. WHEN 执行升级前 THEN 应备份当前合约状态
2. WHEN 升级过程中 THEN 应使用多重签名钱包执行
3. WHEN 升级完成后 THEN 应进行全面的安全审计
4. WHEN 发现安全问题时 THEN 应立即暂停相关功能
5. WHEN 紧急情况时 THEN 应能快速回滚到安全状态

### Requirement 7: 监控和日志

**User Story:** 作为系统管理员，我需要完整的升级日志和监控，以便跟踪升级状态和排查问题。

#### Acceptance Criteria

1. WHEN 执行升级操作 THEN 应记录详细的操作日志
2. WHEN 升级完成后 THEN 应监控所有关键指标
3. WHEN 出现异常时 THEN 应立即发送告警通知
4. WHEN 用户使用新功能时 THEN 应记录使用统计
5. WHEN 系统运行时 THEN 应持续监控合约健康状态

### Requirement 8: 用户通知

**User Story:** 作为用户，我需要了解系统升级和新功能，以便正确使用动态奖励功能。

#### Acceptance Criteria

1. WHEN 升级开始前 THEN 应提前通知用户升级计划
2. WHEN 升级完成后 THEN 应通知用户新功能已可用
3. WHEN 新功能上线时 THEN 应提供使用指南
4. WHEN 用户首次使用时 THEN 应显示功能介绍
5. WHEN 出现问题时 THEN 应及时通知用户并提供解决方案