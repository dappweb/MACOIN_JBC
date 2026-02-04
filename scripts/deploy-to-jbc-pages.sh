#!/bin/bash

# 部署到 jbc-pages 项目的脚本
# 项目所在账户: suiyiwan1@outlook.com
# Account ID: 91682bb238aa911811c831ff0e29b5a5

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 开始部署到 Cloudflare Pages (jbc-pages)...${NC}"
echo "=================================="

# 检查当前登录账户
echo -e "${YELLOW}📋 检查当前 Cloudflare 账户...${NC}"
CURRENT_EMAIL=$(npx wrangler whoami 2>&1 | grep "email" | awk '{print $NF}' || echo "")
CURRENT_ACCOUNT=$(npx wrangler whoami 2>&1 | grep "Account ID" | tail -1 | awk '{print $NF}' || echo "")

echo "当前登录邮箱: $CURRENT_EMAIL"
echo "当前账户 ID: $CURRENT_ACCOUNT"

TARGET_ACCOUNT="91682bb238aa911811c831ff0e29b5a5"
TARGET_EMAIL="suiyiwan1@outlook.com"

if [ "$CURRENT_ACCOUNT" != "$TARGET_ACCOUNT" ]; then
    echo -e "${RED}❌ 账户不匹配！${NC}"
    echo -e "当前账户: ${YELLOW}$CURRENT_EMAIL${NC} ($CURRENT_ACCOUNT)"
    echo -e "目标账户: ${YELLOW}$TARGET_EMAIL${NC} ($TARGET_ACCOUNT)"
    echo ""
    echo -e "${YELLOW}请选择以下方式之一：${NC}"
    echo "1. 使用 API Token 部署（推荐）"
    echo "2. 重新登录正确的账户"
    echo ""
    echo -e "${BLUE}方法1: 使用 API Token${NC}"
    echo "设置环境变量："
    echo "  export CLOUDFLARE_API_TOKEN='your-api-token'"
    echo "  export CLOUDFLARE_ACCOUNT_ID='$TARGET_ACCOUNT'"
    echo "  然后重新运行此脚本"
    echo ""
    echo -e "${BLUE}方法2: 重新登录${NC}"
    echo "运行: npx wrangler logout"
    echo "然后: npx wrangler login"
    echo "使用邮箱: $TARGET_EMAIL"
    echo ""
    
    # 检查是否设置了环境变量
    if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
        echo -e "${GREEN}✅ 检测到环境变量，尝试使用 API Token 部署...${NC}"
    else
        exit 1
    fi
else
    echo -e "${GREEN}✅ 账户匹配，继续部署...${NC}"
fi

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

# 如果设置了环境变量，使用它们
if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
    CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
    CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
    npx wrangler pages deploy dist --project-name=jbc-pages
else
    npx wrangler pages deploy dist --project-name=jbc-pages
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 部署失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 部署成功！${NC}"
echo "=================================="
echo -e "🌐 项目 URL: ${BLUE}https://jbc-pages.pages.dev${NC}"
echo ""
echo -e "${YELLOW}📝 后续操作：${NC}"
echo "1. 检查部署状态: npx wrangler pages deployment list --project-name=jbc-pages"
echo "2. 查看项目信息: npx wrangler pages project list"
echo "3. 设置环境变量（如需要）: npx wrangler pages secret put <NAME> --project-name=jbc-pages"
