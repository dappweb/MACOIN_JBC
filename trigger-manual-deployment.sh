#!/bin/bash

# 🚀 Manual Deployment Trigger Script
# Triggers manual deployments for both test and p-prod branches

echo "🚀 ======================================="
echo "   MANUAL DEPLOYMENT TRIGGER"
echo "🚀 ======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if GitHub CLI is available
if command -v gh &> /dev/null; then
    print_success "GitHub CLI found, attempting to trigger deployments..."
    
    echo ""
    print_status "📋 Triggering Test Branch Deployment..."
    if gh workflow run "Deploy Test Branch to Cloudflare Preview" --ref test; then
        print_success "Test deployment triggered successfully"
    else
        print_error "Failed to trigger test deployment"
    fi
    
    echo ""
    print_status "📋 Triggering P-Prod Branch Deployment..."
    if gh workflow run "Deploy P-Prod Branch to Production" --ref p-prod; then
        print_success "P-prod deployment triggered successfully"
    else
        print_error "Failed to trigger p-prod deployment"
    fi
    
    echo ""
    print_status "📊 Checking recent workflow runs..."
    gh run list --limit 5
    
else
    print_warning "GitHub CLI not found. Manual trigger required."
    echo ""
    print_status "📋 Manual Steps:"
    echo "1. Go to: https://github.com/dappweb/MACOIN_JBC/actions"
    echo "2. Select 'Deploy Test Branch to Cloudflare Preview'"
    echo "3. Click 'Run workflow' and select 'test' branch"
    echo "4. Select 'Deploy P-Prod Branch to Production'"
    echo "5. Click 'Run workflow' and select 'p-prod' branch"
fi

echo ""
print_status "======================================="
print_status "DEPLOYMENT URLS TO CHECK"
print_status "======================================="
echo "🧪 Test Environment: https://jinbao-protocol-test.pages.dev"
echo "🎯 Production Environment: https://jbc-ac-production.pages.dev"

echo ""
print_status "======================================="
print_status "MONITORING LINKS"
print_status "======================================="
echo "📊 GitHub Actions: https://github.com/dappweb/MACOIN_JBC/actions"
echo "☁️ Cloudflare Pages: https://dash.cloudflare.com/pages"

echo ""
print_success "Manual deployment trigger completed!"
print_status "Monitor the GitHub Actions page for deployment progress."