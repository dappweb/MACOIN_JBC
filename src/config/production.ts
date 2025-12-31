/**
 * 生产环境配置
 * 主要修改: 质押周期从分钟改为天数计算
 */

// 🔥 生产环境关键配置
export const PRODUCTION_CONFIG = {
  // 时间单位配置
  SECONDS_IN_UNIT: 86400, // 1天 = 86400秒 (生产环境)
  TIME_UNIT: 'days',      // 显示单位: 天
  RATE_UNIT: 'daily',     // 收益率单位: 每日

  // 质押周期配置 (天数)
  STAKING_PERIODS: [
    {
      days: 7,
      label: '7天',
      rate: 1.3333334,     // 1.33% 每日
      totalReturn: 9.33,   // 总收益约 9.33%
      ratePerBillion: 13333334
    },
    {
      days: 15,
      label: '15天', 
      rate: 1.6666667,     // 1.67% 每日
      totalReturn: 25.0,   // 总收益约 25%
      ratePerBillion: 16666667
    },
    {
      days: 30,
      label: '30天',
      rate: 2.0,           // 2.00% 每日
      totalReturn: 60.0,   // 总收益约 60%
      ratePerBillion: 20000000
    }
  ],

  // 合约地址 (生产环境)
  CONTRACTS: {
    MC_TOKEN: process.env.VITE_MC_CONTRACT_ADDRESS || '',
    JBC_TOKEN: process.env.VITE_JBC_CONTRACT_ADDRESS || '',
    PROTOCOL: process.env.VITE_PROTOCOL_CONTRACT_ADDRESS || ''
  },

  // 网络配置
  NETWORK: {
    CHAIN_ID: 88813,
    CHAIN_NAME: 'MC Chain',
    RPC_URL: 'https://chain.mcerscan.com/',
    EXPLORER_URL: 'https://mcerscan.com'
  }
};

/**
 * 时间计算工具函数 - 生产环境版本
 */
export class ProductionTimeUtils {
  
  /**
   * 计算质押剩余时间 (天数)
   */
  static calculateRemainingTime(startTime: number, cycleDays: number): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } {
    const now = Math.floor(Date.now() / 1000);
    const endTime = startTime + (cycleDays * PRODUCTION_CONFIG.SECONDS_IN_UNIT);
    const remaining = endTime - now;

    if (remaining <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true
      };
    }

    const days = Math.floor(remaining / PRODUCTION_CONFIG.SECONDS_IN_UNIT);
    const hours = Math.floor((remaining % PRODUCTION_CONFIG.SECONDS_IN_UNIT) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;

    return {
      days,
      hours,
      minutes,
      seconds,
      isExpired: false
    };
  }

  /**
   * 计算已经过的天数
   */
  static calculateDaysPassed(startTime: number): number {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - startTime;
    return Math.floor(elapsed / PRODUCTION_CONFIG.SECONDS_IN_UNIT);
  }

  /**
   * 计算质押收益 (生产环境)
   */
  static calculateStakeRewards(
    amount: number,
    startTime: number,
    cycleDays: number,
    paidAmount: number = 0
  ): {
    daysPassed: number;
    totalEarned: number;
    pendingRewards: number;
    dailyRate: number;
    isCompleted: boolean;
  } {
    const daysPassed = Math.min(
      this.calculateDaysPassed(startTime),
      cycleDays
    );

    // 获取日收益率
    const periodConfig = PRODUCTION_CONFIG.STAKING_PERIODS.find(p => p.days === cycleDays);
    if (!periodConfig) {
      throw new Error(`Unsupported staking period: ${cycleDays} days`);
    }

    const dailyRate = periodConfig.rate / 100; // 转换为小数
    const totalEarned = amount * dailyRate * daysPassed;
    const pendingRewards = Math.max(0, totalEarned - paidAmount);

    return {
      daysPassed,
      totalEarned,
      pendingRewards,
      dailyRate: periodConfig.rate,
      isCompleted: daysPassed >= cycleDays
    };
  }

  /**
   * 格式化时间显示
   */
  static formatTimeRemaining(timeData: ReturnType<typeof ProductionTimeUtils.calculateRemainingTime>): string {
    if (timeData.isExpired) {
      return '已到期';
    }

    const parts: string[] = [];
    
    if (timeData.days > 0) {
      parts.push(`${timeData.days}天`);
    }
    if (timeData.hours > 0) {
      parts.push(`${timeData.hours}小时`);
    }
    if (timeData.minutes > 0 && timeData.days === 0) {
      parts.push(`${timeData.minutes}分钟`);
    }

    return parts.join(' ') || '即将到期';
  }

  /**
   * 格式化收益率显示
   */
  static formatRate(rate: number): string {
    return `${rate.toFixed(2)}% 每日`;
  }

  /**
   * 格式化总收益显示
   */
  static formatTotalReturn(rate: number, days: number): string {
    const total = rate * days;
    return `${total.toFixed(2)}%`;
  }
}

/**
 * 生产环境验证函数
 */
export class ProductionValidator {
  
  /**
   * 验证质押周期是否有效
   */
  static isValidStakingPeriod(days: number): boolean {
    return PRODUCTION_CONFIG.STAKING_PERIODS.some(period => period.days === days);
  }

  /**
   * 获取质押周期配置
   */
  static getStakingPeriodConfig(days: number) {
    const config = PRODUCTION_CONFIG.STAKING_PERIODS.find(period => period.days === days);
    if (!config) {
      throw new Error(`Invalid staking period: ${days} days`);
    }
    return config;
  }

  /**
   * 验证环境配置
   */
  static validateEnvironment(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 检查合约地址
    if (!PRODUCTION_CONFIG.CONTRACTS.MC_TOKEN) {
      errors.push('MC Token 合约地址未配置');
    }
    if (!PRODUCTION_CONFIG.CONTRACTS.JBC_TOKEN) {
      errors.push('JBC Token 合约地址未配置');
    }
    if (!PRODUCTION_CONFIG.CONTRACTS.PROTOCOL) {
      errors.push('Protocol 合约地址未配置');
    }

    // 检查时间配置
    if (PRODUCTION_CONFIG.SECONDS_IN_UNIT !== 86400) {
      errors.push('时间单位配置错误，生产环境应为 86400 秒 (1天)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// 导出配置供其他模块使用
export default PRODUCTION_CONFIG;