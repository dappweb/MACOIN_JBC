# 🔥 Jinbao Protocol - RWA DeFi 4.0

> 基于真实世界资产(RWA)的去中心化金融协议，集成自动化代币燃烧机制

## 🌟 项目特性

- **智能合约系统**: 完整的DeFi协议实现
- **前端应用**: React + TypeScript + Vite构建的现代化Web应用
- **自动化燃烧**: 基于Cloudflare Pages + GitHub Actions的定时代币燃烧
- **多重奖励机制**: 直推奖励、层级奖励、极差奖励等
- **实时监控**: 完整的交易历史和数据分析

## 📁 项目结构

```
jinbao-protocol/
├── 📁 src/                          # 🎨 前端源码
│   ├── components/                  # React组件
│   ├── hooks/                       # React Hooks
│   ├── utils/                       # 工具函数
│   ├── assets/                      # 静态资源
│   └── *.tsx, *.ts                  # 主要源码文件
├── 📁 contracts/                    # 📜 智能合约
├── 📁 functions/                    # ☁️ Cloudflare Functions
│   └── api/                         # API端点
├── 📁 docs/                         # 📚 项目文档
│   ├── analysis/                    # 分析文档
│   ├── design/                      # 设计文档
│   ├── fixes/                       # 修复文档
│   ├── guides/                      # 指南文档
│   ├── cloudflare/                  # Cloudflare相关
│   ├── contracts/                   # 合约文档
│   ├── testing/                     # 测试文档
│   └── whitepapers/                 # 白皮书
├── 📁 config/                       # ⚙️ 配置文件
├── 📁 scripts/                      # 🔧 脚本文件
├── 📁 test/                         # 🧪 测试文件
└── 📁 .github/workflows/            # 🤖 GitHub Actions
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn
- Git

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/dappweb/MACOIN_JBC.git
cd MACOIN_JBC

# 安装依赖
npm install
```

### 本地开发

```bash
# 启动前端开发服务器
npm run dev

# 编译智能合约
npm run compile

# 运行测试
npm run test

# 启动Cloudflare Pages Functions本地开发
npm run pages:dev
```

### 构建部署

```bash
# 构建前端应用
npm run build

# 部署到Cloudflare Pages
npm run pages:deploy
```

## 🔥 自动化代币燃烧

### 功能特性

- **定时执行**: 每日UTC 00:00自动燃烧
- **API接口**: 支持手动触发和状态查询
- **实时通知**: Telegram集成通知
- **安全控制**: 多重验证和限制机制

### API端点

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/health` | GET | 健康检查 | 无 |
| `/api/status` | GET | 燃烧状态查询 | 无 |
| `/api/burn` | POST | 执行代币燃烧 | Bearer Token |

### 部署配置

详细的部署指南请参考：
- [Cloudflare Pages部署指南](./docs/guides/PAGES_DEPLOYMENT_GUIDE.md)
- [Cloudflare燃烧方案](./docs/cloudflare/CLOUDFLARE_PAGES_BURN_SOLUTION.md)

## 📊 智能合约

### 核心合约

- **JinbaoProtocol.sol**: 主协议合约
- **JBC.sol**: JBC代币合约
- **MC Token**: MC代币合约

### 主要功能

- 门票购买和管理
- 流动性质押
- 多层级奖励分发
- 代币兑换(AMM)
- 自动化燃烧机制

## 🎨 前端应用

### 技术栈

- **React 19**: 前端框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具
- **Tailwind CSS**: 样式框架
- **Wagmi**: Web3连接
- **RainbowKit**: 钱包连接

### 主要功能

- 钱包连接和管理
- 门票购买和质押
- 奖励查看和提取
- 交易历史记录
- 管理员面板

## 📚 文档

### 核心文档

- [项目需求文档](./docs/PROJECT_REQUIREMENTS.md)
- [合约文档](./docs/contracts/CONTRACT_DOCS.md)
- [前端合约对齐表](./docs/analysis/FRONTEND_CONTRACT_ALIGNMENT.md)

### 技术文档

- [奖励策略分析](./docs/analysis/REWARD_STRATEGIES_ANALYSIS.md)
- [管理员权限分析](./docs/analysis/ADMIN_PRIVILEGES_ANALYSIS.md)
- [差异化奖励设计](./docs/design/DIFFERENTIAL_REWARD_DESIGN.md)

### 部署指南

- [Cloudflare Pages部署](./docs/guides/PAGES_DEPLOYMENT_GUIDE.md)
- [测试插件推荐](./docs/guides/TESTING_PLUGINS_RECOMMENDATIONS.md)

## 🧪 测试

### 运行测试

```bash
# 合约测试
npm run test:contracts

# 前端测试
npm run test:ui

# 覆盖率测试
npm run test:coverage

# 所有测试
npm run test:all
```

### 测试报告

- [测试报告](./docs/testing/TEST_REPORT.md)
- [团队奖励实现总结](./docs/testing/TEAM_BASED_REWARDS_IMPLEMENTATION_SUMMARY.md)

## 🔧 开发脚本

```bash
# 开发相关
npm run dev              # 启动开发服务器
npm run build            # 构建应用
npm run preview          # 预览构建结果

# 合约相关
npm run compile          # 编译合约
npm run deploy           # 部署合约
npm run deploy:mc        # 部署到MC网络

# 测试相关
npm run test             # 运行测试
npm run test:ui          # UI测试
npm run test:coverage    # 覆盖率测试

# Cloudflare相关
npm run pages:dev        # Pages本地开发
npm run pages:deploy     # 部署到Pages
npm run burn:test        # 测试燃烧API
npm run burn:status      # 查看燃烧状态
```

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目！

### 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🔗 相关链接

- **官网**: https://jbc.ac/
- **GitHub**: https://github.com/dappweb/MACOIN_JBC
- **文档**: [项目文档目录](./docs/)

## 📞 联系我们

如有问题或建议，请通过以下方式联系：

- 提交GitHub Issue
- 发送邮件到项目维护者
- 加入我们的社区讨论

---

🔥 **Jinbao Protocol - 引领RWA DeFi 4.0时代！**