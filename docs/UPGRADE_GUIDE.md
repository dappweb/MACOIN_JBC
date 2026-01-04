# 合约升级指南 - 回购机制更新

## 📋 升级概述

本次升级将修改回购销毁机制：
- **修改前**: 回购资金直接在协议合约内部执行
- **修改后**: 回购资金先转到回购钱包，由回购钱包执行回购

## ⚠️ 重要提示

### 权限要求

**必须使用合约所有者的私钥才能执行升级！**

- **合约所有者地址**: `0x0ea4a4b654CD77e9eA5B088633E6d5d5B4BBb720`
- **代理合约地址**: `0x77601aC473dB1195A1A9c82229C9bD008a69987A`

### 当前状态

- **部署账户**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48` (不是所有者)
- **合约所有者**: `0x0ea4a4b654CD77e9eA5B088633E6d5d5B4BBb720`

## 🚀 升级步骤

### 步骤 1: 准备环境

1. **确保使用合约所有者的私钥**

   更新 `.env` 文件：
   ```bash
   PRIVATE_KEY=<合约所有者的私钥>
   ```

   ⚠️ **重要**: 私钥必须对应地址 `0x0ea4a4b654CD77e9eA5B088633E6d5d5B4BBb720`

2. **验证账户余额**

   确保合约所有者账户有足够的 MC 用于支付 Gas 费用（建议至少 1 MC）

### 步骤 2: 执行升级

运行升级脚本：

```bash
npx hardhat run scripts/upgrade-buyback-mechanism.cjs --network mc --config config/hardhat.config.cjs
```

### 步骤 3: 验证升级

升级完成后，脚本会自动验证：

1. ✅ 检查合约所有者
2. ✅ 检查回购钱包地址
3. ✅ 检查回购比例
4. ✅ 验证新函数 `executeBuybackAndBurn()` 是否存在

### 步骤 4: 测试新功能

升级后，测试回购功能：

```javascript
// 1. 购买门票（回购资金会转到回购钱包）
await protocolContract.buyTicket({ value: ethers.parseEther("1000") });

// 2. 检查回购钱包余额
const buybackBalance = await provider.getBalance(BUYBACK_WALLET);
console.log("回购钱包余额:", ethers.formatEther(buybackBalance), "MC");

// 3. 回购钱包执行回购
const buybackWalletSigner = await ethers.getSigner(BUYBACK_WALLET);
const buybackContract = protocolContract.connect(buybackWalletSigner);
await buybackContract.executeBuybackAndBurn({
    value: buybackBalance
});
```

## 📊 升级脚本功能

### 自动执行的操作

1. ✅ 读取部署信息（代理地址、网络等）
2. ✅ 验证合约所有者权限
3. ✅ 编译新合约
4. ✅ 执行 UUPS 升级
5. ✅ 验证升级成功
6. ✅ 更新部署文件
7. ✅ 保存升级记录

### 升级脚本输出

升级成功后会显示：

```
✅ 升级成功!
📋 升级信息:
   代理地址 (不变): 0x77601aC473dB1195A1A9c82229C9bD008a69987A
   旧实现地址: 0x07dbBe0f629e63E55AD06b98FAc8a0d3Dd4b184C
   新实现地址: <新的实现地址>

🔍 验证升级...
   合约所有者: 0x0ea4a4b654CD77e9eA5B088633E6d5d5B4BBb720
   回购钱包: 0x979373c675c25e6cb2FD49B571dcADcB15a5a6D8
   回购比例: 5 %
✅ 新函数 executeBuybackAndBurn() 已部署
```

## 🔍 升级前检查清单

### 必须检查的项目

- [ ] 使用合约所有者的私钥（地址: `0x0ea4a4b654CD77e9eA5B088633E6d5d5B4BBb720`）
- [ ] 账户有足够的 MC 支付 Gas（建议至少 1 MC）
- [ ] 已备份当前部署信息
- [ ] 已在测试网测试升级（如果可能）
- [ ] 已阅读升级安全性分析文档

### 建议检查的项目

- [ ] 检查当前合约状态（用户数据、储备池等）
- [ ] 检查回购钱包地址是否正确
- [ ] 准备升级后的测试计划
- [ ] 通知团队升级时间

## ⚠️ 注意事项

### 1. 权限要求

- ⚠️ **必须使用合约所有者的私钥**
- ⚠️ 升级是不可逆的操作
- ⚠️ 确保私钥安全

### 2. Gas 费用

- 升级需要支付 Gas 费用
- 建议准备至少 1 MC 用于 Gas
- 实际费用取决于网络状况

### 3. 升级时间

- 升级过程可能需要几分钟
- 请耐心等待交易确认
- 不要中断升级过程

### 4. 升级后行为

- ✅ 所有现有数据保持不变
- ⚠️ 回购执行方式改变（需要手动触发）
- ⚠️ 回购钱包余额会累积

## 🔄 升级后操作

### 1. 监控回购钱包

升级后，回购钱包会开始累积资金。需要：

- 定期检查回购钱包余额
- 定期执行回购操作
- 或设置自动执行机制

### 2. 设置自动回购（推荐）

如果回购钱包是智能合约，可以实现自动执行：

```solidity
contract AutoBuybackWallet {
    JinbaoProtocolNative public protocol;
    
    function executeBuyback() external {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            protocol.executeBuybackAndBurn{value: balance}();
        }
    }
    
    // 可以设置定时器自动执行
}
```

### 3. 验证功能

升级后验证以下功能：

- ✅ 购买门票（检查回购资金是否转到回购钱包）
- ✅ 执行回购（回购钱包调用 `executeBuybackAndBurn()`）
- ✅ 其他功能（质押、领取奖励、赎回等）

## 📝 升级记录

升级脚本会自动保存升级记录到：
- `deployments/upgrade-log.json` - 升级历史记录
- `deployments/latest-mc-v4.json` - 更新实现地址

## 🆘 故障排除

### 问题 1: 权限错误

**错误**: `部署账户不是合约所有者`

**解决方案**:
1. 检查 `.env` 文件中的 `PRIVATE_KEY`
2. 确保私钥对应合约所有者地址
3. 重新运行升级脚本

### 问题 2: Gas 不足

**错误**: `insufficient funds for gas`

**解决方案**:
1. 向合约所有者账户充值 MC
2. 确保余额至少 1 MC
3. 重新运行升级脚本

### 问题 3: 升级失败

**错误**: 升级交易失败

**解决方案**:
1. 检查错误信息
2. 验证合约代码是否正确编译
3. 检查网络连接
4. 联系技术支持

## 📚 相关文档

- [升级安全性分析](./analysis/UPGRADE_SAFETY_ANALYSIS.md)
- [回购机制更新](./analysis/BUYBACK_MECHANISM_UPDATE.md)
- [前端合约参考](./contracts/FRONTEND_CONTRACT_REFERENCE.md)

## ✅ 升级完成检查

升级成功后，请确认：

- [x] 升级交易已确认
- [x] 新实现地址已更新
- [x] 合约功能正常
- [x] 回购钱包可以执行回购
- [x] 所有数据完整

---

**升级脚本**: `scripts/upgrade-buyback-mechanism.cjs`  
**代理地址**: `0x77601aC473dB1195A1A9c82229C9bD008a69987A`  
**合约所有者**: `0x0ea4a4b654CD77e9eA5B088633E6d5d5B4BBb720`







