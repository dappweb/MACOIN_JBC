export enum AppTab {
  HOME = 'HOME',
  MINING = 'MINING',
  TEAM = 'TEAM',
  SWAP = 'SWAP',
  HISTORY = 'HISTORY',
  EARNINGS = 'EARNINGS',
  ADMIN = 'ADMIN'
}

export interface MiningPlan {
  days: number;
  dailyRate: number; // Percentage (e.g., 2.0)
}

export interface TicketTier {
  amount: number; // MC Amount
  requiredLiquidity: number; // MC Amount
}

export interface UserStats {
  balanceMC: number;
  balanceJBC: number;
  totalRevenue: number;
  currentLevel: string;
  teamCount: number;
  activeInvestment: number; // Total value locked
  pendingRewards: number;
}

export interface TeamLevel {
  level: string;
  countRequired: number;
  reward: number; // Percentage
  desc: string;
}
