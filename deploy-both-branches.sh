#!/bin/bash

# 🚀 Deploy Both Test and P-Prod Branches to Cloudflare Pages
# This script triggers deployments for both branches

echo "🚀 ======================================="
echo "   DEPLOYING TO CLOUDFLARE PAGES"
echo "🚀 ======================================="

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

# Check current git status
print_status "Checking current git status..."
git status --porcelain

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
print_status "Current branch: $CURRENT_BRANCH"

# Check if we have the latest changes
print_status "Fetching latest changes..."
git fetch origin

# Function to check if branch exists and has commits
check_branch() {
    local branch=$1
    if git show-ref --verify --quiet refs/remotes/origin/$branch; then
        print_success "Branch '$branch' exists on remote"
        
        # Get latest commit info
        local commit=$(git rev-parse origin/$branch)
        local commit_msg=$(git log --oneline -1 origin/$branch)
        print_status "Latest commit on $branch: $commit_msg"
        return 0
    else
        print_error "Branch '$branch' does not exist on remote"
        return 1
    fi
}

# Check both branches
print_status "Checking branch status..."
check_branch "test"
TEST_BRANCH_OK=$?

check_branch "p-prod"
PPROD_BRANCH_OK=$?

if [ $TEST_BRANCH_OK -ne 0 ] || [ $PPROD_BRANCH_OK -ne 0 ]; then
    print_error "One or both branches are not available"
    exit 1
fi

# Display deployment information
echo ""
print_status "======================================="
print_status "DEPLOYMENT CONFIGURATION"
print_status "======================================="

print_status "📋 Test Branch Deployment:"
print_status "  • Branch: test"
print_status "  • Target: Cloudflare Pages"
print_status "  • Project: jbc-ac-preview"
print_status "  • URL: https://jbc-ac-preview.pages.dev"
print_status "  • Workflow: .github/workflows/deploy-test.yml"

echo ""
print_status "📋 P-Prod Branch Deployment:"
print_status "  • Branch: p-prod"
print_status "  • Target: Cloudflare Pages"
print_status "  • Project: jbc-ac-production"
print_status "  • URL: https://jbc-ac-production.pages.dev"
print_status "  • Workflow: .github/workflows/deploy-p-prod.yml"

echo ""
print_status "======================================="
print_status "DEPLOYMENT FEATURES"
print_status "======================================="
print_status "✅ Chinese Error Handling System"
print_status "✅ Multi-language Support (中文/English/繁體中文)"
print_status "✅ Context-aware Error Messages"
print_status "✅ User-friendly Error Suggestions"
print_status "✅ Performance Optimizations"
print_status "✅ Automated Health Checks"

echo ""
print_warning "======================================="
print_warning "MANUAL DEPLOYMENT TRIGGER REQUIRED"
print_warning "======================================="
print_warning "GitHub Actions workflows are configured to trigger automatically on push."
print_warning "Since we've already pushed to both branches, the deployments should be running."
print_warning ""
print_warning "To manually trigger deployments:"
print_warning "1. Go to: https://github.com/dappweb/MACOIN_JBC/actions"
print_warning "2. Select 'Deploy Test Branch to Cloudflare Preview' or 'Deploy P-Prod Branch to Production'"
print_warning "3. Click 'Run workflow' and select the appropriate branch"

echo ""
print_status "======================================="
print_status "CHECKING DEPLOYMENT STATUS"
print_status "======================================="

# Check if we can access GitHub API (optional)
if command -v gh &> /dev/null; then
    print_status "GitHub CLI found, checking workflow runs..."
    gh run list --limit 5 --json status,conclusion,name,createdAt,url
else
    print_warning "GitHub CLI not found. Please check deployment status manually at:"
    print_warning "https://github.com/dappweb/MACOIN_JBC/actions"
fi

echo ""
print_success "======================================="
print_success "DEPLOYMENT SCRIPT COMPLETED"
print_success "======================================="
print_success "Both branches are ready for deployment to Cloudflare Pages"
print_success "Monitor deployment progress at: https://github.com/dappweb/MACOIN_JBC/actions"

echo ""
print_status "Expected URLs after deployment:"
print_status "🧪 Test Environment: https://jbc-ac-preview.pages.dev"
print_status "🎯 Production Environment: https://jbc-ac-production.pages.dev"

echo ""
print_status "Deployment includes the latest Chinese error handling fixes:"
print_status "• User-friendly error messages for ticket purchases"
print_status "• Context-aware error suggestions"
print_status "• Multi-language error support"
print_status "• Improved user experience for all transactions"