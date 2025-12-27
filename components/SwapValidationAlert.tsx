import React from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface SwapValidationAlertProps {
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  suggestion?: string;
  className?: string;
}

const SwapValidationAlert: React.FC<SwapValidationAlertProps> = ({
  type,
  message,
  suggestion,
  className = ''
}) => {
  const getAlertStyles = () => {
    switch (type) {
      case 'error':
        return {
          container: 'bg-red-900/20 border-red-500/50 text-red-300',
          icon: <AlertTriangle size={16} className="text-red-400" />,
          iconBg: 'bg-red-500/20'
        };
      case 'warning':
        return {
          container: 'bg-amber-900/20 border-amber-500/50 text-amber-300',
          icon: <AlertTriangle size={16} className="text-amber-400" />,
          iconBg: 'bg-amber-500/20'
        };
      case 'info':
        return {
          container: 'bg-blue-900/20 border-blue-500/50 text-blue-300',
          icon: <Info size={16} className="text-blue-400" />,
          iconBg: 'bg-blue-500/20'
        };
      case 'success':
        return {
          container: 'bg-green-900/20 border-green-500/50 text-green-300',
          icon: <CheckCircle size={16} className="text-green-400" />,
          iconBg: 'bg-green-500/20'
        };
      default:
        return {
          container: 'bg-gray-900/20 border-gray-500/50 text-gray-300',
          icon: <Info size={16} className="text-gray-400" />,
          iconBg: 'bg-gray-500/20'
        };
    }
  };

  const styles = getAlertStyles();

  return (
    <div className={`border rounded-lg p-3 backdrop-blur-sm ${styles.container} ${className}`}>
      <div className="flex gap-3">
        <div className={`p-1 rounded-full ${styles.iconBg} flex-shrink-0`}>
          {styles.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{message}</p>
          {suggestion && (
            <p className="text-xs mt-1 opacity-80">{suggestion}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SwapValidationAlert;