import { MiningPlan, TeamLevel, TicketTier } from "./types";

export const TICKET_TIERS: TicketTier[] = [
  { amount: 100, requiredLiquidity: 150 },
  { amount: 300, requiredLiquidity: 450 },
  { amount: 500, requiredLiquidity: 750 },
  { amount: 1000, requiredLiquidity: 1500 },
];

export const MINING_PLANS: MiningPlan[] = [
  { days: 3, dailyRate: 2.0 },
  { days: 5, dailyRate: 2.5 },
  { days: 7, dailyRate: 3.0 },
];

export const TEAM_LEVELS: TeamLevel[] = [
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

export const MOCK_USER_STATS = {
  balanceMC: 5420.50,
  balanceJBC: 125.00,
  totalRevenue: 8500.00,
  currentLevel: 'V2',
  teamCount: 42,
  activeInvestment: 1000,
  pendingRewards: 45.2,
};

// Cloudflare Worker API URL (Replace with actual deployed URL)
export const API_BASE_URL = "https://api.macoin-jbc.com"; 
