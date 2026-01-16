#!/bin/bash

# 项目清理脚本
# 安全地删除不必要的临时文件、备份文件和构建产物

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 开始清理项目...${NC}"
echo "========================================"

# 统计清理前的空间
BEFORE=$(du -sh . 2>/dev/null | cut -f1)

# 1. 删除备份文件
echo -e "${YELLOW}📁 查找备份文件...${NC}"
BACKUP_FILES=$(find . -name "*.backup" -type f 2>/dev/null | grep -v node_modules || true)
if [ -n "$BACKUP_FILES" ]; then
    echo "$BACKUP_FILES" | while read -r file; do
        echo "  删除: $file"
        rm -f "$file"
    done
    echo -e "${GREEN}✅ 已删除备份文件${NC}"
else
    echo -e "${GREEN}✅ 未找到备份文件${NC}"
fi

# 2. 删除压缩包
echo -e "${YELLOW}📦 查找压缩包...${NC}"
ZIP_FILES=$(find . -maxdepth 1 -name "*.zip" -type f 2>/dev/null || true)
if [ -n "$ZIP_FILES" ]; then
    echo "$ZIP_FILES" | while read -r file; do
        SIZE=$(du -h "$file" | cut -f1)
        echo "  删除: $file ($SIZE)"
        rm -f "$file"
    done
    echo -e "${GREEN}✅ 已删除压缩包${NC}"
else
    echo -e "${GREEN}✅ 未找到压缩包${NC}"
fi

# 3. 删除 .DS_Store 文件（macOS 系统文件）
echo -e "${YELLOW}🍎 查找 .DS_Store 文件...${NC}"
DS_STORE_FILES=$(find . -name ".DS_Store" -type f 2>/dev/null | grep -v node_modules || true)
if [ -n "$DS_STORE_FILES" ]; then
    echo "$DS_STORE_FILES" | while read -r file; do
        echo "  删除: $file"
        rm -f "$file"
    done
    echo -e "${GREEN}✅ 已删除 .DS_Store 文件${NC}"
else
    echo -e "${GREEN}✅ 未找到 .DS_Store 文件${NC}"
fi

# 4. 删除临时文件
echo -e "${YELLOW}🗑️  查找临时文件...${NC}"
TEMP_FILES=$(find . -maxdepth 1 -name "verify-data.cjs" -type f 2>/dev/null || true)
if [ -n "$TEMP_FILES" ]; then
    echo "$TEMP_FILES" | while read -r file; do
        echo "  删除: $file"
        rm -f "$file"
    done
    echo -e "${GREEN}✅ 已删除临时文件${NC}"
else
    echo -e "${GREEN}✅ 未找到临时文件${NC}"
fi

# 5. 询问是否删除构建产物
echo ""
echo -e "${YELLOW}⚠️  构建产物清理（可选）${NC}"
echo "以下目录可以删除，但需要重新构建："
echo "  - dist/ (前端构建输出)"
echo "  - artifacts/ (合约编译产物)"
echo "  - cache/ (Hardhat 缓存)"
echo "  - config/cache/ (配置缓存)"
read -p "是否删除构建产物? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️  删除构建产物...${NC}"
    
    if [ -d "dist" ]; then
        DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1 || echo "0")
        echo "  删除: dist/ ($DIST_SIZE)"
        rm -rf dist/
    fi
    
    if [ -d "artifacts" ]; then
        ARTIFACTS_SIZE=$(du -sh artifacts 2>/dev/null | cut -f1 || echo "0")
        echo "  删除: artifacts/ ($ARTIFACTS_SIZE)"
        rm -rf artifacts/
    fi
    
    if [ -d "cache" ]; then
        CACHE_SIZE=$(du -sh cache 2>/dev/null | cut -f1 || echo "0")
        echo "  删除: cache/ ($CACHE_SIZE)"
        rm -rf cache/
    fi
    
    if [ -d "config/cache" ]; then
        CONFIG_CACHE_SIZE=$(du -sh config/cache 2>/dev/null | cut -f1 || echo "0")
        echo "  删除: config/cache/ ($CONFIG_CACHE_SIZE)"
        rm -rf config/cache/
    fi
    
    echo -e "${GREEN}✅ 已删除构建产物${NC}"
    echo -e "${YELLOW}💡 提示: 运行 'npm run build' 和 'npm run compile' 可以重新生成${NC}"
else
    echo -e "${BLUE}ℹ️  跳过构建产物清理${NC}"
fi

# 6. 询问是否清理输出文件
echo ""
echo -e "${YELLOW}⚠️  输出文件清理（可选）${NC}"
if [ -d "output" ] && [ "$(ls -A output 2>/dev/null)" ]; then
    OUTPUT_SIZE=$(du -sh output 2>/dev/null | cut -f1 || echo "0")
    echo "output/ 目录包含 $OUTPUT_SIZE 数据"
    read -p "是否清空 output/ 目录? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🗑️  清空 output/ 目录...${NC}"
        rm -rf output/*
        echo -e "${GREEN}✅ 已清空 output/ 目录${NC}"
    else
        echo -e "${BLUE}ℹ️  保留 output/ 目录${NC}"
    fi
fi

# 7. 询问是否清理日志文件
echo ""
echo -e "${YELLOW}⚠️  日志文件清理（可选）${NC}"
if [ -d "logs" ] && [ "$(ls -A logs 2>/dev/null)" ]; then
    LOGS_SIZE=$(du -sh logs 2>/dev/null | cut -f1 || echo "0")
    echo "logs/ 目录包含 $LOGS_SIZE 数据"
    read -p "是否清空 logs/ 目录? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🗑️  清空 logs/ 目录...${NC}"
        rm -rf logs/*
        echo -e "${GREEN}✅ 已清空 logs/ 目录${NC}"
    else
        echo -e "${BLUE}ℹ️  保留 logs/ 目录${NC}"
    fi
fi

# 统计清理后的空间
AFTER=$(du -sh . 2>/dev/null | cut -f1)

echo ""
echo -e "${GREEN}🎉 清理完成！${NC}"
echo "========================================"
echo "清理前: $BEFORE"
echo "清理后: $AFTER"
echo ""
echo -e "${BLUE}💡 提示:${NC}"
echo "  - 备份文件、压缩包、临时文件已删除"
echo "  - 如需重新构建，运行: npm run build"
echo "  - 如需重新编译合约，运行: npm run compile"
