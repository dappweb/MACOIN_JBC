# P-prod环境时间单位修复设计文档

## 概述

本设计文档详细说明如何将p-prod环境的时间单位从60秒修复为86400秒（1天），确保质押周期、奖励解锁和燃烧机制按照真实的商业时间运行。

## 架构

### 修复架构图
```
P-prod时间单位修复 + V4完整奖励机制系统
├── 合约升级层
│   ├── UUPS代理升级
│   ├── 时间单位参数修改 (60s → 86400s)
│   ├── 四种奖励机制实现
│   └── 安全验证机制
├── 奖励机制层
│   ├── 静态奖励 (质押挖矿) - 双币奖励
│   ├── 动态奖励 (推荐奖励) - 单币MC
│   ├── 燃烧机制 (纯销毁) - 不分红
│   └── 交易奖励 (AMM分红) - 基于销毁价值
├── 双币系统层
│   ├── MC代币 (门票、质押、奖励)
│   ├── JBC代币 (燃烧、兑换)
│   ├── 内置AMM (MC↔JBC兑换)
│   └── 销毁机制 (25%/50%销毁率)
├── 数据调整层
│   ├── 现有质押记录调整
│   ├── 奖励解锁时间重算
│   ├── 燃烧周期重置
│   └── 历史数据标记
├── 前端适配层
│   ├── 时间显示格式调整
│   ├── 四种奖励展示
│   ├── 用户通知系统
│   └── 状态同步机制
└── 验证测试层
    ├── 功能完整性测试
    ├── 四种奖励机制验证
    ├── 双币分发测试
    └── 用户体验测试
```

## 组件和接口

### 1. V4完整奖励机制组件

#### 1.1 四种奖励机制实现
```solidity
// JinbaoProtocolV4Ultimate.sol - 完整四种奖励机制
contract JinbaoProtocolV4Ultimate {
    
    // 1. 静态奖励 (质押挖矿) - 双币奖励
    function generateStaticRewards(address[] calldata users, uint256[] calldata amounts) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            if (amounts[i] > 0) {
                // 分发双币奖励 (50% MC + 50% JBC通过兑换池兑换)
                _distributeDualTokenReward(users[i], amounts[i], 4);
            }
        }
    }
    
    // 2. 动态奖励 (推荐奖励) - 单币MC
    function _distributeDynamicRewards(address buyer, uint256 amount) internal {
        // 直推奖励 (25% MC, 即时解锁)
        if (buyerInfo.referrer != address(0)) {
            uint256 directReward = (amount * 25) / 100;
            _recordDynamicReward(buyerInfo.referrer, directReward, 1, buyer, 0);
        }
        
        // 层级奖励 (每层1% MC, 即时解锁)
        // 级差奖励 (基于V等级, 30天解锁, 双币)
    }
    
    // 3. 燃烧机制 (纯销毁，不分红)
    function executeDailyBurn() external onlyOwner {
        uint256 jbcBalance = jbcToken.balanceOf(address(this));
        uint256 burnAmount = jbcBalance / 100; // 1%
        
        // 纯销毁到黑洞地址，不分红给用户
        require(jbcToken.transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount), "Burn failed");
        
        totalBurnedJBC += burnAmount;
        lastBurnTime = block.timestamp;
        currentBurnRound++;
        
        emit DailyBurnExecuted(currentBurnRound, burnAmount, 0); // 0参与者，因为不分红
    }
    
    // 4. 交易奖励 (AMM销毁分红)
    function swapMCToJBC(uint256 mcAmount) external {
        uint256 burnAmount = (mcAmount * 2500) / 10000; // 25%销毁
        uint256 swapAmount = mcAmount - burnAmount;
        
        // 销毁25%的MC到黑洞地址
        require(mcToken.transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount), "MC burn failed");
        
        uint256 jbcOutput = _calculateJBCOutput(swapAmount);
        require(jbcToken.transfer(msg.sender, jbcOutput), "JBC transfer failed");
        
        // 记录销毁价值用于分红
        _recordSwapBurnValue(burnAmount, true);
    }
    
    function swapJBCToMC(uint256 jbcAmount) external {
        uint256 burnAmount = (jbcAmount * 5000) / 10000; // 50%销毁
        uint256 swapAmount = jbcAmount - burnAmount;
        
        // 销毁50%的JBC到黑洞地址
        require(jbcToken.transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount), "JBC burn failed");
        
        uint256 mcOutput = _calculateMCOutput(swapAmount);
        require(mcToken.transfer(msg.sender, mcOutput), "MC transfer failed");
        
        // 记录销毁价值用于分红
        _recordSwapBurnValue(burnAmount, false);
    }
}
```

