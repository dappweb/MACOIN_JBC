# 新协议合约业务逻辑详细说明

## 📋 合约基本信息

- **合约地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **实现合约**: `0x34c929bF6961818f3e20252C87B14A89f6A4F091`
- **合约类型**: UUPS 可升级代理合约
- **代币类型**: 原生 MC 代币（非 ERC20）

## 🎯 核心业务功能

### 1. 推荐人绑定系统 (`bindReferrer`)

**功能描述**: 用户绑定推荐人，建立推荐关系链

**关键特性**:
- ✅ 每个用户只能绑定一次推荐人
- ✅ 防止循环推荐（不能推荐自己或自己的下级）
- ✅ 自动更新推荐关系链的团队统计
- ✅ 支持管理员修改推荐关系 (`adminSetReferrer`)

**业务逻辑**:
```solidity
function bindReferrer(address _referrer) external
```
- 检查用户是否已绑定推荐人
- 验证推荐人地址有效性
- 检查循环推荐
- 更新 `directReferrals` 映射
- 递归更新团队数量 (`teamCount`)

**事件**: `BoundReferrer(address indexed user, address indexed referrer)`

---

### 2. 门票购买系统 (`buyTicket`)

**功能描述**: 用户购买门票，参与协议

**门票等级**:
- 🎫 100 MC
- 🎫 300 MC
- 🎫 500 MC
- 🎫 1000 MC

**关键特性**:
- ✅ **必须先绑定推荐人才能购买**（强制要求）
- ✅ 支持多次购买（累加金额）
- ✅ 自动计算收益上限 (`currentCap = amount * 3`)
- ✅ 记录最大单次购买金额和总购买金额
- ✅ 自动分配推荐奖励

**业务逻辑**:
```solidity
function buyTicket() external payable nonReentrant whenNotPaused
```

**奖励分配**:
1. **直推奖励** (25%): 直接推荐人获得
2. **层级奖励** (15%): 上级推荐链获得
3. **营销钱包** (5%): 营销费用
4. **回购钱包** (5%): 回购和销毁
5. **流动性注入** (25%): 添加到交换池
6. **国库钱包** (25%): 协议储备

**事件**: `TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)`

---

### 3. 流动性质押系统 (`stakeLiquidity`)

**功能描述**: 用户质押流动性，获得极差奖励

**质押周期**:
- 📅 7 天
- 📅 15 天
- 📅 30 天

**关键特性**:
- ✅ 必须先购买门票才能质押
- ✅ 质押金额 = 最大单次门票金额 × 150%
- ✅ 支持多个质押（不同周期）
- ✅ 自动计算极差奖励
- ✅ 自动退还上次手续费

**业务逻辑**:
```solidity
function stakeLiquidity(uint256 cycleDays) external payable nonReentrant whenNotPaused
```

**极差奖励机制**:
- 根据团队数量计算极差奖励
- 奖励存储在 `stakePendingRewards` 中
- 支持 MC 和 JBC 混合奖励

**事件**: `LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)`

---

### 4. 奖励领取系统 (`claimRewards`)

**功能描述**: 用户领取累积的奖励

**奖励类型**:
- 💰 **静态奖励** (REWARD_STATIC): 门票收益
- 💰 **动态奖励** (REWARD_DYNAMIC): 质押收益
- 💰 **直推奖励** (REWARD_DIRECT): 直接推荐奖励
- 💰 **层级奖励** (REWARD_LEVEL): 层级推荐奖励
- 💰 **极差奖励** (REWARD_DIFFERENTIAL): 极差奖励

**关键特性**:
- ✅ 自动计算所有待领取奖励
- ✅ 支持 MC 和 JBC 混合奖励
- ✅ 自动检查收益上限 (`currentCap`)
- ✅ 达到上限后自动退出 (`exited = true`)

**业务逻辑**:
```solidity
function claimRewards() external nonReentrant
```

**奖励计算**:
1. 计算门票静态奖励
2. 计算质押动态奖励
3. 计算待领取的层级奖励
4. 计算待领取的极差奖励
5. 按比例分配 MC 和 JBC

**事件**: 
- `RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)`
- `RewardPaid(address indexed user, uint256 amount, uint8 rewardType)`

---

### 5. 赎回系统 (`redeem`)

**功能描述**: 用户赎回质押的流动性

**关键特性**:
- ✅ 只能赎回已到期的质押
- ✅ 扣除赎回手续费 (1%)
- ✅ 支持部分赎回
- ✅ 自动更新质押状态

**业务逻辑**:
```solidity
function redeem() external nonReentrant
```

