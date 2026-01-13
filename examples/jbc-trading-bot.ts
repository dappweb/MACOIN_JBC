/**
 * JBC自动交易机器人示例
 * 使用规则引擎实现自动交易策略
 */

import { RuleEngine, TradingRules, Rule } from '../utils/ruleEngine';
import { ethers } from 'ethers';

interface MarketData {
  jbcPrice: number;
  jbcBalance: number;
  mcBalance: number;
  profit: number;
  loss: number;
  position: number;
  reserveMC: number;
  reserveJBC: number;
  volume24h?: number;
  avgVolume24h?: number;
}

export class JBCTradingBot {
  private engine: RuleEngine;
  private updateInterval: NodeJS.Timeout | null = null;
  private protocolContract: ethers.Contract;
  private jbcContract: ethers.Contract;
  private account: string;
  private isRunning: boolean = false;

  // 统计数据
  private stats = {
    totalTrades: 0,
    totalProfit: 0,
    totalLoss: 0,
    rulesExecuted: 0,
    startTime: Date.now(),
  };

  constructor(
    protocolContract: ethers.Contract,
    jbcContract: ethers.Contract,
    account: string
  ) {
    this.protocolContract = protocolContract;
    this.jbcContract = jbcContract;
    this.account = account;
    this.engine = new RuleEngine();
    this.setupRules();
  }

  /**
   * 设置交易规则
   */
  private setupRules() {
    // 1. 低价买入规则
    this.engine.addRule({
      name: 'JBC低价买入',
      description: '当JBC价格低于0.95 MC时买入10个',
      condition: (facts) => {
        const price = facts.jbcPrice as number;
        return price !== undefined && price < 0.95;
      },
      action: async (facts) => {
        console.log(`📈 [买入] 价格: ${facts.jbcPrice}, 买入10 JBC`);
        // await this.swapMCToJBC(10);
        this.stats.totalTrades++;
      },
      priority: 10,
      enabled: true,
    });

    // 2. 高价卖出规则
    this.engine.addRule({
      name: 'JBC高价卖出',
      description: '当JBC价格高于1.05 MC时卖出5个',
      condition: (facts) => {
        const price = facts.jbcPrice as number;
        return price !== undefined && price > 1.05;
      },
      action: async (facts) => {
        console.log(`📉 [卖出] 价格: ${facts.jbcPrice}, 卖出5 JBC`);
        // await this.swapJBCToMC(5);
        this.stats.totalTrades++;
      },
      priority: 10,
      enabled: true,
    });

    // 3. 止损规则（最高优先级）
    this.engine.addRule({
      name: '止损',
      description: '当亏损超过50 MC时全部卖出止损',
      condition: (facts) => {
        const loss = facts.loss as number;
        return loss !== undefined && loss > 50;
      },
      action: async (facts) => {
        const balance = facts.jbcBalance as number;
        console.log(`🛑 [止损] 亏损: ${facts.loss}, 卖出全部 ${balance} JBC`);
        // await this.swapJBCToMC(balance);
        this.stats.totalTrades++;
        this.stats.totalLoss += facts.loss as number;
      },
      priority: 100, // 最高优先级
      enabled: true,
    });

    // 4. 止盈规则
    this.engine.addRule({
      name: '止盈',
      description: '当盈利超过100 MC时卖出50%持仓',
      condition: (facts) => {
        const profit = facts.profit as number;
        return profit !== undefined && profit > 100;
      },
      action: async (facts) => {
        const balance = facts.jbcBalance as number;
        const sellAmount = balance * 0.5;
        console.log(`💰 [止盈] 盈利: ${facts.profit}, 卖出50% ${sellAmount} JBC`);
        // await this.swapJBCToMC(sellAmount);
        this.stats.totalTrades++;
        this.stats.totalProfit += facts.profit as number;
      },
      priority: 80,
      enabled: true,
    });

    // 5. 仓位限制规则
    this.engine.addRule({
      name: '仓位限制',
      description: '当持仓价值超过1000 MC时减少仓位',
      condition: (facts) => {
        const position = facts.position as number;
        return position !== undefined && position > 1000;
      },
      action: async (facts) => {
        const balance = facts.jbcBalance as number;
        const reduceAmount = balance * 0.3; // 减少30%
        console.log(`⚖️  [减仓] 持仓: ${facts.position}, 减少 ${reduceAmount} JBC`);
        // await this.swapJBCToMC(reduceAmount);
        this.stats.totalTrades++;
      },
      priority: 70,
      enabled: true,
    });

    // 6. 成交量放大买入规则
    this.engine.addRule({
      name: '成交量放大买入',
      description: '当24小时成交量放大2倍时买入',
      condition: (facts) => {
        const volume = facts.volume24h as number;
        const avgVolume = facts.avgVolume24h as number;
        if (!volume || !avgVolume) return false;
        return volume > avgVolume * 2;
      },
      action: async (facts) => {
        console.log(`📊 [成交量买入] 成交量: ${facts.volume24h}, 买入5 JBC`);
        // await this.swapMCToJBC(5);
        this.stats.totalTrades++;
      },
      priority: 15,
      enabled: true,
    });
  }

