#!/usr/bin/env node

/**
 * 生产环境配置验证脚本
 * 在部署前检查所有关键参数是否正确配置
 */

import fs from 'fs';
import path from 'path';

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log('green', `✅ ${message}`);
}

function logError(message) {
  log('red', `❌ ${message}`);
}

function logWarning(message) {
  log('yellow', `⚠️ ${message}`);
}

function logInfo(message) {
  log('blue', `ℹ️ ${message}`);
}

// 验证结果
let hasErrors = false;
let hasWarnings = false;

function addError(message) {
  logError(message);
  hasErrors = true;
}

function addWarning(message) {
  logWarning(message);
  hasWarnings = true;
}

// 1. 检查智能合约配置
function validateSmartContract() {
  logInfo('检查智能合约配置...');
  
  const contractFiles = [
    'contracts/JinbaoProtocolProduction.sol',
    'contracts/JinbaoProtocolComplete.sol',
    'contracts/JinbaoProtocolV2.sol'
  ];

  let productionContractExists = false;
  
  for (const file of contractFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // 检查 SECONDS_IN_UNIT 配置
      const secondsInUnitMatch = content.match(/SECONDS_IN_UNIT\s*=\s*(\d+)/);
      if (secondsInUnitMatch) {
        const value = parseInt(secondsInUnitMatch[1]);
        
        if (file.includes('Production')) {
          productionContractExists = true;
          if (value === 86400) {
            logSuccess(`${file}: SECONDS_IN_UNIT = ${value} (1天) ✓`);
          } else {
            addError(`${file}: SECONDS_IN_UNIT = ${value}, 应该是 86400 (1天)`);
          }
        } else {
          if (value === 60) {
            logInfo(`${file}: SECONDS_IN_UNIT = ${value} (测试环境配置)`);
          } else if (value === 86400) {
            addWarning(`${file}: 已配置为生产环境 (${value}秒)`);
          }
        }
      }

      // 检查质押周期验证
      if (content.includes('cycleDays == 7 || cycleDays == 15 || cycleDays == 30')) {
        logSuccess(`${file}: 质押周期验证正确 (7/15/30天)`);
      } else {
        addWarning(`${file}: 未找到标准质押周期验证`);
      }

      // 检查收益率配置
      const rates = {
        '7': '13333334',   // 1.3333334%
        '15': '16666667',  // 1.6666667%
        '30': '20000000'   // 2.0%
      };

      for (const [days, expectedRate] of Object.entries(rates)) {
        if (content.includes(`cycleDays == ${days}`) && content.includes(expectedRate)) {
          logSuccess(`${file}: ${days}天质押收益率配置正确 (${expectedRate})`);
        }
      }
    }
  }

  if (!productionContractExists) {
    addWarning('未找到专用的生产环境合约文件 (JinbaoProtocolProduction.sol)');
  } else {
    logSuccess('找到生产环境专用合约文件');
  }
}

// 2. 检查环境变量配置
function validateEnvironmentConfig() {
  logInfo('检查环境变量配置...');
  
  const envFile = '.env.production';
  if (!fs.existsSync(envFile)) {
    addError(`环境配置文件不存在: ${envFile}`);
    return;
  }

  const envContent = fs.readFileSync(envFile, 'utf8');
  
  // 检查关键配置
  const requiredConfigs = {
    'VITE_STAKING_UNIT_SECONDS=86400': '质押时间单位 (1天)',
    'VITE_TIME_UNIT="days"': '时间单位显示',
    'VITE_RATE_UNIT="daily"': '收益率单位显示',
    'VITE_STAKING_PERIODS="7,15,30"': '支持的质押周期',
    'VITE_STAKING_RATES="1.33,1.67,2.00"': '对应的日收益率'
  };

  for (const [config, description] of Object.entries(requiredConfigs)) {
    if (envContent.includes(config)) {
      logSuccess(`${description}: ${config} ✓`);
    } else {
      addError(`缺少配置 ${description}: ${config}`);
    }
  }

  // 检查合约地址配置
  const contractAddresses = [
    'VITE_JBC_CONTRACT_ADDRESS',
    'VITE_PROTOCOL_CONTRACT_ADDRESS',
    'VITE_MC_CONTRACT_ADDRESS'
  ];

  for (const addr of contractAddresses) {
    if (envContent.includes(`${addr}=""`)) {
      addWarning(`${addr} 未设置实际地址`);
    } else if (envContent.includes(addr)) {
      logSuccess(`${addr} 已配置`);
    } else {
      addError(`缺少配置: ${addr}`);
    }
  }
}

