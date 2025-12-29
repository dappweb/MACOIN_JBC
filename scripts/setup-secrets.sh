#!/bin/bash

# Cloudflare Pages Secrets 配置脚本
# 使用方法: ./scripts/setup-secrets.sh [environment]
# 环境选项: production, staging, development

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认环境
ENVIRONMENT=${1:-production}

# 项目名称映射
declare -A PROJECT_NAMES
PROJECT_NAMES[production]="jinbao-protocol-prod"
PROJECT_NAMES[staging]="jinbao-protocol-staging"
PROJECT_NAMES[development]="jinbao-protocol-dev"

PROJECT_NAME=${PROJECT_NAMES[$ENVIRONMENT]}

if [ -z "$PROJECT_NAME" ]; then
    echo -e "${RED}❌ 无效的环境: $ENVIRONMENT${NC}"
    echo "支持的环境: production, staging, development"
    exit 1
fi

echo -e "${BLUE}🔧 配置 Cloudflare Pages Secrets${NC}"
echo "环境: $ENVIRONMENT"
echo "项目: $PROJECT_NAME"
echo "========================================"

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler 未安装${NC}"
    echo "请先安装: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️ 请先登录 Cloudflare${NC}"
    wrangler login
fi

# 设置 secrets 的函数
set_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⚠️ 跳过 $secret_name (未提供值)${NC}"
        return
    fi
    
    echo -e "${BLUE}🔑 设置 $secret_name...${NC}"
    echo "$secret_value" | wrangler pages secret put "$secret_name" --project-name="$PROJECT_NAME"
    echo -e "${GREEN}✅ $secret_name 设置完成${NC}"
}

# 智能合约相关 secrets
echo -e "${BLUE}📝 智能合约配置${NC}"
echo "================================"

# 根据环境设置不同的默认值
case $ENVIRONMENT in
    "production")
        DEFAULT_JBC_ADDRESS=""
        DEFAULT_PROTOCOL_ADDRESS=""
        DEFAULT_RPC_URL="https://rpc.mcchain.io"
        DEFAULT_BURN_AMOUNT="500"
        DEFAULT_MAX_BURN="5000"
        ;;
    "staging")
        DEFAULT_JBC_ADDRESS=""
        DEFAULT_PROTOCOL_ADDRESS=""
        DEFAULT_RPC_URL="https://rpc-testnet.mcchain.io"
        DEFAULT_BURN_AMOUNT="10"
        DEFAULT_MAX_BURN="100"
        ;;
    "development")
        DEFAULT_JBC_ADDRESS=""
        DEFAULT_PROTOCOL_ADDRESS=""
        DEFAULT_RPC_URL="http://localhost:8545"
        DEFAULT_BURN_AMOUNT="1"
        DEFAULT_MAX_BURN="10"
        ;;
esac

# 交互式输入或使用环境变量
read_secret() {
    local var_name=$1
    local prompt=$2
    local default_value=$3
    local env_value=${!var_name}
    
    if [ -n "$env_value" ]; then
        echo "$env_value"
    else
        echo -n -e "${YELLOW}$prompt${NC}"
        if [ -n "$default_value" ]; then
            echo -n " (默认: $default_value)"
        fi
        echo -n ": "
        read -r input
        echo "${input:-$default_value}"
    fi
}

# 读取配置
echo "请输入以下配置信息 (可通过环境变量预设):"
echo ""

JBC_CONTRACT_ADDRESS=$(read_secret "JBC_CONTRACT_ADDRESS" "JBC 代币合约地址" "$DEFAULT_JBC_ADDRESS")
PROTOCOL_CONTRACT_ADDRESS=$(read_secret "PROTOCOL_CONTRACT_ADDRESS" "协议合约地址" "$DEFAULT_PROTOCOL_ADDRESS")
PRIVATE_KEY=$(read_secret "PRIVATE_KEY" "部署私钥 (0x...)" "")
RPC_URL=$(read_secret "RPC_URL" "RPC 地址" "$DEFAULT_RPC_URL")

echo ""
echo -e "${BLUE}📡 通知配置 (可选)${NC}"
echo "================================"

TELEGRAM_BOT_TOKEN=$(read_secret "TELEGRAM_BOT_TOKEN" "Telegram Bot Token" "")
TELEGRAM_CHAT_ID=$(read_secret "TELEGRAM_CHAT_ID" "Telegram Chat ID" "")

