import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        global: 'globalThis',
      },
      build: {
        rollupOptions: {
          external: [
            '@safe-globalThis/safe-apps-sdk',
            '@safe-globalThis/safe-apps-provider', 
            '@safe-globalThis/safe-gateway-typescript-sdk'
          ],
          output: {
            manualChunks: {
              'ethers': ['ethers'],
              'web3-libs': ['@rainbow-me/rainbowkit', 'wagmi', 'viem']
            },
            globals: {
              '@safe-globalThis/safe-apps-sdk': 'SafeAppsSDK',
              '@safe-globalThis/safe-apps-provider': 'SafeAppsProvider',
              '@safe-globalThis/safe-gateway-typescript-sdk': 'SafeGatewaySDK'
            }
          }
        },
        commonjsOptions: {
          transformMixedEsModules: true
        },
        target: 'esnext'
      },
      // Fix for crypto.getRandomValues is not a function in older node versions
      optimizeDeps: {
        include: ['ethers', '@rainbow-me/rainbowkit', 'wagmi', 'viem'],
        exclude: [
          '@safe-globalThis/safe-apps-sdk',
          '@safe-globalThis/safe-apps-provider',
          '@safe-globalThis/safe-gateway-typescript-sdk'
        ],
        esbuildOptions: {
            define: {
                global: 'globalThis'
            },
            target: 'esnext'
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Add polyfills for Node.js modules
          'crypto': 'crypto-browserify',
          'stream': 'stream-browserify',
          'buffer': 'buffer',
          'util': 'util'
        }
      }
    };
});