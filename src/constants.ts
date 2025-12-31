import { MiningPlan, TeamLevel, TicketTier } from "./types";

/**
 * 金宝协议 V4 代币经济常量
 * ═══════════════════════════════════════════════════════════════════════
 * 与合约 TokenomicsLib 保持同步
 */

// 协议版本
export const PROTOCOL_VERSION = "V4";

// ═══════════════════════════════════════════════════════════════════════
//                           门票系统
// ═══════════════════════════════════════════════════════════════════════

/**
 * 门票档位
 * - amount: 门票金额 (MC)
 * - requiredLiquidity: 所需流动性 = amount × 1.5
 * - cap: 收益上限 = amount × 3
 */
export const TICKET_TIERS: TicketTier[] = [
  { amount: 100, requiredLiquidity: 150 },
  { amount: 300, requiredLiquidity: 450 },
  { amount: 500, requiredLiquidity: 750 },
  { amount: 1000, requiredLiquidity: 1500 },
];

// 收益上限倍数
export const CAP_MULTIPLIER = 3;

// 流动性倍数
export const LIQUIDITY_MULTIPLIER = 1.5;

// 门票有效期 (小时)
export const TICKET_FLEXIBILITY_HOURS = 72;

// ═══════════════════════════════════════════════════════════════════════
//                           挖矿参数
// ═══════════════════════════════════════════════════════════════════════

/**
 * 挖矿周期
 * - days: 周期天数
 * - dailyRate: 日化收益率 (%)
 * - totalRate: 周期总收益率 = dailyRate × days
 */
export const MINING_PLANS: MiningPlan[] = [
  { days: 7, dailyRate: 1.3333334 },   // 总收益 ~9.33%
  { days: 15, dailyRate: 1.6666667 },  // 总收益 25%
  { days: 30, dailyRate: 2.0 },        // 总收益 60%
];

// 收益分配比例
export const REWARD_MC_RATIO = 50;   // 50% MC
export const REWARD_JBC_RATIO = 50;  // 50% JBC

// 赎回手续费
export const REDEMPTION_FEE_PERCENT = 1;

// ═══════════════════════════════════════════════════════════════════════
//                           V等级系统
// ═══════════════════════════════════════════════════════════════════════

/**
 * V等级配置
 * - level: 等级名称 (V0-V9)
 * - countRequired: 团队人数要求
 * - reward: 极差收益比例 (%)
 */
export const TEAM_LEVELS: TeamLevel[] = [
  { level: 'V0', countRequired: 0, reward: 0, desc: '无极差收益' },
  { level: 'V1', countRequired: 10, reward: 5, desc: '极差奖励' },
  { level: 'V2', countRequired: 30, reward: 10, desc: '极差奖励' },
  { level: 'V3', countRequired: 100, reward: 15, desc: '极差奖励' },
  { level: 'V4', countRequired: 300, reward: 20, desc: '极差奖励' },
  { level: 'V5', countRequired: 1000, reward: 25, desc: '极差奖励' },
  { level: 'V6', countRequired: 3000, reward: 30, desc: '极差奖励' },
  { level: 'V7', countRequired: 10000, reward: 35, desc: '极差奖励' },
  { level: 'V8', countRequired: 30000, reward: 40, desc: '极差奖励' },
  { level: 'V9', countRequired: 100000, reward: 45, desc: '极差奖励' },
];

// 层级奖励参数
export const MAX_LEVEL_LAYERS = 15;
export const LEVEL_REWARD_PER_LAYER = 1; // 1%
export const MAX_DIFFERENTIAL_LAYERS = 20;

// ═══════════════════════════════════════════════════════════════════════
//                           交易税率
// ═══════════════════════════════════════════════════════════════════════

export const SWAP_BUY_TAX = 50;   // 买入税 50%
export const SWAP_SELL_TAX = 25;  // 卖出税 25%
export const DAILY_BURN_PERCENT = 1; // 每日销毁 1%

// ═══════════════════════════════════════════════════════════════════════
//                           门票分配比例
// ═══════════════════════════════════════════════════════════════════════

export const TICKET_DISTRIBUTION = {
  directReward: 25,    // 直推奖励
  levelReward: 15,     // 级差奖励池
  marketing: 5,        // 市场基金
  buyback: 5,          // 即时回购销毁
  lpInjection: 25,     // 底池缓冲
  treasury: 25,        // 国库托底
};

export const MOCK_USER_STATS = {
  balanceMC: 5420.50,
  balanceJBC: 125.00,
  totalRevenue: 8500.00,
  currentLevel: 'V2',
  teamCount: 42,
  activeInvestment: 1000,
  pendingRewards: 45.2,
};

// Cloudflare Pages Functions API URL
export const API_BASE_URL = window.location.origin; 
