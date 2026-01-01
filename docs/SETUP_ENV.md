# 环境变量配置指南

## 配置 .env 文件

### 步骤 1: 创建 .env 文件

在项目根目录创建 `.env` 文件：

```bash
touch .env
```

### 步骤 2: 添加私钥配置

编辑 `.env` 文件，添加以下内容：

```bash
# 合约所有者私钥（用于升级合约）
# 从部署记录中，合约所有者地址是: 0x4C10831CBcF9884ba72051b5287b6c87E4F74A48
# 请使用该地址对应的私钥
PRIVATE_KEY=0x你的私钥（64位十六进制字符，0x开头）

# MC Chain RPC URL（可选，已在 hardhat.config.cjs 中配置）
MC_RPC_URL=https://chain.mcerscan.com/
```

### 步骤 3: 验证配置

运行以下命令验证配置：

```bash
# 检查 .env 文件是否存在
[ -f .env ] && echo "✅ .env 文件存在" || echo "❌ .env 文件不存在"

# 检查 PRIVATE_KEY 是否已设置（不显示实际值）
[ -n "$PRIVATE_KEY" ] && echo "✅ PRIVATE_KEY 已设置" || echo "❌ PRIVATE_KEY 未设置"
```

## 安全注意事项

1. **不要提交 .env 文件到 Git**
   - `.env` 已在 `.gitignore` 中
   - 永远不要将私钥提交到代码仓库

2. **私钥格式**
   - 必须以 `0x` 开头
   - 后面跟随 64 位十六进制字符
   - 示例: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

3. **权限控制**
   - 确保 `.env` 文件权限设置为仅所有者可读
   ```bash
   chmod 600 .env
   ```

4. **备份**
   - 安全地备份私钥
   - 使用密码管理器存储

## 验证合约所有者

升级前，请确认使用的私钥对应的地址是合约所有者：

```bash
# 使用 Node.js 验证地址
node -e "const { ethers } = require('ethers'); const wallet = new ethers.Wallet(process.env.PRIVATE_KEY); console.log('地址:', wallet.address);"
```

应该输出: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

## 故障排除

### 错误: PRIVATE_KEY 未设置

**解决**: 确保 `.env` 文件存在且包含 `PRIVATE_KEY=0x...`

### 错误: 无效的私钥格式

**解决**: 检查私钥格式是否正确（0x + 64位十六进制）

### 错误: 部署者不是合约所有者

**解决**: 使用合约所有者地址对应的私钥

---

**重要**: 私钥是敏感信息，请妥善保管！

