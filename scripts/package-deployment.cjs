const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 打包可部署文件为 ZIP
 * 包含：合约、编译产物、部署脚本、配置文件、前端构建产物等
 */

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'deployment-packages');
const ZIP_NAME = `deployment-${Date.now()}.zip`;

// 需要打包的目录和文件
const FILES_TO_PACK = [
  // 合约源代码
  'contracts/',
  
  // 编译后的合约
  'artifacts/',
  
  // 部署脚本
  'scripts/',
  
  // 配置文件
  'hardhat.config.cjs',
  'config/hardhat.config.cjs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  
  // 部署记录
  'deployments/',
  
  // 前端构建产物（如果存在）
  'dist/',
  
  // Cloudflare Functions
  'functions/',
  
  // 公共资源
  'public/',
  
  // README
  'README.md',
];

// 需要排除的文件和目录
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.github',
  'cache',
  'test',
  'components',
  'hooks',
  'src',
  'utils',
  'workers',
  'cloudflare-worker',
  'docs',
  '.env',
  '.env.local',
  '.env.production',
  '*.log',
  '.DS_Store',
  'Thumbs.db',
];

function checkFileExists(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  return fs.existsSync(fullPath);
}

function createZip() {
  console.log('📦 开始打包可部署文件...\n');
  
  // 创建输出目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const zipPath = path.join(OUTPUT_DIR, ZIP_NAME);
  
  // 构建 zip 命令
  let zipCommand = `cd "${ROOT_DIR}" && zip -r "${zipPath}"`;
  
  // 添加要打包的文件
  const existingFiles = [];
  for (const file of FILES_TO_PACK) {
    if (checkFileExists(file)) {
      existingFiles.push(file);
      console.log(`✅ 包含: ${file}`);
    } else {
      console.log(`⚠️  跳过（不存在）: ${file}`);
    }
  }
  
  if (existingFiles.length === 0) {
    console.error('❌ 没有找到可打包的文件！');
    process.exit(1);
  }
  
  // 添加文件到 zip 命令
  existingFiles.forEach(file => {
    zipCommand += ` "${file}"`;
  });
  
  // 添加排除模式
  EXCLUDE_PATTERNS.forEach(pattern => {
    zipCommand += ` -x "*/${pattern}/*" "*${pattern}*"`;
  });
  
  try {
    console.log('\n🔨 正在创建 ZIP 文件...');
    execSync(zipCommand, { stdio: 'inherit' });
    
    // 获取文件大小
    const stats = fs.statSync(zipPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n✅ 打包完成！');
    console.log(`📁 文件路径: ${zipPath}`);
    console.log(`📊 文件大小: ${fileSizeMB} MB`);
    console.log(`\n📋 包含的文件:`);
    existingFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    
    return zipPath;
  } catch (error) {
    console.error('❌ 打包失败:', error.message);
    process.exit(1);
  }
}

// 主函数
function main() {
  console.log('='.repeat(60));
  console.log('🚀 可部署文件打包工具');
  console.log('='.repeat(60));
  console.log(`📂 项目根目录: ${ROOT_DIR}`);
  console.log(`📦 输出目录: ${OUTPUT_DIR}\n`);
  
  const zipPath = createZip();
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ 打包完成！');
  console.log('='.repeat(60));
  console.log(`\n💡 提示: ZIP 文件已保存到:`);
  console.log(`   ${zipPath}\n`);
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { createZip, FILES_TO_PACK, EXCLUDE_PATTERNS };

