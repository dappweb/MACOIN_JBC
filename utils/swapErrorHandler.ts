import { ethers } from 'ethers';

export interface SwapValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

export class SwapErrorHandler {
  
  /**
   * 验证兑换前的条件
   */
  static async validateSwapConditions(
    payAmount: string,
    isSelling: boolean,
    balanceMC: string,
    balanceJBC: string,
    poolMC: string,
    poolJBC: string,
    mcContract: any,
    jbcContract: any,
    protocolContract: any,
    account: string
  ): Promise<SwapValidationResult> {
    
    try {
      const amount = parseFloat(payAmount);
      
      // 1. 基本输入验证
      if (!payAmount || amount <= 0) {
        return {
          isValid: false,
          error: '请输入有效的兑换数量',
          suggestion: '数量必须大于0'
        };
      }

      // 2. 余额检查
      const userBalance = parseFloat(isSelling ? balanceJBC : balanceMC);
      if (amount > userBalance) {
        return {
          isValid: false,
          error: `余额不足`,
          suggestion: `您的${isSelling ? 'JBC' : 'MC'}余额为 ${userBalance.toFixed(4)}，请减少兑换数量`
        };
      }

      // 3. 授权检查 - 移除此检查，因为现在由UI层面处理
      // 授权状态现在在SwapPanel中单独管理

      // 4. 流动性检查
      const poolMCNum = parseFloat(poolMC);
      const poolJBCNum = parseFloat(poolJBC);
      
      if (poolMCNum <= 0 || poolJBCNum <= 0) {
        return {
          isValid: false,
          error: '流动性池暂时不可用',
          suggestion: '请稍后再试或联系管理员'
        };
      }

      // 5. 兑换输出计算和验证
      const outputEstimate = this.calculateSwapOutput(amount, isSelling, poolMCNum, poolJBCNum);
      
      if (outputEstimate <= 0) {
        return {
          isValid: false,
          error: '兑换数量过小',
          suggestion: '请增加兑换数量或稍后再试'
        };
      }

      // 6. 流动性充足性检查
      const outputToken = isSelling ? poolMCNum : poolJBCNum;
      if (outputEstimate > outputToken * 0.9) { // 不能超过池子90%
        return {
          isValid: false,
          error: '流动性不足',
          suggestion: `当前池子${isSelling ? 'MC' : 'JBC'}储备不足，请减少兑换数量至 ${(outputToken * 0.8).toFixed(2)} 以下`
        };
      }

      // 7. 滑点警告
      const priceImpact = this.calculatePriceImpact(amount, isSelling, poolMCNum, poolJBCNum);
      if (priceImpact > 10) { // 滑点超过10%
        return {
          isValid: false,
          error: '价格影响过大',
          suggestion: `当前兑换将产生 ${priceImpact.toFixed(2)}% 的价格影响，建议减少兑换数量`
        };
      }

      return { isValid: true };
      
    } catch (error) {
      console.error('兑换验证失败:', error);
      return {
        isValid: false,
        error: '验证失败',
        suggestion: '请检查网络连接或稍后再试'
      };
    }
  }

  /**
   * 计算兑换输出
   */
  private static calculateSwapOutput(
    inputAmount: number,
    isSelling: boolean,
    poolMC: number,
    poolJBC: number
  ): number {
    if (isSelling) {
      // 卖出JBC，获得MC
      const tax = inputAmount * 0.25; // 25%税费
      const amountToSwap = inputAmount - tax;
      return (amountToSwap * poolMC) / (poolJBC + amountToSwap);
    } else {
      // 买入JBC，支付MC
      const outPreTax = (inputAmount * poolJBC) / (poolMC + inputAmount);
      const tax = outPreTax * 0.50; // 50%税费
      return outPreTax - tax;
    }
  }

  /**
   * 计算价格影响
   */
  private static calculatePriceImpact(
    inputAmount: number,
    isSelling: boolean,
    poolMC: number,
    poolJBC: number
  ): number {
    const reserveIn = isSelling ? poolJBC : poolMC;
    return (inputAmount / reserveIn) * 100;
  }

  /**
   * 格式化合约错误为用户友好的消息
   */
  static formatSwapError(error: any): { title: string; message: string; suggestion: string } {
    const errorStr = error?.message || error?.toString() || '';
    
    // 自定义错误映射
    const errorMappings = [
      {
        patterns: ['LowLiquidity', 'insufficient liquidity'],
        title: '流动性不足',
        message: '当前流动性池储备不足以完成此次兑换',
        suggestion: '请减少兑换数量或等待流动性补充'
      },
      {
        patterns: ['InvalidAmount', 'invalid amount'],
        title: '无效数量',
        message: '兑换数量无效或为零',
        suggestion: '请输入大于0的有效数量'
      },
      {
        patterns: ['InsufficientBalance', 'insufficient balance', 'exceeds balance'],
        title: '余额不足',
        message: '您的代币余额不足以完成此次兑换',
        suggestion: '请检查余额或减少兑换数量'
      },
      {
        patterns: ['insufficient allowance', 'allowance', 'ERC20: transfer amount exceeds allowance'],
        title: '授权不足',
        message: '代币授权额度不足，无法完成兑换',
        suggestion: '请点击"授权"按钮为代币授权使用权限'
      },
      {
        patterns: ['user rejected', 'User denied', 'ACTION_REJECTED'],
        title: '交易取消',
        message: '您取消了此次交易',
        suggestion: '如需继续，请重新发起兑换'
      },
      {
        patterns: ['insufficient funds for gas', 'gas'],
        title: 'Gas费不足',
        message: '账户中的ETH不足以支付交易费用',
        suggestion: '请确保账户有足够的ETH支付Gas费'
      },
      {
        patterns: ['execution reverted', 'transaction failed'],
        title: '交易执行失败',
        message: '智能合约执行过程中发生错误',
        suggestion: '请检查输入参数或稍后重试'
      },
      {
        patterns: ['network error', 'Network Error'],
        title: '网络错误',
        message: '网络连接异常，无法完成交易',
        suggestion: '请检查网络连接或更换RPC节点'
      }
    ];

    // 查找匹配的错误类型
    for (const mapping of errorMappings) {
      if (mapping.patterns.some(pattern => 
        errorStr.toLowerCase().includes(pattern.toLowerCase())
      )) {
        return mapping;
      }
    }

    // 默认错误信息
    return {
      title: '兑换失败',
      message: '交易执行过程中发生未知错误',
      suggestion: '请检查输入信息或联系技术支持'
    };
  }
}