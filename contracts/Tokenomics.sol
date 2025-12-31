// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Tokenomics - 金宝协议代币经济模型
 * @author Jinbao Protocol Team
 * @notice 此文件定义了金宝协议的所有代币经济参数和常量
 * @dev 用于文档参考和参数配置
 * 
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     金宝协议 (Jinbao Protocol)                            ║
 * ║                        代币经济模型 v1.0                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/**
 * @title ITokenomicsConstants
 * @notice 代币经济常量接口
 */
interface ITokenomicsConstants {
    
    // ═══════════════════════════════════════════════════════════════════════
    //                           一、核心代币架构
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * MC (Master Coin) - 主代币
     * ────────────────────────────────────────
     * 类型: 原生链代币 (Native Token)
     * 特性: 不可增发、不可冻结
     * 用途:
     *   - 购买门票
     *   - 提供流动性质押
     *   - 收益结算 (50%)
     *   - AMM 交易对基础币
     */
    
    /**
     * JBC (Jinbao Coin) - 金本位代币
     * ────────────────────────────────────────
     * 类型: ERC20
     * 总供应量: 100,000,000 (1亿)
     * 初始分配:
     *   - 5,000,000 进入 LP 池
     *   - 95,000,000 用于挖矿奖励
     * 特性: 强通缩模型
     * 用途:
     *   - 收益结算 (50%)
     *   - AMM 交易
     *   - 价值锚定
     */
}

/**
 * @title TokenomicsLib
 * @notice 代币经济参数库
 * @dev 所有参数均为常量，可直接在合约中引用
 */
