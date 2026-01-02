import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        },
      },
      plugins: [
        react({
          // 启用React Fast Refresh
          fastRefresh: !isProduction,
          // 生产环境移除开发工具
          babel: isProduction ? {
            plugins: [
              ['babel-plugin-react-remove-properties', { properties: ['data-testid'] }]
            ]
          } : undefined
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // 移除生产环境的console
        ...(isProduction && {
          'console.log': '(() => {})',
          'console.warn': '(() => {})',
        })
      },
      
      // 依赖预构建优化
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'ethers',
          '@rainbow-me/rainbowkit',
          'wagmi',
          'viem',
          'react-hot-toast',
          'recharts',
          'lucide-react',
          '@tanstack/react-query'
        ],
        esbuildOptions: {
          define: {
            global: 'globalThis'
          },
          target: 'es2020'
        }
      },
      
      // 构建优化
      build: {
        target: 'es2020',
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: isProduction,
            drop_debugger: isProduction,
            pure_funcs: isProduction ? ['console.log', 'console.warn'] : [],
            passes: 2 // 多次压缩以获得更好的结果
          }
        },
        rollupOptions: {
          output: {
            // 代码分割策略 - 更细粒度分割
            manualChunks: (id) => {
              // 核心React库
              if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
                return 'react-vendor';
              }
              // Web3相关库
              if (id.includes('node_modules/ethers') || 
                  id.includes('node_modules/@rainbow-me') || 
                  id.includes('node_modules/wagmi') || 
                  id.includes('node_modules/viem')) {
                return 'web3-vendor';
              }
              // UI组件库
              if (id.includes('node_modules/lucide-react') || 
                  id.includes('node_modules/recharts') || 
                  id.includes('node_modules/react-hot-toast')) {
                return 'ui-vendor';
              }
              // 工具库
              if (id.includes('node_modules/@tanstack')) {
                return 'utils-vendor';
              }
              // 组件代码分割 - 按路由/功能分割
              if (id.includes('/components/')) {
                const match = id.match(/components\/([^/]+)/);
                if (match) {
                  const componentName = match[1];
                  // 大型组件单独打包
                  if (['MiningPanel', 'EarningsDetail', 'TeamLevel', 'SwapPanel'].includes(componentName)) {
                    return `component-${componentName.toLowerCase()}`;
                  }
                }
              }
            },
            // 文件命名优化
            chunkFileNames: 'assets/js/[name]-[hash].js',
            entryFileNames: 'assets/js/[name]-[hash].js',
            assetFileNames: (assetInfo) => {
              const info = assetInfo.name.split('.');
              const ext = info[info.length - 1];
              if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name)) {
                return `assets/media/[name]-[hash].${ext}`;
              }
              if (/\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i.test(assetInfo.name)) {
                return `assets/img/[name]-[hash].${ext}`;
              }
              if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name)) {
                return `assets/fonts/[name]-[hash].${ext}`;
              }
              return `assets/[ext]/[name]-[hash].${ext}`;
            }
          }
        },
        // 启用源码映射 (仅开发环境)
        sourcemap: !isProduction,
        // 构建报告
        reportCompressedSize: true,
        // 块大小警告限制
        chunkSizeWarningLimit: 1000
      },
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@components': path.resolve(__dirname, 'components'),
          '@src': path.resolve(__dirname, 'src'),
          '@utils': path.resolve(__dirname, 'utils'),
          '@hooks': path.resolve(__dirname, 'hooks'),
        }
      },
      
      // CSS优化
      css: {
        devSourcemap: !isProduction,
        postcss: {
          plugins: isProduction ? [
            autoprefixer,
            cssnano({
              preset: ['default', {
                discardComments: { removeAll: true },
                normalizeWhitespace: true
              }]
            })
          ] : []
        }
      }
    };
});