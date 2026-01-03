# 前端合约地址和函数参考

本文档列出了前端代码中使用的所有智能合约地址和函数。

## 📋 合约地址

### 生产环境 (MC Chain)

```typescript
// src/Web3Context.tsx
export const CONTRACT_ADDRESSES = {
  JBC_TOKEN: "0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D",
  PROTOCOL: "0x77601aC473dB1195A1A9c82229C9bD008a69987A",
  DAILY_BURN_MANAGER: "0x298578A691f10A85f027BDD2D9a8D007540FCBB4"
};
```

### 测试环境

```typescript
// src/config/test.ts
export const TEST_CONFIG = {
  CONTRACTS: {
    JBC_TOKEN: "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da",
    PROTOCOL: "0xD437e63c2A76e0237249eC6070Bef9A2484C4302",
    DAILY_BURN_MANAGER: "0x6C2FdDEb939D92E0dde178845F570FC4E0d213bc"
  }
};
```

---

## 🔷 1. JBC Token 合约

**地址**: `0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D`

### 使用的函数

#### 读取函数 (View)
- `balanceOf(address account)` - 查询账户余额
- `allowance(address owner, address spender)` - 查询授权额度

#### 写入函数 (Write)
- `transfer(address to, uint256 amount)` - 转账
- `transferFrom(address from, address to, uint256 amount)` - 从授权账户转账
- `approve(address spender, uint256 amount)` - 授权

### 使用位置
- `src/Web3Context.tsx` - 合约初始化
- 前端组件中用于查询 JBC 余额和授权操作

---

## 🏛️ 2. Protocol 合约 (JinbaoProtocolNative)

**地址**: `0x77601aC473dB1195A1A9c82229C9bD008a69987A`

### 完整 ABI

所有前端使用的函数定义在 `src/Web3Context.tsx` 的 `PROTOCOL_ABI` 中。

### 核心业务函数

#### 用户操作函数

##### 1. `bindReferrer(address _referrer)`
- **功能**: 绑定推荐人
- **使用位置**: 
  - `src/Web3Context.tsx` (自动绑定)
  - `components/StatsPanel.tsx` (手动绑定)
- **参数**: 推荐人地址

##### 2. `buyTicket() payable`
- **功能**: 购买门票 (100/300/500/1000 MC)
- **使用位置**: `components/BuyTicketPanel.tsx`
- **参数**: 通过 `msg.value` 发送 MC 数量
- **返回值**: 交易哈希

##### 3. `stakeLiquidity(uint256 cycleDays) payable`
- **功能**: 质押流动性 (门票 × 1.5)
- **使用位置**: `components/MiningPanel.tsx`
- **参数**: 
  - `cycleDays`: 周期天数 (7/15/30)
  - 通过 `msg.value` 发送 MC 数量
- **返回值**: 交易哈希

##### 4. `claimRewards()`
- **功能**: 领取收益 (50% MC + 50% JBC)
- **使用位置**: `components/MiningPanel.tsx`
- **返回值**: 交易哈希

##### 5. `redeem()`
- **功能**: 赎回流动性 (周期到期后)
- **使用位置**: `components/MiningPanel.tsx`
- **返回值**: 交易哈希

##### 6. `swapMCToJBC() payable`
- **功能**: MC 换 JBC (AMM 交换)
- **使用位置**: 交换功能组件
- **参数**: 通过 `msg.value` 发送 MC 数量
- **返回值**: 交易哈希

##### 7. `swapJBCToMC(uint256 jbcAmount)`
- **功能**: JBC 换 MC (AMM 交换)
- **使用位置**: 交换功能组件
- **参数**: JBC 数量
- **返回值**: 交易哈希

##### 8. `dailyBurn()`
- **功能**: 执行每日燃烧
- **使用位置**: 管理面板
- **返回值**: 交易哈希

### 查询函数 (View)

#### 用户信息查询

##### 9. `userInfo(address)`
- **返回**: 
  ```solidity
  (
    address referrer,
    uint256 activeDirects,
    uint256 teamCount,
    uint256 totalRevenue,
    uint256 currentCap,
    bool isActive,
    uint256 refundFeeAmount,
    uint256 teamTotalVolume,
    uint256 teamTotalCap,
    uint256 maxTicketAmount,
    uint256 maxSingleTicketAmount
  )
  ```
- **使用位置**: 
  - `src/Web3Context.tsx` (检查推荐人状态)
  - `components/StatsPanel.tsx` (显示用户统计)
  - `components/MiningPanel.tsx` (查询用户信息)

##### 10. `userTicket(address)`
- **返回**: 
  ```solidity
  (
    uint256 ticketId,
    uint256 amount,
    uint256 purchaseTime,
    bool exited
  )
  ```