#### 1.2 双币奖励分发机制
```solidity
// 双币奖励分发器
contract DualTokenRewardDistributor {
    
    /**
     * @dev 分发双币奖励 (50% MC + 50% JBC通过兑换)
     * 用于静态奖励和级差奖励
     */
    function _distributeDualTokenReward(address user, uint256 totalAmount, uint8 rewardType) internal {
        uint256 mcAmount = totalAmount / 2;  // 50% MC直接获得
        uint256 mcForJBC = totalAmount - mcAmount;  // 50% MC用于兑换JBC
        
        // 自动兑换50%的MC为JBC
        uint256 jbcAmount = _autoSwapMCToJBC(user, mcForJBC);
        
        // 记录MC奖励
        if (mcAmount > 0) {
            userDynamicRewards[user].push(DynamicReward({
                amount: mcAmount,
                timestamp: block.timestamp,
                sourceType: rewardType,
                fromUser: user,
                claimed: false,
                unlockTime: rewardType == 3 ? block.timestamp + (30 * SECONDS_IN_UNIT) : block.timestamp
            }));
        }
        
        // 记录JBC奖励 (通过兑换获得)
        if (jbcAmount > 0) {
            userBurnRewards[user].push(BurnReward({
                amount: jbcAmount,
                timestamp: block.timestamp,
                burnRound: currentBurnRound,
                claimed: false
            }));
        }
    }
    
    /**
     * @dev 自动兑换MC为JBC (用于双币奖励)
     */
    function _autoSwapMCToJBC(address user, uint256 mcAmount) internal returns (uint256 jbcAmount) {
        if (mcAmount == 0) return 0;
        
        // 计算JBC输出 (使用内置汇率)
        jbcAmount = _calculateJBCOutput(mcAmount);
        
        // 记录自动兑换事件
        emit AutoSwapExecuted(user, address(mcToken), address(jbcToken), mcAmount, jbcAmount);
        
        return jbcAmount;
    }
}
```

#### 1.3 基于流动性的收益率计算器
```solidity
// 收益率计算器
contract YieldRateCalculator {
    
    /**
     * @dev 获取基于流动性计算的日收益率
     */
    function _getDailyYield(uint256 cycleDays) internal pure returns (uint256) {
        if (cycleDays == 7) return 133;   // 1.33333% ≈ 133基点
        if (cycleDays == 15) return 167;  // 1.666666% ≈ 167基点
        if (cycleDays == 30) return 200;  // 2.0% = 200基点
        return 133; // 默认1.33333%
    }
    
    /**
     * @dev 计算质押收益
     */
    function calculateStakeReward(uint256 amount, uint256 cycleDays, uint256 days) public pure returns (uint256) {
        uint256 dailyYield = _getDailyYield(cycleDays);
        return (amount * dailyYield * days) / 10000; // 基点转换
    }
}
```

