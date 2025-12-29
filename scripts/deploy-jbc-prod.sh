#!/bin/bash

# JBC Chain 生产环境部署脚本
# 使用方法: ./scripts/deploy-jbc-prod.sh

set -e  # 遇到错误立即退出

echo "🌟 开始 JBC Chain 生产环境部署流程..."
echo "⏰ 部署时间: $(date)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 检查必要的环境变量
check_jbc_env_vars() {
    echo -e "${BLUE}🔍 检查 JBC Chain 环境变量...${NC}"
    
    required_vars=(
        "JBC_PRIVATE_KEY"
        "JBC_RPC_URL"
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
        echo -e "${RED}❌ 缺少必要的 JBC Chain 环境变量:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        echo -e "${YELLOW}请设置这些环境变量后重试${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ JBC Chain 环境变量检查通过${NC}"
}

# 检查 JBC Chain 网络连接
check_jbc_network() {
    echo -e "${BLUE}🌐 检查 JBC Chain 网络连接...${NC}"
    
    # 测试 RPC 连接
    response=$(curl -s -X POST "$JBC_RPC_URL" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' || echo "")
    
    if [ -z "$response" ]; then
        echo -e "${RED}❌ 无法连接到 JBC Chain RPC: $JBC_RPC_URL${NC}"
        exit 1
    fi
    
    # 提取链 ID
    chain_id=$(echo "$response" | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$chain_id" ]; then
        echo -e "${GREEN}✅ JBC Chain 连接成功，链 ID: $chain_id${NC}"
    else
        echo -e "${YELLOW}⚠️ JBC Chain 连接成功，但无法获取链 ID${NC}"
    fi
}

# 检查账户余额
check_jbc_balance() {
    echo -e "${BLUE}💰 检查 JBC Chain 账户余额...${NC}"
    
    # 这里需要根据实际的 JBC Chain 配置来检查余额
    echo -e "${YELLOW}⚠️ 请手动确认部署账户有足够的 JBC 代币用于部署${NC}"
    echo -e "${BLUE}ℹ️ 建议余额: 至少 10 JBC 用于合约部署和初始化${NC}"
}

# 编译合约
compile_contracts() {
    echo -e "${BLUE}🔨 编译智能合约...${NC}"
    npm run compile
    echo -e "${GREEN}✅ 合约编译完成${NC}"
}

# 运行测试
run_tests() {
    echo -e "${BLUE}🧪 运行测试套件...${NC}"
    
    # 运行合约测试
    echo "🔧 运行合约测试..."
    npm run test:contracts
    
    # 运行前端测试
    echo "🖥️ 运行前端测试..."
    npm run test:ui
    
    echo -e "${GREEN}✅ 所有测试通过${NC}"
}

# 部署到 JBC Chain
deploy_to_jbc() {
    echo -e "${PURPLE}🚀 部署智能合约到 JBC Chain...${NC}"
    
    export PRIVATE_KEY="$JBC_PRIVATE_KEY"
    export RPC_URL="$JBC_RPC_URL"
    
    # 部署合约
    npm run deploy:jbc
    
    echo -e "${GREEN}✅ 智能合约部署到 JBC Chain 完成${NC}"
}

# 构建前端
build_frontend() {
    echo -e "${BLUE}🔨 构建前端应用...${NC}"
    
    # 设置 JBC Chain 环境变量
    export VITE_CHAIN_NAME="JIBCHAIN L1"
    export VITE_NATIVE_TOKEN_SYMBOL="JBC"
    export VITE_NATIVE_TOKEN_NAME="JIBCOIN"
    
    npm run build
    echo -e "${GREEN}✅ 前端构建完成${NC}"
}

# 部署前端到 Cloudflare Pages
deploy_frontend() {
    echo -e "${PURPLE}🚀 部署前端到 Cloudflare Pages...${NC}"
    
    # 部署到 JBC Chain 生产环境项目
    wrangler pages deploy dist \
        --project-name="jinbao-jbc-prod" \
        --compatibility-date="2024-01-01" \
        --compatibility-flags="nodejs_compat"
    
    echo -e "${GREEN}✅ 前端部署到 Cloudflare Pages 完成${NC}"
}

# 配置 JBC Chain 环境变量
configure_jbc_env_vars() {
    echo -e "${BLUE}🔧 配置 JBC Chain 生产环境变量...${NC}"
    
    # 设置 JBC Chain 特定的 secrets
    if [ -n "$JBC_CONTRACT_ADDRESS" ]; then
        echo "$JBC_CONTRACT_ADDRESS" | wrangler pages secret put JBC_CONTRACT_ADDRESS --project-name="jinbao-jbc-prod"
    fi
    
    if [ -n "$JBC_PROTOCOL_CONTRACT_ADDRESS" ]; then
        echo "$JBC_PROTOCOL_CONTRACT_ADDRESS" | wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS --project-name="jinbao-jbc-prod"
    fi
    
    if [ -n "$JBC_PRIVATE_KEY" ]; then
        echo "$JBC_PRIVATE_KEY" | wrangler pages secret put PRIVATE_KEY --project-name="jinbao-jbc-prod"
    fi
    
    if [ -n "$JBC_RPC_URL" ]; then
        echo "$JBC_RPC_URL" | wrangler pages secret put RPC_URL --project-name="jinbao-jbc-prod"
    fi
    
    echo -e "${GREEN}✅ JBC Chain 环境变量配置完成${NC}"
}

# 部署后验证
post_deploy_verification() {
    echo -e "${BLUE}🔍 执行 JBC Chain 部署后验证...${NC}"
    
    # 等待部署完成
    echo "⏳ 等待部署完成..."
    sleep 30
    
    # 检查前端是否可访问
    if [ -n "$JBC_FRONTEND_URL" ]; then
        echo "🌐 检查前端: $JBC_FRONTEND_URL"
        
        response=$(curl -s -o /dev/null -w "%{http_code}" "$JBC_FRONTEND_URL")
        if [ "$response" = "200" ]; then
            echo -e "${GREEN}✅ JBC Chain 前端可正常访问${NC}"
        else
            echo -e "${RED}❌ JBC Chain 前端访问失败 (HTTP $response)${NC}"
            exit 1
        fi
    fi
    
    # 检查 API 端点
    if [ -n "$JBC_FRONTEND_URL" ]; then
        api_url="$JBC_FRONTEND_URL/api/health"
        echo "🔧 检查 API: $api_url"
        
        api_response=$(curl -s "$api_url")
        if echo "$api_response" | grep -q "success"; then
            echo -e "${GREEN}✅ JBC Chain API 正常工作${NC}"
        else
            echo -e "${YELLOW}⚠️ JBC Chain API 检查异常，但继续部署${NC}"
            echo "响应: $api_response"
        fi
    fi
    
    echo -e "${GREEN}✅ JBC Chain 部署后验证完成${NC}"
}

# 部署摘要
deployment_summary() {
    echo ""
    echo -e "${PURPLE}🎉 =================================${NC}"
    echo -e "${PURPLE}🎉 JBC Chain 生产环境部署完成！${NC}"
    echo -e "${PURPLE}🎉 =================================${NC}"
    echo "⏰ 部署时间: $(date)"
    echo "🌐 网络: JIBCHAIN L1"
    echo "🔗 前端地址: ${JBC_FRONTEND_URL:-'待配置'}"
    echo "⚡ 出块时间: ~2-3秒"
    echo "💰 交易费用: < $0.01"
    echo "📝 Git 提交: $(git rev-parse --short HEAD)"
    echo "👤 操作者: $(git config user.name)"
    echo -e "${PURPLE}🎉 =================================${NC}"
    echo ""
    
    echo -e "${GREEN}🌟 JBC Chain 特性:${NC}"
    echo "  • 更快的出块时间 (2-3秒)"
    echo "  • 更低的交易费用 (< $0.01)"
    echo "  • 原生 JBC 代币支持"
    echo "  • 完全 EVM 兼容"
    echo "  • 跨链桥接支持"
}

# 主函数
main() {
    echo -e "${PURPLE}🌟 Jinbao Protocol JBC Chain 生产环境部署${NC}"
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
    check_jbc_env_vars
    check_jbc_network
    check_jbc_balance
    compile_contracts
    run_tests
    deploy_to_jbc
    build_frontend
    deploy_frontend
    configure_jbc_env_vars
    post_deploy_verification
    deployment_summary
    
    echo -e "${GREEN}🎉 JBC Chain 部署流程全部完成！${NC}"
    echo ""
    echo -e "${BLUE}🚀 下一步建议:${NC}"
    echo "  1. 验证合约功能"
    echo "  2. 测试质押和收益"
    echo "  3. 配置监控告警"
    echo "  4. 通知用户迁移"
}

# 错误处理
trap 'echo -e "${RED}❌ JBC Chain 部署过程中发生错误，请检查日志${NC}"; exit 1' ERR

# 执行主函数
main "$@"