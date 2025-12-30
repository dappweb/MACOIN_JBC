#!/bin/bash

echo "🚀 Building for Cloudflare Pages..."

# 设置 Node.js 版本
export NODE_VERSION=18

# 清理缓存
echo "🧹 Cleaning cache..."
rm -rf node_modules/.vite
rm -rf dist

# 安装依赖
echo "📦 Installing dependencies..."
npm ci --legacy-peer-deps

# 强制重新构建依赖
echo "🔄 Rebuilding dependencies..."
npm rebuild

# 构建项目
echo "🔨 Building project..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo "✅ Build completed!"