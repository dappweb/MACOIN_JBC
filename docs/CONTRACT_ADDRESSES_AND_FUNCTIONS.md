# 链上合约地址和功能说明

## 网络信息
- **网络名称**: MC Chain
- **链 ID**: 88813
- **区块浏览器**: https://mcerscan.com
- **RPC URL**: https://chain.mcerscan.com/

---

## 合约地址

### 1. JBC 代币合约 (JBC Token)
- **地址**: `0x1Bf9ACe2485BC3391150762a109886d0B85f40Da`
- **类型**: ERC20 代币
- **名称**: Jinbao Coin
- **符号**: JBC
- **总供应量**: 100,000,000 JBC (1亿枚)
- **区块浏览器**: https://mcerscan.com/address/0x1Bf9ACe2485BC3391150762a109886d0B85f40Da

#### 主要功能:
- `transfer(address to, uint256 amount)`: 转账 JBC
- `transferFrom(address from, address to, uint256 amount)`: 授权转账
- `balanceOf(address account)`: 查询余额
- `approve(address spender, uint256 amount)`: 授权
- `allowance(address owner, address spender)`: 查询授权额度
- `burn(uint256 amount)`: 销毁代币
- `totalSupply()`: 查询总供应量

#### 税收机制:
- **买入税**: 50% (销毁)
- **卖出税**: 25% (销毁)
- **协议地址豁免**: 协议合约地址的交易不收取税收

---

### 2. 协议合约 (Jinbao Protocol)
- **地址**: `0x77601aC473dB1195A1A9c82229C9bD008a69987A`
- **类型**: UUPS 可升级合约 (Native MC 版本)
- **版本**: V4
- **区块浏览器**: https://mcerscan.com/address/0x77601aC473dB1195A1A9c82229C9bD008a69987A

#### 用户功能:

##### 推荐系统
- `bindReferrer(address _referrer)`: 绑定推荐人
  - 限制：不能绑定自己、不能重复绑定、推荐人必须有效

##### 门票购买
- `buyTicket()`: 购买门票
  - 支持金额: 100/300/500/1000 MC (原生 MC 代币)
  - 资金自动分配: 直推奖励、层级奖励、市场、回购、LP、国库
  - 设置 3 倍收益上限

##### 流动性挖矿
- `stakeLiquidity(uint256 cycleDays)`: 质押流动性
  - 周期选择: 7天/15天/30天
  - 质押金额: 门票金额 × 1.5
  - 前置条件: 已购买门票且在 72 小时内

##### 收益领取
- `claimRewards()`: 领取收益
  - 收益分配: 50% MC + 50% JBC
  - 日化收益率: 2.0% - 3.0% (根据周期)
  - 上限检查: 总收益不超过 3 倍门票金额

##### 赎回功能
- `redeem()`: 赎回流动性
  - 周期到期后可赎回
  - 收取赎回手续费

##### 交换功能 (已隐藏)
- `swapMCToJBC()`: MC 换 JBC
- `swapJBCToMC(uint256 jbcAmount)`: JBC 换 MC

#### 查询功能:

##### 用户信息
- `userInfo(address)`: 查询用户信息
  - 返回: referrer, activeDirects, teamCount, totalRevenue, currentCap, isActive, refundFeeAmount, teamTotalVolume, teamTotalCap, maxTicketAmount, maxSingleTicketAmount

- `userTicket(address)`: 查询用户门票
  - 返回: ticketId, amount, purchaseTime, exited

- `userStakes(address, uint256)`: 查询用户质押
  - 返回: id, amount, startTime, cycleDays, active, paid

- `getDirectReferrals(address)`: 获取直推列表

- `getUserLevel(address)`: 获取用户等级
  - 返回: level, percent, teamCount

- `calculateLevel(uint256 teamCount)`: 计算等级
  - 返回: level, percent

##### 协议状态
- `swapReserveMC()`: 查询 MC 交换储备
- `swapReserveJBC()`: 查询 JBC 交换储备
- `levelRewardPool()`: 查询等级奖励池余额
- `liquidityEnabled()`: 查询流动性功能是否启用
- `redeemEnabled()`: 查询赎回功能是否启用
- `ticketFlexibilityDuration()`: 查询门票灵活性时长
- `SECONDS_IN_UNIT()`: 查询时间单位（秒）

##### 钱包地址
- `marketingWallet()`: 市场钱包
- `treasuryWallet()`: 国库钱包
- `lpInjectionWallet()`: LP 注入钱包
- `buybackWallet()`: 回购钱包
- `owner()`: 合约所有者

#### 管理员功能:

##### 配置管理
- `setDistributionConfig(uint256 _direct, uint256 _level, uint256 _marketing, uint256 _buyback, uint256 _lp, uint256 _treasury)`: 设置分配比例
  - 总和必须为 100%

- `setSwapTaxes(uint256 _buyTax, uint256 _sellTax)`: 设置交换税率

- `setRedemptionFeePercent(uint256 _fee)`: 设置赎回手续费率

- `setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback)`: 设置钱包地址

- `setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled)`: 设置运营状态

- `setTicketFlexibilityDuration(uint256 _duration)`: 设置门票灵活性时长

##### 流动性管理
- `addLiquidity(uint256 jbcAmount)`: 添加流动性
  - 支持 MC (原生) 和 JBC

- `withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC)`: 提取交换储备

##### 用户管理
- `adminSetReferrer(address user, address newReferrer)`: 设置用户推荐人

- `adminSetActiveDirects(address user, uint256 newActiveDirects)`: 设置活跃直推数