#### 1.4 燃烧机制组件 (纯销毁，不分红)
```solidity
// 燃烧机制管理器
contract BurnMechanismManager {
    
    uint256 public constant BURN_INTERVAL = 86400; // 24小时 (真实天数)
    uint256 public lastBurnTime;
    uint256 public currentBurnRound;
    uint256 public totalBurnedJBC;
    
    /**
     * @dev 执行日燃烧机制 (纯销毁，不分红)
     */
    function executeDailyBurn() external onlyOwner {
        require(block.timestamp >= lastBurnTime + BURN_INTERVAL, "Burn interval not reached");
        
        uint256 jbcBalance = jbcToken.balanceOf(address(this));
        require(jbcBalance > 0, "No JBC to burn");
        
        // 计算燃烧金额 (例如：余额的1%)
        uint256 burnAmount = jbcBalance / 100;
        
        // 执行燃烧 (转移到黑洞地址) - 纯销毁，不分红给用户
        require(jbcToken.transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount), "Burn failed");
        
        // 更新燃烧状态 (不分发奖励给用户)
        totalBurnedJBC += burnAmount;
        lastBurnTime = block.timestamp;
        currentBurnRound++;
        
        emit DailyBurnExecuted(currentBurnRound, burnAmount); // 纯销毁事件
    }
    
    /**
     * @dev 获取下次燃烧时间
     */
    function getNextBurnTime() external view returns (uint256) {
        return lastBurnTime + BURN_INTERVAL;
    }
    
    /**
     * @dev 获取燃烧统计
     */
    function getBurnStats() external view returns (
        uint256 _totalBurnedJBC,
        uint256 _currentBurnRound,
        uint256 _nextBurnTime,
        bool _canBurnNow
    ) {
        _totalBurnedJBC = totalBurnedJBC;
        _currentBurnRound = currentBurnRound;
        _nextBurnTime = lastBurnTime + BURN_INTERVAL;
        _canBurnNow = block.timestamp >= _nextBurnTime;
    }
}
```

#### 1.5 AMM交易奖励组件 (基于销毁价值分红)
```solidity
// AMM交易奖励管理器
contract AMMTradingRewardManager {
    
    // 销毁配置
    uint256 public constant SELL_BURN_RATE = 2500;  // 25% = 2500 基点
    uint256 public constant BUY_BURN_RATE = 5000;   // 50% = 5000 基点
    uint256 public constant BASIS_POINTS = 10000;   // 100% = 10000 基点
    
    // 销毁统计
    uint256 public totalMCBurned;     // 总销毁MC数量
    uint256 public totalJBCBurned;    // 总销毁JBC数量
    uint256 public lastRewardTime;    // 最后分红时间
    
    /**
     * @dev MC → JBC 闪兑 (卖出MC，25%销毁)
     */
    function swapMCToJBC(uint256 mcAmount) external nonReentrant whenNotPaused {
        require(mcAmount > 0, "Amount must be greater than 0");
        require(mcToken.balanceOf(msg.sender) >= mcAmount, "Insufficient MC balance");
        
        // 计算销毁金额 (25%)
        uint256 burnAmount = (mcAmount * SELL_BURN_RATE) / BASIS_POINTS;
        uint256 swapAmount = mcAmount - burnAmount;
        
        // 转移MC到合约
        require(mcToken.transferFrom(msg.sender, address(this), mcAmount), "MC transfer failed");
        
        // 销毁25%的MC (转移到黑洞地址)
        require(mcToken.transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount), "MC burn failed");
        
        // 计算JBC输出
        uint256 jbcOutput = _calculateJBCOutput(swapAmount);
        
        // 转移JBC给用户
        require(jbcToken.transfer(msg.sender, jbcOutput), "JBC transfer failed");
        
        // 记录销毁价值用于分红
        _recordSwapBurnValue(burnAmount, true); // true = MC销毁
        
        emit SwapExecuted(msg.sender, address(mcToken), address(jbcToken), mcAmount, jbcOutput, burnAmount);
    }
    
    /**
     * @dev JBC → MC 闪兑 (买入MC，50%销毁JBC)
     */
    function swapJBCToMC(uint256 jbcAmount) external nonReentrant whenNotPaused {
        require(jbcAmount > 0, "Amount must be greater than 0");
        require(jbcToken.balanceOf(msg.sender) >= jbcAmount, "Insufficient JBC balance");
        
        // 计算销毁金额 (50%)
        uint256 burnAmount = (jbcAmount * BUY_BURN_RATE) / BASIS_POINTS;
        uint256 swapAmount = jbcAmount - burnAmount;
        
        // 转移JBC到合约
        require(jbcToken.transferFrom(msg.sender, address(this), jbcAmount), "JBC transfer failed");
        
        // 销毁50%的JBC (转移到黑洞地址)
        require(jbcToken.transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount), "JBC burn failed");
        
        // 计算MC输出
        uint256 mcOutput = _calculateMCOutput(swapAmount);
        
        // 转移MC给用户
        require(mcToken.transfer(msg.sender, mcOutput), "MC transfer failed");
        
        // 记录销毁价值用于分红
        _recordSwapBurnValue(burnAmount, false); // false = JBC销毁
        
        emit SwapExecuted(msg.sender, address(jbcToken), address(mcToken), jbcAmount, mcOutput, burnAmount);
    }
    
    /**
     * @dev 记录销毁价值
     */
    function _recordSwapBurnValue(uint256 burnAmount, bool isMC) internal {
        if (isMC) {
            totalMCBurned += burnAmount;
        } else {
            totalJBCBurned += burnAmount;
        }
    }
    
    /**
     * @dev 分发闪兑销毁奖励 (基于生态参与度)
     */
    function distributeSwapRewards() external onlyOwner {
        require(block.timestamp >= lastRewardTime + BURN_INTERVAL, "Reward interval not reached");
        
        // 计算总销毁价值 (MC和JBC等值计算)
        uint256 totalBurnValue = totalMCBurned + (totalJBCBurned / 2); // JBC按1:2汇率转换为MC等值
        require(totalBurnValue > 0, "No burn value to distribute");
        
        // 重置销毁统计
        totalMCBurned = 0;
        totalJBCBurned = 0;
        lastRewardTime = block.timestamp;
        
        emit SwapRewardsDistributed(totalBurnValue, totalUsers);
    }
    
    /**
     * @dev 管理员分发交易奖励 (基于生态参与度)
     */
    function distributeTradingRewards(address[] calldata users, uint256[] calldata amounts, address tokenAddress) external onlyOwner {
        require(users.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (amounts[i] > 0) {
                userTradingRewards[users[i]].push(TradingReward({
                    amount: amounts[i],
                    timestamp: block.timestamp,
                    tokenAddress: tokenAddress,
                    claimed: false
                }));
                
                emit TradingRewardGenerated(users[i], amounts[i], tokenAddress);
            }
        }
    }
}
```