**赎回流程**:
1. 检查是否有可赎回的质押
2. 计算赎回金额（扣除手续费）
3. 更新质押状态
4. 转账给用户

**事件**: `Redeemed(address indexed user, uint256 principal, uint256 fee)`

---

### 6. 代币交换系统

#### 6.1 MC 换 JBC (`swapMCToJBC`)

**功能描述**: 使用原生 MC 购买 JBC 代币

**关键特性**:
- ✅ 使用恒定乘积公式 (x * y = k)
- ✅ 自动计算滑点保护
- ✅ 购买税费 50%
- ✅ 税费自动销毁

**业务逻辑**:
```solidity
function swapMCToJBC() external payable nonReentrant whenNotPaused
```

**计算公式**:
```
jbcOutput = (mcAmount * swapReserveJBC) / (swapReserveMC + mcAmount)
tax = jbcOutput * 50% / 100
amountToUser = jbcOutput - tax
```

**事件**: `SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax)`

#### 6.2 JBC 换 MC (`swapJBCToMC`)

**功能描述**: 使用 JBC 代币购买原生 MC

**关键特性**:
- ✅ 使用恒定乘积公式
- ✅ 自动计算滑点保护
- ✅ 出售税费 25%
- ✅ 税费自动销毁

**业务逻辑**:
```solidity
function swapJBCToMC(uint256 jbcAmount) external nonReentrant whenNotPaused
```

**计算公式**:
```
mcOutput = (jbcAmount * swapReserveMC) / (swapReserveJBC + jbcAmount)
tax = mcOutput * 25% / 100
amountToUser = mcOutput - tax
```

**事件**: `SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax)`

---

### 7. 每日销毁系统 (`dailyBurn`)

**功能描述**: 每日自动销毁 JBC 代币

**关键特性**:
- ✅ 每 24 小时执行一次
- ✅ 从交换池中销毁 JBC
- ✅ 记录最后销毁时间

**业务逻辑**:
```solidity
function dailyBurn() external
```

**销毁机制**:
- 从 `swapReserveJBC` 中销毁一定数量的 JBC
- 更新 `lastBurnTime`

---

### 8. 回购和销毁系统 (`executeBuybackAndBurn`)

**功能描述**: 使用 MC 回购 JBC 并销毁

**关键特性**:
- ✅ 从交换池中回购 JBC
- ✅ 立即销毁回购的 JBC
- ✅ 减少 JBC 总供应量

**业务逻辑**:
```solidity
function executeBuybackAndBurn() external payable nonReentrant whenNotPaused
```

**事件**: `BuybackAndBurn(uint256 mcAmount, uint256 jbcBurned)`

---

## 🔧 管理员功能

### 1. 配置管理

#### 1.1 钱包地址设置 (`setWallets`)
- 营销钱包
- 国库钱包
- 流动性注入钱包
- 回购钱包

#### 1.2 分配比例设置 (`setDistributionConfig`)
- 直推奖励比例 (25%)
- 层级奖励比例 (15%)
- 营销比例 (5%)
- 回购比例 (5%)
- 流动性注入比例 (25%)
- 国库比例 (25%)

#### 1.3 交换税费设置 (`setSwapTaxes`)
- 购买税费 (50%)
- 出售税费 (25%)

#### 1.4 赎回费用设置 (`setRedemptionFeePercent`)
- 赎回手续费 (1%)

#### 1.5 操作状态设置 (`setOperationalStatus`)
- 流动性功能开关
- 赎回功能开关

### 2. 流动性管理

#### 2.1 添加流动性 (`addLiquidity`)
- 添加 MC 和 JBC 到交换池
- 增加交换储备

#### 2.2 提取交换储备 (`withdrawSwapReserves`)
- 提取 MC 储备
- 提取 JBC 储备

#### 2.3 提取层级奖励池 (`withdrawLevelRewardPool`)
- 提取累积的层级奖励

#### 2.4 紧急提取 (`emergencyWithdrawNative`)
- 紧急提取原生 MC

### 3. 用户管理

#### 3.1 设置推荐人 (`adminSetReferrer`)
- 管理员可以修改用户的推荐人
- 自动更新推荐关系链

### 4. 紧急控制

#### 4.1 紧急暂停 (`emergencyPause`)
- 暂停所有用户操作

#### 4.2 紧急恢复 (`emergencyUnpause`)
- 恢复所有用户操作

---

## 📊 数据结构和状态

