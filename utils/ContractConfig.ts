/**
 * 合约配置管理
 * 处理P-prod环境时间单位修复后的合约交互
 */

export interface ContractConfig {
  address: string;
  chainId: number;
  timeUnitFixed: boolean;
  secondsInUnit: number;
  version: string;
}

export class ContractConfigManager {
  private static instance: ContractConfigManager;
  private config: ContractConfig;

  private constructor() {
    // P-prod环境配置
    this.config = {
      address: "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5", // 原合约地址（已升级）
      chainId: 88813, // MC Chain
      timeUnitFixed: true, // 时间单位已修复
      secondsInUnit: 86400, // 1天 = 86400秒
      version: "4.0.0-final"
    };
  }

  public static getInstance(): ContractConfigManager {
    if (!ContractConfigManager.instance) {
      ContractConfigManager.instance = new ContractConfigManager();
    }
    return ContractConfigManager.instance;
  }

  public getConfig(): ContractConfig {
    return { ...this.config };
  }

  public async detectTimeUnitStatus(contractInstance: any): Promise<void> {
    try {
      // 检测合约是否已修复时间单位
      const timeUnitFixed = await contractInstance.timeUnitFixed();
      const effectiveSecondsInUnit = await contractInstance.getEffectiveSecondsInUnit();
      const version = await contractInstance.getVersionV4();

      this.config.timeUnitFixed = timeUnitFixed;
      this.config.secondsInUnit = Number(effectiveSecondsInUnit);
      this.config.version = version;

      console.log('📊 合约状态检测完成:', {
        timeUnitFixed,
        secondsInUnit: this.config.secondsInUnit,
        version
      });

    } catch (error) {
      console.warn('⚠️ 无法检测时间单位状态，使用默认配置:', error);
      // 回退到旧配置
      this.config.timeUnitFixed = false;
      this.config.secondsInUnit = 60;
      this.config.version = "3.0.0";
    }
  }

  public isTimeUnitFixed(): boolean {
    return this.config.timeUnitFixed;
  }

  public getSecondsInUnit(): number {
    return this.config.secondsInUnit;
  }

  public getDisplayFormat(): 'minutes' | 'days' {
    return this.config.timeUnitFixed ? 'days' : 'minutes';
  }

  public getContractAddress(): string {
    return this.config.address;
  }

  public getVersion(): string {
    return this.config.version;
  }
}

export default ContractConfigManager;