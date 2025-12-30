/**
 * 测试环境配置
 * 主要修改: 质押周期从天数改为分钟计算，便于快速测试
 */

// 🔥 测试环境关键配置
export const TEST_CONFIG = {
  // 时间单位配置
  SECONDS_IN_UNIT: 60,    // 1分钟 = 60秒 (测试环境)
  TIME_UNIT: 'minutes',   // 显示单位: 分钟
  RATE_UNIT: 'per minute', // 收益率单位: 每分钟

  // 质押周期配置 (分钟数)
  STAKING_PERIODS: [
    {
      days: 7,
      label: '7分钟',
      rate: 1.3333334,     // 1.33% 每分钟 (测试用)
      totalReturn: 9.33,   // 总收益约 9.33%
      ratePerBillion: 13333334
    },
    {
      days: 15,
      label: '15分钟', 
      rate: 1.6666667,     // 1.67% 每分钟 (测试用)
      totalReturn: 25.0,   // 总收益约 25%
      ratePerBillion: 16666667
    },
    {
      days: 30,
      label: '30分钟',
      rate: 2.0,           // 2.00% 每分钟 (测试用)
      totalReturn: 60.0,   // 总收益约 60%
      ratePerBillion: 20000000
    }
  ],

  // 合约地址 (测试环境)
  CONTRACTS: {
    JBC_TOKEN: "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da",
    PROTOCOL: "0xD437e63c2A76e0237249eC6070Bef9A2484C4302", // Native MC version with minute time unit
    DAILY_BURN_MANAGER: "0x6C2FdDEb939D92E0dde178845F570FC4E0d213bc"
  },

  // 网络配置
  NETWORK: {
    CHAIN_ID: 88813,
    CHAIN_NAME: 'MC Chain Testnet',
    RPC_URL: 'https://rpc.mcchain.io',
    EXPLORER_URL: 'https://scan.mcchain.io'
  }
};

/**
 * 时间计算工具函数 - 测试环境版本
 */
export class TestTimeUtils {
  
  /**
   * 计算质押剩余时间 (分钟)
   */
  static calculateRemainingTime(startTime: number, cycleDays: number): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } {
    const now = Math.floor(Date.now() / 1000);
    const endTime = startTime + (cycleDays * TEST_CONFIG.SECONDS_IN_UNIT);
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

    // 在测试环境中，以分钟为主要单位
    const totalMinutes = Math.floor(remaining / TEST_CONFIG.SECONDS_IN_UNIT);
    const seconds = remaining % TEST_CONFIG.SECONDS_IN_UNIT;

    return {
      days: 0, // 测试环境不显示天数
      hours: 0, // 测试环境不显示小时
      minutes: totalMinutes,
      seconds,
      isExpired: false
    };
  }

  /**
   * 计算已经过的分钟数
   */
  static calculateMinutesPassed(startTime: number): number {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - startTime;
    return Math.floor(elapsed / TEST_CONFIG.SECONDS_IN_UNIT);
  }

  /**
   * 计算质押收益 (测试环境)
   */
  static calculateStakeRewards(
    amount: number,
    startTime: number,
    cycleDays: number,
    paidAmount: number = 0
  ): {
    minutesPassed: number;
    totalEarned: number;
    pendingRewards: number;
    minuteRate: number;
    isCompleted: boolean;
  } {
    const minutesPassed = Math.min(
      this.calculateMinutesPassed(startTime),
      cycleDays
    );

    // 获取分钟收益率
    const periodConfig = TEST_CONFIG.STAKING_PERIODS.find(p => p.days === cycleDays);
    if (!periodConfig) {
      throw new Error(`Unsupported staking period: ${cycleDays} minutes`);
    }

    const minuteRate = periodConfig.rate / 100; // 转换为小数
    const totalEarned = amount * minuteRate * minutesPassed;
    const pendingRewards = Math.max(0, totalEarned - paidAmount);

    return {
      minutesPassed,
      totalEarned,
      pendingRewards,
      minuteRate: periodConfig.rate,
      isCompleted: minutesPassed >= cycleDays
    };
  }

  /**
   * 格式化时间显示 (测试环境)
   */
  static formatTimeRemaining(timeData: ReturnType<typeof TestTimeUtils.calculateRemainingTime>): string {
    if (timeData.isExpired) {
      return '已到期';
    }

    const parts: string[] = [];
    
    if (timeData.minutes > 0) {
      parts.push(`${timeData.minutes}分钟`);
    }
    if (timeData.seconds > 0) {
      parts.push(`${timeData.seconds}秒`);
    }

    return parts.join(' ') || '即将到期';
  }

  /**
   * 格式化收益率显示 (测试环境)
   */
  static formatRate(rate: number): string {
    return `${rate.toFixed(2)}% 每分钟`;
  }

  /**
   * 格式化总收益显示 (测试环境)
   */
  static formatTotalReturn(rate: number, minutes: number): string {
    const total = rate * minutes;
    return `${total.toFixed(2)}%`;
  }
}

/**
 * 测试环境验证函数
 */
export class TestValidator {
  
  /**
   * 验证质押周期是否有效 (分钟)
   */
  static isValidStakingPeriod(minutes: number): boolean {
    return TEST_CONFIG.STAKING_PERIODS.some(period => period.days === minutes);
  }

  /**
   * 获取质押周期配置
   */
  static getStakingPeriodConfig(minutes: number) {
    const config = TEST_CONFIG.STAKING_PERIODS.find(period => period.days === minutes);
    if (!config) {
      throw new Error(`Invalid staking period: ${minutes} minutes`);
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
    if (!TEST_CONFIG.CONTRACTS.JBC_TOKEN) {
      errors.push('JBC Token 合约地址未配置');
    }
    if (!TEST_CONFIG.CONTRACTS.PROTOCOL) {
      errors.push('Protocol 合约地址未配置');
    }

    // 检查时间配置
    if (TEST_CONFIG.SECONDS_IN_UNIT !== 60) {
      errors.push('时间单位配置错误，测试环境应为 60 秒 (1分钟)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// 导出配置供其他模块使用
export default TEST_CONFIG;