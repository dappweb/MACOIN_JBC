# 测试插件推荐指南

## 1. 智能合约测试增强插件

### 1.1 已安装的基础插件 ✅
- `@nomicfoundation/hardhat-toolbox` - Hardhat工具箱
- `@nomicfoundation/hardhat-chai-matchers` - Chai匹配器
- `hardhat-gas-reporter` - Gas使用报告
- `solidity-coverage` - 代码覆盖率
- `@openzeppelin/hardhat-upgrades` - 可升级合约测试

### 1.2 推荐安装的增强插件

#### A. 模糊测试 (Fuzzing)
```bash
npm install --save-dev @foundry-rs/hardhat-foundry
# 或者
npm install --save-dev hardhat-tracer
```

#### B. 时间操作测试
```bash
npm install --save-dev @nomicfoundation/hardhat-network-helpers
# 已安装 ✅
```

#### C. 合约大小检查
```bash
npm install --save-dev hardhat-contract-sizer
```

#### D. 存储布局检查
```bash
npm install --save-dev hardhat-storage-layout
```

#### E. 安全审计
```bash
npm install --save-dev @crytic/slither-hardhat
# 或者
npm install --save-dev hardhat-mythx
```

## 2. 前端测试增强插件

### 2.1 React组件测试
```bash
npm install --save-dev @testing-library/react
npm install --save-dev @testing-library/jest-dom
npm install --save-dev @testing-library/user-event
npm install --save-dev vitest
npm install --save-dev jsdom
```

### 2.2 Web3集成测试
```bash
npm install --save-dev @wagmi/core/test
npm install --save-dev viem/test
```

### 2.3 E2E测试
```bash
npm install --save-dev playwright
# 或者
npm install --save-dev cypress
```

## 3. 代码质量插件

### 3.1 Linting和格式化
```bash
npm install --save-dev eslint
npm install --save-dev prettier
npm install --save-dev @typescript-eslint/parser
npm install --save-dev @typescript-eslint/eslint-plugin
```

### 3.2 Solidity Linting
```bash
npm install --save-dev solhint
npm install --save-dev prettier-plugin-solidity
```

## 4. 性能和监控插件

### 4.1 Bundle分析
```bash
npm install --save-dev vite-bundle-analyzer
```

### 4.2 性能监控
```bash
npm install --save-dev @web/test-runner-performance
```

## 5. 具体测试场景的插件配置

### 5.1 针对你的流动性质押功能测试

#### hardhat.config.cjs 增强配置
```javascript
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-contract-sizer");

module.exports = {
  // ... 现有配置
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  mocha: {
    timeout: 40000,
    reporter: 'spec'
  }
};
```

### 5.2 Vitest配置 (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

## 6. 推荐的测试工作流

### 6.1 合约测试命令
```json
{
  "scripts": {
    "test": "npx hardhat test",
    "test:coverage": "npx hardhat coverage",
    "test:gas": "REPORT_GAS=true npx hardhat test",
    "test:size": "npx hardhat size-contracts",
    "test:trace": "npx hardhat test --trace",
    "test:fork": "npx hardhat test --network hardhat",
    "lint:sol": "solhint 'contracts/**/*.sol'",
    "format:sol": "prettier --write 'contracts/**/*.sol'"
  }
}
```

### 6.2 前端测试命令
```json
{
  "scripts": {
    "test:ui": "vitest",
    "test:ui:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:component": "vitest --ui",
    "lint:ts": "eslint src --ext .ts,.tsx",
    "format:ts": "prettier --write 'src/**/*.{ts,tsx}'"
  }
}
```

## 7. 特定于你项目的测试建议

### 7.1 流动性质押功能测试
- **单元测试**: 测试 `stakeLiquidity` 函数的各种场景
- **集成测试**: 测试质押→挖矿→赎回的完整流程
- **模糊测试**: 使用随机金额和时间参数测试
- **边界测试**: 测试极值情况

### 7.2 前端组件测试
- **MiningPanel组件**: 测试状态变化和用户交互
- **Web3集成**: 模拟合约调用和钱包连接
- **错误处理**: 测试各种错误场景的用户体验

### 7.3 升级测试
- **存储布局**: 确保升级不破坏存储
- **初始化**: 测试升级后的初始化逻辑
- **向后兼容**: 确保新版本与旧数据兼容

## 8. CI/CD集成

### 8.1 GitHub Actions配置
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run compile
      - run: npm run test
      - run: npm run test:coverage
      - run: npm run test:ui
```

## 9. 安装优先级建议

### 高优先级 (立即安装)
1. `hardhat-contract-sizer` - 检查合约大小
2. `vitest` + `@testing-library/react` - 前端测试
3. `solhint` + `prettier-plugin-solidity` - 代码质量

### 中优先级 (近期安装)
1. `hardhat-storage-layout` - 升级安全
2. `playwright` - E2E测试
3. `hardhat-tracer` - 调试增强

### 低优先级 (可选)
1. 安全审计工具 (生产前必需)
2. 性能监控工具
3. Bundle分析工具

## 10. 使用示例

### 10.1 合约测试示例
```javascript
// test/JinbaoProtocol.test.js
describe("Liquidity Staking Simplification", function () {
  it("Should allow staking when not exited", async function () {
    // 测试未出局用户可以质押
  });
  
  it("Should reject staking when exited", async function () {
    // 测试已出局用户无法质押
  });
  
  it("Should handle any amount staking", async function () {
    // 测试任意金额质押
  });
});
```

### 10.2 前端测试示例
```typescript
// src/components/__tests__/MiningPanel.test.tsx
import { render, screen } from '@testing-library/react'
import { MiningPanel } from '../MiningPanel'

test('shows stake button when not exited', () => {
  render(<MiningPanel />)
  expect(screen.getByText('质押')).toBeInTheDocument()
})
```

---

这些插件将大大增强你的测试能力，特别是对于刚刚修改的流动性质押逻辑。建议按优先级逐步安装和配置。