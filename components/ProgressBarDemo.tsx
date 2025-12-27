import React, { useState, useEffect } from 'react';
import GoldenProgressBar from './GoldenProgressBar';

const ProgressBarDemo: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [showDemo, setShowDemo] = useState(false);

  // 模拟进度增长
  useEffect(() => {
    if (showDemo) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            return 0; // 重置进度
          }
          return prev + 2;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [showDemo]);

  const demoConfigs = [
    {
      title: '标准模式',
      props: {
        progress,
        showAnimation: true,
        showSplashAnimation: false,
        highContrast: false,
        height: 'md' as const
      }
    },
    {
      title: '开屏动画模式',
      props: {
        progress,
        showAnimation: true,
        showSplashAnimation: progress < 10,
        highContrast: false,
        height: 'md' as const
      }
    },
    {
      title: '高对比度模式',
      props: {
        progress,
        showAnimation: true,
        showSplashAnimation: false,
        highContrast: true,
        height: 'md' as const
      }
    },
    {
      title: '完整增强模式',
      props: {
        progress,
        showAnimation: true,
        showSplashAnimation: progress < 15,
        highContrast: true,
        height: 'lg' as const
      }
    }
  ];

  return (
    <div className="p-8 bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          增强版金色进度条演示
        </h1>
        
        <div className="mb-8 text-center">
          <button
            onClick={() => setShowDemo(!showDemo)}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-all"
          >
            {showDemo ? '停止演示' : '开始演示'}
          </button>
          <p className="text-gray-400 mt-2">
            当前进度: {progress.toFixed(1)}%
          </p>
        </div>

        <div className="space-y-8">
          {demoConfigs.map((config, index) => (
            <div key={index} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-semibold text-white mb-4">
                {config.title}
              </h3>
              <div className="mb-4">
                <GoldenProgressBar
                  {...config.props}
                  ariaLabel={`${config.title} 进度条`}
                  className="w-full"
                />
              </div>
              <div className="text-sm text-gray-400">
                <p>特性:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {config.props.showSplashAnimation && (
                    <li>✨ 开屏扫光动画 (进度 &lt; {config.title.includes('完整') ? '15' : '10'}%)</li>
                  )}
                  {config.props.showAnimation && (
                    <li>🔄 Logo滚动动画</li>
                  )}
                  {config.props.highContrast && (
                    <li>🎨 高对比度增强色彩</li>
                  )}
                  <li>📏 高度: {config.props.height}</li>
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gray-800/30 rounded-xl p-6 border border-gray-600">
          <h3 className="text-xl font-semibold text-white mb-4">
            🎯 方案特点
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-gray-300">
            <div>
              <h4 className="font-semibold text-yellow-400 mb-2">开屏动画效果</h4>
              <ul className="space-y-1 text-sm">
                <li>• 45度倾斜扫光效果</li>
                <li>• 2秒动画持续时间</li>
                <li>• 仅在进度开始时触发</li>
                <li>• 支持无障碍访问设置</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-yellow-400 mb-2">高对比度增强</h4>
              <ul className="space-y-1 text-sm">
                <li>• 明暗主题自适应色彩</li>
                <li>• 增强的阴影和发光效果</li>
                <li>• 脉冲动画增强视觉反馈</li>
                <li>• 系统对比度设置支持</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBarDemo;