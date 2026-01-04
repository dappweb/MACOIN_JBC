# 新协议合约部署检查清单

## 📋 部署前检查

### 1. 数据备份 ✅
- [x] 配置参数已备份
- [x] 余额信息已备份
- [x] 系统状态已备份
- [x] 用户数据已备份（367 个用户）
- [x] 事件数据已备份（791 个事件）

### 2. 合约代码验证
- [ ] 确认使用正确的合约文件（JinbaoProtocolNative.sol）
- [ ] 确认合约代码与旧合约功能一致
- [ ] 确认没有引入新的 bug
- [ ] 确认所有业务逻辑正确

### 3. 配置参数准备
- [ ] 确认备份文件路径正确
- [ ] 确认新 Owner 地址正确（JBC Token Owner）
- [ ] 确认所有钱包地址正确

## 🚀 部署步骤

### 步骤 1: 部署新合约
```bash
# 设置环境变量
export BACKUP_FILE=scripts/backups/protocol-backup-1767522095585.json
export NEW_OWNER=0x4C10831CBcF9884ba72051b5287b6c87E4F74A48

# 部署
npx hardhat run scripts/deploy-new-protocol.cjs --network mcchain
```

### 步骤 2: 验证合约功能
```bash
# 验证新合约功能
node scripts/verify-contract-functions.cjs <新合约地址>

# 对比新旧合约
node scripts/verify-contract-functions.cjs <旧合约地址> <新合约地址>
```

### 步骤 3: 测试业务功能
```bash
# 测试只读函数
node scripts/test-contract-functions.cjs <新合约地址>
```

### 步骤 4: 迁移用户数据
```bash
# 迁移用户数据（需要创建迁移脚本）
node scripts/migrate-user-data.cjs <新合约地址>
```

### 步骤 5: 更新引用
- [ ] 更新前端代码中的合约地址
- [ ] 更新 JBC Token 合约中的 protocolAddress
- [ ] 更新其他引用

## ✅ 部署后验证

### 1. 功能验证
- [ ] 所有只读函数正常工作
- [ ] 所有写入函数存在且可调用
- [ ] 配置参数正确设置
- [ ] Owner 地址正确

### 2. 数据验证
- [ ] 用户数据正确迁移
- [ ] 推荐关系正确迁移
- [ ] 系统状态正确设置

### 3. 业务功能测试
- [ ] 绑定推荐人功能正常
- [ ] 购买门票功能正常
- [ ] 质押流动性功能正常
- [ ] 领取奖励功能正常
- [ ] 赎回功能正常
- [ ] 交换功能正常

### 4. 前端测试
- [ ] 前端可以连接到新合约
- [ ] 所有功能在前端正常工作
- [ ] 用户数据正确显示

## ⚠️ 重要注意事项

### 1. 余额损失
- ⚠️ 旧合约中的余额（约 34,802 MC + 1,000,001 JBC）无法提取
- ⚠️ 新合约需要重新注入流动性

### 2. 用户授权
- ⚠️ 用户可能需要重新授权新合约使用 JBC Token
- ⚠️ 需要通知用户更新授权

### 3. 数据完整性
- ⚠️ 必须确保所有用户数据正确迁移
- ⚠️ 建议在测试网先进行完整测试

### 4. 停机时间
- ⚠️ 迁移过程中可能需要暂停服务
- ⚠️ 需要提前通知用户

## 🔧 故障排除

### 如果部署失败
1. 检查网络连接
2. 检查 Gas 费用是否足够
3. 检查合约代码是否有错误
4. 检查配置参数是否正确

### 如果功能验证失败
1. 检查合约地址是否正确
2. 检查 ABI 是否匹配
3. 检查合约是否已正确初始化
4. 检查 Owner 权限

### 如果数据迁移失败
1. 检查备份文件是否正确
2. 检查新合约地址是否正确
3. 检查 Gas 费用是否足够
4. 检查是否有权限问题

## 📊 部署成功标准

- ✅ 新合约成功部署
- ✅ 所有配置参数正确设置
- ✅ Owner 地址正确
- ✅ 所有功能验证通过
- ✅ 用户数据正确迁移
- ✅ 前端可以正常使用
- ✅ 用户测试通过

## 📄 相关文档

- `docs/RE_DEPLOY_FEASIBILITY_ASSESSMENT.md` - 可行性评估
- `docs/RE_DEPLOY_PROTOCOL_PLAN.md` - 重新部署方案
- `scripts/backup-protocol-data.cjs` - 备份脚本
- `scripts/deploy-new-protocol.cjs` - 部署脚本
- `scripts/verify-contract-functions.cjs` - 功能验证脚本
- `scripts/test-contract-functions.cjs` - 功能测试脚本