  /**
   * 更新市场数据
   */
  private async updateMarketData(): Promise<MarketData | null> {
    try {
      // 获取池子储备
      const reserveMC = await this.protocolContract.swapReserveMC();
      const reserveJBC = await this.protocolContract.swapReserveJBC();

      const reserveMCNum = parseFloat(ethers.formatEther(reserveMC));
      const reserveJBCNum = parseFloat(ethers.formatEther(reserveJBC));
      const jbcPrice = reserveMCNum / reserveJBCNum;

      // 获取JBC余额
      const jbcBalance = await this.jbcContract.balanceOf(this.account);
      const jbcBalanceNum = parseFloat(ethers.formatEther(jbcBalance));

      // 计算盈亏（假设初始投资1000 MC）
      const initialInvestment = 1000;
      const currentValue = jbcBalanceNum * jbcPrice;
      const profit = currentValue - initialInvestment;
      const loss = profit < 0 ? Math.abs(profit) : 0;

      const marketData: MarketData = {
        jbcPrice,
        jbcBalance: jbcBalanceNum,
        mcBalance: 0, // 可以从provider获取
        profit: profit > 0 ? profit : 0,
        loss,
        position: currentValue,
        reserveMC: reserveMCNum,
        reserveJBC: reserveJBCNum,
      };

      // 更新规则引擎的事实
      this.engine.setFacts(marketData);

      return marketData;
    } catch (error) {
      console.error('❌ 更新市场数据失败:', error);
      return null;
    }
  }

  /**
   * 执行规则
   */
  private async executeRules() {
    try {
      const executedRules = await this.engine.execute();
      if (executedRules.length > 0) {
        this.stats.rulesExecuted += executedRules.length;
        console.log(`✅ 执行了 ${executedRules.length} 个规则:`, 
          executedRules.map(r => r.name).join(', '));
      }
    } catch (error) {
      console.error('❌ 执行规则失败:', error);
    }
  }

  /**
   * 启动机器人
   */
  async start(intervalMs: number = 5000) {
    if (this.isRunning) {
      console.log('⚠️  机器人已在运行');
      return;
    }

    console.log('🚀 JBC交易机器人启动');
    console.log(`📊 监控间隔: ${intervalMs}ms`);
    this.isRunning = true;
    this.stats.startTime = Date.now();

    // 立即执行一次
    await this.updateMarketData();
    await this.executeRules();

    // 定期更新和执行
    this.updateInterval = setInterval(async () => {
      await this.updateMarketData();
      await this.executeRules();
      this.printStats();
    }, intervalMs);
  }

  /**
   * 停止机器人
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️  JBC交易机器人停止');
    this.printStats();
  }

  /**
   * 打印统计信息
   */
  private printStats() {
    const runtime = Math.floor((Date.now() - this.stats.startTime) / 1000);
    console.log('\n📊 统计信息:');
    console.log(`   运行时间: ${runtime}秒`);
    console.log(`   总交易次数: ${this.stats.totalTrades}`);
    console.log(`   规则执行次数: ${this.stats.rulesExecuted}`);
    console.log(`   总盈利: ${this.stats.totalProfit.toFixed(2)} MC`);
    console.log(`   总亏损: ${this.stats.totalLoss.toFixed(2)} MC`);
    console.log(`   净收益: ${(this.stats.totalProfit - this.stats.totalLoss).toFixed(2)} MC\n`);
  }

  /**
   * 获取当前规则
   */
  getRules(): Rule[] {
    return this.engine.getRules();
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(ruleName: string, enabled: boolean) {
    const rules = this.engine.getRules();
    const rule = rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = enabled;
      console.log(`${enabled ? '✅' : '❌'} 规则 "${ruleName}" ${enabled ? '已启用' : '已禁用'}`);
    }
  }

  /**
   * 获取当前市场数据
   */
  async getMarketData(): Promise<MarketData | null> {
    return await this.updateMarketData();
  }

  /**
   * 手动执行规则（用于测试）
   */
  async manualExecute() {
    await this.updateMarketData();
    await this.executeRules();
  }
}

// 使用示例
export async function createJBCTradingBot(
  protocolContract: ethers.Contract,
  jbcContract: ethers.Contract,
  account: string
): Promise<JBCTradingBot> {
  const bot = new JBCTradingBot(protocolContract, jbcContract, account);
  return bot;
}

// 示例：在React组件中使用
/*
import { useWeb3 } from '../src/Web3Context';
import { createJBCTradingBot } from '../examples/jbc-trading-bot';

function TradingBotPanel() {
  const { protocolContract, jbcContract, account } = useWeb3();
  const [bot, setBot] = useState<JBCTradingBot | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (protocolContract && jbcContract && account) {
      createJBCTradingBot(protocolContract, jbcContract, account)
        .then(setBot);
    }
  }, [protocolContract, jbcContract, account]);

  const handleStart = async () => {
    if (bot) {
      await bot.start(5000);
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    if (bot) {
      bot.stop();
      setIsRunning(false);
    }
  };

  return (
    <div>
      <button onClick={handleStart} disabled={isRunning}>启动</button>
      <button onClick={handleStop} disabled={!isRunning}>停止</button>
    </div>
  );
}
*/
