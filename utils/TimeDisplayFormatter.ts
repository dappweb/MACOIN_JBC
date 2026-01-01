/**
 * 时间显示格式化器
 * 用于P-prod环境时间单位修复后的时间显示适配
 */

export interface TimeUnitConfig {
  secondsInUnit: number;
  isFixed: boolean;
  displayFormat: 'minutes' | 'days';
}

export class TimeDisplayFormatter {
  private config: TimeUnitConfig;

  constructor(config: TimeUnitConfig) {
    this.config = config;
  }

  /**
   * 格式化质押倒计时显示
   */
  formatStakingCountdown(endTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, endTime - now);

    if (remaining === 0) return "已到期";

    if (this.config.isFixed && this.config.secondsInUnit === 86400) {
      // 天级别显示
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
    } else {
      // 分钟级别显示（兼容旧版本）
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      
      if (minutes > 0) {
        return `${minutes}分钟 ${seconds}秒`;
      } else {
        return `${seconds}秒`;
      }
    }
  }

  /**
   * 格式化动态奖励解锁时间显示
   */
  formatDynamicRewardUnlock(unlockTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, unlockTime - now);

    if (remaining === 0) return "可提取";

    if (this.config.isFixed && this.config.secondsInUnit === 86400) {
      // 天级别显示
      const days = Math.ceil(remaining / 86400);
      if (days === 1) {
        const hours = Math.floor(remaining / 3600);
        if (hours < 24) {
          return `${hours}小时后解锁`;
        }
      }
      return `${days}天后解锁`;
    } else {
      // 分钟级别显示（兼容旧版本）
      const minutes = Math.ceil(remaining / 60);
      return `${minutes}分钟后解锁`;
    }
  }

  /**
   * 格式化历史记录时间戳
   */
  formatHistoryTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * 格式化燃烧倒计时
   */
  formatBurnCountdown(nextBurnTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, nextBurnTime - now);

    if (remaining === 0) return "燃烧进行中";

    if (this.config.isFixed && this.config.secondsInUnit === 86400) {
      // 天级别显示
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);

      if (hours > 0) {
        return `${hours}小时 ${minutes}分钟后燃烧`;
      } else {
        return `${minutes}分钟后燃烧`;
      }
    } else {
      // 分钟级别显示（兼容旧版本）
      const minutes = Math.floor(remaining / 60);
      return `${minutes}分钟后燃烧`;
    }
  }

  /**
   * 格式化质押周期显示
   */
  formatStakingPeriod(cycleDays: number): string {
    if (this.config.isFixed && this.config.secondsInUnit === 86400) {
      return `${cycleDays}天`;
    } else {
      return `${cycleDays}分钟`;
    }
  }

  /**
   * 获取时间单位状态指示器
   */
  getTimeUnitIndicator(): {
    status: 'fixed' | 'legacy';
    text: string;
    color: string;
  } {
    if (this.config.isFixed && this.config.secondsInUnit === 86400) {
      return {
        status: 'fixed',
        text: '真实天数',
        color: 'text-green-600'
      };
    } else {
      return {
        status: 'legacy',
        text: '分钟模式',
        color: 'text-orange-600'
      };
    }
  }

  /**
   * 自动检测时间单位配置
   */
  static async detectTimeUnitConfig(contractInstance: any): Promise<TimeUnitConfig> {
    try {
      // 调用合约检测时间单位状态
      const timeUnitFixed = await contractInstance.timeUnitFixed();
      const effectiveSecondsInUnit = await contractInstance.getEffectiveSecondsInUnit();
      
      return {
        secondsInUnit: Number(effectiveSecondsInUnit),
        isFixed: timeUnitFixed,
        displayFormat: timeUnitFixed ? 'days' : 'minutes'
      };
    } catch (error) {
      console.warn('⚠️ 无法检测时间单位配置，使用默认配置:', error);
      // 回退到修复后的配置（P-prod环境默认已修复）
      return {
        secondsInUnit: 86400,
        isFixed: true,
        displayFormat: 'days'
      };
    }
  }

  /**
   * 创建适配不同时间单位的格式化器
   */
  static createFormatter(isFixed: boolean = true): TimeDisplayFormatter {
    const config: TimeUnitConfig = {
      secondsInUnit: isFixed ? 86400 : 60,
      isFixed,
      displayFormat: isFixed ? 'days' : 'minutes'
    };
    
    return new TimeDisplayFormatter(config);
  }
}

export default TimeDisplayFormatter;