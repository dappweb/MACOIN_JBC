#!/bin/bash

echo "🚀 Manual deployment to Cloudflare Pages..."

# 构建项目
echo "📦 Building project..."
npm run build

# 检查是否安装了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "📥 Installing Wrangler..."
    npm install -g wrangler
fi

# 部署到 Cloudflare Pages
echo "🌐 Deploying to Cloudflare..."
wrangler pages deploy dist --project-name="jinbao-test" --compatibility-date="2024-01-01"

echo "✅ Deployment completed!"
echo "🌐 Your site should be available at: https://jinbao-test.pages.dev"