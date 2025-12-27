#!/bin/bash

echo "安装高优先级测试插件..."

# 1. 合约大小检查 (防止合约过大)
npm install --save-dev hardhat-contract-sizer

# 2. 前端测试框架
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# 3. 代码质量工具
npm install --save-dev solhint prettier-plugin-solidity

# 4. 存储布局检查 (升级安全)
npm install --save-dev hardhat-storage-layout

echo "基础插件安装完成！"

echo "安装中优先级插件..."

# 5. E2E测试
npm install --save-dev playwright

# 6. 调试增强
npm install --save-dev hardhat-tracer

echo "所有推荐插件安装完成！"
echo "请查看 TESTING_PLUGINS_RECOMMENDATIONS.md 了解配置方法"