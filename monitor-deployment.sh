#!/bin/bash

# 🔍 部署监控脚本 - 监控GitHub Actions和Cloudflare Pages部署状态

echo "🔍 ======================================="
echo "   部署监控 - GitHub Actions & Cloudflare Pages"
echo "🔍 ======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 显示当前分支状态
print_status "======================================="
print_status "当前Git状态"
print_status "======================================="
echo "当前分支: $(git branch --show-current)"
echo "Test分支最新提交: $(git log --oneline -1 origin/test 2>/dev/null || echo '未找到')"
echo "P-prod分支最新提交: $(git log --oneline -1 origin/p-prod 2>/dev/null || echo '未找到')"

print_status "======================================="
print_status "检查部署URL状态"
print_status "======================================="

# 检查测试环境
print_status "🧪 检查测试环境: https://jbc-ac-preview.pages.dev"
test_status=$(curl -s -o /dev/null -w "%{http_code}" "https://jbc-ac-preview.pages.dev" 2>/dev/null || echo "000")
if [ "$test_status" = "200" ]; then
    print_success "测试环境可访问 (HTTP $test_status)"
else
    print_warning "测试环境状态: HTTP $test_status"
fi

# 检查生产环境
print_status "🎯 检查生产环境: https://jbc-ac-production.pages.dev"
prod_status=$(curl -s -o /dev/null -w "%{http_code}" "https://jbc-ac-production.pages.dev" 2>/dev/null || echo "000")
if [ "$prod_status" = "200" ]; then
    print_success "生产环境可访问 (HTTP $prod_status)"
else
    print_warning "生产环境状态: HTTP $prod_status"
fi

print_status "======================================="
print_status "GitHub Actions监控"
print_status "======================================="

if command -v gh &> /dev/null; then
    print_success "GitHub CLI可用，检查最近的工作流运行..."
    echo ""
    print_status "最近的部署工作流:"
    gh run list --limit 10 --json status,conclusion,name,createdAt,headBranch,url | \
    jq -r '.[] | select(.name | contains("Deploy")) | "\(.status) | \(.conclusion // "运行中") | \(.name) | \(.headBranch) | \(.createdAt)"' | \
    while IFS='|' read -r status conclusion name branch created; do
        if [[ "$conclusion" == "success" ]]; then
            print_success "$name ($branch) - $status"
        elif [[ "$conclusion" == "failure" ]]; then
            print_error "$name ($branch) - $status"
        else
            print_warning "$name ($branch) - $status"
        fi
        echo "  创建时间: $created"
        echo ""
    done
else
    print_warning "GitHub CLI不可用"
    print_status "请手动检查: https://github.com/dappweb/MACOIN_JBC/actions"
fi

print_status "======================================="
print_status "部署预期时间线"
print_status "======================================="
echo "📋 GitHub Actions工作流预期时间:"
echo "  • 构建和测试: 3-5分钟"
echo "  • 部署到Cloudflare: 2-3分钟"
echo "  • 健康检查: 1-2分钟"
echo "  • 总计: 6-10分钟"

echo ""
echo "🔗 监控链接:"
echo "  • GitHub Actions: https://github.com/dappweb/MACOIN_JBC/actions"
echo "  • Cloudflare Pages: https://dash.cloudflare.com/pages"

print_status "======================================="
print_status "手动触发部署（如需要）"
print_status "======================================="
echo "如果自动部署未启动，可以手动触发:"
echo "1. 访问: https://github.com/dappweb/MACOIN_JBC/actions"
echo "2. 选择 'Deploy Test Branch to Cloudflare Preview'"
echo "3. 点击 'Run workflow' 并选择 'test' 分支"
echo "4. 选择 'Deploy P-Prod Branch to Production'"
echo "5. 点击 'Run workflow' 并选择 'p-prod' 分支"

print_success "======================================="
print_success "部署监控完成"
print_success "======================================="
print_success "两个分支已推送新提交，GitHub Actions应该正在运行"
print_status "请等待6-10分钟让部署完成，然后检查上述URL"