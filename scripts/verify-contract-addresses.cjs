/**
 * 验证合约地址是否正确配置
 */

const { ethers } = require('ethers');

const RPC_URL = 'https://chain.mcerscan.com/';
const EXPECTED_ADDRESSES = {
  JBC_TOKEN: '0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D',
  PROTOCOL: '0x0897Cee05E43B2eCf331cd80f881c211eb86844E',
  DAILY_BURN_MANAGER: '0x298578A691f10A85f027BDD2D9a8D007540FCBB4'
};

async function verifyContract(address, name) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const code = await provider.getCode(address);
    
    if (code === '0x') {
      console.log(`❌ ${name}: 地址 ${address} 没有合约代码`);
      return false;
    }
    
    console.log(`✅ ${name}: 地址 ${address} 有合约代码 (${code.length} 字节)`);
    return true;
  } catch (error) {
    console.error(`❌ ${name}: 验证失败`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 开始验证合约地址...\n');
  
  const results = {
    jbc: await verifyContract(EXPECTED_ADDRESSES.JBC_TOKEN, 'JBC Token'),
    protocol: await verifyContract(EXPECTED_ADDRESSES.PROTOCOL, 'Protocol'),
    dailyBurn: await verifyContract(EXPECTED_ADDRESSES.DAILY_BURN_MANAGER, 'Daily Burn Manager')
  };
  
  console.log('\n📊 验证结果:');
  console.log(`JBC Token: ${results.jbc ? '✅' : '❌'}`);
  console.log(`Protocol: ${results.protocol ? '✅' : '❌'}`);
  console.log(`Daily Burn Manager: ${results.dailyBurn ? '✅' : '❌'}`);
  
  const allValid = Object.values(results).every(r => r);
  
  if (allValid) {
    console.log('\n✅ 所有合约地址验证通过！');
    process.exit(0);
  } else {
    console.log('\n❌ 部分合约地址验证失败，请检查配置！');
    process.exit(1);
  }
}

main().catch(console.error);
