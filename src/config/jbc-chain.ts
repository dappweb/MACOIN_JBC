/**
 * JBC Chain (JIBCHAIN L1) 网络配置
 * 基于 https://thirdweb.com/jibchain-l1 的信息
 */

import { defineChain } from 'viem'

// JBC Chain 网络配置
export const JBC_CHAIN_CONFIG = {
  // 基本信息
  name: 'JIBCHAIN L1',
  network: 'jibchain-l1',
  website: 'https://jibchain.net',
  
  // 网络参数 (需要确认实际值)
  chainId: 88888, // 待确认实际链 ID
  
  // 原生代币
  nativeCurrency: {
    name: 'JIBCOIN',
    symbol: 'JBC',
    decimals: 18,
  },
  
  // RPC 端点 (需要确认实际 RPC)
  rpcUrls: {
    default: { http: ['https://rpc.jibchain.net/'] }, // 待确认
    public: { http: ['https://rpc.jibchain.net/'] },
  },
  
  // 区块浏览器
  blockExplorers: {
    default: { 
      name: 'JIBCHAIN Explorer', 
      url: 'https://exp-l1.jibchain.net' 
    },
  },
  
  // 性能特性
  performance: {
    blockTime: 3, // 2-3秒出块
    avgGasPrice: 0.01, // < $0.01 交易费用
    tpsCapacity: 100, // 100+ TPS
    finality: 'near-instant', // 近即时确认
  },
  
  // 特性支持
  features: {
    evm: true, // 完全 EVM 兼容
    bridges: true, // 跨链桥支持
    defi: true, // DeFi 支持
    nft: true, // NFT 支持
    gamefi: true, // GameFi 支持
  }
}

// Viem 链配置
export const jbcChain = defineChain({
  id: JBC_CHAIN_CONFIG.chainId,
  name: JBC_CHAIN_CONFIG.name,
  network: JBC_CHAIN_CONFIG.network,
  nativeCurrency: JBC_CHAIN_CONFIG.nativeCurrency,
  rpcUrls: JBC_CHAIN_CONFIG.rpcUrls,
  blockExplorers: JBC_CHAIN_CONFIG.blockExplorers,
})

// Wagmi 链配置
export const jbcChainWagmi = {
  id: JBC_CHAIN_CONFIG.chainId,
  name: JBC_CHAIN_CONFIG.name,
  network: JBC_CHAIN_CONFIG.network,
  nativeCurrency: JBC_CHAIN_CONFIG.nativeCurrency,
  rpcUrls: JBC_CHAIN_CONFIG.rpcUrls,
  blockExplorers: JBC_CHAIN_CONFIG.blockExplorers,
}

// MetaMask 添加网络配置
export const JBC_METAMASK_CONFIG = {
  chainId: `0x${JBC_CHAIN_CONFIG.chainId.toString(16)}`, // 转换为十六进制
  chainName: JBC_CHAIN_CONFIG.name,
  nativeCurrency: JBC_CHAIN_CONFIG.nativeCurrency,
  rpcUrls: JBC_CHAIN_CONFIG.rpcUrls.default.http,
  blockExplorerUrls: [JBC_CHAIN_CONFIG.blockExplorers.default.url],
}

