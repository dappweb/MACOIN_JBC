const fs = require('fs')
const path = require('path')

const stakesFile = path.join(__dirname, '../output/980-accounts-stakes-data-2026-01-31T07-33-52.json')
const ticketFile = path.join(__dirname, '../output/980-accounts-ticket-data-2026-01-31T07-28-36.json')

const targetAddresses = [
  '0xc65f043ad84561e262c3ae54230f74b1071befe3',
  '0xd6b93380baa72a4ad126b2e8985a33dd8c13d98f'
]

function analyze () {
  const stakesData = JSON.parse(fs.readFileSync(stakesFile, 'utf8'))
  const ticketData = JSON.parse(fs.readFileSync(ticketFile, 'utf8'))

  targetAddresses.forEach(addr => {
    console.log(`\n=== 检查账户: ${addr} ===`)

    // 门票信息
    const userTicket = ticketData.accounts.find(a => a.address.toLowerCase() === addr.toLowerCase())
    if (userTicket) {
      console.log('🎫 门票状态 (新合约):')
      console.log(JSON.stringify(userTicket.newContract.ticket, null, 2))
    } else {
      console.log('❌ 门票数据中未找到该账户')
    }

    // 质押信息
    const userStakes = stakesData.accounts.find(a => a.address.toLowerCase() === addr.toLowerCase())
    if (userStakes) {
      console.log('\n💰 质押状态 (新合约):')
      console.log(`质押笔数: ${userStakes.newContract.count}`)
      userStakes.newContract.stakes.forEach(s => {
        console.log(`- ID: ${s.id}, 金额: ${s.amountMc} MC, 开始时间: ${s.startTimeFormatted}, 周期: ${s.cycleDays}天, 激活: ${s.active}`)
      })
    } else {
      console.log('❌ 质押数据中未找到该账户')
    }

    // 计算成熟时间
    if (userStakes && userStakes.newContract.stakes.length > 0) {
      const stake = userStakes.newContract.stakes[0]
      const startTime = new Date(stake.startTime * 1000)
      const maturityTime = new Date(startTime.getTime() + stake.cycleDays * 24 * 60 * 60 * 1000)
      console.log(`\n⏰ 预计到期时间: ${maturityTime.toLocaleString('zh-CN')}`)

      const now = new Date(); // 假设当前是 2026-02-11
      if (now >= maturityTime) {
        console.log('✅ 该质押已成熟，可以赎回。')
      } else {
        console.log(`⏳ 尚未成熟。距离到期还有 ${((maturityTime - now) / (1000 * 60 * 60 * 24)).toFixed(1)} 天。`)
      }
    }
  })
}

analyze()
