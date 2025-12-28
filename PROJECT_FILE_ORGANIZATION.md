# 📁 Jinbao Protocol 项目文件整理方案

## 🎯 整理目标

将项目文件按功能和类型进行分类，创建清晰的目录结构，提高项目的可维护性和可读性。

## 📋 当前文件分析

### 🔍 文件类型统计
- **文档文件**: 30+ 个 (.md 文件)
- **源代码文件**: 20+ 个 (.ts, .tsx, .js 文件)
- **配置文件**: 10+ 个 (配置和构建文件)
- **合约文件**: contracts/ 目录
- **构建产物**: dist/, artifacts/, cache/ 目录
- **依赖文件**: node_modules/, package.json 等

## 🗂️ 建议的目录结构

```
jinbao-protocol/
├── 📁 docs/                          # 📚 文档目录
│   ├── 📁 analysis/                  # 分析文档
│   │   ├── ADMIN_PRIVILEGES_ANALYSIS.md
│   │   ├── REWARD_STRATEGIES_ANALYSIS.md
│   │   ├── differential-reward-income-analysis.md
│   │   └── FRONTEND_CONTRACT_ALIGNMENT.md
│   ├── 📁 design/                    # 设计文档
│   │   ├── DIFFERENTIAL_REWARD_DESIGN.md
│   │   ├── CONTRACT_UPGRADE_PLAN.md
│   │   └── ALIGNMENT_TABLE.md
│   ├── 📁 fixes/                     # 修复文档
│   │   ├── differential-reward-ui-fix.md
│   │   ├── ticket-purchase-logic-fix.md
│   │   ├── LIQUIDITY_CALCULATION_FIX.md
│   │   ├── SWAP_AUTHORIZATION_OPTIMIZATION.md
│   │   └── TICKET_HISTORY_STATUS_FIX.md
│   ├── 📁 guides/                    # 指南文档
│   │   ├── D1_SETUP_GUIDE.md
│   │   ├── PAGES_DEPLOYMENT_GUIDE.md
│   │   ├── TESTING_PLUGINS_RECOMMENDATIONS.md
│   │   └── TRANSACTION_HISTORY_README.md
│   ├── 📁 cloudflare/               # Cloudflare相关文档
│   │   ├── CLOUDFLARE_DAILY_BURN_SOLUTION.md
│   │   ├── CLOUDFLARE_PAGES_BURN_SOLUTION.md
│   │   └── CLOUDFLARE_PAGES_README.md
│   ├── 📁 contracts/                # 合约文档
│   │   ├── CONTRACT_DOCS.md
│   │   ├── TICKET_VS_LIQUIDITY_EXPLANATION.md
│   │   └── LIQUIDITY_STAKING_SIMPLIFICATION.md
│   ├── 📁 testing/                  # 测试文档
│   │   ├── TEST_REPORT.md
│   │   ├── ticket-purchase-logic-test.md
│   │   ├── SWAP_AUTHORIZATION_TEST_GUIDE.md
│   │   └── TEAM_BASED_REWARDS_IMPLEMENTATION_SUMMARY.md
│   ├── 📁 whitepapers/              # 白皮书
│   │   ├── whitepaper-EN.md
│   │   ├── whitepaper-CN.md
│   │   └── 金宝 RWA · DeFi 4.0 智能合约技术需求文档 v2.0.md
│   ├── PROJECT_REQUIREMENTS.md
│   ├── CHANGELOG.md
│   └── REAL_PRICE_CHART_IMPLEMENTATION.md
│
├── 📁 src/                           # 🎨 前端源码
│   ├── 📁 components/               # React组件
│   ├── 📁 hooks/                    # React Hooks
│   ├── 📁 utils/                    # 工具函数
│   ├── 📁 assets/                   # 静态资源
│   │   ├── mc_chain.png
│   │   └── photo_2025-12-11_17-19-16.jpg
│   ├── App.tsx
│   ├── index.tsx
│   ├── LanguageContext.tsx
│   ├── Web3Context.tsx
│   ├── wagmi-adapters.ts
│   ├── translations.ts
│   ├── types.ts
│   ├── constants.ts
│   └── config.ts
│
├── 📁 contracts/                     # 📜 智能合约
│   └── (现有合约文件)
│
├── 📁 scripts/                      # 🔧 脚本文件
│   ├── deploy/                      # 部署脚本
│   ├── check_selector.cjs
│   └── install-testing-plugins.sh
│
├── 📁 test/                         # 🧪 测试文件
│   └── (现有测试文件)
│
├── 📁 functions/                    # ☁️ Cloudflare Functions
│   ├── api/
│   │   ├── burn.ts
│   │   ├── status.ts
│   │   └── health.ts
│   └── _middleware.ts
│
├── 📁 .github/                      # 🤖 GitHub配置
│   └── workflows/
│       └── daily-burn.yml
│
├── 📁 config/                       # ⚙️ 配置文件
│   ├── hardhat.config.cjs
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   ├── pages-wrangler.toml
│   └── metadata.json
│
├── 📁 public/                       # 🌐 公共资源
│   └── (静态文件)
│
├── 📁 build/                        # 🏗️ 构建产物
│   ├── dist/
│   ├── artifacts/
│   └── cache/
│
├── 📁 archive/                      # 📦 归档文件
│   ├── test-page-fix.html
│   ├── mc.txt
│   └── vite.config.ts.timestamp-*
│
├── 📁 cloudflare-worker/           # 🔥 独立Worker方案 (可选)
│   └── (现有Worker文件)
│
├── package.json                     # 📦 项目配置
├── package-lock.json
├── .env.example
├── .gitignore
├── index.html
└── README.md                        # 📖 项目说明
```

## 🚀 整理执行计划

### 阶段1: 创建目录结构
1. 创建主要目录
2. 创建子目录分类

### 阶段2: 移动文档文件
1. 按功能分类移动.md文件
2. 保持文件名不变，避免链接失效

### 阶段3: 整理源码文件
1. 移动前端源码到src/目录
2. 整理静态资源到assets/目录

### 阶段4: 整理配置文件
1. 移动配置文件到config/目录
2. 保持根目录必要文件

### 阶段5: 清理和归档
1. 移动临时文件到archive/目录
2. 清理不需要的文件

## 📝 整理脚本

我将创建自动化脚本来执行文件整理：

### 1. 创建目录结构脚本
### 2. 移动文件脚本  
### 3. 更新引用路径脚本
### 4. 验证整理结果脚本

## ⚠️ 注意事项

1. **备份重要文件**: 整理前先备份
2. **更新引用路径**: 移动文件后需要更新import路径
3. **保持Git历史**: 使用git mv命令移动文件
4. **测试功能**: 整理后测试项目功能
5. **更新文档**: 更新README和相关文档

## 🎯 整理后的优势

1. **清晰的结构**: 文件按功能分类，易于查找
2. **更好的维护性**: 相关文件集中管理
3. **提高效率**: 减少查找文件的时间
4. **专业外观**: 项目结构更加专业
5. **便于协作**: 团队成员更容易理解项目结构

## 📋 整理检查清单

- [ ] 创建目录结构
- [ ] 移动文档文件
- [ ] 整理源码文件
- [ ] 移动配置文件
- [ ] 更新引用路径
- [ ] 测试项目功能
- [ ] 更新README文档
- [ ] 提交Git变更
- [ ] 验证部署流程

准备好开始整理了吗？我可以逐步执行这个整理方案。