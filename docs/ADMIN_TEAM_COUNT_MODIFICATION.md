# 团队规模修改功能 (Team Count Modification)

## 📋 概述

是的，**团队规模可以修改**。系统提供了管理员功能，允许合约拥有者（Owner）修改用户的团队规模（Team Count）。

## 🔧 功能说明

### 合约函数

**函数名**: `adminSetTeamCount(address user, uint256 newTeamCount)`

**权限**: 仅合约拥有者（`onlyOwner`）

**位置**: `contracts/JinbaoProtocolV4.sol` (第 1183 行)

```solidity
function adminSetTeamCount(address user, uint256 newTeamCount) external onlyOwner {
    if (user == address(0)) revert InvalidAddress();
    
    uint256 oldTeamCount = userInfo[user].teamCount;
    userInfo[user].teamCount = newTeamCount;
    
    // 检查并触发等级变化事件
    (uint256 oldLevel,) = TokenomicsLib.getLevel(oldTeamCount);
    (uint256 newLevel,) = TokenomicsLib.getLevel(newTeamCount);
    if (newLevel != oldLevel) {
        emit UserLevelChanged(user, oldLevel, newLevel, newTeamCount);
    }
    
    emit TeamCountUpdated(user, oldTeamCount, newTeamCount);
}
```

### 功能特性

1. **直接修改**: 管理员可以直接设置用户的团队规模
2. **等级自动更新**: 修改团队规模会自动触发等级重新计算
3. **事件触发**: 
   - `TeamCountUpdated` - 团队规模更新事件
   - `UserLevelChanged` - 如果等级发生变化，会触发等级变化事件

## 🖥️ 前端界面

### AdminPanel 组件

**位置**: `components/AdminPanel.tsx`

**功能**:
- 搜索用户地址
- 显示当前团队规模
- 输入新的团队规模
- 点击"更新"按钮修改

**界面代码**:
```tsx
<div className="pt-3 border-t border-gray-700">
    <label className="block text-sm font-medium text-gray-300 mb-2">
        {t.admin.updateTeamCount}
    </label>
    <div className="flex gap-2">
        <input 
            type="number" 
            value={newTeamCount} 
            onChange={e => setNewTeamCount(e.target.value)} 
            className="w-24 p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm" 
        />
        <button 
            onClick={updateTeamCount} 
            disabled={loading} 
            className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 disabled:opacity-50 text-sm font-bold"
        >
            {t.admin.update}
        </button>
    </div>
    <p className="text-xs text-gray-500 mt-1">
        {t.admin.teamCountNote}
    </p>
</div>
```

### AdminUserManager 组件

**位置**: `components/AdminUserManager.tsx`

**功能**: 更完整的用户管理界面，支持批量修改多个用户属性

## 📊 团队规模与等级关系

团队规模直接影响用户的 V 等级：

| 团队规模 | V 等级 | 级差收益比例 |
|---------|--------|-------------|
| 0-9     | V0     | 0%          |
| 10-29   | V1     | 5%          |
| 30-99   | V2     | 10%         |
| 100-299 | V3     | 15%         |
| 300-999 | V4     | 20%         |
| 1,000-2,999 | V5 | 25%         |
| 3,000-9,999 | V6 | 30%         |
| 10,000-29,999 | V7 | 35%       |
| 30,000-99,999 | V8 | 40%       |
| 100,000+ | V9 | 45%         |

## ⚠️ 重要注意事项

1. **权限限制**: 只有合约拥有者可以修改团队规模
2. **等级影响**: 修改团队规模会自动重新计算用户的 V 等级
3. **事件触发**: 修改会触发链上事件，前端可以监听并更新显示
4. **数据一致性**: 修改团队规模不会自动更新推荐链上的其他用户数据
5. **使用场景**: 
   - 数据修正
   - 测试环境
   - 特殊情况处理

## 🔍 使用示例

### 通过 AdminPanel 修改

1. 打开管理员面板
2. 在"用户管理"部分输入用户地址
3. 点击"搜索"获取用户信息
4. 在"修改团队人数"输入框中输入新的团队规模
5. 点击"更新"按钮
6. 确认交易

### 通过合约直接调用

```javascript
// 使用 ethers.js
const protocolContract = new ethers.Contract(
    PROTOCOL_ADDRESS,
    ABI,
    signer
);

// 修改用户团队规模
const tx = await protocolContract.adminSetTeamCount(
    userAddress,  // 用户地址
    1000          // 新的团队规模
);

await tx.wait();
```

## 📝 相关文件

- **合约实现**: `contracts/JinbaoProtocolV4.sol` (第 1183-1197 行)
- **前端界面**: `components/AdminPanel.tsx` (第 898-916 行)
- **用户管理**: `components/AdminUserManager.tsx` (第 163-164 行)
- **测试脚本**: `scripts/test-admin-modify-teamcount.cjs`
- **升级脚本**: `scripts/upgrade-admin-directs-teamcount.cjs`

## 🔗 相关功能

- **活跃直推修改**: `adminSetActiveDirects` - 修改用户的活跃直推数量
- **推荐人修改**: `adminSetReferrer` - 修改用户的推荐人
- **用户数据批量更新**: `adminUpdateUserData` - 一次性更新多个用户属性

## ✅ 总结

**是的，团队规模可以修改**。管理员可以通过以下方式修改：

1. ✅ **AdminPanel 界面** - 图形化界面操作
2. ✅ **AdminUserManager 界面** - 完整的用户管理界面
3. ✅ **合约直接调用** - 通过 `adminSetTeamCount` 函数

修改团队规模会自动触发等级重新计算，并发出相应的事件通知。


