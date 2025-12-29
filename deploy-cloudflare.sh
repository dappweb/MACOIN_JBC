#!/bin/bash

# Jinbao Protocol Cloudflare 部署脚本
# 使用方法: ./deploy-cloudflare.sh

set -e

echo "🚀 开始 Jinbao Protocol Cloudflare 部署..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查 wrangler 是否可用
echo -e "${BLUE}🔍 检查 wrangler...${NC}"
if ! npx wrangler --version &> /dev/null; then
    echo -e "${RED}❌ wrangler 不可用${NC}"
    exit 1
fi

# 检查是否已登录
echo -e "${BLUE}🔍 检查 Cloudflare 登录状态...${NC}"
if ! npx wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  未登录 Cloudflare，请先登录...${NC}"
    echo -e "${BLUE}📝 请在浏览器中完成登录，然后返回终端${NC}"
    npx wrangler login
    
    # 再次检查登录状态
    if ! npx wrangler whoami &> /dev/null; then
        echo -e "${RED}❌ Cloudflare 登录失败，请重试${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Cloudflare 登录成功${NC}"

# 清理并构建项目
echo -e "${BLUE}🔨 构建项目...${NC}"
rm -rf dist
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 项目构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 项目构建成功${NC}"

# 部署到 Cloudflare Pages
echo -e "${BLUE}🚀 部署到 Cloudflare Pages...${NC}"

# 检查是否存在项目
PROJECT_NAME="jinbao-protocol-prod"

# 尝试部署
if npx wrangler pages deploy dist --project-name=$PROJECT_NAME; then
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo -e "${BLUE}🌐 访问地址: https://$PROJECT_NAME.pages.dev${NC}"
else
    echo -e "${YELLOW}⚠️  项目可能不存在，尝试创建新项目...${NC}"
    
    # 创建新项目并部署
    if npx wrangler pages deploy dist --project-name=$PROJECT_NAME --compatibility-date=2024-01-01; then
        echo -e "${GREEN}✅ 新项目创建并部署成功！${NC}"
        echo -e "${BLUE}🌐 访问地址: https://$PROJECT_NAME.pages.dev${NC}"
    else
        echo -e "${RED}❌ 部署失败${NC}"
        echo -e "${YELLOW}💡 请检查：${NC}"
        echo -e "   1. Cloudflare 账户权限"
        echo -e "   2. 项目名称是否已被使用"
        echo -e "   3. 网络连接是否正常"
        exit 1
    fi
fi

# 部署后检查
echo -e "${BLUE}🔍 验证部署...${NC}"
sleep 5

# 检查健康状态
if curl -s "https://$PROJECT_NAME.pages.dev/api/health" > /dev/null; then
    echo -e "${GREEN}✅ API 端点正常${NC}"
else
    echo -e "${YELLOW}⚠️  API 端点可能需要几分钟才能生效${NC}"
fi

echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}📋 下一步：${NC}"
echo -e "   1. 访问: https://$PROJECT_NAME.pages.dev"
echo -e "   2. 设置环境变量 (如果需要):"
echo -e "      npx wrangler pages secret put JBC_CONTRACT_ADDRESS --project-name=$PROJECT_NAME"
echo -e "      npx wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS --project-name=$PROJECT_NAME"
echo -e "      npx wrangler pages secret put PRIVATE_KEY --project-name=$PROJECT_NAME"
echo -e "      npx wrangler pages secret put RPC_URL --project-name=$PROJECT_NAME"
echo -e "   3. 测试 API: https://$PROJECT_NAME.pages.dev/api/health"

echo -e "${BLUE}📖 详细文档: ./CLOUDFLARE_DEPLOYMENT_GUIDE.md${NC}"