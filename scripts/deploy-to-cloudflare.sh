#!/bin/bash

# JBC重新发行后的Cloudflare部署脚本
# 使用方法: ./scripts/deploy-to-cloudflare.sh <JBC_ADDRESS> <PROTOCOL_ADDRESS>

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -ne 2 ]; then
    echo -e "${RED}❌ 用法: $0 <JBC_ADDRESS> <PROTOCOL_ADDRESS>${NC}"
    echo "示例: $0 0x1234...abcd 0x5678...efgh"
    exit 1
fi

JBC_ADDRESS=$1
PROTOCOL_ADDRESS=$2

echo -e "${BLUE}🚀 开始部署到Cloudflare Pages...${NC}"
echo "=================================="
echo -e "JBC地址: ${GREEN}$JBC_ADDRESS${NC}"
echo -e "协议地址: ${GREEN}$PROTOCOL_ADDRESS${NC}"
echo ""

# 1. 更新前端配置
echo -e "${YELLOW}📝 更新前端配置文件...${NC}"
node scripts/update-frontend-config.cjs "$JBC_ADDRESS" "$PROTOCOL_ADDRESS"

# 2. 构建前端应用
echo -e "${YELLOW}🔨 构建前端应用...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 前端构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 前端构建完成${NC}"

# 3. 部署到Cloudflare Pages
echo -e "${YELLOW}☁️  部署到Cloudflare Pages...${NC}"
npm run pages:deploy

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Cloudflare Pages部署失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Cloudflare Pages部署完成${NC}"

# 4. 设置环境变量
echo -e "${YELLOW}🔧 设置Cloudflare环境变量...${NC}"

# 检查是否安装了wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ wrangler CLI未安装，请先安装: npm install -g wrangler${NC}"
    exit 1
fi

# 设置环境变量
echo "设置JBC合约地址..."
wrangler pages secret put JBC_CONTRACT_ADDRESS --project-name=jinbao-protocol <<< "$JBC_ADDRESS"

echo "设置协议合约地址..."
wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS --project-name=jinbao-protocol <<< "$PROTOCOL_ADDRESS"

echo "设置链ID..."
wrangler pages secret put CHAIN_ID --project-name=jinbao-protocol <<< "88813"

echo "设置RPC URL..."
wrangler pages secret put RPC_URL --project-name=jinbao-protocol <<< "https://chain.mcerscan.com/"

echo -e "${GREEN}✅ 环境变量设置完成${NC}"

# 5. 验证部署
echo -e "${YELLOW}🔍 验证部署...${NC}"

# 等待几秒让部署生效
sleep 5

# 获取部署URL
DEPLOY_URL=$(wrangler pages deployment list --project-name=jinbao-protocol --format=json | jq -r '.[0].url' 2>/dev/null || echo "")

if [ -n "$DEPLOY_URL" ]; then
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo -e "访问地址: ${BLUE}$DEPLOY_URL${NC}"
else
    echo -e "${YELLOW}⚠️  无法获取部署URL，请手动检查Cloudflare Pages控制台${NC}"
fi

# 6. 生成部署报告
echo -e "${YELLOW}📋 生成部署报告...${NC}"

cat > deployment-report.md << EOF
# JBC重新发行部署报告

## 部署信息
- **部署时间**: $(date)
- **JBC合约地址**: $JBC_ADDRESS
- **协议合约地址**: $PROTOCOL_ADDRESS
- **网络**: MC Chain (88813)
- **部署URL**: $DEPLOY_URL

## 合约验证
- 区块浏览器: https://mcerscan.com/
- JBC合约: https://mcerscan.com/address/$JBC_ADDRESS
- 协议合约: https://mcerscan.com/address/$PROTOCOL_ADDRESS

## 环境变量
已设置以下Cloudflare Pages环境变量:
- JBC_CONTRACT_ADDRESS=$JBC_ADDRESS
- PROTOCOL_CONTRACT_ADDRESS=$PROTOCOL_ADDRESS
- CHAIN_ID=88813
- RPC_URL=https://chain.mcerscan.com/

## 重要提醒
⚠️ 这是全新的合约部署，所有历史数据已清空
⚠️ 用户需要重新开始（绑定推荐人、购买门票等）
⚠️ 建议进行充分测试后再公告用户

## 测试清单
- [ ] 钱包连接功能
- [ ] 绑定推荐人功能
- [ ] 购买门票功能
- [ ] 质押流动性功能
- [ ] 奖励领取功能
- [ ] AMM交换功能
- [ ] 管理员功能（如果适用）

## 下一步操作
1. 进行全面功能测试
2. 验证所有合约交互正常
3. 检查前端显示是否正确
4. 准备用户公告和迁移指南
EOF

echo -e "${GREEN}✅ 部署报告已生成: deployment-report.md${NC}"

echo ""
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "=================================="
echo -e "📋 部署报告: ${BLUE}deployment-report.md${NC}"
echo -e "🌐 访问地址: ${BLUE}$DEPLOY_URL${NC}"
echo -e "🔍 区块浏览器: ${BLUE}https://mcerscan.com/${NC}"
echo ""
echo -e "${YELLOW}⚠️  请进行充分测试后再公告用户使用新合约${NC}"