### 2. 合约升级组件

#### 1.1 时间单位修复合约
```solidity
// JinbaoProtocolV3TimeUnitFix.sol
contract JinbaoProtocolV3TimeUnitFix is JinbaoProtocolV3Standalone {
    
    // 新的时间单位常量
    uint256 public constant SECONDS_IN_UNIT_V4 = 86400; // 1天 = 86400秒
    
    // 升级标记
    bool public timeUnitFixed;
    uint256 public fixTimestamp;
    
    // 数据迁移状态
    mapping(address => bool) public userDataMigrated;
    uint256 public totalUsersMigrated;
    
    /**
     * @dev V4升级初始化 - 修复时间单位
     */
    function initializeV4() external reinitializer(4) {
        // 更新时间单位
        _updateTimeUnit();
        
        // 标记修复完成
        timeUnitFixed = true;
        fixTimestamp = block.timestamp;
        
        emit TimeUnitFixed(SECONDS_IN_UNIT_V4, block.timestamp);
    }
    
    /**
     * @dev 获取当前有效的时间单位
     */
    function getEffectiveSecondsInUnit() public view returns (uint256) {
        return timeUnitFixed ? SECONDS_IN_UNIT_V4 : 60;
    }
    
    /**
     * @dev 迁移用户数据到新时间单位
     */
    function migrateUserData(address user) external onlyOwner {
        require(!userDataMigrated[user], "User already migrated");
        
        _migrateUserStakes(user);
        _migrateUserRewards(user);
        
        userDataMigrated[user] = true;
        totalUsersMigrated++;
        
        emit UserDataMigrated(user, block.timestamp);
    }
    
    /**
     * @dev 批量迁移用户数据
     */
    function batchMigrateUsers(address[] calldata users) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            if (!userDataMigrated[users[i]]) {
                _migrateUserStakes(users[i]);
                _migrateUserRewards(users[i]);
                userDataMigrated[users[i]] = true;
                totalUsersMigrated++;
            }
        }
    }
    
    /**
     * @dev 内部函数：迁移用户质押数据
     */
    function _migrateUserStakes(address user) internal {
        // 重新计算质押到期时间
        // 原来的分钟级别转换为天级别
        // 例如：7分钟 -> 7天
    }
    
    /**
     * @dev 内部函数：迁移用户奖励数据
     */
    function _migrateUserRewards(address user) internal {
        // 重新计算动态奖励解锁时间
        // 30分钟解锁 -> 30天解锁
    }
    
    // 事件定义
    event TimeUnitFixed(uint256 newSecondsInUnit, uint256 timestamp);
    event UserDataMigrated(address indexed user, uint256 timestamp);
}
```

