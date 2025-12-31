#!/usr/bin/env node

/**
 * Environment Validator for Jinbao Protocol
 * Validates Node.js version, npm version, and critical dependencies
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.packageJson = this.loadPackageJson();
  }

  loadPackageJson() {
    try {
      const packagePath = join(__dirname, '..', 'package.json');
      return JSON.parse(readFileSync(packagePath, 'utf8'));
    } catch (error) {
      this.errors.push('无法读取 package.json 文件');
      return {};
    }
  }

  validateNodeVersion() {
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      const requiredVersion = this.packageJson.engines?.node;
      if (requiredVersion) {
        const requiredMajor = parseInt(requiredVersion.replace('>=', ''));
        
        if (majorVersion < requiredMajor) {
          this.errors.push(
            `Node.js 版本不兼容: 当前 ${nodeVersion}, 需要 ${requiredVersion}`
          );
        } else {
          console.log(`✅ Node.js 版本: ${nodeVersion} (符合要求)`);
        }
      }
    } catch (error) {
      this.errors.push('无法检测 Node.js 版本');
    }
  }

  validateNpmVersion() {
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      const majorVersion = parseInt(npmVersion.split('.')[0]);
      
      const requiredVersion = this.packageJson.engines?.npm;
      if (requiredVersion) {
        const requiredMajor = parseInt(requiredVersion.replace('>=', ''));
        
        if (majorVersion < requiredMajor) {
          this.errors.push(
            `npm 版本不兼容: 当前 ${npmVersion}, 需要 ${requiredVersion}`
          );
        } else {
          console.log(`✅ npm 版本: ${npmVersion} (符合要求)`);
        }
      }
    } catch (error) {
      this.errors.push('无法检测 npm 版本');
    }
  }

  validateCriticalDependencies() {
    const criticalDeps = [
      'react',
      'vite',
      'ethers',
      '@rainbow-me/rainbowkit',
      'wagmi',
      'hardhat'
    ];

    criticalDeps.forEach(dep => {
      const version = this.packageJson.dependencies?.[dep] || 
                     this.packageJson.devDependencies?.[dep];
      
      if (!version) {
        this.errors.push(`缺少关键依赖: ${dep}`);
      } else {
        console.log(`✅ ${dep}: ${version}`);
      }
    });
  }

  validateEnvironmentFiles() {
    const requiredFiles = ['.env.example'];
    const optionalFiles = ['.env', '.env.production'];
    
    requiredFiles.forEach(file => {
      try {
        readFileSync(file);
        console.log(`✅ 环境文件: ${file}`);
      } catch {
        this.errors.push(`缺少必需的环境文件: ${file}`);
      }
    });

    optionalFiles.forEach(file => {
      try {
        readFileSync(file);
        console.log(`✅ 环境文件: ${file}`);
      } catch {
        this.warnings.push(`建议创建环境文件: ${file}`);
      }
    });
  }

  validateBuildTools() {
    try {
      // 检查 Vite 是否可用
      execSync('npx vite --version', { stdio: 'pipe' });
      console.log('✅ Vite 构建工具可用');
    } catch {
      this.errors.push('Vite 构建工具不可用');
    }

    try {
      // 检查 Hardhat 是否可用
      execSync('npx hardhat --version', { stdio: 'pipe' });
      console.log('✅ Hardhat 开发工具可用');
    } catch {
      this.errors.push('Hardhat 开发工具不可用');
    }
  }

  async run() {
    console.log('🔍 开始环境验证...\n');

    this.validateNodeVersion();
    this.validateNpmVersion();
    this.validateCriticalDependencies();
    this.validateEnvironmentFiles();
    this.validateBuildTools();

    console.log('\n📊 验证结果:');
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  警告:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ 错误:');
      this.errors.forEach(error => console.log(`  - ${error}`));
      console.log('\n💡 建议解决方案:');
      console.log('  1. 升级 Node.js 到 v20+ LTS 版本');
      console.log('  2. 运行 npm install 重新安装依赖');
      console.log('  3. 检查 .env 文件配置');
      process.exit(1);
    } else {
      console.log('\n✅ 环境验证通过! 可以开始开发了。');
    }
  }
}

// 运行验证
const validator = new EnvironmentValidator();
validator.run().catch(console.error);