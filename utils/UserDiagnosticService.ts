import { ethers } from 'ethers';

export interface NetworkStatus {
  chainId: number;
  blockNumber: number;
  latency: number;
  isCorrectNetwork: boolean;
  networkHealth: 'good' | 'slow' | 'poor' | 'disconnected';
}

export interface ContractAccessStatus {
  isAccessible: boolean;
  isPaused: boolean | null;
  isEmergencyPaused: boolean;
  owner: string;
  contractBalance: number;
  error?: string;
}

export interface UserLevelInfo {
  level: number;
  percent: number;
  teamCount: number;
  error?: string;
}

export interface UserTicketInfo {
  ticketId: string;
  amount: number;
  purchaseTime: number;
  exited: boolean;
  isActive: boolean;
}

export interface UserInfo {
  referrer: string;
  hasReferrer: boolean;
  isActive: boolean;
  totalRevenue: number;
  currentCap: number;
  maxTicketAmount: number;
  maxSingleTicketAmount: number;
}

export interface RewardEventInfo {
  staticRewards: any[];
  differentialRewards: any[];
  directRewards: any[];
  levelRewards: any[];
  totalEvents: number;
  queryError?: string;
  latestEvent?: any;
}

export interface DiagnosticInfo {
  userAddress: string;
  timestamp: string;
  networkStatus: NetworkStatus;
  contractAccess: ContractAccessStatus;
  userLevel: UserLevelInfo;
  userTicket: UserTicketInfo;
  userInfo: UserInfo;
  rewardEvents: RewardEventInfo;
  issues: Array<{
    type: 'network' | 'contract' | 'user_state' | 'component';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    details?: any;
  }>;
  solutions: string[];
  canPurchaseTicket: boolean;
  recommendedAction: string;
}

export class UserDiagnosticService {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private targetChainId: number = 88813; // MC Chain

  constructor(provider: ethers.Provider, contract: ethers.Contract) {
    this.provider = provider;
    this.contract = contract;
  }

  async performComprehensiveDiagnostic(userAddress: string): Promise<DiagnosticInfo> {
    console.log(`🔍 开始诊断用户: ${userAddress}`);
    
    const diagnostic: DiagnosticInfo = {
      userAddress,
      timestamp: new Date().toISOString(),
      networkStatus: await this.checkNetworkStatus(),
      contractAccess: await this.checkContractAccess(),
      userLevel: await this.checkUserLevel(userAddress),
      userTicket: await this.checkUserTicket(userAddress),
      userInfo: await this.checkUserInfo(userAddress),
      rewardEvents: await this.checkRewardEvents(userAddress),
      issues: [],
      solutions: [],
      canPurchaseTicket: false,
      recommendedAction: ''
    };

    // 分析问题
    this.analyzeIssues(diagnostic);
    
    return diagnostic;
  }

  private async checkNetworkStatus(): Promise<NetworkStatus> {
    try {
      const startTime = Date.now();
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const latency = Date.now() - startTime;

      const chainId = Number(network.chainId);
      const isCorrectNetwork = chainId === this.targetChainId;
      
      let networkHealth: NetworkStatus['networkHealth'] = 'good';
      if (latency > 5000) networkHealth = 'poor';
      else if (latency > 2000) networkHealth = 'slow';

      return {
        chainId,
        blockNumber,
        latency,
        isCorrectNetwork,
        networkHealth
      };
    } catch (error) {
      console.error('❌ 网络状态检查失败:', error);
      return {
        chainId: 0,
        blockNumber: 0,
        latency: 0,
        isCorrectNetwork: false,
        networkHealth: 'disconnected'
      };
    }
  }