// 3. 检查前端配置
function validateFrontendConfig() {
  logInfo('检查前端配置...');
  
  const configFile = 'src/config/production.ts';
  if (!fs.existsSync(configFile)) {
    addWarning(`前端生产配置文件不存在: ${configFile}`);
    return;
  }

  const configContent = fs.readFileSync(configFile, 'utf8');
  
  // 检查关键配置
  if (configContent.includes('SECONDS_IN_UNIT: 86400')) {
    logSuccess('前端时间单位配置正确 (86400秒 = 1天)');
  } else {
    addError('前端时间单位配置错误，应该是 86400 秒');
  }

  if (configContent.includes("TIME_UNIT: 'days'")) {
    logSuccess('前端时间单位显示配置正确 (days)');
  } else {
    addError("前端时间单位显示配置错误，应该是 'days'");
  }

  // 检查质押周期配置
  const stakingPeriods = [
    { days: 7, rate: '1.3333334' },
    { days: 15, rate: '1.6666667' },
    { days: 30, rate: '2.0' }
  ];

  for (const period of stakingPeriods) {
    if (configContent.includes(`days: ${period.days}`) && configContent.includes(`rate: ${period.rate}`)) {
      logSuccess(`前端 ${period.days}天质押配置正确 (${period.rate}% 每日)`);
    } else {
      addError(`前端 ${period.days}天质押配置缺失或错误`);
    }
  }
}

// 4. 检查部署脚本配置
function validateDeploymentScripts() {
  logInfo('检查部署脚本配置...');
  
  const deployScript = 'scripts/deploy-prod.sh';
  if (fs.existsSync(deployScript)) {
    logSuccess('生产环境部署脚本存在');
    
    const scriptContent = fs.readFileSync(deployScript, 'utf8');
    if (scriptContent.includes('npm run deploy:mc')) {
      logSuccess('部署脚本包含 MC Chain 部署命令');
    } else {
      addWarning('部署脚本可能缺少 MC Chain 部署命令');
    }
  } else {
    addError(`生产环境部署脚本不存在: ${deployScript}`);
  }

  const secretsScript = 'scripts/setup-secrets.sh';
  if (fs.existsSync(secretsScript)) {
    logSuccess('Secrets 配置脚本存在');
  } else {
    addError(`Secrets 配置脚本不存在: ${secretsScript}`);
  }
}

// 5. 检查 GitHub Actions 配置
function validateGitHubActions() {
  logInfo('检查 GitHub Actions 配置...');
  
  const workflowFile = '.github/workflows/deploy-prod.yml';
  if (!fs.existsSync(workflowFile)) {
    addError(`GitHub Actions 工作流文件不存在: ${workflowFile}`);
    return;
  }

  const workflowContent = fs.readFileSync(workflowFile, 'utf8');
  
  // 检查触发条件
  if (workflowContent.includes('branches: [ prod ]')) {
    logSuccess('GitHub Actions 配置为 prod 分支触发');
  } else {
    addError('GitHub Actions 未配置为 prod 分支触发');
  }

  // 检查必要的 secrets
  const requiredSecrets = [
    'PROD_PRIVATE_KEY',
    'MC_RPC_URL',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID'
  ];

  for (const secret of requiredSecrets) {
    if (workflowContent.includes(secret)) {
      logSuccess(`GitHub Actions 包含必要的 secret: ${secret}`);
    } else {
      addError(`GitHub Actions 缺少必要的 secret: ${secret}`);
    }
  }
}

// 6. 生成配置摘要
function generateConfigSummary() {
  logInfo('生成配置摘要...');
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 生产环境配置摘要');
  console.log('='.repeat(60));
  
  console.log('\n🔧 关键参数:');
  console.log('  • 时间单位: 86400 秒 (1天)');
  console.log('  • 质押周期: 7天, 15天, 30天');
  console.log('  • 日收益率: 1.33%, 1.67%, 2.00%');
  console.log('  • 网络: MC Chain (88813)');
  
  console.log('\n📊 收益计算示例 (1000 MC):');
  console.log('  • 7天质押:  每日 13.33 MC, 总收益 93.33 MC');
  console.log('  • 15天质押: 每日 16.67 MC, 总收益 250.00 MC');
  console.log('  • 30天质押: 每日 20.00 MC, 总收益 600.00 MC');
  
  console.log('\n🚀 部署方式:');
  console.log('  • 自动部署: git push origin prod');
  console.log('  • 本地部署: npm run deploy:prod');
  console.log('  • 配置 Secrets: npm run setup:secrets:prod');
}

// 主函数
function main() {
  console.log('🔍 生产环境配置验证');
  console.log('='.repeat(60));
  
  validateSmartContract();
  console.log('');
  
  validateEnvironmentConfig();
  console.log('');
  
  validateFrontendConfig();
  console.log('');
  
  validateDeploymentScripts();
  console.log('');
  
  validateGitHubActions();
  console.log('');
  
  generateConfigSummary();
  
  // 输出验证结果
  console.log('\n' + '='.repeat(60));
  console.log('📋 验证结果');
  console.log('='.repeat(60));
  
  if (hasErrors) {
    logError('发现配置错误，请修复后再部署！');
    process.exit(1);
  } else if (hasWarnings) {
    logWarning('发现配置警告，建议检查后再部署');
    logInfo('如果确认无误，可以继续部署');
  } else {
    logSuccess('所有配置验证通过，可以安全部署！');
  }
  
  console.log('\n🚀 下一步:');
  console.log('  1. 配置 GitHub Repository Secrets');
  console.log('  2. 创建 Cloudflare Pages 项目');
  console.log('  3. 执行部署: npm run deploy:prod');
  console.log('  4. 验证部署结果');
}

// 执行验证
main();