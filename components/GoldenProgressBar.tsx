import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface GoldenProgressBarProps {
  progress: number;           // 0-100 percentage
  height?: 'sm' | 'md' | 'lg'; // h-3, h-4, h-5
  showAnimation?: boolean;     // Enable/disable logo animation
  className?: string;          // Additional CSS classes
  ariaLabel?: string;         // Accessibility label
  theme?: 'light' | 'dark';   // Theme support
  showSplashAnimation?: boolean; // Enable splash screen animation
  highContrast?: boolean;     // Enable high contrast mode
}

interface LogoAnimationConfig {
  duration: number;           // Animation duration in seconds
  logoSize: number;          // Logo size in pixels
  logoSpacing: number;       // Space between logos in pixels
  direction: 'ltr' | 'rtl';  // Animation direction
}

interface LogoAsset {
  src: string;               // Logo image source
  alt: string;               // Alternative text
  fallbackIcon: React.ComponentType<{ size: number; className?: string }>; // Fallback icon component
  width: number;             // Optimized width
  height: number;            // Optimized height
}

const GoldenProgressBar: React.FC<GoldenProgressBarProps> = ({
  progress,
  height = 'md',
  showAnimation = true,
  className = '',
  ariaLabel = 'Progress',
  theme = 'dark',
  showSplashAnimation = false,
  highContrast = false
}) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [splashComplete, setSplashComplete] = useState(!showSplashAnimation);

  // Handle splash animation completion
  useEffect(() => {
    if (showSplashAnimation && !reducedMotion) {
      const timer = setTimeout(() => {
        setSplashComplete(true);
      }, 2000); // 2 second splash animation
      return () => clearTimeout(timer);
    }
  }, [showSplashAnimation, reducedMotion]);

  // Check for user's reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Height classes mapping
  const heightClasses = {
    sm: 'h-3',
    md: 'h-4', 
    lg: 'h-5'
  };

  // Logo size based on height with responsive adjustments - 增大图标尺寸
  const logoSizes = {
    sm: window.innerWidth < 768 ? 16 : 20,   // 原来 8:10，现在 16:20 (增大约2倍)
    md: window.innerWidth < 768 ? 20 : 24,   // 原来 12:14，现在 20:24 (增大约1.7倍)
    lg: window.innerWidth < 768 ? 24 : 28    // 原来 16:18，现在 24:28 (增大约1.5倍)
  };

  // Logo asset configuration with fallback handling and theme support
  const logoAsset: LogoAsset = {
    src: '/icon-removebg-preview.png', // 使用去背景的项目图标
    alt: 'JBC Logo',
    fallbackIcon: Zap,
    width: logoSizes[height],
    height: logoSizes[height]
  };

  const animationConfig: LogoAnimationConfig = {
    duration: window.innerWidth < 768 ? 4 : 3, // Slower on mobile for better visibility
    logoSize: logoSizes[height],
    logoSpacing: window.innerWidth < 768 ? 30 : 40, // Closer spacing on mobile
    direction: 'ltr' // 改为从左到右
  };

  // Handle logo loading
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setLogoLoaded(true);
      setLogoError(false);
    };
    img.onerror = () => {
      setLogoLoaded(false);
      setLogoError(true);
    };
    img.src = logoAsset.src;
  }, [logoAsset.src]);

  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  // Determine if animation should be active
  const shouldAnimate = showAnimation && !reducedMotion && clampedProgress > 0 && splashComplete;
  const shouldShowSplash = showSplashAnimation && !splashComplete && !reducedMotion;

  // Enhanced color schemes for high contrast
  const getColorScheme = () => {
    if (highContrast) {
      return {
        background: theme === 'light' 
          ? 'linear-gradient(90deg, #1A0F00 0%, #2D1B00 100%)' // 更深的背景色
          : 'linear-gradient(90deg, #2D1B00 0%, #4A2C00 100%)', // 深棕色背景
        progressFill: theme === 'light'
          ? 'linear-gradient(90deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)' // 亮金色进度
          : 'linear-gradient(90deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)', // 亮金色进度
        boxShadow: theme === 'light'
          ? '0 0 20px rgba(255, 215, 0, 0.9)' // 更强的阴影
          : '0 0 25px rgba(255, 215, 0, 1.0)', // 最强阴影
        innerShadow: theme === 'light'
          ? 'inset 0 0 10px rgba(255, 215, 0, 0.8)'
          : 'inset 0 0 12px rgba(255, 215, 0, 1.0)',
        logoColor: 'rgba(0, 0, 0, 0.9)' // 深色图标确保对比度
      };
    } else {
      return {
        background: 'linear-gradient(90deg, #2D1B00 0%, #4A2C00 100%)', // 深棕色背景
        progressFill: 'linear-gradient(90deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)', // 亮金色进度
        boxShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
        innerShadow: 'inset 0 0 8px rgba(255, 215, 0, 0.9)',
        logoColor: 'rgba(0, 0, 0, 0.8)'
      };
    }
  };

  const colorScheme = getColorScheme();

  // Render logo or fallback icon
  const renderLogo = (index: number) => {
    const FallbackIcon = logoAsset.fallbackIcon;
    
    return (
      <div
        key={index}
        className="flex items-center justify-center rounded-full p-1 shadow-lg"
        style={{
          width: `${animationConfig.logoSize + 8}px`,
          height: `${animationConfig.logoSize + 8}px`,
          background: 'transparent', // 透明背景
          border: '2px solid rgba(255, 215, 0, 0.8)',
          boxShadow: '0 0 12px rgba(255, 215, 0, 0.7)'
        }}
      >
        {logoLoaded && !logoError ? (
          <img
            src={logoAsset.src}
            alt={logoAsset.alt}
            width={logoAsset.width + 4}
            height={logoAsset.height + 4}
            className="drop-shadow-lg rounded-sm"
            style={{ 
              filter: 'brightness(1.2) contrast(1.3) drop-shadow(0 0 4px rgba(255, 215, 0, 0.8))', // 增强发光效果
              objectFit: 'contain',
              animation: 'logoSpin 2s linear infinite'
            }}
            onError={() => setLogoError(true)}
          />
        ) : (
          <FallbackIcon 
            size={animationConfig.logoSize}
            className="drop-shadow-lg text-yellow-400"
            style={{ 
              filter: 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.8))',
              animation: 'logoSpin 2s linear infinite'
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div 
      className={`golden-progress-bar ${heightClasses[height]} ${className} ${shouldShowSplash ? 'splash-animation' : ''}`}
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      style={{
        background: colorScheme.background,
        boxShadow: colorScheme.boxShadow,
        borderRadius: '9999px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Splash Screen Animation */}
      {shouldShowSplash && (
        <div
          className="absolute inset-0 splash-overlay"
          style={{
            background: `linear-gradient(45deg, 
              transparent 0%, 
              rgba(255, 255, 255, 0.8) 25%, 
              rgba(255, 255, 255, 1) 50%, 
              rgba(255, 255, 255, 0.8) 75%, 
              transparent 100%)`,
            animation: 'splashSweep 2s ease-out forwards',
            borderRadius: '9999px'
          }}
        />
      )}

      {/* Progress fill */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all duration-500"
        style={{ 
          width: `${clampedProgress}%`,
          background: colorScheme.progressFill,
          boxShadow: colorScheme.innerShadow
        }}
      >
        {/* Logo animation container - fixed at the right edge of progress fill */}
        {shouldAnimate && clampedProgress > 0 && (
          <div
            className="absolute top-1/2 flex items-center justify-center"
            style={{
              right: '0px', // 精确位于进度条填充的最右边
              transform: 'translate(50%, -50%)', // 图标中心对齐进度条右边缘
              width: `${animationConfig.logoSize + 8}px`,
              height: `${animationConfig.logoSize + 8}px`,
              zIndex: 10
            }}
          >
            {renderLogo(0)}
          </div>
        )}
      </div>

      {/* Enhanced Glow effect overlay */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: highContrast 
            ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
          animation: shouldAnimate ? `goldenGlow ${highContrast ? '1.5s' : '2s'} ease-in-out infinite` : 'none'
        }}
      />

      {/* Pulse effect for high contrast mode */}
      {highContrast && shouldAnimate && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, transparent 70%)',
            animation: 'pulseGlow 3s ease-in-out infinite'
          }}
        />
      )}

      {/* Additional contrast border */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none border-2"
        style={{
          borderColor: shouldAnimate ? 'rgba(255, 215, 0, 0.6)' : 'rgba(255, 215, 0, 0.3)',
          animation: shouldAnimate ? 'goldenGlow 2s ease-in-out infinite' : 'none'
        }}
      />
    </div>
  );
};

export default GoldenProgressBar;