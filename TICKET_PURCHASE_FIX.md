# 购买门票错误修复方案

## 问题分析

用户点击"购买门票"按钮时出现 "Transaction failed. Please check details in console." 错误，原因是：

1. **合约地址不匹配**：前端配置的合约地址指向的合约不存在
2. **网络连接问题**：前端可能连接到错误的网络

## 解决方案

### 方案一：使用本地 Hardhat 网络（推荐用于开发测试）

#### 1. 启动本地 Hardhat 网络
```bash
npx hardhat node
```

#### 2. 合约地址已更新
前端已更新为使用本地部署的合约地址：
- MC Token: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- JBC Token: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- JinbaoProtocol: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`

#### 3. 配置钱包连接本地网络
在 MetaMask 或其他钱包中添加本地网络：
- 网络名称: Hardhat Local
- RPC URL: http://localhost:8545
- 链 ID: 31337
- 货币符号: ETH

#### 4. 导入测试账户
使用 Hardhat 提供的测试账户私钥：
```
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Balance: 10000 ETH + 999,990,000 MC
```

### 方案二：重新部署到目标网络

如果需要部署到特定网络（如测试网或主网）：

#### 1. 配置网络
在 `hardhat.config.cjs` 中配置目标网络

#### 2. 部署合约
```bash
npx hardhat run scripts/deploy-local-contracts.cjs --network <network-name>
```

#### 3. 更新前端配置
将新的合约地址更新到 `src/Web3Context.tsx` 中的 `CONTRACT_ADDRESSES`

## 测试验证

### 合约功能测试
```bash
# 测试合约部署状态
npx hardhat run scripts/simple-contract-test.cjs --network localhost

# 测试购买门票功能
npx hardhat run scripts/test-ticket-purchase.cjs --network localhost
```

### 预期结果
- MC Token 余额: 999,990,000 MC
- 购买 1000 MC 门票成功
- 实际花费: 200 MC（包含费用）
- 门票金额: 1000 MC

## 当前状态

✅ **合约部署成功**
- 所有合约已部署到本地 Hardhat 网络
- 初始流动性已添加（10,000 MC + 10,000 JBC）
- 购买门票功能测试通过

✅ **前端配置已更新**
- 合约地址已更新为本地部署地址
- Web3Context.tsx 已配置正确的合约地址

⚠️ **需要用户操作**
- 确保钱包连接到 localhost:8545 (Hardhat 网络)
- 导入测试账户或使用现有账户
- 确保有足够的 ETH 用于 gas 费用

## 故障排除

### 如果仍然出现错误：

1. **检查网络连接**
   ```bash
   # 确认 Hardhat 网络正在运行
   curl http://localhost:8545
   ```

2. **检查合约状态**
   ```bash
   npx hardhat run scripts/simple-contract-test.cjs --network localhost
   ```

3. **查看浏览器控制台**
   - 打开开发者工具
   - 查看 Console 和 Network 标签页
   - 检查具体的错误信息

4. **重新部署合约**
   ```bash
   # 停止 Hardhat 网络，重新启动
   npx hardhat node
   
   # 重新部署
   npx hardhat run scripts/deploy-local-contracts.cjs --network localhost
   ```

## 联系支持

如果问题仍然存在，请提供：
- 浏览器控制台的完整错误信息
- 当前连接的网络信息
- 钱包地址和余额信息