# Admin Dashboard Requirements Document

## Introduction

Jinbao Protocol Admin Dashboard是一个全面的管理界面，为协议管理员提供完整的系统控制、监控和管理功能。基于JinbaoProtocol智能合约的所有管理员权限，该Dashboard将提供直观的Web界面来执行各种管理操作。

## Glossary

- **Admin**: 拥有合约owner权限的管理员地址
- **Protocol**: JinbaoProtocol智能合约系统
- **Admin_Dashboard**: 管理员操作界面
- **Protocol_Status**: 协议状态监控
- **User_Management**: 用户管理系统
- **Financial_Operations**: 财务操作管理
- **Data_Modification**: 数据修改功能
- **Security_Controls**: 安全控制系统
- **Chinese_UI**: 中文用户界面
- **User**: 协议的普通用户
- **Ticket**: 用户购买的参与凭证
- **Stake**: 用户的流动性质押
- **Swap_Pool**: MC/JBC代币交换池
- **Level_Reward_Pool**: 层级奖励资金池
- **Emergency_Control**: 紧急情况下的系统控制功能

## Requirements

### Requirement 1: 管理员身份验证和权限控制

**User Story:** 作为系统管理员，我需要安全的身份验证机制，以确保只有授权人员可以访问管理功能。

#### Acceptance Criteria

1. WHEN 用户访问Admin Dashboard THEN 系统 SHALL 要求连接Web3钱包进行身份验证
2. WHEN 连接的钱包地址不是合约owner THEN 系统 SHALL 拒绝访问并显示权限错误
3. WHEN 管理员身份验证成功 THEN 系统 SHALL 显示完整的管理界面
4. WHEN 管理员会话超过30分钟无操作 THEN 系统 SHALL 自动登出并要求重新验证
5. WHEN 执行敏感操作时 THEN 系统 SHALL 要求二次确认和钱包签名

### Requirement 2: 协议状态实时监控

**User Story:** 作为管理员，我需要实时监控协议的运行状态和关键指标，以便及时发现问题和做出决策。

#### Acceptance Criteria

1. WHEN Dashboard加载时 THEN 系统 SHALL 显示协议总体状态概览
2. WHEN 显示状态数据时 THEN 系统 SHALL 包含总用户数、活跃用户数、总票据金额、总质押金额
3. WHEN 显示交换池状态时 THEN 系统 SHALL 显示MC和JBC的储备量和当前价格
4. WHEN 显示奖励池状态时 THEN 系统 SHALL 显示层级奖励池余额和待分发奖励
5. WHEN 数据更新时 THEN 系统 SHALL 每30秒自动刷新关键指标
6. WHEN 检测到异常数据时 THEN 系统 SHALL 显示警告提示

### Requirement 3: 用户管理功能

**User Story:** 作为管理员，我需要查看和管理用户信息，包括用户状态、推荐关系和奖励记录。

#### Acceptance Criteria

1. WHEN 搜索用户时 THEN 系统 SHALL 支持按地址、推荐人、状态等条件查询
2. WHEN 查看用户详情时 THEN 系统 SHALL 显示用户的票据、质押、奖励和推荐关系信息
3. WHEN 查看推荐网络时 THEN 系统 SHALL 以树形结构显示用户的推荐关系
4. WHEN 需要批量更新团队数量时 THEN 系统 SHALL 提供批量操作界面
5. WHEN 导出用户数据时 THEN 系统 SHALL 支持CSV和JSON格式导出

### Requirement 4: 财务管理中心

**User Story:** 作为财务管理员，我需要管理协议中的各种资金，包括提取、转移和流动性管理。

#### Acceptance Criteria

1. WHEN 提取交换池资金时 THEN 系统 SHALL 调用withdrawSwapReserves函数并更新储备量
2. WHEN 提取层级奖励池资金时 THEN 系统 SHALL 调用withdrawLevelRewardPool函数
3. WHEN 紧急提取任意代币时 THEN 系统 SHALL 调用rescueTokens函数
4. WHEN 添加流动性时 THEN 系统 SHALL 调用addLiquidity函数并更新池子状态
5. WHEN 更新钱包地址时 THEN 系统 SHALL 调用setWallets函数更新各个功能钱包地址
6. WHEN 执行财务操作前 THEN 系统 SHALL 显示操作预览和风险提示

### Requirement 5: 协议参数配置

**User Story:** 作为系统管理员，我需要调整协议的运行参数，包括分配比例、费用设置和运营开关。

#### Acceptance Criteria

1. WHEN 修改分配比例时 THEN 系统 SHALL 调用setDistributionConfig函数并验证总和为100%
2. WHEN 修改交换税收时 THEN 系统 SHALL 调用setSwapTaxes函数并验证税率合理性
3. WHEN 修改赎回费用时 THEN 系统 SHALL 调用setRedemptionFeePercent函数
4. WHEN 修改运营状态时 THEN 系统 SHALL 调用setOperationalStatus函数控制功能开关
5. WHEN 修改票据灵活期时 THEN 系统 SHALL 调用setTicketFlexibilityDuration函数
6. WHEN 参数修改前 THEN 系统 SHALL 显示当前值和修改后的影响预估

