#!/usr/bin/env node

/**
 * 更新公告到数据库脚本
 * 使用方法: node scripts/update-announcement-to-db.cjs
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DATABASE_NAME = 'macoin-jbc-db';
const SQL_FILE = path.join(__dirname, 'update-announcement.sql');
// 目标账户信息（数据库所在的账户）
const TARGET_ACCOUNT_ID = '91682bb238aa911811c831ff0e29b5a5'; // suiyiwan1@outlook.com

console.log('📢 开始更新公告到数据库...\n');
console.log('📄 使用SQL文件:', SQL_FILE);
console.log('🗄️  数据库:', DATABASE_NAME);
console.log('📧 目标账户 ID:', TARGET_ACCOUNT_ID);
console.log('');

// 检查SQL文件是否存在
if (!fs.existsSync(SQL_FILE)) {
  console.error('❌ SQL文件不存在:', SQL_FILE);
  console.error('💡 请确保 scripts/update-announcement.sql 文件存在');
  process.exit(1);
}

// 检查是否有 API Token
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || TARGET_ACCOUNT_ID;

if (apiToken) {
  console.log('🔑 检测到 API Token，使用 API Token 方式执行...\n');
  process.env.CLOUDFLARE_API_TOKEN = apiToken;
  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
}

try {
  // 执行SQL文件
  console.log('🔄 执行SQL更新...');
  let command = `wrangler d1 execute ${DATABASE_NAME} --remote --file ${SQL_FILE}`;
  
  // 如果使用 API Token，添加账户ID参数
  if (apiToken) {
    command += ` --account-id ${accountId}`;
  }
  
  console.log('执行命令:', command);
  console.log('');
  
  const env = { ...process.env };
  if (apiToken) {
    env.CLOUDFLARE_API_TOKEN = apiToken;
    env.CLOUDFLARE_ACCOUNT_ID = accountId;
  }
  
  execSync(command, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: env
  });

  console.log('');
  console.log('✅ 公告更新成功！');
  console.log('📅 更新时间:', new Date().toISOString());
  console.log('');
  console.log('🔍 验证更新结果...');
  
  // 验证更新
  try {
    let verifyCommand = `wrangler d1 execute ${DATABASE_NAME} --remote --command "SELECT language, LENGTH(content) as content_length, updated_at FROM announcements ORDER BY language;"`;
    if (apiToken) {
      verifyCommand += ` --account-id ${accountId}`;
    }
    execSync(verifyCommand, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: env
    });
  } catch (error) {
    console.warn('⚠️  验证查询失败，但更新可能已成功');
  }

  console.log('');
  console.log('💡 提示:');
  console.log('   1. 如果用户页面仍未显示，请清除浏览器缓存');
  console.log('   2. 或者等待几分钟让缓存自动刷新');
  console.log('   3. 也可以手动刷新页面（Ctrl+F5 或 Cmd+Shift+R）');

} catch (error) {
  console.error('');
  console.error('❌ 更新失败:', error.message);
  console.error('');
  console.error('💡 可能的解决方案:');
  console.error('');
  console.error('   方法 1: 使用 API Token（推荐）');
  console.error('   =================================');
  console.error('   1. 登录 Cloudflare Dashboard: https://dash.cloudflare.com/profile/api-tokens');
  console.error('   2. 创建 API Token，权限需要: Account → D1 → Edit');
  console.error('   3. 设置环境变量并运行:');
  console.error(`      export CLOUDFLARE_API_TOKEN='your-api-token'`);
  console.error(`      export CLOUDFLARE_ACCOUNT_ID='${TARGET_ACCOUNT_ID}'`);
  console.error(`      node scripts/update-announcement-to-db.cjs`);
  console.error('');
  console.error('   方法 2: 切换到正确的账户');
  console.error('   =================================');
  console.error('   1. 退出当前账户: npx wrangler logout');
  console.error('   2. 登录正确账户: npx wrangler login');
  console.error('   3. 使用邮箱: suiyiwan1@outlook.com');
  console.error('   4. 再次运行脚本');
  console.error('');
  console.error('   方法 3: 通过管理面板手动发布');
  console.error('   =================================');
  console.error('   在管理面板中直接发布公告，系统会自动保存到数据库');
  console.error('');
  console.error('   其他检查:');
  console.error('   - 检查数据库名称是否正确:', DATABASE_NAME);
  console.error('   - 检查SQL文件是否存在:', SQL_FILE);
  console.error('');
  process.exit(1);
}
