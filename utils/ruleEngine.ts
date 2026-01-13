/**
 * 简单规则引擎实现
 * 用于交易策略和风控规则
 */

// 规则接口
export interface Rule {
  name: string;
  description?: string;
  condition: (facts: Record<string, any>) => boolean;
  action: (facts: Record<string, any>) => void | Promise<void>;
  priority?: number; // 优先级，数字越大优先级越高
  enabled?: boolean; // 是否启用
}

// 规则引擎类
export class RuleEngine {
  private rules: Rule[] = [];
  private facts: Record<string, any> = {};

  /**
   * 添加规则
   */
  addRule(rule: Rule): void {
    this.rules.push(rule);
    // 按优先级排序
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 添加多个规则
   */
  addRules(rules: Rule[]): void {
    rules.forEach(rule => this.addRule(rule));
  }

  /**
   * 移除规则
   */
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
  }

  /**
   * 设置事实（数据）
   */
  setFact(key: string, value: any): void {
    this.facts[key] = value;
  }

  /**
   * 设置多个事实
   */
  setFacts(facts: Record<string, any>): void {
    Object.assign(this.facts, facts);
  }

  /**
   * 获取事实
   */
  getFact(key: string): any {
    return this.facts[key];
  }

  /**
   * 清除所有事实
   */
  clearFacts(): void {
    this.facts = {};
  }

  /**
   * 执行规则引擎
   * @returns 执行的规则列表
   */
  async execute(): Promise<Rule[]> {
    const executedRules: Rule[] = [];

    // 过滤启用的规则
    const enabledRules = this.rules.filter(rule => rule.enabled !== false);

    // 遍历规则，检查条件并执行
    for (const rule of enabledRules) {
      try {
        // 检查条件
        if (rule.condition(this.facts)) {
          // 执行动作
          await rule.action(this.facts);
          executedRules.push(rule);
          
          // 如果规则设置了只执行一次，可以在这里移除
          // 这里我们保留规则，允许重复执行
        }
      } catch (error) {
        console.error(`规则执行失败: ${rule.name}`, error);
      }
    }

    return executedRules;
  }

  /**
   * 获取所有规则
   */
  getRules(): Rule[] {
    return [...this.rules];
  }

  /**
   * 获取当前事实
   */
  getFacts(): Record<string, any> {
    return { ...this.facts };
  }
}

// 规则构建器（方便创建规则）
export class RuleBuilder {
  private rule: Partial<Rule> = {};

  name(name: string): RuleBuilder {
    this.rule.name = name;
    return this;
  }

  description(description: string): RuleBuilder {
    this.rule.description = description;
    return this;
  }

  condition(condition: (facts: Record<string, any>) => boolean): RuleBuilder {
    this.rule.condition = condition;
    return this;
  }

  action(action: (facts: Record<string, any>) => void | Promise<void>): RuleBuilder {
    this.rule.action = action;
    return this;
  }

  priority(priority: number): RuleBuilder {
    this.rule.priority = priority;
    return this;
  }

  enabled(enabled: boolean): RuleBuilder {
    this.rule.enabled = enabled;
    return this;
  }

  build(): Rule {
    if (!this.rule.name || !this.rule.condition || !this.rule.action) {
      throw new Error('规则必须包含 name, condition 和 action');
    }
    return this.rule as Rule;
  }
}

// 预定义的交易规则示例
export const TradingRules = {
  /**
   * 低价买入规则
   */
  lowPriceBuy: (threshold: number, amount: number): Rule => ({
    name: '低价买入',
    description: `当价格低于 ${threshold} 时买入 ${amount} 个代币`,
    condition: (facts) => {
      const price = facts.price as number;
      return price !== undefined && price < threshold;
    },
    action: async (facts) => {
      console.log(`执行买入: 价格 ${facts.price}, 买入数量 ${amount}`);
      // 这里可以调用实际的交易函数
      // await buyToken(amount);
    },
    priority: 10,
    enabled: true
  }),

  /**
   * 高价卖出规则
   */
  highPriceSell: (threshold: number, amount: number): Rule => ({
    name: '高价卖出',
    description: `当价格高于 ${threshold} 时卖出 ${amount} 个代币`,
    condition: (facts) => {
      const price = facts.price as number;
      return price !== undefined && price > threshold;
    },
    action: async (facts) => {
      console.log(`执行卖出: 价格 ${facts.price}, 卖出数量 ${amount}`);
      // await sellToken(amount);
    },
    priority: 10,
    enabled: true
  }),

  /**
   * 止损规则
   */
  stopLoss: (maxLoss: number): Rule => ({
    name: '止损',
    description: `当亏损超过 ${maxLoss} 时止损`,
    condition: (facts) => {
      const loss = facts.loss as number;
      return loss !== undefined && loss > maxLoss;
    },
    action: async (facts) => {
      console.log(`执行止损: 当前亏损 ${facts.loss}`);
      // await stopLoss();
    },
    priority: 100, // 高优先级
    enabled: true
  }),

  /**
   * 仓位限制规则
   */
  positionLimit: (maxPosition: number): Rule => ({
    name: '仓位限制',
    description: `当仓位超过 ${maxPosition} 时减少仓位`,
    condition: (facts) => {
      const position = facts.position as number;
      return position !== undefined && position > maxPosition;
    },
    action: async (facts) => {
      const position = facts.position as number;
      const reduceAmount = position - maxPosition;
      console.log(`减少仓位: 当前 ${position}, 减少 ${reduceAmount}`);
      // await reducePosition(reduceAmount);
    },
    priority: 90,
    enabled: true
  }),

  /**
   * 套利机会规则
   */
  arbitrage: (minSpread: number): Rule => ({
    name: '套利机会',
    description: `当价差超过 ${minSpread} 时执行套利`,
    condition: (facts) => {
      const priceA = facts.priceA as number;
      const priceB = facts.priceB as number;
      if (priceA === undefined || priceB === undefined) return false;
      const spread = Math.abs(priceA - priceB);
      return spread > minSpread;
    },
    action: async (facts) => {
      const priceA = facts.priceA as number;
      const priceB = facts.priceB as number;
      console.log(`执行套利: 价差 ${Math.abs(priceA - priceB)}`);
      // await executeArbitrage(priceA, priceB);
    },
    priority: 50,
    enabled: true
  })
};

// 使用示例
export function createTradingRuleEngine(): RuleEngine {
  const engine = new RuleEngine();

  // 添加交易规则
  engine.addRule(TradingRules.lowPriceBuy(100, 10));
  engine.addRule(TradingRules.highPriceSell(150, 5));
  engine.addRule(TradingRules.stopLoss(1000));
  engine.addRule(TradingRules.positionLimit(1000));
  engine.addRule(TradingRules.arbitrage(10));

  return engine;
}

// 使用 RuleBuilder 创建自定义规则
export function createCustomRule(): Rule {
  return new RuleBuilder()
    .name('自定义规则')
    .description('这是一个自定义规则示例')
    .condition((facts) => {
      // 自定义条件逻辑
      return facts.someCondition === true;
    })
    .action(async (facts) => {
      // 自定义动作逻辑
      console.log('执行自定义动作', facts);
    })
    .priority(20)
    .enabled(true)
    .build();
}