#### 1.2 升级部署脚本
```javascript
// scripts/deploy-time-unit-fix.cjs
const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🔧 开始部署P-prod时间单位修复...");
    
    // 1. 备份当前状态
    await backupCurrentState();
    
    // 2. 部署新实现合约
    const JinbaoProtocolV3TimeUnitFix = await ethers.getContractFactory("JinbaoProtocolV3TimeUnitFix");
    
    // 3. 升级代理合约
    const proxyAddress = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
    const upgraded = await upgrades.upgradeProxy(proxyAddress, JinbaoProtocolV3TimeUnitFix);
    
    // 4. 初始化V4
    await upgraded.initializeV4();
    
    // 5. 验证升级结果
    await verifyUpgrade(upgraded);
    
    console.log("✅ P-prod时间单位修复完成");
}

async function backupCurrentState() {
    // 备份关键数据
    const backupData = {
        timestamp: Date.now(),
        contractState: await getCurrentContractState(),
        userStakes: await getAllUserStakes(),
        dynamicRewards: await getAllDynamicRewards()
    };
    
    fs.writeFileSync(
        `backup-before-time-fix-${backupData.timestamp}.json`,
        JSON.stringify(backupData, null, 2)
    );
}
```

### 2. 数据迁移组件

#### 2.1 质押数据迁移器
```typescript
class StakeDataMigrator {
    async migrateStakeData(userAddress: string): Promise<void> {
        const stakes = await this.getUserStakes(userAddress);
        
        for (const stake of stakes) {
            if (stake.active && !stake.migrated) {
                // 重新计算到期时间
                const newEndTime = this.convertMinutesToDays(stake.endTime);
                await this.updateStakeEndTime(stake.id, newEndTime);
            }
        }
    }
    
    private convertMinutesToDays(minuteBasedTime: number): number {
        // 将基于分钟的时间转换为基于天的时间
        // 考虑到用户的合理预期
        const currentTime = Math.floor(Date.now() / 1000);
        const remainingMinutes = Math.max(0, minuteBasedTime - currentTime);
        
        // 将剩余分钟转换为对应的天数
        const remainingDays = Math.ceil(remainingMinutes / 60); // 分钟转天
        return currentTime + (remainingDays * 86400); // 天转秒
    }
}
```

#### 2.2 动态奖励迁移器
```typescript
class DynamicRewardMigrator {
    async migrateDynamicRewards(userAddress: string): Promise<void> {
        const rewards = await this.getUserDynamicRewards(userAddress);
        
        for (const reward of rewards) {
            if (!reward.claimed && reward.sourceType === 3) { // 极差奖励
                // 重新计算30天解锁时间
                const newUnlockTime = this.convertMinutesToDays(reward.unlockTime);
                await this.updateRewardUnlockTime(reward.id, newUnlockTime);
            }
        }
    }
    
    private convertMinutesToDays(minuteBasedUnlock: number): number {
        const currentTime = Math.floor(Date.now() / 1000);
        const remainingMinutes = Math.max(0, minuteBasedUnlock - currentTime);
        
        // 30分钟解锁 -> 30天解锁
        const remainingDays = Math.max(1, Math.ceil(remainingMinutes / 60));
        return currentTime + (remainingDays * 86400);
    }
}
```

### 3. 前端适配组件

#### 3.1 时间显示格式化器
```typescript
class TimeDisplayFormatter {
    formatStakingCountdown(endTime: number): string {
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, endTime - now);
        
        if (remaining === 0) return "已到期";
        
        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        
        if (days > 0) {
            return `${days}天 ${hours}小时 ${minutes}分钟`;
        } else if (hours > 0) {
            return `${hours}小时 ${minutes}分钟`;
        } else {
            return `${minutes}分钟`;
        }
    }
    
    formatDynamicRewardUnlock(unlockTime: number): string {
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, unlockTime - now);
        
        if (remaining === 0) return "可提取";
        
        const days = Math.ceil(remaining / 86400);
        return `${days}天后解锁`;
    }
}
```

