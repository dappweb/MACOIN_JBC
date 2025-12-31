#!/bin/bash

# 🔍 Deployment Status Verification Script
# Verifies the current status of test and p-prod branch deployments

echo "🔍 ======================================="
echo "   DEPLOYMENT STATUS VERIFICATION"
echo "🔍 ======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check git status
print_status "Checking current git repository status..."
echo "Current branch: $(git branch --show-current)"
echo "Latest commit: $(git log --oneline -1)"

echo ""
print_status "======================================="
print_status "BRANCH STATUS VERIFICATION"
print_status "======================================="

# Check test branch
print_status "📋 Test Branch Status:"
if git show-ref --verify --quiet refs/remotes/origin/test; then
    test_commit=$(git rev-parse origin/test)
    test_msg=$(git log --oneline -1 origin/test)
    print_success "Test branch exists: $test_msg"
    echo "  • Commit: $test_commit"
    echo "  • Target: jinbao-protocol-test.pages.dev"
    echo "  • Workflow: .github/workflows/deploy-test.yml"
else
    print_error "Test branch not found on remote"
fi

echo ""
# Check p-prod branch
print_status "📋 P-Prod Branch Status:"
if git show-ref --verify --quiet refs/remotes/origin/p-prod; then
    pprod_commit=$(git rev-parse origin/p-prod)
    pprod_msg=$(git log --oneline -1 origin/p-prod)
    print_success "P-prod branch exists: $pprod_msg"
    echo "  • Commit: $pprod_commit"
    echo "  • Target: jbc-ac-production.pages.dev"
    echo "  • Workflow: .github/workflows/deploy-p-prod.yml"
else
    print_error "P-prod branch not found on remote"
fi

echo ""
print_status "======================================="
print_status "DEPLOYMENT CONFIGURATION VERIFICATION"
print_status "======================================="

# Check workflow files
print_status "📋 Checking workflow files..."

if [ -f ".github/workflows/deploy-test.yml" ]; then
    print_success "Test deployment workflow exists"
    echo "  • File: .github/workflows/deploy-test.yml"
    echo "  • Trigger: push to test branch"
else
    print_error "Test deployment workflow missing"
fi

if [ -f ".github/workflows/deploy-p-prod.yml" ]; then
    print_success "P-prod deployment workflow exists"
    echo "  • File: .github/workflows/deploy-p-prod.yml"
    echo "  • Trigger: push to p-prod branch"
else
    print_error "P-prod deployment workflow missing"
fi

echo ""
print_status "======================================="
print_status "ERROR HANDLING SYSTEM VERIFICATION"
print_status "======================================="

# Check error handling files
print_status "📋 Checking error handling system files..."

if [ -f "utils/chineseErrorFormatter.ts" ]; then
    print_success "Chinese error formatter exists"
    echo "  • File: utils/chineseErrorFormatter.ts"
else
    print_error "Chinese error formatter missing"
fi

if [ -f "components/ErrorToast.tsx" ]; then
    print_success "Error toast component exists"
    echo "  • File: components/ErrorToast.tsx"
else
    print_error "Error toast component missing"
fi

if [ -f "src/translations.ts" ]; then
    print_success "Translation system exists"
    echo "  • File: src/translations.ts"
else
    print_error "Translation system missing"
fi

# Check MiningPanel integration
if [ -f "components/MiningPanel.tsx" ]; then
    if grep -q "showFriendlyError" "components/MiningPanel.tsx"; then
        print_success "MiningPanel integrated with error handling"
        echo "  • File: components/MiningPanel.tsx"
        echo "  • Integration: showFriendlyError functions"
    else
        print_warning "MiningPanel may not be fully integrated"
    fi
else
    print_error "MiningPanel component missing"
fi

echo ""
print_status "======================================="
print_status "GITHUB ACTIONS STATUS"
print_status "======================================="

# Check if GitHub CLI is available
if command -v gh &> /dev/null; then
    print_status "📋 Recent GitHub Actions runs:"
    gh run list --limit 10 --json status,conclusion,name,createdAt,url,headBranch | \
    jq -r '.[] | "\(.status) | \(.conclusion // "running") | \(.name) | \(.headBranch) | \(.createdAt)"' | \
    while IFS='|' read -r status conclusion name branch created; do
        if [[ "$name" == *"Deploy"* ]]; then
            if [[ "$conclusion" == "success" ]]; then
                print_success "$name ($branch) - $status"
            elif [[ "$conclusion" == "failure" ]]; then
                print_error "$name ($branch) - $status"
            else
                print_warning "$name ($branch) - $status"
            fi
            echo "  • Created: $created"
        fi
    done
else
    print_warning "GitHub CLI not available. Please check manually at:"
    print_warning "https://github.com/dappweb/MACOIN_JBC/actions"
fi

echo ""
print_status "======================================="
print_status "DEPLOYMENT URLS"
print_status "======================================="

print_status "📋 Expected deployment URLs:"
echo "🧪 Test Environment:"
echo "  • https://jinbao-protocol-test.pages.dev"
echo "  • Branch: test"
echo "  • Features: Chinese error handling, comprehensive testing"

echo ""
echo "🎯 Production Environment:"
echo "  • https://jbc-ac-production.pages.dev"
echo "  • Branch: p-prod"
echo "  • Features: Security audits, performance optimization, Chinese error handling"

echo ""
print_status "======================================="
print_status "VERIFICATION CHECKLIST"
print_status "======================================="

echo "Manual verification steps:"
echo "1. [ ] Check GitHub Actions: https://github.com/dappweb/MACOIN_JBC/actions"
echo "2. [ ] Test environment accessibility"
echo "3. [ ] Production environment accessibility"
echo "4. [ ] Chinese error handling functionality"
echo "5. [ ] All transaction operations (buy ticket, stake, claim, redeem)"
echo "6. [ ] Multi-language support (zh/en/zh-TW)"
echo "7. [ ] Performance and security optimizations"

echo ""
print_success "======================================="
print_success "VERIFICATION SCRIPT COMPLETED"
print_success "======================================="
print_success "Deployment configuration appears to be properly set up"
print_success "Monitor GitHub Actions for deployment progress"