### Requirement 6: 交换池管理

**User Story:** 作为流动性管理员，我需要监控和管理MC/JBC交换池的状态和流动性。

#### Acceptance Criteria

1. WHEN 查看交换池状态时 THEN 系统 SHALL 显示MC和JBC储备量、当前价格和24小时交易量
2. WHEN 添加流动性时 THEN 系统 SHALL 计算最优比例并显示价格影响
3. WHEN 调整池子参数时 THEN 系统 SHALL 提供价格影响分析
4. WHEN 检测到流动性不足时 THEN 系统 SHALL 显示警告并建议操作
5. WHEN 执行池子操作时 THEN 系统 SHALL 实时更新储备量和价格信息

### Requirement 7: 奖励系统管理

**User Story:** 作为奖励管理员，我需要监控奖励分发情况并能够手动处理特殊情况下的奖励。

#### Acceptance Criteria

1. WHEN 查看奖励统计时 THEN 系统 SHALL 显示各类奖励的分发总量和历史记录
2. WHEN 查看待分发奖励时 THEN 系统 SHALL 显示所有pending rewards的详细信息
3. WHEN 需要手动分发奖励时 THEN 系统 SHALL 提供手动奖励分发功能
4. WHEN 批量处理奖励时 THEN 系统 SHALL 支持批量奖励操作
5. WHEN 分析奖励数据时 THEN 系统 SHALL 提供奖励分发的统计图表

### Requirement 8: 安全和紧急控制

**User Story:** 作为安全管理员，我需要在紧急情况下快速控制系统，并监控潜在的安全风险。

#### Acceptance Criteria

1. WHEN 检测到异常活动时 THEN 系统 SHALL 显示安全警报并记录详细信息
2. WHEN 需要紧急暂停时 THEN 系统 SHALL 提供一键暂停功能（通过setOperationalStatus）
3. WHEN 监控合约余额时 THEN 系统 SHALL 实时检查各代币余额并警告异常变化
4. WHEN 查看操作日志时 THEN 系统 SHALL 显示所有管理操作的完整审计记录
5. WHEN 评估风险等级时 THEN 系统 SHALL 基于多个指标计算并显示当前风险等级

### Requirement 9: 数据分析和报告

**User Story:** 作为数据分析师，我需要全面的数据分析工具来了解协议运行情况和用户行为。

#### Acceptance Criteria

1. WHEN 查看用户增长数据时 THEN 系统 SHALL 显示用户注册和激活的趋势图表
2. WHEN 分析交易量数据时 THEN 系统 SHALL 显示票据购买、质押和交换的统计图表
3. WHEN 分析奖励分发时 THEN 系统 SHALL 显示各类奖励的分发趋势和分布
4. WHEN 生成报告时 THEN 系统 SHALL 支持日报、周报、月报的自动生成
5. WHEN 导出数据时 THEN 系统 SHALL 支持多种格式的数据导出功能

### Requirement 10: 简单数据修改功能

**User Story:** 作为管理员，我需要能够进行简单的数据修改操作，以便快速调整用户状态和协议数据，增强现有管理功能的灵活性。

#### Acceptance Criteria

1. WHEN 需要调整用户团队数量时 THEN 系统 SHALL 提供单个用户团队数量的快速编辑功能
2. WHEN 需要修正用户奖励上限时 THEN 系统 SHALL 允许管理员手动调整用户的currentCap值
3. WHEN 需要重置用户状态时 THEN 系统 SHALL 提供用户激活状态的手动切换功能
4. WHEN 需要调整用户推荐关系时 THEN 系统 SHALL 允许查看和修改用户的推荐人绑定关系
5. WHEN 需要修正用户历史数据时 THEN 系统 SHALL 提供用户maxTicketAmount和maxSingleTicketAmount的编辑功能
6. WHEN 执行数据修改时 THEN 系统 SHALL 记录所有修改操作的详细日志和原因
7. WHEN 批量修改数据时 THEN 系统 SHALL 支持CSV文件上传进行批量用户数据更新

### Requirement 11: 中文用户界面和体验

**User Story:** 作为管理员用户，我需要直观易用的中文界面来高效完成各种管理任务。

#### Acceptance Criteria

1. WHEN 使用Dashboard时 THEN 系统 SHALL 提供响应式设计支持桌面和平板设备
2. WHEN 切换功能模块时 THEN 系统 SHALL 提供清晰的中文导航和面包屑导航
3. WHEN 执行操作时 THEN 系统 SHALL 显示中文进度指示器和操作结果反馈
4. WHEN 发生错误时 THEN 系统 SHALL 显示友好的中文错误信息和解决建议
5. WHEN 使用界面时 THEN 系统 SHALL 支持深色和浅色主题切换
6. WHEN 需要帮助时 THEN 系统 SHALL 提供中文操作指南和功能说明
7. WHEN 显示任何界面元素时 THEN 系统 SHALL 使用简体中文作为主要语言
8. WHEN 显示数据和统计信息时 THEN 系统 SHALL 使用中文格式化数字和日期