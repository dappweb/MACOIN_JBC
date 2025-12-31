#!/bin/bash

# 🚀 分支部署优化提交脚本
# 用于将优化后的部署配置提交到test和p-prod分支

set -e

echo "🚀 开始分支部署优化提交流程..."

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 当前分支: $CURRENT_BRANCH"

# 检查是否有未提交的更改
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "⚠️ 检测到未提交的更改，请先提交或暂存当前更改"
    git status
    exit 1
fi

# 要提交的文件列表
FILES_TO_COMMIT=(
    ".github/workflows/deploy-test.yml"
    ".github/workflows/deploy-p-prod.yml"
    "utils/chineseErrorFormatter.ts"
    "components/ErrorToast.tsx"
    "src/translations.ts"
    "BRANCH_DEPLOYMENT_OPTIMIZATION_COMPLETE.md"
    ".kiro/specs/branch-deployment-optimization/requirements.md"
)

# 检查文件是否存在
echo "🔍 检查必要文件..."
for file in "${FILES_TO_COMMIT[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file 不存在"
        exit 1
    fi
done

# 函数：提交到指定分支
commit_to_branch() {
    local branch_name=$1
    local commit_message=$2
    
    echo ""
    echo "🌿 切换到分支: $branch_name"
    
    # 检查分支是否存在
    if git show-ref --verify --quiet refs/heads/$branch_name; then
        git checkout $branch_name
        echo "✅ 已切换到现有分支: $branch_name"
    else
        echo "❌ 分支 $branch_name 不存在，请先创建该分支"
        return 1
    fi
    
    # 拉取最新更改
    echo "📥 拉取最新更改..."
    git pull origin $branch_name || echo "⚠️ 无法拉取，可能是新分支"
    
    # 从主分支合并必要文件
    echo "🔄 从主分支合并必要文件..."
    git checkout $CURRENT_BRANCH -- "${FILES_TO_COMMIT[@]}" || echo "⚠️ 部分文件可能不存在"
    
    # 检查是否有更改
    if git diff --quiet && git diff --cached --quiet; then
        echo "ℹ️ 没有检测到更改，跳过提交"
        return 0
    fi
    
    # 添加文件
    echo "📝 添加文件到暂存区..."
    git add "${FILES_TO_COMMIT[@]}"
    
    # 提交更改
    echo "💾 提交更改..."
    git commit -m "$commit_message"
    
    # 推送到远程
    echo "🚀 推送到远程分支..."
    git push origin $branch_name
    
    echo "✅ 成功提交到分支: $branch_name"
}

# 提交到test分支
echo ""
echo "🧪 ======================================="
echo "🧪 提交到测试分支 (test)"
echo "🧪 ======================================="

commit_to_branch "test" "🚀 优化测试分支部署配置，集成中文错误处理系统

✨ 主要改进:
- 集成中文错误处理系统验证
- 增强健康检查和错误处理系统检测
- 优化构建流程和错误提示
- 添加中文通知支持

📋 包含文件:
- 优化的测试部署工作流
- 中文错误格式化工具
- 错误提示组件
- 翻译系统
- 完整文档

🎯 目标: 提升中文用户体验，优化测试环境部署流程"

# 提交到p-prod分支
echo ""
echo "🎉 ======================================="
echo "🎉 提交到生产分支 (p-prod)"
echo "🎉 ======================================="

commit_to_branch "p-prod" "🎉 优化生产分支部署配置，集成中文错误处理系统

✨ 主要改进:
- 集成完整的中文错误处理系统
- 增强安全检查和性能监控
- 优化生产环境构建流程
- 添加全面的健康检查

📋 包含文件:
- 优化的生产部署工作流
- 中文错误格式化工具
- 错误提示组件
- 翻译系统
- 完整文档

🎯 目标: 生产级中文用户体验，确保部署质量和安全性

🌐 网络: MC Chain (88813) 主网
🚀 功能: 智能错误翻译、上下文提示、解决建议"

# 回到原始分支
echo ""
echo "🔄 回到原始分支: $CURRENT_BRANCH"
git checkout $CURRENT_BRANCH

echo ""
echo "🎉 ======================================="
echo "🎉 分支部署优化提交完成！"
echo "🎉 ======================================="
echo ""
echo "📊 提交总结:"
echo "✅ test分支: 测试环境部署优化"
echo "✅ p-prod分支: 生产环境部署优化"
echo "🚀 中文错误处理系统已集成到所有分支"
echo ""
echo "🔗 下一步:"
echo "1. 检查GitHub Actions执行状态"
echo "2. 验证Cloudflare Pages部署"
echo "3. 测试中文错误处理功能"
echo "4. 监控部署性能和质量指标"
echo ""
echo "📞 如有问题，请检查:"
echo "- GitHub Actions日志"
echo "- Cloudflare Pages部署状态"
echo "- 环境变量配置"
echo "- 网络连接状态"
echo ""
echo "🎯 部署优化完成！准备享受更好的中文用户体验！ ✨"