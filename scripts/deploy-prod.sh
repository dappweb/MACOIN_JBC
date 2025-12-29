#!/bin/bash

# 生产环境部署脚本
# 使用方法: ./scripts/deploy-prod.sh

set -e  # 遇到错误立即退出

echo "🚀 开始生产环境部署流程..."
echo "⏰ 部署时间: $(date)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必要的环境变量
check_env_vars() {
    echo -e "${BLUE}🔍 检查环境变量...${NC}"
    
    required_vars=(
        "PROD_PRIVATE_KEY"
        "MC_RPC_URL"
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ACCOUNT_ID"
    )
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo -e "${RED}❌ 缺少必要的环境变量:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        echo -e "${YELLOW}请设置这些环境变量后重试${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 环境变量检查通过${NC}"
}

# 检查依赖
check_dependencies() {
    echo -e "${BLUE}🔍 检查依赖...${NC}"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安装${NC}"
        exit 1
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm 未安装${NC}"
        exit 1
    fi
    
    # 检查 wrangler
    if ! command -v wrangler &> /dev/null; then
        echo -e "${YELLOW}⚠️ Wrangler 未安装，正在安装...${NC}"
        npm install -g wrangler
    fi
    
    echo -e "${GREEN}✅ 依赖检查通过${NC}"
}

# 安装项目依赖
install_dependencies() {
    echo -e "${BLUE}📦 安装项目依赖...${NC}"
    npm ci
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
}

# 运行测试
run_tests() {
    echo -e "${BLUE}🧪 运行测试套件...${NC}"
    
    # 编译合约
    echo "🔨 编译智能合约..."
    npm run compile
    
    # 运行所有测试
    echo "🧪 运行测试..."
    npm run test:all
    
    echo -e "${GREEN}✅ 所有测试通过${NC}"
}

# 构建前端
build_frontend() {
    echo -e "${BLUE}🔨 构建前端应用...${NC}"
    npm run build
    echo -e "${GREEN}✅ 前端构建完成${NC}"
}

# 部署智能合约
deploy_contracts() {
    echo -e "${BLUE}🚀 部署智能合约到 MC Chain...${NC}"
    
    export PRIVATE_KEY="$PROD_PRIVATE_KEY"
    npm run deploy:mc
    
    echo -e "${GREEN}✅ 智能合约部署完成${NC}"
}

# 部署到 Cloudflare Pages
deploy_frontend() {
    echo -e "${BLUE}🚀 部署前端到 Cloudflare Pages...${NC}"
    
    # 部署到生产环境
    wrangler pages deploy dist \
        --project-name="jinbao-protocol-prod" \
        --compatibility-date="2024-01-01" \
        --compatibility-flags="nodejs_compat"
    
    echo -e "${GREEN}✅ 前端部署完成${NC}"
}

# 配置生产环境变量
configure_env_vars() {
    echo -e "${BLUE}🔧 配置生产环境变量...${NC}"
    
    # 设置 secrets (如果提供了值)
    if [ -n "$PROD_JBC_CONTRACT_ADDRESS" ]; then
        echo "$PROD_JBC_CONTRACT_ADDRESS" | wrangler pages secret put JBC_CONTRACT_ADDRESS --project-name="jinbao-protocol-prod"
    fi
    
    if [ -n "$PROD_PROTOCOL_CONTRACT_ADDRESS" ]; then
        echo "$PROD_PROTOCOL_CONTRACT_ADDRESS" | wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS --project-name="jinbao-protocol-prod"
    fi
    
    if [ -n "$PROD_PRIVATE_KEY" ]; then
        echo "$PROD_PRIVATE_KEY" | wrangler pages secret put PRIVATE_KEY --project-name="jinbao-protocol-prod"
    fi
    
    if [ -n "$MC_RPC_URL" ]; then
        echo "$MC_RPC_URL" | wrangler pages secret put RPC_URL --project-name="jinbao-protocol-prod"
    fi
    
    echo -e "${GREEN}✅ 环境变量配置完成${NC}"
}

# 部署后验证
post_deploy_verification() {
    echo -e "${BLUE}🔍 执行部署后验证...${NC}"
    
    # 等待部署完成
    echo "⏳ 等待部署完成..."
    sleep 30
    
    # 检查前端是否可访问
    if [ -n "$PROD_FRONTEND_URL" ]; then
        echo "🌐 检查前端: $PROD_FRONTEND_URL"
        
        response=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_FRONTEND_URL")
        if [ "$response" = "200" ]; then
            echo -e "${GREEN}✅ 前端可正常访问${NC}"
        else
            echo -e "${RED}❌ 前端访问失败 (HTTP $response)${NC}"
            exit 1
        fi
    fi
    
    # 检查 API 端点
    if [ -n "$PROD_FRONTEND_URL" ]; then
        api_url="$PROD_FRONTEND_URL/api/health"
        echo "🔧 检查 API: $api_url"
        
        api_response=$(curl -s "$api_url")
        if echo "$api_response" | grep -q "success"; then
            echo -e "${GREEN}✅ API 正常工作${NC}"
        else
            echo -e "${YELLOW}⚠️ API 检查异常，但继续部署${NC}"
            echo "响应: $api_response"
        fi
    fi
    
    echo -e "${GREEN}✅ 部署后验证完成${NC}"
}

# 部署摘要
deployment_summary() {
    echo ""
    echo -e "${GREEN}🎉 =================================${NC}"
    echo -e "${GREEN}🎉 生产环境部署完成！${NC}"
    echo -e "${GREEN}🎉 =================================${NC}"
    echo "⏰ 部署时间: $(date)"
    echo "🌐 前端地址: ${PROD_FRONTEND_URL:-'待配置'}"
    echo "📝 Git 提交: $(git rev-parse --short HEAD)"
    echo "👤 操作者: $(git config user.name)"
    echo -e "${GREEN}🎉 =================================${NC}"
    echo ""
}

# 主函数
main() {
    echo -e "${BLUE}🚀 Jinbao Protocol 生产环境部署${NC}"
    echo "========================================"
    
    # 检查是否在正确的分支
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "prod" ]; then
        echo -e "${YELLOW}⚠️ 当前分支: $current_branch${NC}"
        echo -e "${YELLOW}⚠️ 建议在 prod 分支进行生产部署${NC}"
        read -p "是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "部署已取消"
            exit 1
        fi
    fi
    
    # 执行部署步骤
    check_env_vars
    check_dependencies
    install_dependencies
    run_tests
    build_frontend
    deploy_contracts
    deploy_frontend
    configure_env_vars
    post_deploy_verification
    deployment_summary
    
    echo -e "${GREEN}🎉 部署流程全部完成！${NC}"
}

# 错误处理
trap 'echo -e "${RED}❌ 部署过程中发生错误，请检查日志${NC}"; exit 1' ERR

# 执行主函数
main "$@"