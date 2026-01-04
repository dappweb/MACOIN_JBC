# 下一步操作指南

## ✅ 已完成

1. **部署新协议合约** ✅
   - 新合约地址: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
   - Owner: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`
   - 所有配置参数已正确设置

2. **迁移用户数据** ✅
   - 推荐关系: 365/367 用户已迁移
   - 其他数据会在用户操作时自动恢复

3. **更新前端合约地址** ✅
   - `src/Web3Context.tsx` 已更新

---

## ⏳ 待完成步骤

### 步骤 1: 更新 JBC Token 的 protocolAddress

**目的**: 让 JBC Token 合约知道新的协议地址，以便正确执行税费豁免等逻辑

**执行方式**:
```bash
# 确保 .env 中有 JBC_TOKEN_OWNER_PRIVATE_KEY
# 然后运行:
npx hardhat run scripts/update-jbc-protocol-address.cjs --network mc
```

**要求**:
- 需要 JBC Token Owner 的私钥（`0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`）
- 私钥应该在 `.env` 文件中

**脚本**: `scripts/update-jbc-protocol-address.cjs`

---

### 步骤 2: 验证新合约功能

**目的**: 确保所有业务功能正常工作

**执行方式**:
```bash
# 验证新合约功能
node scripts/verify-contract-functions.cjs 0x0897Cee05E43B2eCf331cd80f881c211eb86844E

# 测试业务功能
node scripts/test-contract-functions.cjs 0x0897Cee05E43B2eCf331cd80f881c211eb86844E
```

**检查项**:
- ✅ 所有只读函数正常
- ✅ 所有写入函数存在
- ✅ 配置参数正确
- ✅ Owner 地址正确

---

### 步骤 3: 测试前端功能

**目的**: 确保前端可以正常使用新合约

**测试项**:
1. **连接钱包**
   - [ ] 可以连接钱包
   - [ ] 可以切换到 MC Chain 网络

2. **推荐人绑定**
   - [ ] 可以绑定推荐人
   - [ ] 推荐关系正确显示

3. **购买门票**
   - [ ] 可以购买门票（100/300/500/1000 MC）
   - [ ] 门票信息正确显示

4. **质押流动性**
   - [ ] 可以质押流动性
   - [ ] 质押信息正确显示

5. **领取奖励**
   - [ ] 可以领取奖励
   - [ ] 奖励计算正确

6. **赎回**
   - [ ] 可以赎回质押
   - [ ] 赎回金额正确

7. **交换功能**
   - [ ] MC 换 JBC 功能正常
   - [ ] JBC 换 MC 功能正常

8. **管理员功能**
   - [ ] 管理员面板可以访问
   - [ ] 所有管理员功能正常

---

### 步骤 4: 重新注入流动性（如需要）

**目的**: 如果交换功能需要，需要添加流动性

**执行方式**:
```bash
# 使用管理员面板添加流动性
# 或使用脚本添加流动性
```

**注意**:
- 新合约从零开始，没有余额
- 如果需要交换功能，需要添加 MC 和 JBC 流动性
- 最小流动性要求: 1000 MC + 对应 JBC

---

## 🔍 验证清单

### 合约验证
- [ ] 新合约地址正确
- [ ] Owner 地址正确
- [ ] 所有配置参数正确
- [ ] JBC Token 地址正确

### 数据验证
- [ ] 推荐关系已迁移
- [ ] 用户数据可以正常查询
- [ ] 系统状态正确

### 功能验证
- [ ] 所有业务功能正常
- [ ] 前端可以正常使用
- [ ] 用户操作正常

---

## ⚠️ 重要注意事项

### 1. 余额损失
- ⚠️ 旧合约中的余额（约 34,802 MC + 1,000,001 JBC）无法提取
- ⚠️ 新合约需要重新注入流动性

### 2. 用户授权
- ⚠️ 用户可能需要重新授权新合约使用 JBC Token
- ⚠️ 需要通知用户更新授权

### 3. 数据完整性
- ⚠️ 部分数据（如 `activeDirects`, `teamCount`）会在用户操作时自动恢复
- ⚠️ 建议在用户操作前通知用户

### 4. 停机时间
- ⚠️ 迁移过程中可能需要暂停服务
- ⚠️ 需要提前通知用户

---

## 📊 执行顺序

1. **更新 JBC Token protocolAddress** (必须)
2. **验证新合约功能** (必须)
3. **测试前端功能** (必须)
4. **重新注入流动性** (如需要)
5. **通知用户** (必须)

---

## 🚀 快速执行

```bash
# 1. 更新 JBC Token protocolAddress
npx hardhat run scripts/update-jbc-protocol-address.cjs --network mc

# 2. 验证新合约功能
node scripts/verify-contract-functions.cjs 0x0897Cee05E43B2eCf331cd80f881c211eb86844E

# 3. 测试业务功能
node scripts/test-contract-functions.cjs 0x0897Cee05E43B2eCf331cd80f881c211eb86844E

# 4. 启动前端测试
npm run dev
```

---

## 📄 相关文档

- `docs/DEPLOYMENT_CHECKLIST.md` - 部署检查清单
- `docs/FRONTEND_UPDATE_GUIDE.md` - 前端更新指南
- `docs/CONTRACT_BUSINESS_LOGIC.md` - 合约业务逻辑
- `scripts/update-jbc-protocol-address.cjs` - 更新 JBC Token 脚本

