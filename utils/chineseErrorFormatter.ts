import { useLanguage } from '../src/LanguageContext';

/**
 * 中文友好的错误格式化工具
 * 将英文技术错误信息转换为用户友好的中文提示
 */
export const formatChineseError = (error: any, language: 'zh' | 'en' | 'zh-TW' = 'zh'): string => {
  // 处理繁体中文，映射到简体中文处理逻辑
  const processLanguage = language === 'zh-TW' ? 'zh' : language;
  if (!error) return processLanguage === 'zh' ? '未知错误' : 'Unknown error occurred';

  // 处理字符串错误
  if (typeof error === 'string') {
    return translateError(error, processLanguage);
  }

  // 提取错误信息
  const message = error.message || '';
  const code = error.code;
  const reason = error.reason;

  // 1. 用户取消交易
  if (
    message.includes('user rejected') || 
    message.includes('User denied') || 
    code === 'ACTION_REJECTED' || 
    code === 4001
  ) {
    return processLanguage === 'zh' ? '用户取消了交易' : 'Transaction cancelled by user';
  }

  // 2. 余额不足
  if (
    message.includes('insufficient funds') || 
    message.includes('exceeds balance') ||
    message.includes('InsufficientBalance') ||
    code === 'INSUFFICIENT_FUNDS'
  ) {
    return processLanguage === 'zh' ? 'MC代币余额不足，请检查钱包余额' : 'Insufficient MC balance';
  }

  // 3. Gas费不足
  if (
    message.includes('insufficient funds for gas') ||
    message.includes('gas required exceeds allowance')
  ) {
    return processLanguage === 'zh' ? 'Gas费不足，请确保钱包有足够的MC支付手续费' : 'Insufficient gas fee';
  }

  // 4. 合约执行失败 - 具体错误原因
  if (reason) {
    return translateContractReason(reason, processLanguage);
  }
  
  if (message.includes('execution reverted')) {
    const match = message.match(/execution reverted:? (.*?)(?:\"|$)/);
    if (match && match[1]) {
      return translateContractReason(match[1], processLanguage);
    }
    return processLanguage === 'zh' ? '合约执行失败，请检查交易参数' : 'Contract execution failed';
  }

  // 5. 缺少回滚数据 - 通常是余额或权限问题
  if (message.includes('missing revert data') || code === 'CALL_EXCEPTION') {
    return processLanguage === 'zh' ? 
      '交易失败：请检查MC余额是否足够，当前需要150 MC购买门票' : 
      'Transaction failed: Check your MC balance';
  }

  // 6. 网络错误
  if (message.includes('Network Error') || code === 'NETWORK_ERROR') {
    return processLanguage === 'zh' ? '网络连接错误，请检查网络或稍后重试' : 'Network connection error';
  }

  // 7. RPC错误
  if (message.includes('Internal JSON-RPC error')) {
    const match = message.match(/message":"(.*?)"/);
    if (match && match[1]) {
      return processLanguage === 'zh' ? `RPC错误：${match[1]}` : `RPC Error: ${match[1]}`;
    }
    return processLanguage === 'zh' ? '钱包RPC错误，请切换网络或重试' : 'Wallet RPC error';
  }

  // 8. 特定的合约错误
  if (message.includes('ActiveTicketExists')) {
    return processLanguage === 'zh' ? 
      '您已有活跃门票，请先完成当前挖矿周期或赎回流动性后再购买新门票' : 
      'You already have an active ticket';
  }

  // 回退处理
  return translateError(message, processLanguage);
};

/**
 * 翻译常见错误信息
 */
const translateError = (error: string, language: 'zh' | 'en'): string => {
  if (language === 'en') return error;

  const errorMap: Record<string, string> = {
    'Transaction failed: Check your inputs and wallet balance': 'MC余额不足，请检查钱包余额后重试',
    'Transaction failed': '交易失败，请重试',
    'Contract execution error': '合约执行错误，请检查交易参数',
    'Insufficient funds for transaction': 'MC余额不足，无法完成交易',
    'User rejected the transaction': '用户取消了交易',
    'Network connection error': '网络连接错误，请检查网络',
    'Internal Wallet/RPC Error': '钱包RPC错误，请重试',
    'missing revert data': '交易参数错误或余额不足',
    'execution reverted': '合约执行失败',
    'insufficient funds': 'MC余额不足',
    'user rejected': '用户取消交易',
    'User denied': '用户拒绝交易',
  };

  // 查找完全匹配
  if (errorMap[error]) {
    return errorMap[error];
  }

  // 查找部分匹配
  for (const [key, value] of Object.entries(errorMap)) {
    if (error.includes(key)) {
      return value;
    }
  }

  // 如果没有匹配，返回简化的中文提示
  if (error.length > 100) {
    return '交易失败，请检查MC余额和网络连接';
  }

  return error;
};

/**
 * 翻译合约回滚原因
 */
const translateContractReason = (reason: string, language: 'zh' | 'en'): string => {
  if (language === 'en') return `Transaction failed: ${reason}`;

  const reasonMap: Record<string, string> = {
    'InsufficientBalance': 'MC余额不足，请检查钱包余额',
    'ActiveTicketExists': '您已有活跃门票，请先完成当前挖矿或赎回后再购买',
    'InvalidTicketAmount': '无效的门票金额，请选择100、300、500或1000 MC',
    'InvalidCycle': '无效的挖矿周期，请选择7、15或30天',
    'NotOwner': '权限不足，仅合约拥有者可执行此操作',
    'ZeroAddress': '无效的地址参数',
    'TransferFailed': '代币转账失败，请检查余额和授权',
    'ReentrancyGuardReentrantCall': '重入攻击保护，请稍后重试',
    'ERC20InsufficientBalance': 'MC代币余额不足',
    'ERC20InsufficientAllowance': 'MC代币授权不足，请先授权',
  };

  // 查找匹配的原因
  for (const [key, value] of Object.entries(reasonMap)) {
    if (reason.includes(key)) {
      return value;
    }
  }

  return `交易失败：${reason}`;
};

/**
 * 获取用户友好的错误建议
 */
export const getErrorSuggestion = (error: any, language: 'zh' | 'en' | 'zh-TW' = 'zh'): string => {
  const processLanguage = language === 'zh-TW' ? 'zh' : language;
  const message = typeof error === 'string' ? error : (error.message || '');

  if (processLanguage === 'en') {
    if (message.includes('insufficient') || message.includes('balance')) {
      return 'Please check your MC balance and ensure you have enough tokens for the transaction.';
    }
    if (message.includes('gas')) {
      return 'Please increase gas fee or ensure you have enough MC for transaction fees.';
    }
    return 'Please check your wallet connection and try again.';
  }

  // 中文建议
  if (message.includes('insufficient') || message.includes('balance') || message.includes('余额')) {
    return '建议：请检查MC余额，确保有足够代币完成交易。购买150 MC门票需要至少150 MC。';
  }
  
  if (message.includes('gas') || message.includes('Gas')) {
    return '建议：请确保钱包有足够的MC支付Gas手续费，或提高Gas费用。';
  }
  
  if (message.includes('network') || message.includes('Network')) {
    return '建议：请检查网络连接，确认已连接到MC Chain网络（链ID：88813）。';
  }
  
  if (message.includes('user rejected') || message.includes('User denied')) {
    return '建议：请在钱包中确认交易，或检查交易参数是否正确。';
  }

  return '建议：请检查钱包连接和MC余额，确保网络稳定后重试。';
};

/**
 * React Hook 版本的错误格式化
 */
export const useChineseErrorFormatter = () => {
  const { language } = useLanguage();
  
  return {
    formatError: (error: any) => formatChineseError(error, language as 'zh' | 'en' | 'zh-TW'),
    getSuggestion: (error: any) => getErrorSuggestion(error, language as 'zh' | 'en' | 'zh-TW'),
  };
};