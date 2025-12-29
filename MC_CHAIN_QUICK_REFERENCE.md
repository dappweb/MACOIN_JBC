# 🚀 MC Chain 快速参考

## 📋 网络信息卡片

```
┌─────────────────────────────────────────┐
│              MC Chain                   │
├─────────────────────────────────────────┤
│ Chain ID: 88813 (0x15AF5)              │
│ RPC URL: https://chain.mcerscan.com/   │
│ Explorer: https://mcerscan.com         │
│ Symbol: MC                             │
│ Decimals: 18                           │
└─────────────────────────────────────────┘
```

## 🔗 已部署合约地址

### 代币合约
```bash
# MC Token (Mock)
0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF

# JBC Token  
0xA743cB357a9f59D349efB7985072779a094658dD
```

### 协议合约
```bash
# JinbaoProtocol (UUPS Proxy)
Proxy: 0x7a216BeA62eF7629904E0d30b24F6842c9b0d660
Implementation: 0x326c44a65d6A75217FA4064776864bc8983c1e9c

# Legacy Contract (参考)
0x2d3C48D2d24C27c9256B83d0fc4Fe8A99a9cb7de
```

## 🔧 MetaMask 添加网络

### 手动添加
```
Network Name: MC Chain
RPC URL: https://chain.mcerscan.com/
Chain ID: 88813
Currency Symbol: MC
Block Explorer: https://mcerscan.com
```

### 一键添加 (Web3)
```javascript
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x15AF5',
    chainName: 'MC Chain',
    nativeCurrency: {
      name: 'MC',
      symbol: 'MC',
      decimals: 18,
    },
    rpcUrls: ['https://chain.mcerscan.com/'],
    blockExplorerUrls: ['https://mcerscan.com'],
  }],
});
```

## 🏗️ 开发配置

### Hardhat
```javascript
mc: {
  url: "https://chain.mcerscan.com/",
  chainId: 88813,
  accounts: [process.env.PRIVATE_KEY],
  timeout: 300000,
}
```

### Wagmi/Viem
```javascript
import { defineChain } from 'viem'

export const mcChain = defineChain({
  id: 88813,
  name: 'MC Chain',
  network: 'mc-chain',
  nativeCurrency: {
    decimals: 18,
    name: 'MC',
    symbol: 'MC',
  },
  rpcUrls: {
    default: {
      http: ['https://chain.mcerscan.com/'],
    },
    public: {
      http: ['https://chain.mcerscan.com/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MCerscan',
      url: 'https://mcerscan.com',
    },
  },
})
```

## 📊 生产环境参数

### 质押配置
```bash
# 时间单位
SECONDS_IN_UNIT = 86400  # 1天

# 质押周期
7天质押  -> 1.33% 日收益
15天质押 -> 1.67% 日收益  
30天质押 -> 2.00% 日收益
```

### 燃烧配置
```bash
# 每日燃烧
DAILY_BURN_AMOUNT = 500 JBC
MAX_BURN_AMOUNT = 5000 JBC
BURN_PERCENTAGE = 0.1%
```

## 🚀 常用命令

### 部署命令
```bash
# 编译合约
npm run compile

# 部署到 MC Chain
npm run deploy:mc

# 检查网络连接
npm run check:mc

# 验证生产配置
npm run validate:prod
```

### 测试命令
```bash
# 测试网络连接
node debug-homepage-level.js

# 查询用户收益
node query-user-earnings.js

# 测试极差奖励
node test-differential-rewards.js
```

## 🔍 区块浏览器链接

### 合约查看
```bash
# MC Token
https://mcerscan.com/address/0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF

# JBC Token
https://mcerscan.com/address/0xA743cB357a9f59D349efB7985072779a094658dD

# JinbaoProtocol Proxy
https://mcerscan.com/address/0x7a216BeA62eF7629904E0d30b24F6842c9b0d660
```

### 交易查看
```bash
# 替换 {txHash} 为实际交易哈希
https://mcerscan.com/tx/{txHash}
```

## 📱 前端集成

### 环境变量
```bash
# .env.production
VITE_CHAIN_ID=88813
VITE_CHAIN_NAME="MC Chain"
VITE_RPC_URL="https://chain.mcerscan.com/"
VITE_MC_CONTRACT_ADDRESS="0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF"
VITE_JBC_CONTRACT_ADDRESS="0xA743cB357a9f59D349efB7985072779a094658dD"
VITE_PROTOCOL_CONTRACT_ADDRESS="0x7a216BeA62eF7629904E0d30b24F6842c9b0d660"
```

### React Hook 示例
```javascript
import { useChainId, useSwitchChain } from 'wagmi'

const MC_CHAIN_ID = 88813

function useEnsureMCChain() {
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  
  const isOnMCChain = chainId === MC_CHAIN_ID
  
  const switchToMCChain = () => {
    if (switchChain) {
      switchChain({ chainId: MC_CHAIN_ID })
    }
  }
  
  return { isOnMCChain, switchToMCChain }
}
```

## 🆘 故障排除

### 常见问题
```bash
# RPC 连接失败
- 检查网络连接
- 尝试备用 RPC: https://rpc.mcchain.io/
- 验证防火墙设置

# 交易失败
- 检查 Gas 费用设置
- 确认账户余额充足
- 验证合约地址正确

# 前端连接问题
- 清除浏览器缓存
- 重新连接钱包
- 检查网络切换
```

### 调试工具
```bash
# 网络连接测试
curl -X POST https://chain.mcerscan.com/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# 预期返回: {"jsonrpc":"2.0","id":1,"result":"0x15af5"}
```

## 📞 支持联系

- 📧 技术支持: support@jinbao.io
- 📖 完整文档: [MC_CHAIN_DEPLOYMENT_ENVIRONMENT.md](MC_CHAIN_DEPLOYMENT_ENVIRONMENT.md)
- 🚀 部署指南: [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)

---

**快速参考版本**: 1.0.0  
**最后更新**: 2024-12-29