// JBC Chain 环境配置
export const JBC_ENVIRONMENT_CONFIG = {
  // 生产环境
  production: {
    chainId: JBC_CHAIN_CONFIG.chainId,
    rpcUrl: JBC_CHAIN_CONFIG.rpcUrls.default.http[0],
    explorer: JBC_CHAIN_CONFIG.blockExplorers.default.url,
    
    // 合约地址 (部署后更新)
    contracts: {
      jbcToken: '', // JBC Protocol Token
      protocolProxy: '', // JinbaoProtocol Proxy
      mcToken: '', // MC Token (如果需要)
    },
    
    // 前端配置
    frontend: {
      url: 'https://jinbao-jbc-prod.pages.dev',
      apiUrl: 'https://jinbao-jbc-prod.pages.dev/api',
    },
    
    // 质押配置
    staking: {
      timeUnit: 86400, // 1天 = 86400秒
      periods: [7, 15, 30], // 天数
      rates: [1.3333334, 1.6666667, 2.0], // 日收益率 %
    },
    
    // 燃烧配置
    burning: {
      dailyAmount: 500, // 每日燃烧 500 JBC
      maxAmount: 5000, // 最大燃烧 5000 JBC
      percentage: 0.1, // 0.1% 燃烧比例
    }
  },
  
  // 测试环境
  staging: {
    chainId: JBC_CHAIN_CONFIG.chainId, // 如果有测试网，使用不同的链 ID
    rpcUrl: JBC_CHAIN_CONFIG.rpcUrls.default.http[0], // 测试网 RPC
    explorer: JBC_CHAIN_CONFIG.blockExplorers.default.url,
    
    contracts: {
      jbcToken: '',
      protocolProxy: '',
      mcToken: '',
    },
    
    frontend: {
      url: 'https://jinbao-jbc-staging.pages.dev',
      apiUrl: 'https://jinbao-jbc-staging.pages.dev/api',
    },
    
    staking: {
      timeUnit: 60, // 测试环境可以用分钟
      periods: [7, 15, 30],
      rates: [1.3333334, 1.6666667, 2.0],
    },
    
    burning: {
      dailyAmount: 10, // 测试环境少量燃烧
      maxAmount: 100,
      percentage: 0.01,
    }
  }
}

// 工具函数
export class JBCChainUtils {
  
  /**
   * 添加 JBC Chain 到 MetaMask
   */
  static async addToMetaMask(): Promise<boolean> {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not installed')
    }
    
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [JBC_METAMASK_CONFIG],
      })
      return true
    } catch (error) {
      console.error('Failed to add JBC Chain to MetaMask:', error)
      return false
    }
  }
  
  /**
   * 切换到 JBC Chain
   */
  static async switchToJBCChain(): Promise<boolean> {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not installed')
    }
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: JBC_METAMASK_CONFIG.chainId }],
      })
      return true
    } catch (error: any) {
      // 如果链不存在，尝试添加
      if (error.code === 4902) {
        return await this.addToMetaMask()
      }
      console.error('Failed to switch to JBC Chain:', error)
      return false
    }
  }
  
  /**
   * 检查是否在 JBC Chain
   */
  static async isOnJBCChain(): Promise<boolean> {
    if (typeof window.ethereum === 'undefined') {
      return false
    }
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      return chainId === JBC_METAMASK_CONFIG.chainId
    } catch (error) {
      console.error('Failed to check chain:', error)
      return false
    }
  }
  
  /**
   * 获取网络信息
   */
  static getNetworkInfo() {
    return {
      name: JBC_CHAIN_CONFIG.name,
      chainId: JBC_CHAIN_CONFIG.chainId,
      symbol: JBC_CHAIN_CONFIG.nativeCurrency.symbol,
      explorer: JBC_CHAIN_CONFIG.blockExplorers.default.url,
      rpc: JBC_CHAIN_CONFIG.rpcUrls.default.http[0],
      performance: JBC_CHAIN_CONFIG.performance,
      features: JBC_CHAIN_CONFIG.features,
    }
  }
  
  /**
   * 格式化 JBC 金额
   */
  static formatJBC(amount: string | number, decimals: number = 4): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `${num.toFixed(decimals)} JBC`
  }
  
  /**
   * 估算交易费用
   */
  static estimateTransactionFee(gasUsed: number = 21000): string {
    const feeInUSD = (gasUsed * JBC_CHAIN_CONFIG.performance.avgGasPrice) / 21000
    return `~$${feeInUSD.toFixed(4)}`
  }
}

// React Hook 示例
export function useJBCChain() {
  const isOnJBCChain = async () => {
    return await JBCChainUtils.isOnJBCChain()
  }
  
  const switchToJBCChain = async () => {
    return await JBCChainUtils.switchToJBCChain()
  }
  
  const addToMetaMask = async () => {
    return await JBCChainUtils.addToMetaMask()
  }
  
  return {
    chainConfig: JBC_CHAIN_CONFIG,
    isOnJBCChain,
    switchToJBCChain,
    addToMetaMask,
    networkInfo: JBCChainUtils.getNetworkInfo(),
  }
}

export default JBC_CHAIN_CONFIG