### 用户信息 (`UserInfo`)
```solidity
struct UserInfo {
    address referrer;              // 推荐人地址
    uint256 activeDirects;         // 活跃直推数量
    uint256 teamCount;             // 团队总人数
    uint256 totalRevenue;          // 总收益
    uint256 currentCap;            // 当前收益上限
    bool isActive;                 // 是否活跃
    uint256 refundFeeAmount;      // 待退还手续费
    uint256 teamTotalVolume;       // 团队总交易量
    uint256 teamTotalCap;          // 团队总上限
    uint256 maxTicketAmount;       // 最大门票金额
    uint256 maxSingleTicketAmount; // 最大单次门票金额
}
```

### 门票信息 (`Ticket`)
```solidity
struct Ticket {
    uint256 ticketId;      // 门票 ID
    uint256 amount;        // 门票金额
    uint256 purchaseTime;  // 购买时间
    bool exited;           // 是否已退出
}
```

### 质押信息 (`Stake`)
```solidity
struct Stake {
    uint256 id;           // 质押 ID
    uint256 amount;       // 质押金额
    uint256 startTime;    // 开始时间
    uint256 cycleDays;    // 周期天数
    bool active;          // 是否活跃
    uint256 paid;         // 已支付金额
}
```

---

## 🔐 安全特性

### 1. 重入攻击保护
- ✅ 使用 `ReentrancyGuard` 防止重入攻击
- ✅ 所有关键函数都使用 `nonReentrant` 修饰符

### 2. 暂停机制
- ✅ 紧急暂停功能 (`emergencyPause`)
- ✅ 所有用户操作都检查 `whenNotPaused`

### 3. 权限控制
- ✅ Owner 权限控制 (`onlyOwner`)
- ✅ 关键操作需要 Owner 权限

### 4. 输入验证
- ✅ 金额验证
- ✅ 地址验证
- ✅ 循环推荐检查
- ✅ 滑点保护

---

## 📈 奖励机制详解

### 1. 直推奖励 (25%)
- 直接推荐人获得门票金额的 25%
- 立即发放

### 2. 层级奖励 (15%)
- 上级推荐链获得门票金额的 15%
- 按层级分配
- 存储在 `ticketPendingRewards` 中

### 3. 极差奖励
- 根据团队数量计算
- 质押时触发
- 存储在 `stakePendingRewards` 中

### 4. 静态奖励
- 门票收益
- 按时间计算

### 5. 动态奖励
- 质押收益
- 按周期计算

---

## 🎯 业务规则

### 1. 推荐关系规则
- ✅ 每个用户只能有一个推荐人
- ✅ 不能推荐自己
- ✅ 不能形成循环推荐
- ✅ 推荐关系可以修改（仅管理员）

### 2. 门票规则
- ✅ 必须先绑定推荐人
- ✅ 只能购买指定金额的门票
- ✅ 支持多次购买
- ✅ 收益上限 = 门票金额 × 3

### 3. 质押规则
- ✅ 必须先购买门票
- ✅ 质押金额 = 最大单次门票 × 150%
- ✅ 支持 7/15/30 天周期
- ✅ 可以多次质押

### 4. 奖励规则
- ✅ 达到收益上限后自动退出
- ✅ 奖励可以随时领取
- ✅ 支持 MC 和 JBC 混合奖励

---

## 📊 当前状态

### 迁移完成情况
- ✅ **推荐关系**: 365/367 用户已迁移
- ⚠️ **其他数据**: 需要用户操作时自动恢复
  - `activeDirects`: 会在用户购买门票时自动更新
  - `teamCount`: 会在推荐关系链中自动计算
  - `totalRevenue`: 会在用户领取奖励时累积

### 合约配置
- ✅ 所有配置参数已正确设置
- ✅ Owner 已设置为 JBC Token Owner
- ✅ 所有业务功能可用

---

## 🔄 下一步

1. **更新前端引用**: 更新 `src/Web3Context.tsx` 中的合约地址
2. **更新 JBC Token**: 调用 `setProtocol(0x0897Cee05E43B2eCf331cd80f881c211eb86844E)`
3. **重新注入流动性**: 添加 MC 和 JBC 到交换池
4. **通知用户**: 通知用户新合约地址和需要重新授权

---

## 📝 注意事项

1. **余额损失**: 旧合约中的余额（约 34,802 MC + 1,000,001 JBC）无法提取
2. **用户授权**: 用户可能需要重新授权新合约使用 JBC Token
3. **数据恢复**: 部分数据（如 `activeDirects`, `teamCount`）会在用户操作时自动恢复
4. **推荐关系**: 推荐关系已成功迁移，用户可以正常使用