#### 3.2 用户通知组件
```typescript
class TimeUnitFixNotification {
    showPreUpgradeNotice(): void {
        toast.info(
            "📢 系统升级通知：为提供更好的投资体验，质押周期将调整为真实天数。" +
            "升级期间可能短暂影响服务，您的资产安全不受影响。",
            { duration: 10000 }
        );
    }
    
    showPostUpgradeNotice(): void {
        toast.success(
            "✅ 升级完成：质押周期已调整为真实天数。" +
            "7天质押现在是真正的7天，您的投资更符合预期！",
            { duration: 8000 }
        );
    }
    
    showDataMigrationStatus(progress: number): void {
        toast.loading(
            `🔄 数据迁移中... ${progress}% 完成`,
            { id: 'migration-progress' }
        );
    }
}
```

### 4. 验证测试组件

#### 4.1 功能验证器
```typescript
class TimeUnitFixValidator {
    async validateTimeUnitFix(): Promise<ValidationResult> {
        const results: ValidationResult = {
            timeUnitCorrect: false,
            stakingPeriodsCorrect: false,
            rewardUnlockCorrect: false,
            burnCycleCorrect: false,
            dataIntegrityMaintained: false
        };
        
        // 验证时间单位
        const secondsInUnit = await this.contract.getEffectiveSecondsInUnit();
        results.timeUnitCorrect = secondsInUnit === 86400;
        
        // 验证质押周期
        results.stakingPeriodsCorrect = await this.validateStakingPeriods();
        
        // 验证奖励解锁
        results.rewardUnlockCorrect = await this.validateRewardUnlock();
        
        // 验证燃烧周期
        results.burnCycleCorrect = await this.validateBurnCycle();
        
        // 验证数据完整性
        results.dataIntegrityMaintained = await this.validateDataIntegrity();
        
        return results;
    }
    
    private async validateStakingPeriods(): Promise<boolean> {
        // 创建测试质押，验证7天是否真的是7天
        const testStake = await this.createTestStake(7); // 7天
        const expectedEndTime = Math.floor(Date.now() / 1000) + (7 * 86400);
        const actualEndTime = testStake.endTime;
        
        // 允许小幅误差（几分钟内）
        return Math.abs(actualEndTime - expectedEndTime) < 300;
    }
}
```

## 数据模型

### 升级状态数据结构
```typescript
interface TimeUnitFixStatus {
    isFixed: boolean;
    fixTimestamp: number;
    oldSecondsInUnit: number;
    newSecondsInUnit: number;
    migrationProgress: {
        totalUsers: number;
        migratedUsers: number;
        percentage: number;
    };
    validationResults: ValidationResult;
}

interface ValidationResult {
    timeUnitCorrect: boolean;
    stakingPeriodsCorrect: boolean;
    rewardUnlockCorrect: boolean;
    burnCycleCorrect: boolean;
    dataIntegrityMaintained: boolean;
}

interface MigrationPlan {
    phase1: "备份数据";
    phase2: "部署升级合约";
    phase3: "执行UUPS升级";
    phase4: "初始化V4";
    phase5: "迁移用户数据";
    phase6: "验证功能";
    phase7: "用户通知";
}
```

## 错误处理

### 升级失败处理
```typescript
class UpgradeErrorHandler {
    async handleUpgradeFailure(error: Error): Promise<void> {
        console.error("升级失败:", error);
        
        // 1. 停止升级过程
        await this.pauseUpgrade();
        
        // 2. 评估损害
        const damage = await this.assessDamage();
        
        // 3. 执行回滚（如果可能）
        if (damage.canRollback) {
            await this.rollbackUpgrade();
        }
        
        // 4. 通知管理员
        await this.notifyAdministrators(error, damage);
        
        // 5. 用户通知
        toast.error("升级暂时失败，系统正在恢复中，您的资产安全。");
    }
    
    async rollbackUpgrade(): Promise<void> {
        // 回滚到备份状态
        const backup = await this.loadLatestBackup();
        await this.restoreFromBackup(backup);
        
        toast.info("系统已安全回滚到升级前状态。");
    }
}
```

