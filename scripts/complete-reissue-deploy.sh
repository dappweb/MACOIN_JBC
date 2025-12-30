#!/bin/bash

# JBC重新发行和完整部署脚本
# 这个脚本将执行完整的重新发行流程：
# 1. 重新部署JBC合约
# 2. 部署新的协议合约
# 3. 转移所有JBC到指定地址
# 4. 更新前端配置
# 5. 部署到Cloudflare

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 JBC重新发行和完整部署流程${NC}"
echo "=================================================="
echo ""

# 检查环境
echo -e "${YELLOW}🔍 检查部署环境...${NC}"

# 检查.env文件
if [ ! -f .env ]; then
    echo -e "${RED}❌ 未找到.env文件，请确保配置了PRIVATE_KEY${NC}"
    exit 1
fi

# 检查私钥
if ! grep -q "PRIVATE_KEY" .env; then
    echo -e "${RED}❌ .env文件中未找到PRIVATE_KEY配置${NC}"
    exit 1
fi

# 检查网络连接
echo "检查MC Chain网络连接..."
if ! curl -s https://chain.mcerscan.com/ > /dev/null; then
    echo -e "${RED}❌ 无法连接到MC Chain网络${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 环境检查通过${NC}"
echo ""

# 1. 编译合约
echo -e "${YELLOW}🔨 编译智能合约...${NC}"
npm run compile

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 合约编译失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 合约编译完成${NC}"
echo ""

# 2. 部署合约
echo -e "${YELLOW}📦 部署JBC和协议合约...${NC}"
echo "目标地址: 0xdb817e0d21a134f649d24b91e39d42e7eec52a65"
echo ""

# 运行部署脚本
npm run deploy:mc -- --config config/hardhat.config.cjs scripts/deploy-jbc-reissue.cjs

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 合约部署失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 合约部署完成${NC}"
echo ""

# 3. 从部署文件中提取合约地址
echo -e "${YELLOW}📋 提取合约地址...${NC}"

# 查找最新的部署文件
LATEST_DEPLOYMENT=$(ls -t deployments/jbc-reissue-deployment-*.json 2>/dev/null | head -n1)

if [ -z "$LATEST_DEPLOYMENT" ]; then
    echo -e "${RED}❌ 未找到部署文件${NC}"
    exit 1
fi

echo "使用部署文件: $LATEST_DEPLOYMENT"

# 提取地址（需要安装jq）
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ 需要安装jq来解析JSON文件${NC}"
    echo "Ubuntu/Debian: sudo apt-get install jq"
    echo "macOS: brew install jq"
    exit 1
fi

JBC_ADDRESS=$(jq -r '.contracts.jbcToken' "$LATEST_DEPLOYMENT")
PROTOCOL_ADDRESS=$(jq -r '.contracts.protocolProxy' "$LATEST_DEPLOYMENT")

if [ "$JBC_ADDRESS" = "null" ] || [ "$PROTOCOL_ADDRESS" = "null" ]; then
    echo -e "${RED}❌ 无法从部署文件中提取合约地址${NC}"
    exit 1
fi

echo -e "JBC地址: ${GREEN}$JBC_ADDRESS${NC}"
echo -e "协议地址: ${GREEN}$PROTOCOL_ADDRESS${NC}"
echo ""

# 4. 更新前端配置
echo -e "${YELLOW}🔧 更新前端配置...${NC}"
node scripts/update-frontend-config.cjs "$JBC_ADDRESS" "$PROTOCOL_ADDRESS"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 前端配置更新失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 前端配置更新完成${NC}"
echo ""

# 5. 构建前端
echo -e "${YELLOW}🔨 构建前端应用...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 前端构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 前端构建完成${NC}"
echo ""

# 6. 部署到Cloudflare
echo -e "${YELLOW}☁️  部署到Cloudflare Pages...${NC}"

# 检查wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ wrangler CLI未安装${NC}"
    echo "请安装: npm install -g wrangler"
    exit 1
fi

# 部署
npm run pages:deploy

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Cloudflare Pages部署失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Cloudflare Pages部署完成${NC}"
echo ""

# 7. 设置环境变量
echo -e "${YELLOW}🔧 设置Cloudflare环境变量...${NC}"

# 获取项目名称（从wrangler.toml或使用默认值）
PROJECT_NAME="jinbao-protocol"
if [ -f wrangler.toml ]; then
    PROJECT_NAME=$(grep -E "^name\s*=" wrangler.toml | sed 's/.*=\s*"\([^"]*\)".*/\1/' || echo "jinbao-protocol")
fi

echo "项目名称: $PROJECT_NAME"

# 设置环境变量
echo "设置JBC合约地址..."
echo "$JBC_ADDRESS" | wrangler pages secret put JBC_CONTRACT_ADDRESS --project-name="$PROJECT_NAME"

echo "设置协议合约地址..."
echo "$PROTOCOL_ADDRESS" | wrangler pages secret put PROTOCOL_CONTRACT_ADDRESS --project-name="$PROJECT_NAME"

echo "设置链ID..."
echo "88813" | wrangler pages secret put CHAIN_ID --project-name="$PROJECT_NAME"

echo "设置RPC URL..."
echo "https://chain.mcerscan.com/" | wrangler pages secret put RPC_URL --project-name="$PROJECT_NAME"

echo -e "${GREEN}✅ 环境变量设置完成${NC}"
echo ""