- **使用位置**: 
  - `components/BuyTicketPanel.tsx` (检查门票状态)
  - `components/MiningPanel.tsx` (显示门票信息)

##### 11. `userStakes(address, uint256)`
- **返回**: 
  ```solidity
  (
    uint256 id,
    uint256 amount,
    uint256 startTime,
    uint256 cycleDays,
    bool active,
    uint256 paid
  )
  ```
- **使用位置**: `components/MiningPanel.tsx` (显示质押列表)

##### 12. `getDirectReferrals(address)`
- **返回**: `address[]` - 直推地址列表
- **使用位置**: 推荐关系组件

##### 13. `getUserLevel(address)`
- **返回**: 
  ```solidity
  (
    uint256 level,
    uint256 percent,
    uint256 teamCount
  )
  ```
- **使用位置**: 用户等级显示

##### 14. `calculateLevel(uint256 teamCount)`
- **功能**: 根据团队数量计算等级
- **返回**: 
  ```solidity
  (
    uint256 level,
    uint256 percent
  )
  ```
- **使用位置**: 等级计算

#### 系统状态查询

##### 15. `owner()`
- **返回**: `address` - 合约所有者
- **使用位置**: `src/Web3Context.tsx` (检查管理员权限)

##### 16. `swapReserveMC()`
- **返回**: `uint256` - MC 储备量
- **使用位置**: 交换功能、价格计算

##### 17. `swapReserveJBC()`
- **返回**: `uint256` - JBC 储备量
- **使用位置**: 交换功能、价格计算

##### 18. `lastBurnTime()`
- **返回**: `uint256` - 最后燃烧时间
- **使用位置**: 燃烧功能显示

##### 19. `marketingWallet()`
- **返回**: `address` - 营销钱包地址

##### 20. `treasuryWallet()`
- **返回**: `address` - 国库钱包地址

##### 21. `lpInjectionWallet()`
- **返回**: `address` - 流动性注入钱包地址

##### 22. `buybackWallet()`
- **返回**: `address` - 回购钱包地址

##### 23. `liquidityEnabled()`
- **返回**: `bool` - 流动性功能是否启用

##### 24. `redeemEnabled()`
- **返回**: `bool` - 赎回功能是否启用

##### 25. `ticketFlexibilityDuration()`
- **返回**: `uint256` - 门票灵活性持续时间

##### 26. `levelRewardPool()`
- **返回**: `uint256` - 等级奖励池余额

##### 27. `SECONDS_IN_UNIT()`
- **返回**: `uint256` - 时间单位（秒）

### 管理员函数

##### 28. `setDistributionConfig(uint256 _direct, uint256 _level, uint256 _marketing, uint256 _buyback, uint256 _lp, uint256 _treasury)`
- **功能**: 设置分配配置
- **权限**: 仅所有者

##### 29. `setSwapTaxes(uint256 _buyTax, uint256 _sellTax)`
- **功能**: 设置交换税收
- **权限**: 仅所有者

##### 30. `setRedemptionFeePercent(uint256 _fee)`
- **功能**: 设置赎回手续费百分比
- **权限**: 仅所有者

##### 31. `setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback)`
- **功能**: 设置钱包地址
- **权限**: 仅所有者

##### 32. `addLiquidity(uint256 jbcAmount) payable`
- **功能**: 添加流动性
- **权限**: 仅所有者
- **参数**: 
  - `jbcAmount`: JBC 数量
  - 通过 `msg.value` 发送 MC 数量

##### 33. `withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC)`
- **功能**: 提取交换储备
- **权限**: 仅所有者

##### 34. `rescueTokens(address token, address to, uint256 amount)`
- **功能**: 救援代币（紧急提取）
- **权限**: 仅所有者

##### 35. `transferOwnership(address newOwner)`
- **功能**: 转移所有权
- **权限**: 仅所有者

##### 36. `setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled)`
- **功能**: 设置运营状态
- **权限**: 仅所有者

##### 37. `setTicketFlexibilityDuration(uint256 _duration)`
- **功能**: 设置门票灵活性持续时间
- **权限**: 仅所有者

##### 38. `adminSetReferrer(address user, address newReferrer)`
- **功能**: 管理员设置推荐人
- **权限**: 仅所有者

##### 39. `adminSetActiveDirects(address user, uint256 newActiveDirects)`
- **功能**: 管理员设置活跃直推数
- **权限**: 仅所有者

##### 40. `adminSetTeamCount(address user, uint256 newTeamCount)`
- **功能**: 管理员设置团队成员数
- **权限**: 仅所有者