## 测试策略

### 升级测试计划
```typescript
describe('P-prod Time Unit Fix', () => {
    it('should upgrade SECONDS_IN_UNIT from 60 to 86400', async () => {
        // 验证时间单位修复
    });
    
    it('should migrate existing stakes to day-based periods', async () => {
        // 验证质押数据迁移
    });
    
    it('should update dynamic reward unlock times', async () => {
        // 验证动态奖励时间调整
    });
    
    it('should maintain data integrity during upgrade', async () => {
        // 验证数据完整性
    });
    
    it('should handle upgrade failures gracefully', async () => {
        // 验证错误处理和回滚
    });
});
```

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

基于prework分析，以下是从需求中提取的可测试正确性属性：

### 属性1: 质押周期时间单位正确性
*对于任何* 质押操作（7天/15天/30天），计算的结束时间应基于86400秒的时间单位而不是60秒
**验证: 需求1.1, 1.2, 1.3**

### 属性2: 极差奖励解锁时间正确性
*对于任何* 极差奖励，30天解锁期应使用86400秒作为基础单位计算，确保真实的30天解锁期
**验证: 需求2.1**

### 属性3: 静态奖励双币分发正确性
*对于任何* 静态奖励分发，应分配50% MC代币和50% JBC代币（通过兑换池兑换获得）
**验证: 需求9.1, 10.1**

### 属性4: 级差奖励双币分发正确性
*对于任何* 级差奖励分发，应分配50% MC代币和50% JBC代币（通过兑换池兑换获得）
**验证: 需求10.2**

### 属性5: 燃烧机制纯销毁正确性
*对于任何* 日燃烧操作，JBC应转移到黑洞地址而不是分配给任何用户
**验证: 需求11.1**

### 属性6: AMM销毁机制正确性
*对于任何* MC→JBC兑换，应销毁25%的MC到黑洞地址；*对于任何* JBC→MC兑换，应销毁50%的JBC到黑洞地址
**验证: 需求12.1, 12.2**

### 属性7: 数据迁移完整性
*对于任何* 用户数据，迁移后应保持逻辑一致性且不丢失
**验证: 需求5.1, 5.2**

### 属性8: 升级安全性
*对于任何* 升级操作，应有完整的备份和回滚机制
**验证: 需求5.3, 5.4**

## 部署计划

### 分阶段部署策略
```
Phase 1: 准备阶段 (2小时)
├── 数据备份
├── 合约编译验证
├── 测试环境验证
└── 用户预通知

Phase 2: 升级阶段 (1小时)
├── 部署新实现合约
├── 执行UUPS升级
├── 初始化V4功能
└── 基础功能验证

Phase 3: 迁移阶段 (4小时)
├── 批量用户数据迁移
├── 质押记录调整
├── 奖励时间重算
└── 迁移进度监控

Phase 4: 验证阶段 (2小时)
├── 全面功能测试
├── 数据一致性检查
├── 性能影响评估
└── 用户体验验证

Phase 5: 完成阶段 (1小时)
├── 用户通知发送
├── 文档更新
├── 监控系统配置
└── 技术支持准备
```

## 风险评估

### 高风险项
1. **数据丢失风险**: 升级过程中可能丢失用户数据
   - 缓解措施: 完整备份 + 分批迁移 + 验证机制

2. **时间计算错误**: 迁移后时间计算可能不准确
   - 缓解措施: 充分测试 + 逐步验证 + 快速修复

3. **用户体验中断**: 升级期间服务可能中断
   - 缓解措施: 预通知 + 快速升级 + 状态监控

### 中风险项
1. **前端显示异常**: 时间格式可能显示错误
   - 缓解措施: 前端同步更新 + 格式验证

2. **合约兼容性**: 新旧版本可能存在兼容问题
   - 缓解措施: 充分测试 + 渐进升级

这个设计确保了p-prod环境时间单位修复的安全性和可靠性，同时最小化对用户的影响。