library TokenomicsLib {
    
    // ═══════════════════════════════════════════════════════════════════════
    //                           二、门票系统参数
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * 门票档位
     * ┌────────┬──────────┬─────────────────┬───────────────────┐
     * │ 档位   │ 金额     │ 收益上限 (3倍)  │ 流动性要求 (1.5倍) │
     * ├────────┼──────────┼─────────────────┼───────────────────┤
     * │ T1     │ 100 MC   │ 300 MC          │ 150 MC            │
     * │ T2     │ 300 MC   │ 900 MC          │ 450 MC            │
     * │ T3     │ 500 MC   │ 1,500 MC        │ 750 MC            │
     * │ T4     │ 1,000 MC │ 3,000 MC        │ 1,500 MC          │
     * └────────┴──────────┴─────────────────┴───────────────────┘
     */
    uint256 internal constant TICKET_TIER_1 = 100 ether;
    uint256 internal constant TICKET_TIER_2 = 300 ether;
    uint256 internal constant TICKET_TIER_3 = 500 ether;
    uint256 internal constant TICKET_TIER_4 = 1000 ether;
    
    /// @notice 收益上限倍数
    uint256 internal constant CAP_MULTIPLIER = 3;
    
    /// @notice 流动性要求倍数 (150% = 1.5倍)
    uint256 internal constant LIQUIDITY_MULTIPLIER = 150;
    uint256 internal constant LIQUIDITY_DIVISOR = 100;
    
    /// @notice 门票有效期 (72小时内需提供流动性)
    uint256 internal constant TICKET_FLEXIBILITY_DURATION = 72 hours;
    
    /**
     * 门票收入分配 (100% MC)
     * ┌─────────────────┬────────┬─────────────────────────┐
     * │ 用途            │ 比例   │ 流向                    │
     * ├─────────────────┼────────┼─────────────────────────┤
     * │ 直推奖励        │ 25%    │ 推荐人 (秒结)           │
     * │ 级差奖励池      │ 15%    │ 奖励池 (延迟结算)       │
     * │ 市场基金        │ 5%     │ 项目方钱包              │
     * │ 即时回购销毁    │ 5%     │ MC→JBC 100%销毁         │
     * │ 底池缓冲        │ 25%    │ LP 注入钱包             │
     * │ 国库托底        │ 25%    │ 国库钱包                │
     * └─────────────────┴────────┴─────────────────────────┘
     * 合计: 100%
     */
    uint256 internal constant DIRECT_REWARD_PERCENT = 25;
    uint256 internal constant LEVEL_REWARD_PERCENT = 15;
    uint256 internal constant MARKETING_PERCENT = 5;
    uint256 internal constant BUYBACK_PERCENT = 5;
    uint256 internal constant LP_INJECTION_PERCENT = 25;
    uint256 internal constant TREASURY_PERCENT = 25;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                         三、流动性挖矿参数
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * 挖矿周期与收益率
     * ┌────────┬─────────────┬──────────────┐
     * │ 周期   │ 日化率      │ 周期总收益   │
     * ├────────┼─────────────┼──────────────┤
     * │ 7天    │ 1.3333334%  │ ~9.33%       │
     * │ 15天   │ 1.6666667%  │ 25%          │
     * │ 30天   │ 2.0%        │ 60%          │
     * └────────┴─────────────┴──────────────┘
     * 
     * 收益结算: 50% MC + 50% JBC (按AMM价格折算)
     */
    uint256 internal constant CYCLE_7_DAYS = 7;
    uint256 internal constant CYCLE_15_DAYS = 15;
    uint256 internal constant CYCLE_30_DAYS = 30;
    
    /// @notice 日化收益率 (per billion, 即 / 1e9)
    /// @dev 7天周期: 13333334 / 1e9 = 1.3333334%
    uint256 internal constant RATE_7_DAYS = 13333334;
    
    /// @dev 15天周期: 16666667 / 1e9 = 1.6666667%
    uint256 internal constant RATE_15_DAYS = 16666667;
    
    /// @dev 30天周期: 20000000 / 1e9 = 2.0%
    uint256 internal constant RATE_30_DAYS = 20000000;
    
    /// @notice 收益分配比例
    uint256 internal constant MC_REWARD_RATIO = 50;   // 50% MC
    uint256 internal constant JBC_REWARD_RATIO = 50;  // 50% JBC
    
    /// @notice 赎回手续费 (基于门票金额)
    uint256 internal constant REDEMPTION_FEE_PERCENT = 1;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                         四、动态奖励体系
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * V等级系统 (基于团队人数)
     * ┌────────┬─────────────────┬──────────────┐
     * │ 等级   │ 团队人数        │ 极差收益比例 │
     * ├────────┼─────────────────┼──────────────┤
     * │ V0     │ 0-9             │ 0%           │
     * │ V1     │ 10-29           │ 5%           │
     * │ V2     │ 30-99           │ 10%          │
     * │ V3     │ 100-299         │ 15%          │
     * │ V4     │ 300-999         │ 20%          │
     * │ V5     │ 1,000-2,999     │ 25%          │
     * │ V6     │ 3,000-9,999     │ 30%          │
     * │ V7     │ 10,000-29,999   │ 35%          │
     * │ V8     │ 30,000-99,999   │ 40%          │
     * │ V9     │ 100,000+        │ 45%          │
     * └────────┴─────────────────┴──────────────┘
     */
    
    // V等级团队人数阈值
    uint256 internal constant V1_THRESHOLD = 10;
    uint256 internal constant V2_THRESHOLD = 30;
    uint256 internal constant V3_THRESHOLD = 100;
    uint256 internal constant V4_THRESHOLD = 300;
    uint256 internal constant V5_THRESHOLD = 1000;
    uint256 internal constant V6_THRESHOLD = 3000;
    uint256 internal constant V7_THRESHOLD = 10000;
    uint256 internal constant V8_THRESHOLD = 30000;
    uint256 internal constant V9_THRESHOLD = 100000;
    
    // V等级极差收益比例
    uint256 internal constant V0_PERCENT = 0;
    uint256 internal constant V1_PERCENT = 5;
    uint256 internal constant V2_PERCENT = 10;
    uint256 internal constant V3_PERCENT = 15;
    uint256 internal constant V4_PERCENT = 20;
    uint256 internal constant V5_PERCENT = 25;
    uint256 internal constant V6_PERCENT = 30;
    uint256 internal constant V7_PERCENT = 35;
    uint256 internal constant V8_PERCENT = 40;
    uint256 internal constant V9_PERCENT = 45;
    
    /**
     * 层级奖励
     * ────────────────────────────────────────
     * 最大层数: 15层
     * 每层奖励: 1%
     * 层数解锁条件:
     *   - 1个有效直推: 解锁5层
     *   - 2个有效直推: 解锁10层
     *   - 3个有效直推: 解锁15层
     */
    uint256 internal constant MAX_LEVEL_LAYERS = 15;
    uint256 internal constant LEVEL_REWARD_PER_LAYER = 1; // 1%
    
    uint256 internal constant DIRECTS_FOR_5_LAYERS = 1;
    uint256 internal constant DIRECTS_FOR_10_LAYERS = 2;
    uint256 internal constant DIRECTS_FOR_15_LAYERS = 3;
    
    /// @notice 级差奖励最大追溯层数
    uint256 internal constant MAX_DIFFERENTIAL_LAYERS = 20;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                       五、交易与销毁机制 (AMM)
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * 买入 JBC (MC → JBC)
     * ────────────────────────────────────────
     * 滑点税: 50%
     * 分配:
     *   - 50% → 用户获得
     *   - 50% → 直接销毁
     */
    uint256 internal constant SWAP_BUY_TAX = 50;
    
    /**
     * 卖出 JBC (JBC → MC)
     * ────────────────────────────────────────
     * 滑点税: 25%
     * 分配:
     *   - 75% → 兑换为 MC 给用户
     *   - 25% → 直接销毁
     */
    uint256 internal constant SWAP_SELL_TAX = 25;
    
    /**
     * 每日底池销毁
     * ────────────────────────────────────────
     * 频率: 每24小时
     * 销毁量: LP池中 1% 的 JBC
     * 去向: 永久销毁 (0x...dead)
     */
    uint256 internal constant DAILY_BURN_PERCENT = 1;
    uint256 internal constant DAILY_BURN_INTERVAL = 24 hours;
    
    /// @notice 黑洞地址 (销毁地址)
    address internal constant BLACK_HOLE = 0x000000000000000000000000000000000000dEaD;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                         六、安全参数
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice 最低流动性阈值
    uint256 internal constant MIN_LIQUIDITY = 1000 ether;
    
    /// @notice 最大价格影响 (10% = 1000 / 10000)
    uint256 internal constant MAX_PRICE_IMPACT = 1000;
    
    /// @notice 最大递归深度 (防止无限循环)
    uint256 internal constant MAX_RECURSION_DEPTH = 30;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                           辅助函数
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice 根据周期天数获取日化收益率
     * @param cycleDays 周期天数 (7, 15, 30)
     * @return rate 日化收益率 (per billion)
     */
    function getRate(uint256 cycleDays) internal pure returns (uint256 rate) {
        if (cycleDays == CYCLE_7_DAYS) return RATE_7_DAYS;
        if (cycleDays == CYCLE_15_DAYS) return RATE_15_DAYS;
        return RATE_30_DAYS;
    }
    
    /**
     * @notice 根据团队人数计算V等级
     * @param teamCount 团队总人数
     * @return level V等级 (0-9)
     * @return percent 极差收益比例
     */
    function getLevel(uint256 teamCount) internal pure returns (uint256 level, uint256 percent) {
        if (teamCount >= V9_THRESHOLD) return (9, V9_PERCENT);
        if (teamCount >= V8_THRESHOLD) return (8, V8_PERCENT);
        if (teamCount >= V7_THRESHOLD) return (7, V7_PERCENT);
        if (teamCount >= V6_THRESHOLD) return (6, V6_PERCENT);
        if (teamCount >= V5_THRESHOLD) return (5, V5_PERCENT);
        if (teamCount >= V4_THRESHOLD) return (4, V4_PERCENT);
        if (teamCount >= V3_THRESHOLD) return (3, V3_PERCENT);
        if (teamCount >= V2_THRESHOLD) return (2, V2_PERCENT);
        if (teamCount >= V1_THRESHOLD) return (1, V1_PERCENT);
        return (0, V0_PERCENT);
    }
    
    /**
     * @notice 根据有效直推数计算可解锁的层级奖励层数
     * @param activeDirects 有效直推数
     * @return layers 可解锁层数
     */
    function getLevelRewardLayers(uint256 activeDirects) internal pure returns (uint256 layers) {
        if (activeDirects >= DIRECTS_FOR_15_LAYERS) return 15;
        if (activeDirects >= DIRECTS_FOR_10_LAYERS) return 10;
        if (activeDirects >= DIRECTS_FOR_5_LAYERS) return 5;
        return 0;
    }
    
    /**
     * @notice 验证门票金额是否有效
     * @param amount 门票金额
     * @return valid 是否有效
     */
    function isValidTicketAmount(uint256 amount) internal pure returns (bool valid) {
        return amount == TICKET_TIER_1 ||
               amount == TICKET_TIER_2 ||
               amount == TICKET_TIER_3 ||
               amount == TICKET_TIER_4;
    }
    
    /**
     * @notice 验证质押周期是否有效
     * @param cycleDays 周期天数
     * @return valid 是否有效
     */
    function isValidCycle(uint256 cycleDays) internal pure returns (bool valid) {
        return cycleDays == CYCLE_7_DAYS ||
               cycleDays == CYCLE_15_DAYS ||
               cycleDays == CYCLE_30_DAYS;
    }
    
    /**
     * @notice 计算收益上限
     * @param ticketAmount 门票金额
     * @return cap 收益上限
     */
    function calculateCap(uint256 ticketAmount) internal pure returns (uint256 cap) {
        return ticketAmount * CAP_MULTIPLIER;
    }
    
    /**
     * @notice 计算所需流动性
     * @param ticketAmount 门票金额
     * @return required 所需流动性金额
     */
    function calculateRequiredLiquidity(uint256 ticketAmount) internal pure returns (uint256 required) {
        return (ticketAmount * LIQUIDITY_MULTIPLIER) / LIQUIDITY_DIVISOR;
    }
}

