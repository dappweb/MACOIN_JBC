#!/bin/bash

# 环境变量配置辅助脚本

echo "🔧 环境变量配置助手"
echo "===================="
echo ""

# 检查 .env 文件是否存在
if [ -f .env ]; then
    echo "⚠️  .env 文件已存在"
    read -p "是否要覆盖现有配置? (y/N): " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "❌ 已取消"
        exit 0
    fi
fi

echo ""
echo "📋 配置说明:"
echo "1. 合约所有者地址: 0x4C10831CBcF9884ba72051b5287b6c87E4F74A48"
echo "2. 请使用该地址对应的私钥"
echo "3. 私钥格式: 0x + 64位十六进制字符"
echo ""

# 读取私钥
read -p "请输入私钥 (0x开头): " private_key

# 验证私钥格式
if [[ ! $private_key =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "❌ 错误: 私钥格式不正确"
    echo "   格式应为: 0x + 64位十六进制字符"
    exit 1
fi

# 验证地址
echo ""
echo "🔍 验证地址..."
node -e "
const { ethers } = require('ethers');
try {
    const wallet = new ethers.Wallet('$private_key');
    const address = wallet.address;
    console.log('✅ 地址:', address);
    const expected = '0x4C10831CBcF9884ba72051b5287b6c87E4F74A48';
    if (address.toLowerCase() === expected.toLowerCase()) {
        console.log('✅ 地址匹配合约所有者');
    } else {
        console.log('⚠️  警告: 地址不匹配合约所有者');
        console.log('   期望:', expected);
        console.log('   实际:', address);
        console.log('   如果继续，升级可能会失败');
    }
} catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
}
" || exit 1

# 创建 .env 文件
echo ""
read -p "确认创建 .env 文件? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ 已取消"
    exit 0
fi

cat > .env << EOF
# 合约所有者私钥（用于升级合约）
PRIVATE_KEY=$private_key

# MC Chain RPC URL（可选）
MC_RPC_URL=https://chain.mcerscan.com/
EOF

# 设置文件权限
chmod 600 .env

echo ""
echo "✅ .env 文件已创建"
echo "✅ 文件权限已设置为 600 (仅所有者可读)"
echo ""
echo "📋 下一步:"
echo "   运行升级脚本:"
echo "   npx hardhat run scripts/upgrade-admin-directs-teamcount.cjs --network mc --config config/hardhat.config.cjs"

