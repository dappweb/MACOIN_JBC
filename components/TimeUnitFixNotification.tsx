import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, Clock, AlertCircle, Info } from 'lucide-react';

interface TimeUnitFixNotificationProps {
  contractAddress?: string;
  isFixed?: boolean;
  onDismiss?: () => void;
}

export const TimeUnitFixNotification: React.FC<TimeUnitFixNotificationProps> = ({
  contractAddress = "0x57f94D4F3832FE53a07dd02bA393F7490bE51E63",
  isFixed = true,
  onDismiss
}) => {
  const [showNotification, setShowNotification] = useState(true);
  const [notificationType, setNotificationType] = useState<'success' | 'info' | 'warning'>('success');

  useEffect(() => {
    if (isFixed) {
      setNotificationType('success');
      showSuccessNotification();
    } else {
      setNotificationType('info');
      showInfoNotification();
    }
  }, [isFixed]);

  const showSuccessNotification = () => {
    toast.success(
      '🎉 时间单位修复完成！质押周期已调整为真实天数，投资体验更符合预期！',
      {
        duration: 8000,
        position: 'top-center',
        style: {
          background: '#10B981',
          color: 'white',
          fontSize: '14px',
          padding: '16px',
          borderRadius: '8px',
          maxWidth: '500px'
        }
      }
    );
  };

  const showInfoNotification = () => {
    toast.loading(
      '⏳ 系统正在进行时间单位修复，质押周期将调整为真实天数...',
      {
        duration: 5000,
        position: 'top-center',
        style: {
          background: '#3B82F6',
          color: 'white',
          fontSize: '14px',
          padding: '16px',
          borderRadius: '8px',
          maxWidth: '500px'
        }
      }
    );
  };

  const handleDismiss = () => {
    setShowNotification(false);
    onDismiss?.();
  };

  if (!showNotification) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className={`
        rounded-lg shadow-lg p-4 border-l-4 
        ${notificationType === 'success' ? 'bg-green-50 border-green-400' : ''}
        ${notificationType === 'info' ? 'bg-blue-50 border-blue-400' : ''}
        ${notificationType === 'warning' ? 'bg-yellow-50 border-yellow-400' : ''}
      `}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {notificationType === 'success' && (
              <CheckCircle className="h-5 w-5 text-green-400" />
            )}
            {notificationType === 'info' && (
              <Info className="h-5 w-5 text-blue-400" />
            )}
            {notificationType === 'warning' && (
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            )}
          </div>
          
          <div className="ml-3 flex-1">
            <h3 className={`
              text-sm font-medium
              ${notificationType === 'success' ? 'text-green-800' : ''}
              ${notificationType === 'info' ? 'text-blue-800' : ''}
              ${notificationType === 'warning' ? 'text-yellow-800' : ''}
            `}>
              {isFixed ? '时间单位修复完成' : '时间单位修复中'}
            </h3>
            
            <div className={`
              mt-2 text-sm
              ${notificationType === 'success' ? 'text-green-700' : ''}
              ${notificationType === 'info' ? 'text-blue-700' : ''}
              ${notificationType === 'warning' ? 'text-yellow-700' : ''}
            `}>
              {isFixed ? (
                <div>
                  <p className="mb-2">✅ 质押周期已调整为真实天数</p>
                  <ul className="text-xs space-y-1 ml-4">
                    <li>• 7天质押 = 真正的7天（不再是7分钟）</li>
                    <li>• 15天质押 = 真正的15天</li>
                    <li>• 30天质押 = 真正的30天</li>
                    <li>• 动态奖励30天解锁期修复</li>
                  </ul>
                </div>
              ) : (
                <div>
                  <p className="mb-2">系统正在修复时间单位配置...</p>
                  <p className="text-xs">您的资产安全不受影响，请稍候。</p>
                </div>
              )}
            </div>
            
            {isFixed && (
              <div className="mt-3 text-xs text-gray-600">
                <p>合约地址: {contractAddress}</p>
                <p>修复时间: {new Date().toLocaleString()}</p>
              </div>
            )}
          </div>
          
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className={`
                inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2
                ${notificationType === 'success' ? 'text-green-400 hover:bg-green-100 focus:ring-green-600' : ''}
                ${notificationType === 'info' ? 'text-blue-400 hover:bg-blue-100 focus:ring-blue-600' : ''}
                ${notificationType === 'warning' ? 'text-yellow-400 hover:bg-yellow-100 focus:ring-yellow-600' : ''}
              `}
            >
              <span className="sr-only">关闭</span>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// FAQ组件
export const TimeUnitFixFAQ: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const faqs = [
    {
      question: "时间单位修复对我现有的质押有什么影响？",
      answer: "现有质押将按照新的时间单位重新计算到期时间。例如，如果您之前质押了7分钟，现在将调整为7天的真实投资周期。"
    },
    {
      question: "我的动态奖励解锁时间会改变吗？",
      answer: "是的，30分钟的解锁期将调整为30天的真实解锁期，这更符合投资预期和风险管理。"
    },
    {
      question: "修复过程中我的资产安全吗？",
      answer: "完全安全。修复过程只是调整时间计算参数，不会影响您的资产余额或所有权。"
    },
    {
      question: "为什么要进行这次修复？",
      answer: "P-prod环境应该模拟真实的投资环境，使用真实的天数而不是分钟数，让用户体验更接近实际投资场景。"
    }
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
      >
        <Info className="h-4 w-4 inline mr-2" />
        时间修复FAQ
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">时间单位修复 FAQ</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-200 pb-4">
                <h3 className="font-medium text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-gray-700 text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-green-800 mb-2">修复完成后的变化</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• 质押周期：7/15/30天 = 真实的天数</li>
              <li>• 动态奖励：30天解锁期</li>
              <li>• 燃烧机制：每24小时执行一次</li>
              <li>• 门票灵活期：72小时真实时间</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeUnitFixNotification;