#!/usr/bin/env node

/**
 * 前端改进验证脚本
 * 验证 EarningsDetail 组件的 50/50 机制显示改进
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 验证前端 50/50 机制显示改进...\n');

// 读取 EarningsDetail.tsx 文件
const componentPath = path.join(__dirname, 'components', 'EarningsDetail.tsx');

if (!fs.existsSync(componentPath)) {
  console.error('❌ EarningsDetail.tsx 文件不存在');
  process.exit(1);
}

const componentContent = fs.readFileSync(componentPath, 'utf8');

// 验证改进项目
const improvements = [
  {
    name: '添加 JBC 价格状态管理',
    check: () => componentContent.includes('const [currentJBCPrice, setCurrentJBCPrice] = useState(0)'),
    description: '添加了 currentJBCPrice 状态来跟踪当前 JBC 汇率'
  },
  {
    name: '添加储备信息状态',
    check: () => componentContent.includes('const [reserveInfo, setReserveInfo] = useState<{mc: string, jbc: string}>({mc: "0", jbc: "0"})'),
    description: '添加了 reserveInfo 状态来跟踪流动性池储备'
  },
  {
    name: '改进待领取奖励显示',
    check: () => componentContent.includes('📊 分配机制:') && componentContent.includes('50% MC + 50% JBC (按当前汇率计算)'),
    description: '在待领取奖励中明确显示 50/50 分配机制'
  },
  {
    name: '添加当前汇率显示',
    check: () => componentContent.includes('💱 当前汇率: 1 JBC = {currentJBCPrice.toFixed(6)} MC'),
    description: '显示当前 JBC 对 MC 的汇率'
  },
  {
    name: '添加总价值计算',
    check: () => componentContent.includes('💰 总价值: {(pendingRewards.mc + pendingRewards.jbc * currentJBCPrice).toFixed(4)} MC'),
    description: '计算并显示待领取奖励的总价值'
  },
  {
    name: '添加流动性池信息',
    check: () => componentContent.includes('🏊 流动性池: {parseFloat(reserveInfo.mc).toFixed(2)} MC / {parseFloat(reserveInfo.jbc).toFixed(2)} JBC'),
    description: '显示当前流动性池的储备信息'
  },
  {
    name: '添加价格信息面板',
    check: () => componentContent.includes('💱 当前汇率信息') && componentContent.includes('静态奖励按 50% MC + 50% JBC (等值) 分配'),
    description: '添加专门的价格信息显示面板'
  },
  {
    name: '改进 24 小时统计显示',
    check: () => componentContent.includes('📊 50% MC + 50% JBC 分配') && componentContent.includes('💰 总价值:'),
    description: '在 24 小时统计中添加机制说明和总价值'
  },
  {
    name: '改进静态奖励记录显示',
    check: () => componentContent.includes('静态奖励 - 50% MC + 50% JBC 分配') && componentContent.includes('MC 部分 (50%)'),
    description: '在交易记录中特别标注静态奖励的 50/50 分配'
  },
  {
    name: '改进移动端显示',
    check: () => componentContent.includes('50% MC + 50% JBC') && componentContent.includes('≈ {(parseFloat(row.mcAmount) + parseFloat(row.jbcAmount) * currentJBCPrice).toFixed(2)} MC'),
    description: '在移动端视图中显示 50/50 机制和总价值'
  },
  {
    name: '改进详情模态框',
    check: () => componentContent.includes('静态奖励分配 (50% MC + 50% JBC)') && componentContent.includes('价值计算'),
    description: '在详情模态框中详细显示静态奖励的分配和价值计算'
  },
  {
    name: '更新价格计算逻辑',
    check: () => componentContent.includes('setCurrentJBCPrice(calculatedJBCPrice)') && componentContent.includes('setReserveInfo({'),
    description: '在获取待领取奖励时同时更新价格和储备信息'
  }
];

// 执行验证
let passedCount = 0;
let failedCount = 0;

console.log('📋 验证改进项目:\n');

improvements.forEach((improvement, index) => {
  const passed = improvement.check();
  const status = passed ? '✅' : '❌';
  const number = (index + 1).toString().padStart(2, '0');
  
  console.log(`${status} ${number}. ${improvement.name}`);
  console.log(`    ${improvement.description}`);
  
  if (passed) {
    passedCount++;
  } else {
    failedCount++;
    console.log(`    ⚠️  未找到相关代码实现`);
  }
  console.log('');
});

// 输出总结
console.log('📊 验证结果总结:');
console.log(`✅ 通过: ${passedCount}/${improvements.length}`);
console.log(`❌ 失败: ${failedCount}/${improvements.length}`);
console.log(`📈 完成率: ${((passedCount / improvements.length) * 100).toFixed(1)}%\n`);

// 检查关键功能
console.log('🔍 关键功能检查:');

const keyFeatures = [
  {
    name: '50/50 机制说明',
    check: () => {
      const count = (componentContent.match(/50%.*MC.*50%.*JBC/g) || []).length;
      return count >= 3; // 至少在 3 个地方显示
    }
  },
  {
    name: 'JBC 价格显示',
    check: () => {
      const count = (componentContent.match(/currentJBCPrice/g) || []).length;
      return count >= 5; // 多处使用价格信息
    }
  },
  {
    name: '总价值计算',
    check: () => {
      const count = (componentContent.match(/总价值|总价值:/g) || []).length;
      return count >= 3; // 多处显示总价值
    }
  },
  {
    name: '静态奖励特殊处理',
    check: () => {
      return componentContent.includes('row.rewardType === 0') && 
             componentContent.includes('selectedRecord.rewardType === 0');
    }
  }
];

keyFeatures.forEach(feature => {
  const status = feature.check() ? '✅' : '❌';
  console.log(`${status} ${feature.name}`);
});

console.log('\n🎯 改进效果预期:');
console.log('1. 用户可以清楚看到静态奖励的 50% MC + 50% JBC 分配机制');
console.log('2. 实时显示当前 JBC 汇率，帮助用户理解 JBC 数量计算');
console.log('3. 在多个位置显示总价值，方便用户了解奖励的实际价值');
console.log('4. 区分静态奖励和其他奖励的显示方式，突出 50/50 机制');
console.log('5. 提供流动性池信息，增加透明度');

if (passedCount === improvements.length) {
  console.log('\n🎉 所有改进项目验证通过！前端显示优化完成。');
  process.exit(0);
} else {
  console.log(`\n⚠️  还有 ${failedCount} 个改进项目需要完善。`);
  process.exit(1);
}