# 8. 获取部署URL
echo -e "${YELLOW}🔍 获取部署信息...${NC}"

# 等待部署生效
sleep 5

DEPLOY_URL=""
if command -v wrangler &> /dev/null; then
    DEPLOY_URL=$(wrangler pages deployment list --project-name="$PROJECT_NAME" --format=json 2>/dev/null | jq -r '.[0].url' 2>/dev/null || echo "")
fi

# 9. 生成完整的部署报告
echo -e "${YELLOW}📋 生成部署报告...${NC}"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TARGET_ADDRESS="0xdb817e0d21a134f649d24b91e39d42e7eec52a65"

cat > deployment-report-complete.md << EOF
# JBC重新发行完整部署报告

## 部署概览
- **部署时间**: $TIMESTAMP
- **网络**: MC Chain (88813)
- **目标地址**: $TARGET_ADDRESS
- **部署状态**: ✅ 成功

## 合约信息
- **JBC合约地址**: \`$JBC_ADDRESS\`
- **协议合约地址**: \`$PROTOCOL_ADDRESS\`
- **JBC总供应量**: 100,000,000 JBC
- **目标地址余额**: 100,000,000 JBC (全部转移)

## 区块浏览器链接
- **JBC合约**: https://mcerscan.com/address/$JBC_ADDRESS
- **协议合约**: https://mcerscan.com/address/$PROTOCOL_ADDRESS
- **目标地址**: https://mcerscan.com/address/$TARGET_ADDRESS

## 前端部署
- **构建状态**: ✅ 成功
- **Cloudflare部署**: ✅ 成功
- **访问地址**: $DEPLOY_URL

## 环境变量配置
已在Cloudflare Pages中设置以下环境变量:
\`\`\`
JBC_CONTRACT_ADDRESS=$JBC_ADDRESS
PROTOCOL_CONTRACT_ADDRESS=$PROTOCOL_ADDRESS
CHAIN_ID=88813
RPC_URL=https://chain.mcerscan.com/
\`\`\`

## 重要变更
⚠️ **这是全新的合约部署，包含以下重要变更**:

1. **新的JBC合约**: 所有JBC代币已转移到指定地址
2. **新的协议合约**: 使用原生MC代币，支持更好的用户体验
3. **历史数据清空**: 所有用户数据、推荐关系、质押记录已清空
4. **新的合约地址**: 前端已更新为新的合约地址

## 用户迁移指南
用户需要执行以下操作:

1. **重新连接钱包**: 确保连接到MC Chain网络
2. **重新绑定推荐人**: 之前的推荐关系已清空
3. **重新购买门票**: 之前的门票已失效
4. **重新质押**: 之前的质押记录已清空
5. **重新授权代币**: 需要重新授权JBC代币给新合约

## 功能测试清单
在公告用户使用前，请完成以下测试:

### 基础功能
- [ ] 钱包连接 (MetaMask, WalletConnect等)
- [ ] 网络切换到MC Chain
- [ ] 账户余额显示 (原生MC和JBC)

### 核心功能
- [ ] 绑定推荐人
- [ ] 购买门票 (100/300/500/1000 MC)
- [ ] 质押流动性 (7/15/30天周期)
- [ ] 领取静态收益
- [ ] 领取动态奖励

### AMM功能
- [ ] MC换JBC
- [ ] JBC换MC
- [ ] 价格显示正确
- [ ] 滑点计算正确

### 管理功能 (如果适用)
- [ ] 管理员面板访问
- [ ] 合约配置修改
- [ ] 流动性管理
- [ ] 紧急功能

## 监控和维护
- **合约监控**: 建议设置合约事件监控
- **流动性监控**: 监控AMM池子的流动性状况
- **用户反馈**: 收集用户使用反馈
- **性能监控**: 监控前端应用性能

## 联系信息
如有问题，请联系技术团队。

---
*报告生成时间: $TIMESTAMP*
EOF

echo -e "${GREEN}✅ 完整部署报告已生成: deployment-report-complete.md${NC}"
echo ""

# 10. 显示完成信息
echo -e "${PURPLE}🎉 JBC重新发行和部署完成！${NC}"
echo "=================================================="
echo -e "📋 **合约地址**:"
echo -e "   JBC: ${GREEN}$JBC_ADDRESS${NC}"
echo -e "   协议: ${GREEN}$PROTOCOL_ADDRESS${NC}"
echo ""
echo -e "🌐 **访问地址**:"
if [ -n "$DEPLOY_URL" ]; then
    echo -e "   前端: ${BLUE}$DEPLOY_URL${NC}"
else
    echo -e "   前端: ${YELLOW}请检查Cloudflare Pages控制台${NC}"
fi
echo -e "   区块浏览器: ${BLUE}https://mcerscan.com/${NC}"
echo ""
echo -e "📄 **部署报告**: ${BLUE}deployment-report-complete.md${NC}"
echo ""
echo -e "${YELLOW}⚠️  重要提醒:${NC}"
echo "   • 这是全新合约，所有历史数据已清空"
echo "   • 用户需要重新开始使用"
echo "   • 请进行充分测试后再公告用户"
echo "   • 所有JBC已转移到: 0xdb817e0d21a134f649d24b91e39d42e7eec52a65"
echo ""
echo -e "${GREEN}✅ 部署流程完成，请查看部署报告了解详细信息${NC}"