const fs = require('fs');
const path = require('path');

/**
 * 更新前端配置文件中的合约地址
 * @param {string} jbcAddress - 新的JBC合约地址
 * @param {string} protocolAddress - 新的协议合约地址
 */
function updateFrontendConfig(jbcAddress, protocolAddress) {
  console.log("🔧 更新前端配置文件...");
  
  // 更新 Web3Context.tsx
  const web3ContextPath = path.join(__dirname, '../src/Web3Context.tsx');
  
  if (fs.existsSync(web3ContextPath)) {
    let content = fs.readFileSync(web3ContextPath, 'utf8');
    
    // 更新合约地址
    content = content.replace(
      /JBC_TOKEN: "0x[a-fA-F0-9]{40}"/,
      `JBC_TOKEN: "${jbcAddress}"`
    );
    
    content = content.replace(
      /PROTOCOL: "0x[a-fA-F0-9]{40}"/,
      `PROTOCOL: "${protocolAddress}"`
    );
    
    fs.writeFileSync(web3ContextPath, content);
    console.log("✅ 已更新 src/Web3Context.tsx");
  } else {
    console.log("⚠️  未找到 src/Web3Context.tsx 文件");
  }
  
  // 检查是否有其他配置文件需要更新
  const configFiles = [
    'src/config.ts',
    'src/constants.ts',
    'src/config/contracts.ts'
  ];
  
  configFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // 更新JBC地址
      if (content.includes('JBC') && content.includes('0x')) {
        content = content.replace(
          /JBC[^"]*"0x[a-fA-F0-9]{40}"/g,
          `JBC_TOKEN: "${jbcAddress}"`
        );
      }
      
      // 更新协议地址
      if (content.includes('PROTOCOL') && content.includes('0x')) {
        content = content.replace(
          /PROTOCOL[^"]*"0x[a-fA-F0-9]{40}"/g,
          `PROTOCOL: "${protocolAddress}"`
        );
      }
      
      fs.writeFileSync(fullPath, content);
      console.log(`✅ 已更新 ${filePath}`);
    }
  });
  
  console.log("✅ 前端配置文件更新完成");
}

module.exports = updateFrontendConfig;

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.log("用法: node update-frontend-config.cjs <JBC_ADDRESS> <PROTOCOL_ADDRESS>");
    process.exit(1);
  }
  
  const [jbcAddress, protocolAddress] = args;
  updateFrontendConfig(jbcAddress, protocolAddress);
}