  private async checkContractAccess(): Promise<ContractAccessStatus> {
    try {
      // 检查合约基本信息
      const owner = await this.contract.owner();
      
      // 检查暂停状态
      let isPaused = null;
      let isEmergencyPaused = false;
      
      try {
        isPaused = await this.contract.paused();
      } catch (e) {
        console.warn('合约没有 paused() 函数');
      }

      try {
        isEmergencyPaused = await this.contract.emergencyPaused();
      } catch (e) {
        console.warn('合约没有 emergencyPaused() 函数');
      }

      // 检查合约余额
      const balance = await this.provider.getBalance(await this.contract.getAddress());
      const contractBalance = parseFloat(ethers.formatEther(balance));

      return {
        isAccessible: true,
        isPaused,
        isEmergencyPaused,
        owner,
        contractBalance,
      };
    } catch (error) {
      console.error('❌ 合约访问检查失败:', error);
      return {
        isAccessible: false,
        isPaused: null,
        isEmergencyPaused: false,
        owner: '',
        contractBalance: 0,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  private async checkUserLevel(userAddress: string): Promise<UserLevelInfo> {
    try {
      const userLevel = await this.contract.getUserLevel(userAddress);
      return {
        level: Number(userLevel.level),
        percent: Number(userLevel.percent),
        teamCount: Number(userLevel.teamCount)
      };
    } catch (error) {
      console.error('❌ 用户等级检查失败:', error);
      return {
        level: 0,
        percent: 0,
        teamCount: 0,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  private async checkUserTicket(userAddress: string): Promise<UserTicketInfo> {
    try {
      const ticket = await this.contract.userTicket(userAddress);
      return {
        ticketId: ticket.id ? ticket.id.toString() : '0',
        amount: parseFloat(ethers.formatEther(ticket.amount)),
        purchaseTime: Number(ticket.purchaseTime),
        exited: ticket.exited || false,
        isActive: ticket.amount > 0 && !ticket.exited
      };
    } catch (error) {
      console.error('❌ 用户门票检查失败:', error);
      return {
        ticketId: '0',
        amount: 0,
        purchaseTime: 0,
        exited: false,
        isActive: false
      };
    }
  }

  private async checkUserInfo(userAddress: string): Promise<UserInfo> {
    try {
      const userInfo = await this.contract.userInfo(userAddress);
      return {
        referrer: userInfo.referrer,
        hasReferrer: userInfo.referrer !== ethers.ZeroAddress,
        isActive: userInfo.isActive || false,
        totalRevenue: parseFloat(ethers.formatEther(userInfo.totalRevenue)),
        currentCap: parseFloat(ethers.formatEther(userInfo.currentCap)),
        maxTicketAmount: parseFloat(ethers.formatEther(userInfo.maxTicketAmount)),
        maxSingleTicketAmount: parseFloat(ethers.formatEther(userInfo.maxSingleTicketAmount))
      };
    } catch (error) {
      console.error('❌ 用户信息检查失败:', error);
      return {
        referrer: ethers.ZeroAddress,
        hasReferrer: false,
        isActive: false,
        totalRevenue: 0,
        currentCap: 0,
        maxTicketAmount: 0,
        maxSingleTicketAmount: 0
      };
    }
  }

  private async checkRewardEvents(userAddress: string): Promise<RewardEventInfo> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000); // 检查最近100000个区块

      console.log(`🔍 查询奖励事件，从区块 ${fromBlock} 到 ${currentBlock}`);

      // 并行查询所有奖励事件
      const [
        staticRewardResults,
        differentialRewardResults,
        directRewardResults,
        levelRewardResults
      ] = await Promise.allSettled([
        // 静态奖励 (RewardClaimed with rewardType 0)
        this.contract.queryFilter(
          this.contract.filters.RewardClaimed(userAddress),
          fromBlock
        ),
        // 级差奖励 (DifferentialRewardDistributed)
        this.contract.queryFilter(
          this.contract.filters.DifferentialRewardDistributed(userAddress),
          fromBlock
        ),
        // 直推奖励 (ReferralRewardPaid)
        this.contract.queryFilter(
          this.contract.filters.ReferralRewardPaid(userAddress),
          fromBlock
        ),
        // 层级奖励 (可能包含在 ReferralRewardPaid 中)
        this.contract.queryFilter(
          this.contract.filters.RewardPaid(userAddress),
          fromBlock
        )
      ]);

      const staticRewards = staticRewardResults.status === 'fulfilled' ? staticRewardResults.value : [];
      const differentialRewards = differentialRewardResults.status === 'fulfilled' ? differentialRewardResults.value : [];
      const directRewards = directRewardResults.status === 'fulfilled' ? directRewardResults.value : [];
      const levelRewards = levelRewardResults.status === 'fulfilled' ? levelRewardResults.value : [];

      const totalEvents = staticRewards.length + differentialRewards.length + directRewards.length + levelRewards.length;

      // 找到最新的事件
      const allEvents = [...staticRewards, ...differentialRewards, ...directRewards, ...levelRewards];
      const latestEvent = allEvents.length > 0 ? 
        allEvents.reduce((latest, current) => 
          current.blockNumber > latest.blockNumber ? current : latest
        ) : null;

      console.log(`📊 事件统计:
        - 静态奖励: ${staticRewards.length}
        - 级差奖励: ${differentialRewards.length}
        - 直推奖励: ${directRewards.length}
        - 层级奖励: ${levelRewards.length}
        - 总计: ${totalEvents}`);

      return {
        staticRewards,
        differentialRewards,
        directRewards,
        levelRewards,
        totalEvents,
        latestEvent
      };
    } catch (error) {
      console.error('❌ 奖励事件查询失败:', error);
      return {
        staticRewards: [],
        differentialRewards: [],
        directRewards: [],
        levelRewards: [],
        totalEvents: 0,
        queryError: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  private analyzeIssues(diagnostic: DiagnosticInfo): void {
    const issues = diagnostic.issues;
    const solutions = diagnostic.solutions;

    // 检查网络问题
    if (!diagnostic.networkStatus.isCorrectNetwork) {
      issues.push({
        type: 'network',
        severity: 'critical',
        description: `网络错误：当前链ID ${diagnostic.networkStatus.chainId}，应为 ${this.targetChainId}`,
        details: diagnostic.networkStatus
      });
      solutions.push('请切换到正确的网络 (MC Chain)');
    }

    if (diagnostic.networkStatus.networkHealth === 'disconnected') {
      issues.push({
        type: 'network',
        severity: 'critical',
        description: '网络连接失败',
        details: diagnostic.networkStatus
      });
      solutions.push('请检查网络连接');
    } else if (diagnostic.networkStatus.networkHealth === 'poor') {
      issues.push({
        type: 'network',
        severity: 'medium',
        description: `网络延迟过高: ${diagnostic.networkStatus.latency}ms`,
        details: diagnostic.networkStatus
      });
      solutions.push('网络较慢，可能影响数据加载');
    }

    // 检查合约访问问题
    if (!diagnostic.contractAccess.isAccessible) {
      issues.push({
        type: 'contract',
        severity: 'critical',
        description: '无法访问协议合约',
        details: diagnostic.contractAccess
      });
      solutions.push('合约可能暂时不可用，请稍后重试或联系技术支持');
    }

    if (diagnostic.contractAccess.isPaused) {
      issues.push({
        type: 'contract',
        severity: 'high',
        description: '协议合约已暂停',
        details: diagnostic.contractAccess
      });
      solutions.push('协议暂时暂停，请等待恢复');
    }

    // 检查用户状态问题
    if (!diagnostic.userTicket.isActive) {
      issues.push({
        type: 'user_state',
        severity: 'high',
        description: '用户没有有效的门票',
        details: {
          ticketAmount: diagnostic.userTicket.amount,
          exited: diagnostic.userTicket.exited
        }
      });
      solutions.push('需要购买门票才能获得奖励');
    }

    if (!diagnostic.userInfo.hasReferrer) {
      issues.push({
        type: 'user_state',
        severity: 'medium',
        description: '用户没有推荐人',
        details: diagnostic.userInfo
      });
      solutions.push('绑定推荐人可以获得更多奖励机会');
    }

    // 检查奖励显示问题
    if (diagnostic.rewardEvents.totalEvents === 0) {
      issues.push({
        type: 'user_state',
        severity: 'medium',
        description: '没有找到任何奖励记录',
        details: diagnostic.rewardEvents
      });
      solutions.push('用户可能还没有产生奖励，或者奖励事件查询失败');
    }

    if (diagnostic.rewardEvents.queryError) {
      issues.push({
        type: 'component',
        severity: 'high',
        description: '奖励事件查询失败',
        details: diagnostic.rewardEvents.queryError
      });
      solutions.push('事件查询出现问题，请刷新页面或检查网络');
    }

    // 检查静态奖励问题
    if (diagnostic.userTicket.isActive && diagnostic.rewardEvents.staticRewards.length === 0) {
      issues.push({
        type: 'user_state',
        severity: 'medium',
        description: '用户有有效门票但没有静态奖励记录',
        details: {
          ticketActive: diagnostic.userTicket.isActive,
          staticRewardsCount: diagnostic.rewardEvents.staticRewards.length
        }
      });
      solutions.push('可能需要等待静态奖励产生，或检查质押状态');
    }

    // 设置推荐行动
    if (issues.some(i => i.severity === 'critical')) {
      diagnostic.recommendedAction = '存在严重问题，需要立即处理';
      diagnostic.canPurchaseTicket = false;
    } else if (issues.some(i => i.severity === 'high')) {
      diagnostic.recommendedAction = '存在重要问题，建议优先解决';
      diagnostic.canPurchaseTicket = false;
    } else if (!diagnostic.userTicket.isActive) {
      diagnostic.recommendedAction = '建议购买门票开始获得奖励';
      diagnostic.canPurchaseTicket = true;
    } else {
      diagnostic.recommendedAction = '系统运行正常，继续使用';
      diagnostic.canPurchaseTicket = true;
    }
  }

  generateDiagnosticReport(diagnostic: DiagnosticInfo): string {
    const report = [];
    
    report.push(`# 用户诊断报告`);
    report.push(`**用户地址:** ${diagnostic.userAddress}`);
    report.push(`**诊断时间:** ${diagnostic.timestamp}`);
    report.push('');

    // 网络状态
    report.push(`## 网络状态`);
    report.push(`- **链ID:** ${diagnostic.networkStatus.chainId} ${diagnostic.networkStatus.isCorrectNetwork ? '✅' : '❌'}`);
    report.push(`- **区块高度:** ${diagnostic.networkStatus.blockNumber}`);
    report.push(`- **网络延迟:** ${diagnostic.networkStatus.latency}ms`);
    report.push(`- **网络健康:** ${diagnostic.networkStatus.networkHealth}`);
    report.push('');

    // 合约状态
    report.push(`## 合约状态`);
    report.push(`- **合约可访问:** ${diagnostic.contractAccess.isAccessible ? '✅' : '❌'}`);
    report.push(`- **合约暂停:** ${diagnostic.contractAccess.isPaused ? '❌' : '✅'}`);
    report.push(`- **紧急暂停:** ${diagnostic.contractAccess.isEmergencyPaused ? '❌' : '✅'}`);
    report.push(`- **合约余额:** ${diagnostic.contractAccess.contractBalance} MC`);
    report.push('');

    // 用户状态
    report.push(`## 用户状态`);
    report.push(`- **V等级:** V${diagnostic.userLevel.level} (${diagnostic.userLevel.percent}%)`);
    report.push(`- **团队人数:** ${diagnostic.userLevel.teamCount}`);
    report.push(`- **门票状态:** ${diagnostic.userTicket.isActive ? '✅ 有效' : '❌ 无效'}`);
    report.push(`- **门票金额:** ${diagnostic.userTicket.amount} MC`);
    report.push(`- **推荐人:** ${diagnostic.userInfo.hasReferrer ? '✅ 已绑定' : '❌ 未绑定'}`);
    report.push(`- **总收益:** ${diagnostic.userInfo.totalRevenue} MC`);
    report.push(`- **收益上限:** ${diagnostic.userInfo.currentCap} MC`);
    report.push('');

    // 奖励事件统计
    report.push(`## 奖励事件统计`);
    report.push(`- **静态奖励:** ${diagnostic.rewardEvents.staticRewards.length} 条`);
    report.push(`- **级差奖励:** ${diagnostic.rewardEvents.differentialRewards.length} 条`);
    report.push(`- **直推奖励:** ${diagnostic.rewardEvents.directRewards.length} 条`);
    report.push(`- **层级奖励:** ${diagnostic.rewardEvents.levelRewards.length} 条`);
    report.push(`- **总计:** ${diagnostic.rewardEvents.totalEvents} 条`);
    report.push('');

    // 问题分析
    if (diagnostic.issues.length > 0) {
      report.push(`## 发现的问题`);
      diagnostic.issues.forEach((issue, index) => {
        const severityIcon = {
          'low': '🟡',
          'medium': '🟠', 
          'high': '🔴',
          'critical': '💀'
        }[issue.severity];
        
        report.push(`${index + 1}. ${severityIcon} **${issue.description}**`);
        report.push(`   - 类型: ${issue.type}`);
        report.push(`   - 严重程度: ${issue.severity}`);
        if (issue.details) {
          report.push(`   - 详情: ${JSON.stringify(issue.details, null, 2)}`);
        }
        report.push('');
      });
    }

    // 解决方案
    if (diagnostic.solutions.length > 0) {
      report.push(`## 建议解决方案`);
      diagnostic.solutions.forEach((solution, index) => {
        report.push(`${index + 1}. ${solution}`);
      });
      report.push('');
    }

    // 推荐行动
    report.push(`## 推荐行动`);
    report.push(`**${diagnostic.recommendedAction}**`);
    report.push(`**可以购买门票:** ${diagnostic.canPurchaseTicket ? '✅' : '❌'}`);

    return report.join('\n');
  }
}