### 事件 (Events)

前端监听以下事件：

- `BoundReferrer(address indexed user, address indexed referrer)` - 绑定推荐人
- `TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)` - 购买门票
- `TicketExpired(address indexed user, uint256 ticketId, uint256 amount)` - 门票过期
- `LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)` - 质押流动性
- `RewardPaid(address indexed user, uint256 amount, uint8 rewardType)` - 支付奖励
- `RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)` - 领取奖励
- `ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)` - 推荐奖励支付
- `UserLevelChanged(address indexed user, uint256 oldLevel, uint256 newLevel, uint256 teamCount)` - 用户等级变更
- `TeamCountUpdated(address indexed user, uint256 oldCount, uint256 newCount)` - 团队数量更新
- `UserDataUpdated(address indexed user, uint256 activeDirects, uint256 totalRevenue, uint256 currentCap, uint256 refundFeeAmount)` - 用户数据更新
- `Redeemed(address indexed user, uint256 principal, uint256 fee)` - 赎回
- `SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax)` - MC 换 JBC
- `SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax)` - JBC 换 MC

---

## 🔥 3. Daily Burn Manager 合约

**地址**: `0x298578A691f10A85f027BDD2D9a8D007540FCBB4`

### 使用的函数

#### 读取函数 (View)
- `canBurn()` - 是否可以执行燃烧
- `nextBurnTime()` - 下次燃烧时间
- `getBurnAmount()` - 获取燃烧数量
- `timeUntilNextBurn()` - 距离下次燃烧的时间
- `lastBurnTime()` - 最后燃烧时间
- `owner()` - 合约所有者

#### 写入函数 (Write)
- `dailyBurn()` - 执行每日燃烧
- `emergencyPause()` - 紧急暂停
- `resumeBurn()` - 恢复燃烧

### 事件
- `DailyBurnExecuted(uint256 burnAmount, uint256 timestamp, address executor)` - 每日燃烧执行

---

## 📊 函数使用统计

### 最常用的函数

1. **`userInfo(address)`** - 查询用户信息（使用最频繁）
2. **`userTicket(address)`** - 查询门票信息
3. **`userStakes(address, uint256)`** - 查询质押信息
4. **`buyTicket()`** - 购买门票
5. **`stakeLiquidity(uint256)`** - 质押流动性
6. **`claimRewards()`** - 领取奖励
7. **`redeem()`** - 赎回流动性

### 组件使用映射

| 组件 | 使用的函数 |
|------|-----------|
| `Web3Context.tsx` | `userInfo()`, `bindReferrer()`, `owner()` |
| `BuyTicketPanel.tsx` | `buyTicket()`, `userTicket()` |
| `MiningPanel.tsx` | `stakeLiquidity()`, `claimRewards()`, `redeem()`, `userInfo()`, `userTicket()`, `userStakes()` |
| `StatsPanel.tsx` | `bindReferrer()`, `userInfo()`, `getUserLevel()`, `getDirectReferrals()` |
| `LiquidityPositions.tsx` | `userStakes()`, `userTicket()` |

---

## 🔗 网络配置

### MC Chain 配置

```typescript
// src/config.ts
const mcChain = {
  id: 88813,
  name: 'MC Chain',
  nativeCurrency: { name: 'MC', symbol: 'MC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://chain.mcerscan.com/'] },
  },
  blockExplorers: {
    default: { name: 'Mcerscan', url: 'https://mcerscan.com' },
  },
};
```

### RPC URLs (按优先级)

1. `process.env.MC_RPC_URL` (环境变量)
2. `https://rpc.mcchain.io`
3. `https://chain.mcerscan.com/`
4. `https://mcchain.io/rpc`

---

## 📝 注意事项

1. **原生 MC 代币**: 协议合约使用原生 MC 代币，不需要 ERC20 授权
2. **合约升级**: 协议合约使用 UUPS 代理模式，地址可能指向代理合约
3. **事件监听**: 前端通过 `queryFilter` 查询历史事件
4. **错误处理**: 所有合约调用都包含错误处理和用户友好的错误提示
5. **交易确认**: 所有写入操作都等待交易确认 (`tx.wait()`)

---

## 🔍 检查脚本

使用以下脚本检查合约状态：

```bash
# 检查协议合约 JBC 余额
node scripts/check-protocol-jbc-balance.cjs
```

---

## 📚 相关文档

- [合约完整文档](./CONTRACT_DOCS.md)
- [JBC 生成机制分析](../analysis/JBC_GENERATION_ANALYSIS.md)
- [收益计算分析](../analysis/REVENUE_CALCULATION_ANALYSIS.md)

