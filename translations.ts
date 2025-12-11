export type Language = 'zh' | 'en';

export const translations = {
  zh: {
    nav: {
      home: '首页概览',
      mining: 'RWA 矿池',
      team: '团队节点',
      swap: '闪兑交易',
      connect: '连接钱包',
      connected: '0x3A...8f22'
    },
    stats: {
      protocol: 'DeFi 4.0 协议',
      title: 'RWA 金宝',
      subtitle: '真实黄金资产锚定',
      desc: '基于 MACOIN Chain 自研公链。参与即有25%部分进行黄金对标，由紫金矿业提供5000万黄金托底。',
      join: '立即参与',
      whitepaper: '查看白皮书',
      assets: '我的资产 (MC)',
      holding: '持有 JBC',
      revenue: '累计收益',
      level: '当前等级',
      teamCount: '团队人数',
      chartTitle: 'JBC 价值走势',
      settlement: '双币本位结算',
      today: '今日',
      estValue: '预估价值'
    },
    mining: {
      title: 'RWA 黄金矿池',
      subtitle: '选择门票与流动性周期，开启 DeFi 4.0 双币高收益挖矿',
      step1: '1. 选择门票 (Ticket)',
      liquidity: '流动性',
      step2: '2. 选择质押周期',
      days: '天',
      daily: '日化',
      notice: '注意：',
      notice1: '门票购买后需72小时内提供流动性，否则自动作废。',
      notice2: '赎回时需支付门票额度 1% 的赎回金。',
      notice3: '收益结算: 50% MC (币本位) + 50% JBC (金本位)。',
      estRevenue: '收益预估',
      ticketInv: '门票投入',
      liqInv: '流动性投入 (1.5x)',
      totalLock: '总锁仓',
      dailyRev: '日收益',
      totalRev: '周期总收益',
      cap: '3倍出局额度',
      maxCap: '最大额度',
      approve: '第一步：授权合约 (Approve)',
      stake: '立即质押',
      agreement: '点击质押即代表您同意 DeFi 4.0 协议规则'
    },
    team: {
      title: 'V系列 极差裂变机制',
      subtitle: '推广有效地址，获取高达 45% 的极差收益',
      colLevel: '等级 (Level)',
      colCount: '有效地址数',
      colReward: '极差奖励比例',
      colStatus: '状态',
      current: '当前等级',
      directReward: '直推奖励',
      directDesc: '每直接推荐一名有效用户，即可获得其门票金额 25% 的奖励。',
      levelReward: '层级奖 (15%)',
      l1: '推 1 有效账户',
      r1: '拿 5 层每单 1%',
      l2: '推 2 有效账户',
      r2: '拿 10 层每单 1%',
      l3: '推 3 有效账户',
      r3: '拿 15 层每单 1%'
    },
    swap: {
      title: 'JBC 闪兑 (Swap)',
      pay: '支付',
      balance: '余额',
      get: '获得 (预估)',
      slipSell: '卖出滑点 25% (25% 销毁)',
      slipBuy: '买入滑点 50% (50% 销毁)',
      confirm: '确认兑换'
    },
    footer: {
      rights: '© 2024 MACOIN RWA Protocol. All rights reserved.',
      audit: 'Code is law. JBC contract audited by SlowMist.'
    }
  },
  en: {
    nav: {
      home: 'Dashboard',
      mining: 'RWA Mining',
      team: 'Team Nodes',
      swap: 'Swap',
      connect: 'Connect Wallet',
      connected: '0x3A...8f22'
    },
    stats: {
      protocol: 'DeFi 4.0 Protocol',
      title: 'RWA Jinbao',
      subtitle: 'Real Gold Asset Anchored',
      desc: 'Built on MACOIN Chain. 25% of participation is benchmarked against gold, backed by 50 million gold reserves from Zijin Mining.',
      join: 'Join Now',
      whitepaper: 'Whitepaper',
      assets: 'My Assets (MC)',
      holding: 'JBC Holdings',
      revenue: 'Total Revenue',
      level: 'Current Level',
      teamCount: 'Team Members',
      chartTitle: 'JBC Value Trend',
      settlement: 'Dual Token Settlement',
      today: 'Today',
      estValue: 'Est. Value'
    },
    mining: {
      title: 'RWA Gold Pool',
      subtitle: 'Select ticket and liquidity cycle to start DeFi 4.0 high-yield mining',
      step1: '1. Select Ticket',
      liquidity: 'Liquidity',
      step2: '2. Select Cycle',
      days: 'Days',
      daily: 'Daily',
      notice: 'Notice:',
      notice1: 'Liquidity must be provided within 72 hours after ticket purchase.',
      notice2: 'A 1% redemption fee applies to the ticket amount upon redemption.',
      notice3: 'Revenue Settlement: 50% MC (Coin Base) + 50% JBC (Gold Base).',
      estRevenue: 'Est. Revenue',
      ticketInv: 'Ticket Invest',
      liqInv: 'Liquidity Invest (1.5x)',
      totalLock: 'Total Locked',
      dailyRev: 'Daily Revenue',
      totalRev: 'Total Revenue',
      cap: '3x Out Cap',
      maxCap: 'Max Cap',
      approve: 'Step 1: Approve',
      stake: 'Stake Now',
      agreement: 'Clicking stake means you agree to DeFi 4.0 Protocol Rules'
    },
    team: {
      title: 'V-Series Differential Mechanism',
      subtitle: 'Promote effective addresses to get up to 45% differential revenue',
      colLevel: 'Level',
      colCount: 'Active Addrs',
      colReward: 'Reward Ratio',
      colStatus: 'Status',
      current: 'Current',
      directReward: 'Direct Reward',
      directDesc: 'Get 25% of the ticket amount for every direct active user referral.',
      levelReward: 'Level Reward (15%)',
      l1: 'Refer 1 Active',
      r1: 'Get 5 Layers 1%',
      l2: 'Refer 2 Active',
      r2: 'Get 10 Layers 1%',
      l3: 'Refer 3 Active',
      r3: 'Get 15 Layers 1%'
    },
    swap: {
      title: 'JBC Swap',
      pay: 'Pay',
      balance: 'Balance',
      get: 'Receive (Est.)',
      slipSell: 'Sell Slippage 25% (25% Burn)',
      slipBuy: 'Buy Slippage 50% (50% Burn)',
      confirm: 'Confirm Swap'
    },
    footer: {
      rights: '© 2024 MACOIN RWA Protocol. All rights reserved.',
      audit: 'Code is law. JBC contract audited by SlowMist.'
    }
  }
};