- `adminSetTeamCount(address user, uint256 newTeamCount)`: 设置团队人数

##### 紧急功能
- `rescueTokens(address token, address to, uint256 amount)`: 紧急提取代币

- `transferOwnership(address newOwner)`: 转移所有权

#### 事件 (Events):
- `BoundReferrer(address indexed user, address indexed referrer)`: 绑定推荐人
- `TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)`: 购买门票
- `TicketExpired(address indexed user, uint256 ticketId, uint256 amount)`: 门票过期
- `LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)`: 质押流动性
- `RewardPaid(address indexed user, uint256 amount, uint8 rewardType)`: 支付奖励
- `RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)`: 领取奖励
- `ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)`: 推荐奖励支付
- `UserLevelChanged(address indexed user, uint256 oldLevel, uint256 newLevel, uint256 teamCount)`: 用户等级变更
- `TeamCountUpdated(address indexed user, uint256 oldCount, uint256 newCount)`: 团队人数更新
- `UserDataUpdated(address indexed user, uint256 activeDirects, uint256 totalRevenue, uint256 currentCap, uint256 refundFeeAmount)`: 用户数据更新
- `Redeemed(address indexed user, uint256 principal, uint256 fee)`: 赎回
- `SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax)`: MC 换 JBC
- `SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax)`: JBC 换 MC

---

### 3. 每日燃烧管理合约 (Daily Burn Manager)
- **地址**: `0x298578A691f10A85f027BDD2D9a8D007540FCBB4`
- **类型**: 独立管理合约
- **区块浏览器**: https://mcerscan.com/address/0x298578A691f10A85f027BDD2D9a8D007540FCBB4

#### 主要功能:
- `dailyBurn()`: 执行每日燃烧
  - 自动燃烧协议合约中的 JBC 代币
  - 每日可执行一次

- `canBurn()`: 查询是否可以执行燃烧
  - 返回: bool

- `nextBurnTime()`: 查询下次燃烧时间
  - 返回: uint256 (时间戳)

- `lastBurnTime()`: 查询最后燃烧时间
  - 返回: uint256 (时间戳)

- `getBurnAmount()`: 查询燃烧数量
  - 返回: uint256 (JBC 数量)

- `timeUntilNextBurn()`: 查询距离下次燃烧的剩余时间
  - 返回: uint256 (秒数)

- `emergencyPause()`: 紧急暂停燃烧功能
  - 仅所有者可调用

- `resumeBurn()`: 恢复燃烧功能
  - 仅所有者可调用

- `owner()`: 查询合约所有者

#### 事件:
- `DailyBurnExecuted(uint256 burnAmount, uint256 timestamp, address executor)`: 每日燃烧执行

---

## 默认配置

### 分配比例 (Distribution Config)
- **直推奖励**: 25%
- **层级奖励**: 15%
- **市场**: 5%
- **回购**: 5%
- **LP 注入**: 25%
- **国库**: 25%
- **总计**: 100%

### 交换税率 (Swap Taxes)
- **买入税**: 50%
- **卖出税**: 25%

### 赎回手续费 (Redemption Fee)
- **默认**: 1%

### 门票金额 (Ticket Amounts)
- 100 MC
- 300 MC
- 500 MC
- 1000 MC

### 质押周期 (Stake Cycles)
- 7 天
- 15 天
- 30 天

### 收益上限
- 每个周期: 门票金额 × 3 倍

---

## 使用示例

### 1. 查询用户信息
```javascript
const userInfo = await protocolContract.userInfo(userAddress);
console.log('推荐人:', userInfo.referrer);
console.log('活跃直推数:', userInfo.activeDirects.toString());
console.log('团队人数:', userInfo.teamCount.toString());
console.log('总收益:', ethers.formatEther(userInfo.totalRevenue), 'MC');
```

### 2. 购买门票
```javascript
const amount = ethers.parseEther("100"); // 100 MC
const tx = await protocolContract.buyTicket({ value: amount });
await tx.wait();
```

### 3. 质押流动性
```javascript
const cycleDays = 7; // 7天周期
const ticketAmount = ethers.parseEther("100");
const liquidityAmount = ticketAmount * 150n / 100n; // 门票 × 1.5
const tx = await protocolContract.stakeLiquidity(cycleDays, { value: liquidityAmount });
await tx.wait();
```

### 4. 领取收益
```javascript
const tx = await protocolContract.claimRewards();
await tx.wait();
```

### 5. 查询协议余额
```javascript
const protocolBalance = await jbcContract.balanceOf(CONTRACT_ADDRESSES.PROTOCOL);
console.log('协议 JBC 余额:', ethers.formatEther(protocolBalance), 'JBC');
```

---

## 注意事项

1. **网络要求**: 所有操作必须在 MC Chain (链 ID: 88813) 上进行
2. **原生 MC**: 协议使用原生 MC 代币，不是 ERC20 代币
3. **推荐人要求**: 购买门票前需要绑定推荐人
4. **时间限制**: 购买门票后 72 小时内必须质押流动性
5. **收益上限**: 每个周期的总收益不能超过门票金额的 3 倍
6. **管理员权限**: 只有合约所有者可以执行管理员功能

---

## 相关文档

- [JBC 代币生成机制分析](./JBC_GENERATION_ANALYSIS.md)
- [合约文档](../contracts/CONTRACT_DOCS.md)
- [前端合约参考](../contracts/FRONTEND_CONTRACT_REFERENCE.md)

---

**最后更新**: 2025-01-03
**版本**: V4 (Native MC Version)

