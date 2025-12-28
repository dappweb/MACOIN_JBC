#!/bin/bash

# Jinbao Daily Burn - 部署脚本
# 使用方法: ./deploy.sh [staging|production]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${2}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

print_success() {
    print_message "$1" "$GREEN"
}

print_error() {
    print_message "$1" "$RED"
}

print_warning() {
    print_message "$1" "$YELLOW"
}

print_info() {
    print_message "$1" "$BLUE"
}

# 检查参数
ENVIRONMENT=${1:-staging}

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    print_error "错误: 环境参数必须是 'staging' 或 'production'"
    echo "使用方法: $0 [staging|production]"
    exit 1
fi

print_info "🚀 开始部署 Jinbao Daily Burn Worker 到 $ENVIRONMENT 环境"

# 检查必要的工具
print_info "🔍 检查必要工具..."

if ! command -v wrangler &> /dev/null; then
    print_error "❌ Wrangler CLI 未安装"
    print_info "请运行: npm install -g wrangler"
    exit 1
fi

if ! command -v node &> /dev/null; then
    print_error "❌ Node.js 未安装"
    exit 1
fi

print_success "✅ 工具检查完成"

# 检查依赖
print_info "📦 检查项目依赖..."

if [ ! -d "node_modules" ]; then
    print_warning "⚠️ 依赖未安装，正在安装..."
    npm install
fi

print_success "✅ 依赖检查完成"

# 检查配置文件
print_info "⚙️ 检查配置文件..."

if [ ! -f "wrangler.toml" ]; then
    print_error "❌ wrangler.toml 配置文件不存在"
    exit 1
fi

print_success "✅ 配置文件检查完成"

# 检查环境变量
print_info "🔐 检查环境变量..."

check_secret() {
    local secret_name=$1
    local env_flag=""
    
    if [ "$ENVIRONMENT" != "staging" ]; then
        env_flag="--env $ENVIRONMENT"
    fi
    
    if ! wrangler secret list $env_flag 2>/dev/null | grep -q "$secret_name"; then
        print_warning "⚠️ 缺少环境变量: $secret_name"
        read -p "是否现在设置 $secret_name? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            wrangler secret put "$secret_name" $env_flag
        else
            print_error "❌ 缺少必要的环境变量: $secret_name"
            exit 1
        fi
    fi
}

# 检查必要的secrets
check_secret "PRIVATE_KEY"
check_secret "RPC_URL"

# 可选的secrets
if ! wrangler secret list --env "$ENVIRONMENT" 2>/dev/null | grep -q "TELEGRAM_BOT_TOKEN"; then
    print_warning "⚠️ 未设置 TELEGRAM_BOT_TOKEN (可选)"
    read -p "是否设置Telegram通知? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        check_secret "TELEGRAM_BOT_TOKEN"
        check_secret "TELEGRAM_CHAT_ID"
    fi
fi

print_success "✅ 环境变量检查完成"

# 构建项目
print_info "🔨 构建项目..."
npm run build

print_success "✅ 项目构建完成"

# 部署
print_info "🚀 部署到 $ENVIRONMENT 环境..."

if [ "$ENVIRONMENT" = "staging" ]; then
    wrangler deploy --env staging
else
    wrangler deploy --env production
fi

if [ $? -eq 0 ]; then
    print_success "✅ 部署成功!"
    
    # 获取Worker URL
    WORKER_URL=$(wrangler whoami 2>/dev/null | grep -o 'https://.*\.workers\.dev' | head -1)
    if [ -z "$WORKER_URL" ]; then
        WORKER_URL="https://jinbao-daily-burn-${ENVIRONMENT}.your-subdomain.workers.dev"
    fi
    
    print_info "🌐 Worker URL: $WORKER_URL"
    print_info "📊 状态查询: $WORKER_URL/status"
    print_info "🔥 手动燃烧: curl -X POST $WORKER_URL/burn"
    print_info "❤️ 健康检查: $WORKER_URL/health"
    
    # 测试部署
    print_info "🧪 测试部署..."
    
    if curl -s -f "$WORKER_URL/health" > /dev/null; then
        print_success "✅ 健康检查通过"
    else
        print_warning "⚠️ 健康检查失败，请检查部署状态"
    fi
    
    # 显示下次执行时间
    print_info "⏰ 定时任务: 每日 UTC 00:00 自动执行"
    
    # 显示监控信息
    print_info "📈 监控命令:"
    echo "  实时日志: wrangler tail --env $ENVIRONMENT"
    echo "  Dashboard: https://dash.cloudflare.com"
    
else
    print_error "❌ 部署失败"
    exit 1
fi

print_success "🎉 部署完成!"