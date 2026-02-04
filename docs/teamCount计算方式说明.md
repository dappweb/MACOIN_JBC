# teamCount 计算方式说明

## 概述

`teamCount` 表示一个用户的团队总人数，包括其所有直接和间接下线。本文档详细说明了几种不同的计算方式及其区别。

## 1. 合约中的计算方式（_updateTeamCount）

### 计算逻辑

当有新用户加入时，合约会沿着推荐链向上更新所有上级的 `teamCount`：

```solidity
function _updateTeamCount(address user) internal {
    address current = userInfo[user].referrer;
    uint256 iterations = 0;
    
    while (current != address(0) && iterations < 30) {
        uint256 oldCount = userInfo[current].teamCount;
        userInfo[current].teamCount = oldCount + 1;  // 每个上级的 teamCount 都 +1
        emit TeamCountUpdated(current, oldCount, oldCount + 1);
        
        current = userInfo[current].referrer;
        iterations++;
    }
}
```

### 特点

- **累加方式**：每当有新用户加入，所有上级的 `teamCount` 都 +1
- **迭代限制**：最多向上遍历 30 层（防止无限循环）
- **实时更新**：每次有新用户加入时自动更新

### 示例

假设推荐关系：A → B → C → D

当用户 D 加入时：
- C 的 teamCount +1（C 有 1 个下线：D）
- B 的 teamCount +1（B 有 2 个下线：C 和 D）
- A 的 teamCount +1（A 有 3 个下线：B、C 和 D）

最终结果：
- A 的 teamCount = 3
- B 的 teamCount = 2
- C 的 teamCount = 1
- D 的 teamCount = 0

## 2. 递归计算方式（calculateTeamCountRecursive）

### 计算逻辑

从下往上递归计算，公式为：

```
teamCount = 直接下线数 + 所有下线的 teamCount 之和
```

### 代码实现

```javascript
function calculateTeamCountRecursive(userAddress, referrerToUsers, cache = new Map(), visited = new Set()) {
    if (cache.has(userAddress)) {
        return cache.get(userAddress);
    }
    
    if (visited.has(userAddress)) {
        return 0; // 防止循环
    }
    visited.add(userAddress);
    
    const directReferrals = referrerToUsers.get(userAddress) || [];
    let count = directReferrals.length; // 直接下线数
    
    // 递归计算每个直接下线的 teamCount
    for (const referral of directReferrals) {
        count += calculateTeamCountRecursive(referral, referrerToUsers, cache, new Set(visited));
    }
    
    visited.delete(userAddress);
    cache.set(userAddress, count);
    return count;
}
```

### 特点

- **递归计算**：从下往上，先计算下线的 teamCount，再累加
- **理论上正确**：如果所有下线的 teamCount 都正确，结果就是正确的
- **依赖关系**：如果某些下线的 teamCount 不准确，会导致累加结果不准确

### 示例

假设推荐关系：A → B → C → D

递归计算过程：
1. D 的 teamCount = 0（没有下线）
2. C 的 teamCount = 1（直接下线：D）+ 0（D 的 teamCount）= 1
3. B 的 teamCount = 1（直接下线：C）+ 1（C 的 teamCount）= 2
4. A 的 teamCount = 1（直接下线：B）+ 2（B 的 teamCount）= 3

最终结果：
- A 的 teamCount = 3
- B 的 teamCount = 2
- C 的 teamCount = 1
- D 的 teamCount = 0

## 3. 唯一团队成员数（去重后）

### 计算逻辑

通过遍历推荐树，统计该用户下的所有唯一用户数（不包括自己）：

```javascript
function getAllTeamMembersRecursive(userAddress, referrerToUsers, allMembers = new Set(), visited = new Set()) {
    if (visited.has(userAddress)) {
        return; // 防止循环
    }
    visited.add(userAddress);
    
    const directReferrals = referrerToUsers.get(userAddress) || [];
    for (const referral of directReferrals) {
        allMembers.add(referral);
        getAllTeamMembersRecursive(referral, referrerToUsers, allMembers, new Set(visited));
    }
}
```

### 特点

- **去重统计**：使用 Set 数据结构，确保每个用户只计算一次
- **最准确**：这是最准确的统计方式，不受 teamCount 计算错误的影响
- **不包括自己**：只统计下线成员，不包括用户自己

### 示例

假设推荐关系：A → B → C → D

唯一团队成员数：
- A 的唯一团队成员数 = 3（B、C、D）
- B 的唯一团队成员数 = 2（C、D）
- C 的唯一团队成员数 = 1（D）
- D 的唯一团队成员数 = 0

## 4. 三种计算方式的对比

| 计算方式 | 公式 | 准确性 | 特点 |
|---------|------|-------|------|
| 合约中的 teamCount | 累加方式：每个新用户加入，所有上级 +1 | 依赖更新机制 | 实时更新，但可能不完整 |
| 递归计算的 teamCount | teamCount = 直接下线数 + 所有下线的 teamCount 之和 | 依赖下线的准确性 | 理论上正确，但依赖关系链 |
| 唯一团队成员数（去重后） | 遍历推荐树统计唯一用户数 | 最准确 | 不受 teamCount 错误影响 |

## 5. 为什么会有差异？

### 合约中的 teamCount 可能不准确的原因：

1. **迭代限制**：合约最多向上遍历 30 层，如果推荐链超过 30 层，可能无法完全更新
2. **数据迁移**：从旧合约迁移到新合约时，teamCount 可能没有正确同步
3. **历史事件丢失**：某些历史事件可能丢失或未正确处理
4. **更新机制不完整**：某些用户加入时，teamCount 更新可能失败或未执行

### 递归计算可能不准确的原因：

1. **依赖关系**：如果某些下线的 teamCount 不准确，会导致累加结果不准确
2. **计算顺序**：需要从下往上计算，如果某些下线的 teamCount 还未修复，结果就不准确

### 唯一团队成员数最准确的原因：

1. **直接统计**：直接从推荐关系图统计，不依赖 teamCount 的值
2. **去重保证**：使用 Set 数据结构，确保每个用户只计算一次
3. **不受影响**：不受 teamCount 计算错误的影响

## 6. 实际应用建议

### 检查 teamCount 是否正确：

1. **首选方式**：使用唯一团队成员数（去重后）作为标准
2. **对比验证**：将合约中的 teamCount 与唯一团队成员数对比
3. **修复方式**：如果发现差异，使用 `adminSetTeamCount` 修复

### 修复流程：

1. 计算唯一团队成员数（去重后）
2. 对比合约中的 teamCount
3. 如果存在差异，使用 `adminSetTeamCount` 更新为正确值

## 7. 示例：用户 0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e

### 数据对比：

- **合约中的 teamCount**: 953 ✅（已修复）
- **唯一团队成员数（去重后）**: 953 ✅
- **递归计算的 teamCount**: 826（不准确，因为某些下线的 teamCount 不准确）

### 结论：

- 唯一团队成员数（去重后）是最准确的：**953**
- 合约中的 teamCount 已修复为 **953**，与唯一团队成员数一致 ✅
- 递归计算显示 826 是因为某些下线的 teamCount 不准确，导致累加结果不准确

## 8. 总结

1. **唯一团队成员数（去重后）是最准确的统计方式**
2. **合约中的 teamCount 应该等于唯一团队成员数（去重后）**
3. **如果发现差异，应该使用 `adminSetTeamCount` 修复**
4. **递归计算方式依赖下线的准确性，如果下线不准确，结果也不准确**
