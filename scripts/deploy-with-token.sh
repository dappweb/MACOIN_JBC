#!/bin/bash

# 使用 API Token 部署到 jbc-pages 的脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 使用 API Token 部署到 Cloudflare Pages (jbc-pages)...${NC}"
echo "=================================="

# 检查环境变量
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${RED}❌ 错误：未设置 CLOUDFLARE_API_TOKEN 环境变量${NC}"
    echo ""
    echo -e "${YELLOW}请设置环境变量：${NC}"
    echo "  export CLOUDFLARE_API_TOKEN='your-api-token'"
    echo "  export CLOUDFLARE_ACCOUNT_ID='91682bb238aa911811c831ff0e29b5a5'"
    echo ""
    echo -e "${BLUE}获取 API Token 的步骤：${NC}"
    echo "1. 访问: https://dash.cloudflare.com/profile/api-tokens"
    echo "2. 点击 'Create Token'"
    echo "3. 使用 'Edit Cloudflare Workers' 模板"
    echo "4. 账户资源选择: suiyiwan1@outlook.com's Account"
    echo "5. 权限设置:"
    echo "   - Account - Cloudflare Pages - Edit"
    echo "   - Zone - Zone Settings - Read"
    echo "6. 复制生成的 Token"
    echo ""
    exit 1
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}⚠️  未设置 CLOUDFLARE_ACCOUNT_ID，使用默认值${NC}"
    export CLOUDFLARE_ACCOUNT_ID='91682bb238aa911811c831ff0e29b5a5'
fi

echo -e "${GREEN}✅ 环境变量已设置${NC}"
echo "   Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo "   API Token: ${CLOUDFLARE_API_TOKEN:0:10}..."
echo ""

# 检查 dist 目录
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}📦 dist 目录不存在，开始构建...${NC}"
    npm run build
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 构建失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 构建完成${NC}"
else
    echo -e "${GREEN}✅ dist 目录已存在${NC}"
fi

# 部署到 Cloudflare Pages
echo -e "${YELLOW}☁️  部署到 Cloudflare Pages (jbc-pages)...${NC}"

CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
npx wrangler pages deploy dist --project-name=jbc-pages

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 部署失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 部署成功！${NC}"
echo "=================================="
echo -e "🌐 项目 URL: ${BLUE}https://jbc-pages.pages.dev${NC}"
echo ""