echo ""
echo -e "${BLUE}⚙️ 燃烧配置${NC}"
echo "================================"

DAILY_BURN_AMOUNT=$(read_secret "DAILY_BURN_AMOUNT" "每日燃烧数量" "$DEFAULT_BURN_AMOUNT")
MAX_BURN_AMOUNT=$(read_secret "MAX_BURN_AMOUNT" "最大燃烧限制" "$DEFAULT_MAX_BURN")

# 确认配置
echo ""
echo -e "${BLUE}📋 配置摘要${NC}"
echo "================================"
echo "环境: $ENVIRONMENT"
echo "项目: $PROJECT_NAME"
echo "JBC 合约: ${JBC_CONTRACT_ADDRESS:-'未设置'}"
echo "协议合约: ${PROTOCOL_CONTRACT_ADDRESS:-'未设置'}"
echo "RPC 地址: ${RPC_URL:-'未设置'}"
echo "私钥: ${PRIVATE_KEY:+已设置}"
echo "Telegram Bot: ${TELEGRAM_BOT_TOKEN:+已设置}"
echo "Telegram Chat: ${TELEGRAM_CHAT_ID:+已设置}"
echo "每日燃烧: ${DAILY_BURN_AMOUNT:-'未设置'}"
echo "最大燃烧: ${MAX_BURN_AMOUNT:-'未设置'}"
echo ""

read -p "确认设置这些 secrets? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 0
fi

# 设置 secrets
echo ""
echo -e "${BLUE}🚀 开始设置 secrets...${NC}"
echo "================================"

set_secret "JBC_CONTRACT_ADDRESS" "$JBC_CONTRACT_ADDRESS" "JBC 代币合约地址"
set_secret "PROTOCOL_CONTRACT_ADDRESS" "$PROTOCOL_CONTRACT_ADDRESS" "协议合约地址"
set_secret "PRIVATE_KEY" "$PRIVATE_KEY" "部署私钥"
set_secret "RPC_URL" "$RPC_URL" "RPC 地址"
set_secret "TELEGRAM_BOT_TOKEN" "$TELEGRAM_BOT_TOKEN" "Telegram Bot Token"
set_secret "TELEGRAM_CHAT_ID" "$TELEGRAM_CHAT_ID" "Telegram Chat ID"

# 设置环境变量 (非敏感信息)
echo ""
echo -e "${BLUE}⚙️ 设置环境变量...${NC}"
echo "================================"

if [ -n "$DAILY_BURN_AMOUNT" ]; then
    wrangler pages secret put DAILY_BURN_AMOUNT --project-name="$PROJECT_NAME" <<< "$DAILY_BURN_AMOUNT"
    echo -e "${GREEN}✅ DAILY_BURN_AMOUNT 设置完成${NC}"
fi

if [ -n "$MAX_BURN_AMOUNT" ]; then
    wrangler pages secret put MAX_BURN_AMOUNT --project-name="$PROJECT_NAME" <<< "$MAX_BURN_AMOUNT"
    echo -e "${GREEN}✅ MAX_BURN_AMOUNT 设置完成${NC}"
fi

# 完成
echo ""
echo -e "${GREEN}🎉 =================================${NC}"
echo -e "${GREEN}🎉 Secrets 配置完成！${NC}"
echo -e "${GREEN}🎉 =================================${NC}"
echo "环境: $ENVIRONMENT"
echo "项目: $PROJECT_NAME"
echo ""
echo "你现在可以:"
echo "1. 部署应用: ./scripts/deploy-prod.sh"
echo "2. 查看 secrets: wrangler pages secret list --project-name=\"$PROJECT_NAME\""
echo "3. 测试 API: curl https://$PROJECT_NAME.pages.dev/api/health"
echo ""

# 可选: 测试连接
read -p "是否测试 API 连接? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔍 测试 API 连接...${NC}"
    
    # 等待一下让配置生效
    sleep 5
    
    API_URL="https://$PROJECT_NAME.pages.dev/api/health"
    echo "测试地址: $API_URL"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_URL" || echo "HTTPSTATUS:000")
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ API 连接成功${NC}"
        echo "响应: $body"
    else
        echo -e "${YELLOW}⚠️ API 连接失败 (HTTP $http_code)${NC}"
        echo "这可能是因为配置还未生效，请稍后再试"
    fi
fi

echo -e "${GREEN}✅ 配置脚本执行完成${NC}"