#!/bin/bash

# 🔍 Comprehensive Deployment Status Check
# Checks the actual deployment status of both environments

echo "🔍 ======================================="
echo "   DEPLOYMENT STATUS CHECK"
echo "🔍 ======================================="

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

# Function to check URL status
check_url() {
    local url=$1
    local name=$2
    
    print_status "Checking $name: $url"
    
    # Check HTTP status
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        print_success "$name is accessible (HTTP $status)"
        
        # Check if it contains our app content
        local content=$(curl -s "$url" 2>/dev/null || echo "")
        if echo "$content" | grep -q "Jinbao\|JBC\|Mining"; then
            print_success "$name contains expected application content"
        else
            print_warning "$name is accessible but may not contain the expected app"
        fi
        
        # Check for error handling system
        if echo "$content" | grep -q "chineseErrorFormatter\|ErrorToast"; then
            print_success "$name includes Chinese error handling system"
        else
            print_warning "$name may not include the error handling system (could be bundled)"
        fi
        
    elif [ "$status" = "404" ]; then
        print_error "$name not found (HTTP $status) - deployment may not exist"
    elif [ "$status" = "000" ]; then
        print_error "$name connection failed - URL may be incorrect or not deployed"
    else
        print_warning "$name returned HTTP $status - may still be deploying"
    fi
    
    echo ""
}

# Check both environments
print_status "======================================="
print_status "CHECKING DEPLOYMENT URLS"
print_status "======================================="

check_url "https://jinbao-protocol-test.pages.dev" "Test Environment"
check_url "https://jbc-ac-production.pages.dev" "Production Environment"

# Alternative URLs to check
print_status "======================================="
print_status "CHECKING ALTERNATIVE URLS"
print_status "======================================="

# Check if there are other possible project names
check_url "https://jbc-ac-preview.pages.dev" "Preview Environment (Alternative)"
check_url "https://jinbao-protocol-preview.pages.dev" "Preview Environment (Alternative 2)"

print_status "======================================="
print_status "BRANCH STATUS SUMMARY"
print_status "======================================="

# Show current branch status
print_status "Current git status:"
echo "Branch: $(git branch --show-current)"
echo "Test branch commit: $(git rev-parse origin/test 2>/dev/null || echo 'Not found')"
echo "P-prod branch commit: $(git rev-parse origin/p-prod 2>/dev/null || echo 'Not found')"

print_status "======================================="
print_status "NEXT STEPS"
print_status "======================================="

echo "1. Check GitHub Actions: https://github.com/dappweb/MACOIN_JBC/actions"
echo "2. Verify Cloudflare Pages projects exist:"
echo "   - jinbao-protocol-test"
echo "   - jbc-ac-production"
echo "3. If deployments haven't run, manually trigger them:"
echo "   - Go to GitHub Actions"
echo "   - Run 'Deploy Test Branch to Cloudflare Preview' on test branch"
echo "   - Run 'Deploy P-Prod Branch to Production' on p-prod branch"

print_success "Deployment status check completed!"