/**
 * @title JBCToken
 * @notice JBC 代币参数
 */
library JBCTokenParams {
    /// @notice 代币名称
    string internal constant NAME = "Jinbao Coin";
    
    /// @notice 代币符号
    string internal constant SYMBOL = "JBC";
    
    /// @notice 总供应量: 1亿
    uint256 internal constant TOTAL_SUPPLY = 100_000_000 ether;
    
    /// @notice 初始 LP 分配: 500万
    uint256 internal constant INITIAL_LP_AMOUNT = 5_000_000 ether;
    
    /// @notice 挖矿奖励池: 9500万
    uint256 internal constant MINING_POOL_AMOUNT = 95_000_000 ether;
    
    /// @notice 买入税率
    uint256 internal constant BUY_TAX = 50; // 50%
    
    /// @notice 卖出税率
    uint256 internal constant SELL_TAX = 25; // 25%
}

/**
 * @title TokenomicsSummary
 * @notice 代币经济模型摘要合约 (仅用于文档和参考)
 * 
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                              代币流动图                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║                         ┌──────────────┐                                  ║
 * ║                         │   用户钱包    │                                  ║
 * ║                         └──────┬───────┘                                  ║
 * ║                                │                                          ║
 * ║            ┌───────────────────┼───────────────────┐                      ║
 * ║            │                   │                   │                      ║
 * ║            ▼                   ▼                   ▼                      ║
 * ║     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              ║
 * ║     │  购买门票    │     │  流动性质押  │     │  AMM交换    │              ║
 * ║     │  (MC)       │     │  (MC)       │     │  (MC↔JBC)  │              ║
 * ║     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘              ║
 * ║            │                   │                   │                      ║
 * ║            ▼                   ▼                   ▼                      ║
 * ║     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              ║
 * ║     │ 25% 直推     │     │ 静态收益    │     │ 50%/25%税   │              ║
 * ║     │ 15% 级差池   │     │ 50%MC+50%JBC│     │  直接销毁    │              ║
 * ║     │ 5% 市场      │     │             │     │             │              ║
 * ║     │ 5% 回购销毁  │     │ 级差奖励    │     │ 每日1%销毁   │              ║
 * ║     │ 25% LP注入   │     │ 50%MC+50%JBC│     │             │              ║
 * ║     │ 25% 国库     │     │             │     │             │              ║
 * ║     └─────────────┘     └─────────────┘     └─────────────┘              ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * 
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                            关键参数汇总                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║ 参数              │ 值              │ 说明                               ║
 * ╠═══════════════════╪═════════════════╪════════════════════════════════════╣
 * ║ JBC 总供应量      │ 100,000,000     │ 固定不增发                         ║
 * ║ 买入税            │ 50%             │ 全部销毁                           ║
 * ║ 卖出税            │ 25%             │ 全部销毁                           ║
 * ║ 每日销毁          │ 1%              │ LP池JBC                            ║
 * ║ 门票有效期        │ 72小时          │ 需在此期间质押                     ║
 * ║ 最大层级          │ 15层            │ 层级奖励                           ║
 * ║ 最大级差层        │ 20层            │ 级差奖励                           ║
 * ║ 收益上限          │ 3倍             │ 门票金额                           ║
 * ║ 赎回手续费        │ 1%              │ 基于门票金额                       ║
 * ║ 最低流动性        │ 1,000           │ MIN_LIQUIDITY                      ║
 * ║ 最大滑点          │ 10%             │ MAX_PRICE_IMPACT                   ║
 * ╚═══════════════════╧═════════════════╧════════════════════════════════════╝
 */
