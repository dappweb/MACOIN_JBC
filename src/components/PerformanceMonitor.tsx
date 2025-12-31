import React, { useEffect } from 'react';

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

export const PerformanceMonitor: React.FC = () => {
  useEffect(() => {
    // 只在生产环境收集性能指标
    if (process.env.NODE_ENV !== 'production') return;
    
    const collectMetrics = () => {
      try {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        const metrics: Partial<PerformanceMetrics> = {
          ttfb: navigation.responseStart - navigation.requestStart,
        };
        
        // FCP
        const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
        if (fcp) metrics.fcp = fcp.startTime;
        
        // LCP
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          metrics.lcp = lastEntry.startTime;
          
          // 发送指标
          sendMetrics(metrics as PerformanceMetrics);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // FID
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            metrics.fid = (entry as any).processingStart - entry.startTime;
          });
        }).observe({ entryTypes: ['first-input'] });
        
        // CLS
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          metrics.cls = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });
        
      } catch (error) {
        console.warn('Performance monitoring error:', error);
      }
    };
    
    // 页面加载完成后收集指标
    if (document.readyState === 'complete') {
      collectMetrics();
    } else {
      window.addEventListener('load', collectMetrics);
    }
    
    return () => {
      window.removeEventListener('load', collectMetrics);
    };
  }, []);
  
  return null;
};

async function sendMetrics(metrics: PerformanceMetrics) {
  try {
    // 使用 navigator.sendBeacon 确保数据发送
    const data = JSON.stringify({
      ...metrics,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      connection: (navigator as any).connection?.effectiveType || 'unknown'
    });
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/performance', data);
    } else {
      // 降级到 fetch
      fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true
      }).catch(() => {
        // 静默失败，不影响用户体验
      });
    }
  } catch (error) {
    // 静默失败，不影响用户体验
  }
}