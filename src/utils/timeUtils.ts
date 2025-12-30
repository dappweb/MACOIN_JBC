/**
 * 时间工具函数 - 自动适配测试/生产环境
 */

import { ethers } from 'ethers';

export interface TimeConfig {
  SECONDS_IN_UNIT: number;
  TIME_UNIT: 'minutes' | 'days';
  RATE_UNIT: 'per minute' | 'daily';
  UNIT_LABEL: string;
  SHORT_UNIT: string;
}

/**
 * 根据合约的 SECONDS_IN_UNIT 值自动检测环境配置
 */
export async function detectTimeConfig(protocolContract: ethers.Contract): Promise<TimeConfig> {
  try {
    const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
    const seconds = Number(secondsInUnit);
    
    if (seconds === 60) {
      // 测试环境 - 分钟单位
      return {
        SECONDS_IN_UNIT: 60,
        TIME_UNIT: 'minutes',
        RATE_UNIT: 'per minute',
        UNIT_LABEL: '分钟',
        SHORT_UNIT: '分'
      };
    } else if (seconds === 86400) {
      // 生产环境 - 天数单位
      return {
        SECONDS_IN_UNIT: 86400,
        TIME_UNIT: 'days',
        RATE_UNIT: 'daily',
        UNIT_LABEL: '天',
        SHORT_UNIT: '天'
      };
    } else {
      // 未知配置，默认使用天数
      console.warn(`Unknown SECONDS_IN_UNIT value: ${seconds}, defaulting to days`);
      return {
        SECONDS_IN_UNIT: seconds,
        TIME_UNIT: 'days',
        RATE_UNIT: 'daily',
        UNIT_LABEL: '天',
        SHORT_UNIT: '天'
      };
    }
  } catch (error) {
    console.error('Failed to detect time config from contract:', error);
    // 默认使用分钟单位（测试环境）
    return {
      SECONDS_IN_UNIT: 60,
      TIME_UNIT: 'minutes',
      RATE_UNIT: 'per minute',
      UNIT_LABEL: '分钟',
      SHORT_UNIT: '分'
    };
  }
}

/**
 * 通用时间计算工具类
 */
export class TimeUtils {
  
  /**
   * 计算剩余时间
   */
  static calculateRemainingTime(
    startTime: number, 
    cyclePeriods: number, 
    config: TimeConfig
  ): {
    totalUnits: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } {
    const now = Math.floor(Date.now() / 1000);
    const endTime = startTime + (cyclePeriods * config.SECONDS_IN_UNIT);
    const remaining = endTime - now;

    if (remaining <= 0) {
      return {
        totalUnits: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true
      };
    }

    const totalUnits = Math.floor(remaining / config.SECONDS_IN_UNIT);
    const remainingSeconds = remaining % config.SECONDS_IN_UNIT;
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    return {
      totalUnits,
      hours,
      minutes,
      seconds,
      isExpired: false
    };
  }

  /**
   * 计算已经过的时间单位
   */
  static calculateUnitsPassed(startTime: number, config: TimeConfig): number {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - startTime;
    return Math.floor(elapsed / config.SECONDS_IN_UNIT);
  }

  /**
   * 计算质押收益
   */
  static calculateStakeRewards(
    amount: number,
    startTime: number,
    cyclePeriods: number,
    paidAmount: number = 0,
    config: TimeConfig
  ): {
    unitsPassed: number;
    totalEarned: number;
    pendingRewards: number;
    unitRate: number;
    isCompleted: boolean;
  } {
    const unitsPassed = Math.min(
      this.calculateUnitsPassed(startTime, config),
      cyclePeriods
    );

    // 根据周期获取收益率
    let ratePerBillion: number;
    if (cyclePeriods === 7) ratePerBillion = 13333334;
    else if (cyclePeriods === 15) ratePerBillion = 16666667;
    else if (cyclePeriods === 30) ratePerBillion = 20000000;
    else ratePerBillion = 13333334; // 默认值

    const unitRate = ratePerBillion / 10000000; // 转换为百分比
    const totalEarned = (amount * ratePerBillion * unitsPassed) / 1000000000;
    const pendingRewards = Math.max(0, totalEarned - paidAmount);

    return {
      unitsPassed,
      totalEarned,
      pendingRewards,
      unitRate,
      isCompleted: unitsPassed >= cyclePeriods
    };
  }

  /**
   * 格式化时间显示
   */
  static formatTimeRemaining(
    timeData: ReturnType<typeof TimeUtils.calculateRemainingTime>,
    config: TimeConfig
  ): string {
    if (timeData.isExpired) {
      return '已到期';
    }

    const parts: string[] = [];
    
    if (timeData.totalUnits > 0) {
      parts.push(`${timeData.totalUnits}${config.SHORT_UNIT}`);
    }
    
    if (config.TIME_UNIT === 'minutes') {
      // 测试环境：显示分钟和秒
      if (timeData.seconds > 0) {
        parts.push(`${timeData.seconds}秒`);
      }
    } else {
      // 生产环境：显示小时和分钟
      if (timeData.hours > 0) {
        parts.push(`${timeData.hours}时`);
      }
      if (timeData.minutes > 0 && timeData.totalUnits === 0) {
        parts.push(`${timeData.minutes}分`);
      }
    }

    return parts.join(' ') || '即将到期';
  }

  /**
   * 格式化收益率显示
   */
  static formatRate(rate: number, config: TimeConfig): string {
    const rateLabel = config.TIME_UNIT === 'minutes' ? '每分钟' : '每日';
    return `${rate.toFixed(2)}% ${rateLabel}`;
  }

  /**
   * 格式化周期显示
   */
  static formatCyclePeriod(periods: number, config: TimeConfig): string {
    return `${periods} ${config.UNIT_LABEL}`;
  }

  /**
   * 获取质押周期选项
   */
  static getStakingOptions(config: TimeConfig) {
    const unitLabel = config.UNIT_LABEL;
    
    return [
      {
        value: 7,
        label: `7${unitLabel}`,
        rate: 1.33,
        description: config.TIME_UNIT === 'minutes' ? '快速测试' : '短期质押'
      },
      {
        value: 15,
        label: `15${unitLabel}`,
        rate: 1.67,
        description: config.TIME_UNIT === 'minutes' ? '中等测试' : '中期质押'
      },
      {
        value: 30,
        label: `30${unitLabel}`,
        rate: 2.00,
        description: config.TIME_UNIT === 'minutes' ? '长期测试' : '长期质押'
      }
    ];
  }
}

/**
 * 环境检测工具
 */
export class EnvironmentDetector {
  
  /**
   * 检测当前是否为测试环境
   */
  static async isTestEnvironment(protocolContract: ethers.Contract): Promise<boolean> {
    try {
      const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
      return Number(secondsInUnit) === 60;
    } catch (error) {
      console.error('Failed to detect environment:', error);
      return true; // 默认认为是测试环境
    }
  }

  /**
   * 获取环境描述
   */
  static async getEnvironmentDescription(protocolContract: ethers.Contract): Promise<string> {
    const isTest = await this.isTestEnvironment(protocolContract);
    return isTest ? '测试环境 (分钟单位)' : '生产环境 (天数单位)';
  }
}

export default TimeUtils;