contract TokenomicsSummary {
    using TokenomicsLib for uint256;
    
    /// @notice 获取门票档位
    function getTicketTiers() external pure returns (
        uint256 tier1,
        uint256 tier2,
        uint256 tier3,
        uint256 tier4
    ) {
        return (
            TokenomicsLib.TICKET_TIER_1,
            TokenomicsLib.TICKET_TIER_2,
            TokenomicsLib.TICKET_TIER_3,
            TokenomicsLib.TICKET_TIER_4
        );
    }
    
    /// @notice 获取门票分配比例
    function getTicketDistribution() external pure returns (
        uint256 directReward,
        uint256 levelReward,
        uint256 marketing,
        uint256 buyback,
        uint256 lpInjection,
        uint256 treasury
    ) {
        return (
            TokenomicsLib.DIRECT_REWARD_PERCENT,
            TokenomicsLib.LEVEL_REWARD_PERCENT,
            TokenomicsLib.MARKETING_PERCENT,
            TokenomicsLib.BUYBACK_PERCENT,
            TokenomicsLib.LP_INJECTION_PERCENT,
            TokenomicsLib.TREASURY_PERCENT
        );
    }
    
    /// @notice 获取挖矿参数
    function getMiningParams() external pure returns (
        uint256 cycle7Days,
        uint256 rate7Days,
        uint256 cycle15Days,
        uint256 rate15Days,
        uint256 cycle30Days,
        uint256 rate30Days
    ) {
        return (
            TokenomicsLib.CYCLE_7_DAYS,
            TokenomicsLib.RATE_7_DAYS,
            TokenomicsLib.CYCLE_15_DAYS,
            TokenomicsLib.RATE_15_DAYS,
            TokenomicsLib.CYCLE_30_DAYS,
            TokenomicsLib.RATE_30_DAYS
        );
    }
    
    /// @notice 获取V等级配置
    function getVLevelConfig(uint256 level) external pure returns (
        uint256 threshold,
        uint256 percent
    ) {
        if (level == 0) return (0, TokenomicsLib.V0_PERCENT);
        if (level == 1) return (TokenomicsLib.V1_THRESHOLD, TokenomicsLib.V1_PERCENT);
        if (level == 2) return (TokenomicsLib.V2_THRESHOLD, TokenomicsLib.V2_PERCENT);
        if (level == 3) return (TokenomicsLib.V3_THRESHOLD, TokenomicsLib.V3_PERCENT);
        if (level == 4) return (TokenomicsLib.V4_THRESHOLD, TokenomicsLib.V4_PERCENT);
        if (level == 5) return (TokenomicsLib.V5_THRESHOLD, TokenomicsLib.V5_PERCENT);
        if (level == 6) return (TokenomicsLib.V6_THRESHOLD, TokenomicsLib.V6_PERCENT);
        if (level == 7) return (TokenomicsLib.V7_THRESHOLD, TokenomicsLib.V7_PERCENT);
        if (level == 8) return (TokenomicsLib.V8_THRESHOLD, TokenomicsLib.V8_PERCENT);
        if (level == 9) return (TokenomicsLib.V9_THRESHOLD, TokenomicsLib.V9_PERCENT);
        revert("Invalid level");
    }
    
    /// @notice 获取交易税参数
    function getSwapTaxes() external pure returns (
        uint256 buyTax,
        uint256 sellTax,
        uint256 dailyBurnPercent
    ) {
        return (
            TokenomicsLib.SWAP_BUY_TAX,
            TokenomicsLib.SWAP_SELL_TAX,
            TokenomicsLib.DAILY_BURN_PERCENT
        );
    }
    
    /// @notice 获取安全参数
    function getSafetyParams() external pure returns (
        uint256 minLiquidity,
        uint256 maxPriceImpact,
        uint256 maxRecursionDepth,
        uint256 ticketFlexibilityDuration
    ) {
        return (
            TokenomicsLib.MIN_LIQUIDITY,
            TokenomicsLib.MAX_PRICE_IMPACT,
            TokenomicsLib.MAX_RECURSION_DEPTH,
            TokenomicsLib.TICKET_FLEXIBILITY_DURATION
        );
    }
    
    /// @notice 获取JBC代币参数
    function getJBCParams() external pure returns (
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint256 initialLP,
        uint256 miningPool
    ) {
        return (
            JBCTokenParams.NAME,
            JBCTokenParams.SYMBOL,
            JBCTokenParams.TOTAL_SUPPLY,
            JBCTokenParams.INITIAL_LP_AMOUNT,
            JBCTokenParams.MINING_POOL_AMOUNT
        );
    }
    
    /// @notice 计算用户等级
    function calculateUserLevel(uint256 teamCount) external pure returns (
        uint256 level,
        uint256 percent
    ) {
        return TokenomicsLib.getLevel(teamCount);
    }
    
    /// @notice 计算收益上限
    function calculateCap(uint256 ticketAmount) external pure returns (uint256) {
        return TokenomicsLib.calculateCap(ticketAmount);
    }
    
    /// @notice 计算所需流动性
    function calculateRequiredLiquidity(uint256 ticketAmount) external pure returns (uint256) {
        return TokenomicsLib.calculateRequiredLiquidity(ticketAmount);
    }
}
