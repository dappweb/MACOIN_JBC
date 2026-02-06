# 升级说明：72 小时内未提供流动性则门票在首次质押时失效

## 变更说明

- **逻辑**：在 `stakeLiquidity()` 入口先调用 `_expireTicketIfNeeded(msg.sender)`。
- **效果**：用户购票后 72 小时内未提供流动性，在**首次尝试质押时**会被判定门票失效并清空，需重新购票后才能再次提供流动性。

## 上线步骤

### 1. 确认代码已包含修改

合约 `contracts/JinbaoProtocolNative.sol` 中 `stakeLiquidity` 开头应有：

```solidity
_expireTicketIfNeeded(msg.sender);
```

### 2. 确认环境

- 本机已安装依赖：`npm install`
- `.env` 中配置：
  - `PRIVATE_KEY`：合约 **Owner** 账户私钥（当前 Owner: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`）
  - 该账户在 MC 链上有足够 MC 支付 Gas

### 3. 编译

```bash
npm run compile
```

### 4. 执行升级（MC 链）

```bash
npx hardhat run scripts/upgrade-stake-liquidity-72h-expire.cjs --network mc --config config/hardhat.config.cjs
```

### 5. 验证

- 脚本会输出新实现地址并写入 `deployments/upgrade-stake-liquidity-72h-expire-{timestamp}.json`。
- 线上代理地址不变：`0x0897Cee05E43B2eCf331cd80f881c211eb86844E`。
- 前端无需改合约地址，仅合约逻辑更新。

## 若升级失败

- **not the owner**：请用合约 Owner 账户的 `PRIVATE_KEY` 执行。
- **storage / layout**：确认未改动合约的 storage 布局，仅改了 `stakeLiquidity` 内部逻辑。
- **timeout**：可适当增大脚本内 `timeout` 或检查网络/RPC。

## 相关文件

- 升级脚本：`scripts/upgrade-stake-liquidity-72h-expire.cjs`
- 合约修改：`contracts/JinbaoProtocolNative.sol`（`stakeLiquidity`）
- 更新历史：`docs/CONTRACT_UPDATE_HISTORY.md`
