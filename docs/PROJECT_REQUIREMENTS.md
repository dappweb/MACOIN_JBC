# 金宝 RWA · DeFi 4.0 项目整体需求清单

**最后更新**: 2026-01-01  
**版本**: v1.0.1-stable  
**项目阶段**: 已发布 (Released)

---

## 📋 目录

1. [项目概述](#项目概述)
2. [核心功能需求](#核心功能需求)
3. [技术栈需求](#技术栈需求)
4. [功能对齐状态](#功能对齐状态)
5. [开发任务看板](#开发任务看板)
6. [已完成的工作](#已完成的工作)
7. [开放问题与优化建议](#开放问题与优化建议)

---

## 项目概述

### 项目定义
**金宝 RWA · DeFi 4.0** 是一个基于 **双币强通缩模型** 的收益系统，通过智能合约实现自动化的代币分配、流动性挖矿、动态奖励和销毁机制。

### 核心代币
| 代币 | 类型 | 特性 | 用途 |
|:---|:---|:---|:---|
| **MC** (Master Coin) | ERC20/原生 | 不可增发，不可冻结 | 支付门票、流动性、收益结算 |
| **JBC** (Jinbao Coin) | ERC20 | 总量1亿固定，强通缩 | 价值锚定、收益结算、交易对 |

### 核心机制
- **门票系统**: 4档级别 (100/300/500/1000 MC)
- **流动性挖矿**: 3周期选项 (7/15/30天，日化1.33%-2.0%)
- **动态奖励体系**: 20层推荐链，V0-V9共9等级
- **自动销毁**: 买卖滑点 + 每日底池销毁
- **出局保护**: 3倍倍数出局上限

---

## 核心功能需求

### 一、门票系统 (Ticket System)

#### 1.1 门票档位 (Ticket Tiers)
```
T1: 100 MC
T2: 300 MC
T3: 500 MC
T4: 1000 MC
```
- ✅ 合约支持
- ✅ 前端支持
- ✅ 用户可购买多张门票

#### 1.2 购买与激活流程 (Purchase & Activation)
1. **购买**: 用户支付 MC
2. **初始状态**: `Pending` (待提供流动性)
3. **激活时效**: 72小时内完成流动性提供
4. **超时处理**: 自动作废 (Expired)，资金不退
5. **流动性要求**: 门票金额的 1.5倍 MC

**状态流转**:
```
Pending (0-72h) → Active (流动性到期前) → Redeemable (到期后) → Exited (3倍出局)
                    ↓ (超时)
                  Expired
```

#### 1.3 门票收入分配 (100% MC)
| 用途 | 比例 | 流向 | 备注 |
|:---|:---|:---|:---|
| **直推奖励** | 25% | 推荐人 | 秒结，需校验活跃状态 |
| **极差奖励** | 15% | 奖励池 | 延迟结算，下级赎回时释放 |
| **市场基金** | 5% | 项目方 | 固定钱包 |
| **即时回购** | 5% | 销毁 | MC→JBC 100%销毁 |
| **底池缓冲** | 25% | 缓冲池 | 防瞬时拉盘，分批注入LP |
| **国库托底** | 25% | 国库钱包 | 固定钱包 |

### 二、流动性挖矿 (Liquidity Mining)

#### 2.1 挖矿周期与收益率 (Plans)
| 周期 | 日化率 | 收益计算 |
|:---|:---|:---|
| **7天** | 1.3333334% | 本金 × 1.33% × 7 ≈ 9.33% 总收益 |
| **15天** | 1.6666667% | 本金 × 1.67% × 15 ≈ 25% 总收益 |
| **30天** | 2.0% | 本金 × 2.0% × 30 = 60% 总收益 |

#### 2.2 收益结算结构 (Yield Distribution)
- **50% MC**: 直接发放
- **50% JBC**: 按当前 AMM 价格折算发放

#### 2.3 复投奖励 (Reinvestment Fee Refund)
- 若上一轮已赎回且支付过 1% 手续费
- 本次提供流动性时，系统自动退还上次的 1% 赎回手续费

**状态**:
- ✅ 合约实现完成 (v3.2)
- ✅ 前端已修正周期常量 (7/15/30天)
- ⚠️ 前端 UI 未展示手续费退还金额

### 三、动态收益体系 (Dynamic Rewards)

#### 3.1 等级定义 (V-Levels)
基于**有效直推人数** (Active Directs)：

| 等级 | 有效直推数 | 极差比例 |
|:---|:---|:---|
| V0 | 0 | 0% |
| V1 | 10 | 5% |
| V2 | 30 | 10% |
| V3 | 100 | 15% |
| V4 | 300 | 20% |
| V5 | 1000 | 25% |
| V6 | 3000 | 30% |
| V7 | 10000 | 35% |
| V8 | 30000 | 40% |
| V9 | 100000 | 45% |

#### 3.2 奖励计算逻辑 (Differential Reward Algorithm)
1. **计算时机**: 下级购买门票时
2. **计算基数**: 下级门票金额
3. **状态管理**:
   - 初始: `Pending` (冻结)
   - 解锁: 下级完成流动性周期并赎回时 → `Released`

4. **算法** (逐层向上，限20层或45%):
   ```
   previousLevel = 0
   for each layer (up to 20 levels):
     if currentLevel > previousLevel:
       reward = ticketAmount × (currentPercent - previousPercent)
       record/pay reward
       previousLevel = currentLevel
     else:
       skip (平级无收益，继续向上)
     if currentLevel == 45% (V9):
       break
   ```

#### 3.3 结算时机
- **发放**: 当下级用户完成流动性周期并发起赎回操作时
- **逻辑**: 触发极差奖励从 `Pending` → `Released`
- **金额**: 来自门票收入的 15% 奖励池

**状态**:
- ✅ 合约逻辑完成
- ✅ 前端支持 V0-V9 等级展示
- ✅ 前端使用 `getDirectReferralsData` 获取下级数据

### 四、交易与销毁 (AMM & Burn)

#### 4.1 买入 JBC (Swap MC → JBC)
- **输入**: MC
- **滑点**: 50%
  - 50% JBC → 用户
  - 50% JBC → 销毁 (0x...dead)
- **函数**: `swapMCToJBC()`

#### 4.2 卖出 JBC (Swap JBC → MC)
- **输入**: JBC
- **滑点**: 25%
  - 25% JBC → 销毁
  - 75% JBC → 兑换为 MC 给用户
- **函数**: `swapJBCToMC()`

#### 4.3 每日底池自动销毁 (Daily Burn)
- **时机**: 每日 00:00 UTC
- **操作**: 移除 LP 中 **1% JBC 数量**
- **去向**: 直接销毁
- **函数**: `dailyBurn()`
- **权限**: 可开放给 Keeper 或任意用户调用（可设置调用奖励）

**状态**:
- ✅ 合约实现
- ✅ 前端支持 SWAP 交易
- ⚠️ Keeper 机制待部署

### 五、赎回机制 (Redemption)

#### 5.1 赎回条件
- 流动性提供周期结束

#### 5.2 赎回操作 (redeem)
1. **手续费**: 扣除门票金额的 1% MC
2. **返还**: 100% 流动性本金 (MC)
3. **发放**: 累计的静态收益 (50% MC + 50% JBC)
4. **触发**: 解锁并释放对应的极差奖励 (`Pending` → `Released`)

#### 5.3 手续费退还 (Fee Refund)
- 当用户下一次提供流动性时，自动退还上次的 1% 手续费
- **状态**: ✅ 合约实现，⚠️ 前端 UI 未显式提示

### 六、出局机制 (3x Exit Cap)

#### 6.1 触发条件
- 单张门票的 `(已领静态 + 已领动态)` >= `门票金额 × 3`

#### 6.2 出局后果
1. 门票状态设为 `EXITED`
2. 对应流动性本金强制赎回（扣除1%）
3. **不再产生静态收益**
4. **不再享受任何动态奖励**（直到购买新门票）

**状态**:
- ✅ 合约实现
- ✅ 前端展示 Max Cap 进度条

---

## 技术栈需求

### 智能合约
- **框架**: Hardhat
- **语言**: Solidity ^0.8.20
- **依赖**:
  - `@openzeppelin/contracts` (v5.4.0) - ERC20, Ownable, ReentrancyGuard
  - Uniswap V2 接口 (AMM)
- **主合约**: `JinbaoProtocolNative.sol` (Native MC 版本)
- **配置**: `hardhat.config.cjs`
- **部署网络**: MC Chain, Sepolia, BSC Testnet

### 前端
- **框架**: React 19
- **工具链**: Vite
- **Web3**: 
  - `wagmi` (v2.19.5)
  - `viem` (v2.41.2)
  - `rainbowkit` (v2.2.10)
- **UI & 数据**:
  - `recharts` (数据可视化)
  - `react-hot-toast` (提示)
  - `lucide-react` (图标)
  - `@tanstack/react-query` (数据获取)
- **状态管理**: Web3Context.tsx, LanguageContext.tsx
- **主要组件**:
  - MiningPanel (挖矿)
  - SwapPanel (交易)
  - TeamLevel (团队等级)
  - EarningsDetail (收益明细)
  - AdminPanel (管理员)
  - TransactionHistory (交易历史)

### 构建与部署
- **编译**: `npm run compile`
- **测试**: `npm run test`
- **部署**: `npm run deploy:{network}` (mc/sepolia/bsc)
- **开发**: `npm run dev` (Vite热重载)

---

## 功能对齐状态

### ✅ 已对齐的功能

| 功能 | 合约 | 前端 | 状态 |
|:---|:---|:---|:---|
| 门票购买 | ✅ v3.2 | ✅ | 完全对齐 |
| 流动性挖矿 | ✅ v3.2 | ✅ 已修正常量 | 完全对齐 |
| 收益领取 | ✅ v3.2 | ✅ | 完全对齐 |
| 赎回机制 | ✅ v3.2 | ✅ | 完全对齐 |
| 极差奖励 | ✅ v3.2 | ✅ | 完全对齐 |
| SWAP 交易 | ✅ v3.2 | ✅ | 完全对齐 |
| 推荐绑定 | ✅ v3.2 | ✅ | 完全对齐 |
| 3倍出局 | ✅ v3.2 | ✅ | 完全对齐 |

### ⚠️ 部分完成/可优化

| 功能 | 合约状态 | 前端状态 | 改进方向 |
|:---|:---|:---|:---|
| 手续费退还提示 | ✅ 完成 | ⚠️ 后端逻辑已做，UI未显示 | 前端需增加 `refundFeeAmount` 显示逻辑 |
| 每日底池销毁 | ✅ 实现 | ❌ 无 | 需部署 Keeper 或手动触发机制 |
| 底池缓冲执行 | ✅ 实现 | ❌ 无 | 需手动触发或 Keeper 自动执行 |

---

## 开发任务看板

### Phase 1: 智能合约 (已完成)
- [x] JinbaoProtocol.sol v3.2 Final - 核心逻辑实现
- [x] MockMC.sol - 测试用 Mock 代币
- [x] 部署脚本 (sepolia, mc, bsc)
- [x] 单元测试 (test/JinbaoProtocol_v3.2.test.cjs)

### Phase 2: 前端基础 (已完成)
- [x] React + Vite 项目框架
- [x] Web3Context (wagmi + viem 集成)
- [x] 主要组件 (Mining, Swap, Team, etc.)
- [x] 常量修正 (7/15/30 天周期)

### Phase 3: 功能完善 (进行中)
- [ ] 手续费退还提示 UI
- [ ] Keeper 部署脚本 (dailyBurn 自动触发)
- [ ] 底池缓冲手动触发 UI
- [ ] 事务历史优化与过滤
- [ ] 错误处理与异常捕获增强

### Phase 4: 测试与优化 (待进行)
- [ ] 全链测试 (Sepolia, MC Chain)
- [ ] 负压测试 (高并发门票购买)
- [ ] 安全审计 (合约代码审查)
- [ ] 性能优化 (前端加载、查询优化)

### Phase 5: 上线与运维 (待进行)
- [ ] 主网部署
- [ ] 监控告警配置
- [ ] 文档完善
- [ ] 用户教程制作

---

## 已完成的工作

### ✅ 合约相关
1. **JinbaoProtocol.sol v3.2 Final**
   - 完整实现双币模型、门票系统、流动性挖矿、动态奖励、销毁机制
   - 包含 20 层推荐链、V0-V9 等级、3倍出局保护
   - 包含底池自动销毁接口 `dailyBurn()`

2. **部署工作**
   - Sepolia 测试网部署 (多次迭代)
   - 构建信息 (build-info) 保存
   - ABI/JSON 构件生成

3. **测试用例**
   - JinbaoProtocol_v3.2.test.cjs - 核心流程测试
   - Swap.test.cjs - 交易对测试

### ✅ 前端相关
1. **项目初始化**
   - React 19 + Vite + TypeScript
   - wagmi + viem + rainbowkit 集成

2. **核心组件**
   - **MiningPanel**: 门票购买、流动性质押、赎回
   - **SwapPanel**: MC ↔ JBC 交易
   - **TeamLevel**: 团队等级展示 (V0-V9)
   - **EarningsDetail**: 收益明细
   - **AdminPanel**: 管理员操作面板
   - **TransactionHistory**: 交易历史

3. **状态管理**
   - Web3Context: 合约交互
   - LanguageContext: 多语言支持 (中文/英文)

4. **常量修正**
   - `constants.ts` 中的 MINING_PLANS 由 3/5/7 天修正为 7/15/30 天

5. **多语言支持**
   - translations.ts 支持中文/英文

### ✅ 文档相关
1. 技术需求文档 v3.2 Final (最新版本)
2. 前端-合约对齐报告 v1.0
3. 部署指南、测试报告等

---

## 开放问题与优化建议

### 🔴 高优先级 (需要立即处理)

#### 1. 每日底池销毁 (Daily Burn) 执行机制
**问题**: `dailyBurn()` 函数已实现，但需要外部定期触发
**解决方案**:
- 部署 Keeper 脚本 (如 Hardhat 定时任务或 The Graph Subgraph)
- 或在前端添加手动触发按钮 (仅管理员)
- 或使用 Chainlink Automation / Gelato

**文件**: `scripts/dailyBurn.cjs` (待创建)

#### 2. 底池缓冲执行逻辑
**问题**: 缓冲池超过阈值时，需触发分批买入 JBC 并注入 LP
**状态**: 合约已实现 `executeBufferedBuy()`
**需求**: 
- 手动触发 UI (管理员)
- 或 Keeper 自动执行

#### 3. 手续费退还 UI 显示
**问题**: 合约已自动退还上次赎回的 1% 手续费，但前端未显示
**需求**: 在 `MiningPanel.tsx` 质押前检查并提示
**实现**: 
- 读取合约 `userInfo.refundFeeAmount`
- 显示 "本次质押将退还 X.XX MC 手续费"

### 🟡 中优先级 (优化与增强)

#### 1. 事务历史优化
**当前**: `TransactionHistory.tsx` 展示所有交易
**建议**: 添加筛选功能 (按交易类型、日期范围、金额范围)

#### 2. 数据可视化增强
**当前**: 使用 recharts 展示基础图表
**建议**: 添加实时 JBC 价格走势、收益累计曲线

#### 3. 错误处理
**当前**: 基础 try-catch + toast 提示
**建议**: 统一错误代码、用户友好的错误消息、重试机制

#### 4. 网络切换与自动检测
**当前**: 支持多链部署
**建议**: 前端自动检测网络并提示切换

### 🟢 低优先级 (未来优化)

1. **移动端适配**: 当前设计可能不完全适配手机
2. **性能优化**: 大数据量下的查询优化、缓存策略
3. **高级分析**: 用户行为分析、收益预测模型
4. **安全增强**: 多签钱包集成、时间锁机制

---

## 文件结构参考

```
MACOIN_JBC/
├── contracts/
│   ├── JinbaoProtocolNative.sol  # 主合约 (Native MC 版本)
│   ├── JBC.sol                   # JBC ERC20
│   └── MockMC.sol                # Mock MC
├── scripts/
│   ├── deploy.cjs                # 部署脚本
│   ├── dailyBurn.cjs             # ⚠️ 待创建
│   └── ...
├── test/
│   ├── JinbaoProtocol_v3.2.test.cjs
│   └── ...
├── components/                    # React 组件
│   ├── MiningPanel.tsx
│   ├── SwapPanel.tsx
│   ├── TeamLevel.tsx
│   ├── AdminPanel.tsx
│   ├── TransactionHistory.tsx
│   └── ...
├── constants.ts                   # ✅ 已修正 7/15/30 天
├── types.ts                       # TypeScript 类型
├── Web3Context.tsx               # Web3 状态管理
├── LanguageContext.tsx           # 多语言上下文
├── translations.ts               # 多语言字符串
└── ...
```

---

## 总结

**项目现状**: 智能合约与前端核心业务逻辑已完全对齐 (v3.2 Final)。  
**主要任务**: 完善 Keeper/自动化执行、UI 优化、测试验证。  
**预期完成**: 待定 (根据具体优先级安排)

---

*此文档作为项目需求的"唯一真实来源 (Single Source of Truth)"，所有后续开发应参照本文档进行。若有变更，请更新本文档并通知所有项目参与者。*
