import { AlertCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { useLanguage } from '../src/LanguageContext';
import { useChineseErrorFormatter } from '../utils/chineseErrorFormatter';

import toast from 'react-hot-toast';

/**
 * 用户友好的错误提示组件
 * 将技术错误转换为易懂的中文提示，并提供解决建议
 */
export const showFriendlyError = (error: any, context?: string, showSuggestion: boolean = true) => {
  const { language } = useLanguage();
  const { formatError, getSuggestion } = useChineseErrorFormatter();
  
  // 格式化错误信息
  const errorMessage = formatError(error);
  const suggestion = getSuggestion(error);
  
  // 根据上下文调整错误信息
  const contextualMessage = getContextualMessage(errorMessage, context, language as 'zh' | 'en' | 'zh-TW');
  
  // 显示主要错误信息
  toast.error(contextualMessage, {
    duration: 5000,
    icon: <AlertCircle className="text-red-500" size={20} />,
    style: {
      background: '#1f2937',
      color: '#f87171',
      border: '1px solid #f87171',
      borderRadius: '12px',
      padding: '16px',
      fontSize: '14px',
      maxWidth: '400px'
    }
  });
  
  // 显示解决建议
  if (showSuggestion && suggestion && suggestion !== contextualMessage) {
    setTimeout(() => {
      toast(suggestion, {
        icon: <Lightbulb className="text-yellow-500" size={20} />,
        duration: 8000,
        style: {
          background: '#1f2937',
          color: '#fbbf24',
          border: '1px solid #fbbf24',
          borderRadius: '12px',
          padding: '16px',
          fontSize: '14px',
          maxWidth: '400px'
        }
      });
    }, 1500);
  }
};

/**
 * 根据上下文调整错误信息
 */
const getContextualMessage = (message: string, context?: string, language: 'zh' | 'en' | 'zh-TW' = 'zh'): string => {
  const processLanguage = language === 'zh-TW' ? 'zh' : language;
  if (!context || processLanguage === 'en') return message;
  
  const contextMap: Record<string, Record<string, string>> = {
    'buyTicket': {
      'MC余额不足，请检查钱包余额后重试': '购买门票失败：MC余额不足。购买150 MC门票需要至少150 MC代币。',
      '交易失败，请重试': '购买门票失败：请检查MC余额是否足够（需要150 MC）',
      '用户取消了交易': '门票购买已取消',
    },
    'stakeLiquidity': {
      'MC余额不足，请检查钱包余额后重试': '提供流动性失败：MC余额不足。需要150 MC用于流动性质押。',
      '交易失败，请重试': '流动性质押失败：请检查MC余额和授权状态',
    },
    'claimRewards': {
      '交易失败，请重试': '领取奖励失败：可能暂无可领取的奖励',
    },
    'redeem': {
      '交易失败，请重试': '赎回失败：请确认质押周期已结束',
    }
  };
  
  if (contextMap[context] && contextMap[context][message]) {
    return contextMap[context][message];
  }
  
  return message;
};

/**
 * 显示余额不足的专用提示
 */
export const showInsufficientBalanceError = (requiredAmount: string, currentBalance: string) => {
  const { language } = useLanguage();
  
  const message = language === 'zh' 
    ? `MC余额不足！需要 ${requiredAmount} MC，当前余额 ${currentBalance} MC`
    : `Insufficient MC balance! Need ${requiredAmount} MC, current balance ${currentBalance} MC`;
    
  const suggestion = language === 'zh'
    ? '建议：请先获取足够的MC代币，或减少交易金额'
    : 'Suggestion: Please acquire more MC tokens or reduce transaction amount';
  
  toast.error(message, {
    duration: 5000,
    icon: <AlertCircle className="text-red-500" size={20} />,
    style: {
      background: '#1f2937',
      color: '#f87171',
      border: '1px solid #f87171',
      borderRadius: '12px',
      padding: '16px',
      fontSize: '14px',
      maxWidth: '400px'
    }
  });
  
  setTimeout(() => {
    toast(suggestion, {
      icon: <Lightbulb className="text-yellow-500" size={20} />,
      duration: 6000,
      style: {
        background: '#1f2937',
        color: '#fbbf24',
        border: '1px solid #fbbf24',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '14px',
        maxWidth: '400px'
      }
    });
  }, 1500);
};

/**
 * 显示网络错误提示
 */
export const showNetworkError = () => {
  const { language } = useLanguage();
  
  const message = language === 'zh'
    ? '网络连接错误：请检查是否连接到MC Chain网络'
    : 'Network Error: Please check MC Chain connection';
    
  const suggestion = language === 'zh'
    ? '建议：在钱包中切换到MC Chain网络（链ID：88813）'
    : 'Suggestion: Switch to MC Chain network (Chain ID: 88813) in your wallet';
  
  toast.error(message, {
    duration: 6000,
    icon: <RefreshCw className="text-red-500" size={20} />,
    style: {
      background: '#1f2937',
      color: '#f87171',
      border: '1px solid #f87171',
      borderRadius: '12px',
      padding: '16px',
      fontSize: '14px',
      maxWidth: '400px'
    }
  });
  
  setTimeout(() => {
    toast(suggestion, {
      icon: <Lightbulb className="text-yellow-500" size={20} />,
      duration: 8000,
      style: {
        background: '#1f2937',
        color: '#fbbf24',
        border: '1px solid #fbbf24',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '14px',
        maxWidth: '400px'
      }
    });
  }, 2000);
};

export default { showFriendlyError, showInsufficientBalanceError, showNetworkError };