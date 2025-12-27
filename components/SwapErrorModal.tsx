import React from 'react';
import { AlertTriangle, X, RefreshCw, ExternalLink } from 'lucide-react';

interface SwapErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  suggestion: string;
  onRetry?: () => void;
  showContactSupport?: boolean;
}

const SwapErrorModal: React.FC<SwapErrorModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  suggestion,
  onRetry,
  showContactSupport = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 relative animate-fade-in">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* 错误图标和标题 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/20 rounded-full">
            <AlertTriangle className="text-red-400" size={24} />
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>

        {/* 错误信息 */}
        <div className="space-y-4">
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <p className="text-gray-300 text-sm leading-relaxed">{message}</p>
          </div>

          {/* 建议解决方案 */}
          <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
            <h4 className="text-blue-300 font-semibold text-sm mb-2">💡 解决建议</h4>
            <p className="text-blue-200 text-sm leading-relaxed">{suggestion}</p>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            {onRetry && (
              <button
                onClick={() => {
                  onRetry();
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-neon-500 hover:bg-neon-600 text-black font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                <RefreshCw size={16} />
                重试
              </button>
            )}
            
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>

          {/* 联系支持 */}
          {showContactSupport && (
            <div className="pt-2 border-t border-gray-700">
              <button className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm py-2 transition-colors">
                <ExternalLink size={14} />
                联系技术支持
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SwapErrorModal;