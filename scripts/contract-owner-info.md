# 合约 Owner 地址信息

## 检查时间
2026-01-04

## Owner 地址

**协议合约 Owner**: `0x1Bf9ACe2485BC3391150762a109886d0B85f40Da`

## 详细信息

### 地址类型
- **类型**: 合约地址（有代码）
- **余额**: 0.0 MC

### 相关地址对比
- **JBC Token 地址**: `0x1Bf9ACe2485BC3391150762a109886d0B85f40Da`
- **协议合约 Owner**: `0x1Bf9ACe2485BC3391150762a109886d0B85f40Da`

**注意**: Owner 地址与 JBC Token 地址相同，这可能是：
1. JBC Token 合约被设置为协议合约的 Owner
2. 或者这是同一个多签钱包/合约地址

### 区块浏览器链接
- **MC Chain 浏览器**: https://mcerscan.com/address/0x1Bf9ACe2485BC3391150762a109886d0B85f40Da

## 协议合约信息

- **协议合约地址**: `0x77601aC473dB1195A1A9c82229C9bD008a69987A`
- **合约类型**: UUPS 代理合约
- **实现合约地址**: `0x00f3b8e6755d2cb0ad9388c71df740e0a919a590`

## Owner 权限

Owner 拥有以下权限（根据合约代码）：
1. ✅ 升级合约 (`_authorizeUpgrade`)
2. ✅ 紧急暂停/恢复 (`emergencyPause`, `emergencyUnpause`)
3. ✅ 设置钱包地址 (`setWallets`)
4. ✅ 设置分配配置 (`setDistributionConfig`)
5. ✅ 设置交换税费 (`setSwapTaxes`)
6. ✅ 设置赎回费用 (`setRedemptionFeePercent`)
7. ✅ 设置操作状态 (`setOperationalStatus`)
8. ✅ 设置 JBC 代币地址 (`setJbcToken`)
9. ✅ 设置门票灵活性时长 (`setTicketFlexibilityDuration`)
10. ✅ 添加流动性 (`addLiquidity`)
11. ✅ 提取层级奖励池 (`withdrawLevelRewardPool`)
12. ✅ 提取交换储备 (`withdrawSwapReserves`)
13. ✅ 紧急提取原生代币 (`emergencyWithdrawNative`)
14. ✅ 救援代币 (`rescueTokens`)

## 检查方法

使用以下脚本检查 Owner：
```bash
node scripts/check-contract-owner.cjs
```

## 注意事项

1. **Owner 是合约地址**: 这意味着可能需要通过合约来执行 Owner 操作
2. **余额为 0**: Owner 地址当前没有 MC 余额
3. **与 JBC Token 地址相同**: 需要确认这是否是预期的设计

