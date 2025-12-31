#!/bin/bash

# 🔍 部署优化验证脚本
# 用于验证分支部署优化的完整性

set -e

echo "🔍 开始验证部署优化状态..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查函数
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $description${NC}"
        return 0
    else
        echo -e "${RED}❌ $description${NC}"
        return 1
    fi
}

check_content() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ -f "$file" ] && grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✅ $description${NC}"
        return 0
    else
        echo -e "${RED}❌ $description${NC}"
        return 1
    fi
}

echo ""
echo -e "${BLUE}📋 =======================================${NC}"
echo -e "${BLUE}📋 验证中文错误处理系统${NC}"
echo -e "${BLUE}📋 =======================================${NC}"

# 检查中文错误处理系统文件
check_file "utils/chineseErrorFormatter.ts" "中文错误格式化工具"
check_file "components/ErrorToast.tsx" "错误提示组件"
check_file "src/translations.ts" "翻译系统"

# 检查错误处理系统内容
check_content "utils/chineseErrorFormatter.ts" "formatChineseError" "错误格式化函数"
check_content "utils/chineseErrorFormatter.ts" "getErrorSuggestion" "错误建议函数"
check_content "components/ErrorToast.tsx" "showFriendlyError" "友好错误提示函数"

echo ""
echo -e "${BLUE}🧪 =======================================${NC}"
echo -e "${BLUE}🧪 验证测试分支部署配置${NC}"
echo -e "${BLUE}🧪 =======================================${NC}"

# 检查测试部署配置
check_file ".github/workflows/deploy-test.yml" "测试分支部署工作流"
check_content ".github/workflows/deploy-test.yml" "chineseErrorFormatter" "测试工作流包含错误处理验证"
check_content ".github/workflows/deploy-test.yml" "中文错误提示系统已集成" "测试工作流包含中文通知"

echo ""
echo -e "${BLUE}🎉 =======================================${NC}"
echo -e "${BLUE}🎉 验证生产分支部署配置${NC}"
echo -e "${BLUE}🎉 =======================================${NC}"

# 检查生产部署配置
check_file ".github/workflows/deploy-p-prod.yml" "生产分支部署工作流"
check_content ".github/workflows/deploy-p-prod.yml" "chineseErrorFormatter" "生产工作流包含错误处理验证"
check_content ".github/workflows/deploy-p-prod.yml" "中文错误提示优化已上线" "生产工作流包含中文通知"

echo ""
echo -e "${BLUE}📚 =======================================${NC}"
echo -e "${BLUE}📚 验证文档和规范${NC}"
echo -e "${BLUE}📚 =======================================${NC}"

# 检查文档
check_file "BRANCH_DEPLOYMENT_OPTIMIZATION_COMPLETE.md" "部署优化完成报告"
check_file ".kiro/specs/branch-deployment-optimization/requirements.md" "部署优化需求规范"
check_file "ERROR_HANDLING_OPTIMIZATION.md" "错误处理优化文档"

echo ""
echo -e "${BLUE}🔧 =======================================${NC}"
echo -e "${BLUE}🔧 验证项目配置${NC}"
echo -e "${BLUE}🔧 =======================================${NC}"

# 检查项目配置文件
check_file "package.json" "项目配置文件"
check_file "vite.config.ts" "Vite配置文件"
check_file "tsconfig.json" "TypeScript配置文件"

# 检查构建脚本
check_content "package.json" "\"build\"" "构建脚本"
check_content "package.json" "\"dev\"" "开发脚本"

echo ""
echo -e "${BLUE}🌐 =======================================${NC}"
echo -e "${BLUE}🌐 验证网络和环境配置${NC}"
echo -e "${BLUE}🌐 =======================================${NC}"

# 检查环境配置
check_file ".env.example" "环境变量示例文件"

# 检查MC Chain配置
if [ -f "vite.config.ts" ]; then
    if grep -q "88813" "vite.config.ts"; then
        echo -e "${GREEN}✅ MC Chain (88813) 配置${NC}"
    else
        echo -e "${YELLOW}⚠️ MC Chain配置可能在其他文件中${NC}"
    fi
fi

echo ""
echo -e "${BLUE}📊 =======================================${NC}"
echo -e "${BLUE}📊 验证总结${NC}"
echo -e "${BLUE}📊 =======================================${NC}"

# 统计检查结果
total_checks=0
passed_checks=0

# 重新运行所有检查并统计
files_to_check=(
    "utils/chineseErrorFormatter.ts"
    "components/ErrorToast.tsx"
    "src/translations.ts"
    ".github/workflows/deploy-test.yml"
    ".github/workflows/deploy-p-prod.yml"
    "BRANCH_DEPLOYMENT_OPTIMIZATION_COMPLETE.md"
    ".kiro/specs/branch-deployment-optimization/requirements.md"
    "ERROR_HANDLING_OPTIMIZATION.md"
    "package.json"
    "vite.config.ts"
    "tsconfig.json"
)

for file in "${files_to_check[@]}"; do
    total_checks=$((total_checks + 1))
    if [ -f "$file" ]; then
        passed_checks=$((passed_checks + 1))
    fi
done

echo -e "${BLUE}📊 检查统计:${NC}"
echo -e "   总检查项: $total_checks"
echo -e "   通过检查: $passed_checks"
echo -e "   通过率: $(( passed_checks * 100 / total_checks ))%"

if [ $passed_checks -eq $total_checks ]; then
    echo ""
    echo -e "${GREEN}🎉 =======================================${NC}"
    echo -e "${GREEN}🎉 验证完成 - 所有检查通过！${NC}"
    echo -e "${GREEN}🎉 =======================================${NC}"
    echo ""
    echo -e "${GREEN}✅ 中文错误处理系统完整${NC}"
    echo -e "${GREEN}✅ 测试分支部署配置优化${NC}"
    echo -e "${GREEN}✅ 生产分支部署配置优化${NC}"
    echo -e "${GREEN}✅ 文档和规范完整${NC}"
    echo ""
    echo -e "${BLUE}🚀 准备提交到分支！${NC}"
    echo -e "${BLUE}运行: ./deploy-branch-updates.sh${NC}"
else
    echo ""
    echo -e "${RED}❌ =======================================${NC}"
    echo -e "${RED}❌ 验证失败 - 存在缺失项${NC}"
    echo -e "${RED}❌ =======================================${NC}"
    echo ""
    echo -e "${YELLOW}⚠️ 请检查并修复缺失的文件或配置${NC}"
    echo -e "${YELLOW}⚠️ 然后重新运行验证脚本${NC}"
fi

echo ""
echo -e "${BLUE}📞 如需帮助:${NC}"
echo -e "   1. 检查文件是否存在于正确位置"
echo -e "   2. 验证文件内容是否完整"
echo -e "   3. 确认所有依赖已安装"
echo -e "   4. 检查Git分支状态"

echo ""
echo -e "${BLUE}🔍 验证完成！${NC}"