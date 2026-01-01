#!/usr/bin/env node

/**
 * 更新前端合约地址脚本
 * 从最新的部署文件中读取合约地址并更新前端配置
 */

const fs = require('fs');
const path = require('path');

// 读取最新的部署文件
const deploymentsDir = path.join(__dirname, '../deployments');
const deploymentFiles = fs.readdirSync(deploymentsDir)
  .filter(file => file.startsWith('mc-chain-deployment-') && file.endsWith('.json'))
  .map(file => ({
    name: file,
    path: path.join(deploymentsDir, file),
    time: fs.statSync(path.join(deploymentsDir, file)).mtime
  }))
  .sort((a, b) => b.time - a.time);

if (deploymentFiles.length === 0) {
  console.error('❌ 未找到部署文件');
  process.exit(1);
}

const latestDeployment = deploymentFiles[0];
console.log(`📄 使用部署文件: ${latestDeployment.name}`);

const deployment = JSON.parse(fs.readFileSync(latestDeployment.path, 'utf8'));

const PROTOCOL_ADDRESS = deployment.proxyAddress;
const JBC_TOKEN_ADDRESS = deployment.jbcToken;

console.log(`📍 协议地址: ${PROTOCOL_ADDRESS}`);
console.log(`📍 JBC Token地址: ${JBC_TOKEN_ADDRESS}`);

// 更新 Web3Context.tsx
const web3ContextPath = path.join(__dirname, '../src/Web3Context.tsx');
let web3Context = fs.readFileSync(web3ContextPath, 'utf8');

// 更新 PROTOCOL 地址
const protocolRegex = /PROTOCOL:\s*process\.env\.NODE_ENV\s*===\s*'production'\s*\?\s*"[^"]*"/;
const newProtocolLine = `PROTOCOL: process.env.NODE_ENV === 'production'\n    ? "${PROTOCOL_ADDRESS}"  // P-prod Protocol V4 (级差奖励基于静态收益)`;

if (protocolRegex.test(web3Context)) {
  web3Context = web3Context.replace(protocolRegex, newProtocolLine);
  fs.writeFileSync(web3ContextPath, web3Context, 'utf8');
  console.log('✅ 已更新 src/Web3Context.tsx 中的 PROTOCOL 地址');
} else {
  console.warn('⚠️  未找到 PROTOCOL 地址配置，请手动更新');
}

// 更新 .env 文件（如果存在）
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // 更新或添加 VITE_PROTOCOL_CONTRACT_ADDRESS
  if (envContent.includes('VITE_PROTOCOL_CONTRACT_ADDRESS')) {
    envContent = envContent.replace(
      /VITE_PROTOCOL_CONTRACT_ADDRESS=.*/,
      `VITE_PROTOCOL_CONTRACT_ADDRESS=${PROTOCOL_ADDRESS}`
    );
  } else {
    envContent += `\nVITE_PROTOCOL_CONTRACT_ADDRESS=${PROTOCOL_ADDRESS}\n`;
  }
  
  // 更新或添加 VITE_JBC_CONTRACT_ADDRESS
  if (envContent.includes('VITE_JBC_CONTRACT_ADDRESS')) {
    envContent = envContent.replace(
      /VITE_JBC_CONTRACT_ADDRESS=.*/,
      `VITE_JBC_CONTRACT_ADDRESS=${JBC_TOKEN_ADDRESS}`
    );
  } else {
    envContent += `\nVITE_JBC_CONTRACT_ADDRESS=${JBC_TOKEN_ADDRESS}\n`;
  }
  
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ 已更新 .env 文件');
}

console.log('\n🎉 合约地址更新完成！');
console.log('\n📋 更新摘要:');
console.log(`   协议地址: ${PROTOCOL_ADDRESS}`);
console.log(`   JBC Token: ${JBC_TOKEN_ADDRESS}`);
console.log('\n💡 下一步:');
console.log('   1. 检查前端配置是否正确');
console.log('   2. 重新构建前端: npm run build');
console.log('   3. 测试合约交互功能');

