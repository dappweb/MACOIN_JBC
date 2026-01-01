import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { useWeb3 } from '../src/Web3Context';
import { useLanguage } from '../src/LanguageContext';
import { ethers } from 'ethers';

interface DifferentialRewardStatusProps {
  className?: string;
}

interface LevelInfo {
  level: number;
  percent: number;
  teamCount: number;
  nextLevelRequirement?: number;
  nextLevelPercent?: number;
}

const DifferentialRewardStatus: React.FC<DifferentialRewardStatusProps> = ({ className = '' }) => {
  const { protocolContract, account, isConnected } = useWeb3();
  const { t } = useLanguage();
  
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [recentDifferentialRewards, setRecentDifferentialRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // V等级配置
  const LEVEL_REQUIREMENTS = [
    { level: 0, requirement: 0, percent: 0 },
    { level: 1, requirement: 10, percent: 5 },
    { level: 2, requirement: 30, percent: 10 },
    { level: 3, requirement: 100, percent: 15 },
    { level: 4, requirement: 300, percent: 20 },
    { level: 5, requirement: 1000, percent: 25 },
    { level: 6, requirement: 3000, percent: 30 },
    { level: 7, requirement: 10000, percent: 35 },
    { level: 8, requirement: 30000, percent: 40 },
    { level: 9, requirement: 100000, percent: 45 },
  ];

  const fetchDifferentialRewardStatus = async () => {
    if (!protocolContract || !account || !isConnected) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 获取用户等级信息
      const userLevel = await protocolContract.getUserLevel(account);
      const level = Number(userLevel.level);
      const percent = Number(userLevel.percent);
      const teamCount = Number(userLevel.teamCount);

      // 计算下一等级要求
      const nextLevelConfig = LEVEL_REQUIREMENTS.find(config => config.level > level);
      
      const levelData: LevelInfo = {
        level,
        percent,
        teamCount,
        nextLevelRequirement: nextLevelConfig?.requirement,
        nextLevelPercent: nextLevelConfig?.percent
      };

      setLevelInfo(levelData);

      // 获取最近的极差奖励记录
      try {
        const currentBlock = await protocolContract.provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000); // 检查最近50000个区块

        // 查询用户作为受益人的极差奖励记录
        const differentialEvents = await protocolContract.queryFilter(
          protocolContract.filters.DifferentialRewardReleased(null, account),
          fromBlock
        );

        // 解析事件数据
        const rewardRecords = await Promise.all(
          differentialEvents.slice(-10).map(async (event: any) => {
            try {
              const block = await event.getBlock();
              return {
                stakeId: event.args.stakeId.toString(),
                upline: event.args.upline,
                amount: ethers.formatEther(event.args.amount),
                blockNumber: event.blockNumber,
                timestamp: block.timestamp,
                transactionHash: event.transactionHash
              };
            } catch (err) {
              console.error('Error parsing differential reward event:', err);
              return null;
            }
          })
        );

        setRecentDifferentialRewards(rewardRecords.filter(record => record !== null));

      } catch (eventError) {
        console.warn('Failed to fetch differential reward events:', eventError);
        setRecentDifferentialRewards([]);
      }

    } catch (err: any) {
      console.error('Failed to fetch differential reward status:', err);
      setError(err.message || 'Failed to load differential reward status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDifferentialRewardStatus();
  }, [protocolContract, account, isConnected]);

  if (!isConnected || !account) {
    return null;
  }

  if (loading) {
    return (
      <div className={`bg-gray-900/80 border border-gray-700 rounded-xl p-6 backdrop-blur-sm ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-300">加载极差奖励状态...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-900/30 border border-red-500/50 rounded-xl p-6 backdrop-blur-sm ${className}`}>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <div>
            <h3 className="text-red-400 font-semibold">加载失败</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!levelInfo) {
    return null;
  }

  const progressToNext = levelInfo.nextLevelRequirement 
    ? Math.min((levelInfo.teamCount / levelInfo.nextLevelRequirement) * 100, 100)
    : 100;

  return (
    <div className={`bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-500/40 rounded-xl backdrop-blur-sm ${className}`}>
      {/* 头部 */}
      <div className="p-6 border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber-400">极差奖励状态</h3>
              <p className="text-amber-300/80 text-sm">基于团队建设的差额奖励机制</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-amber-400">V{levelInfo.level}</div>
            <div className="text-sm text-amber-300">{levelInfo.percent}% 收益</div>
          </div>
        </div>
      </div>

      {/* 当前状态 */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 等级信息 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-amber-300">团队状态</span>
            </div>
            
            <div className="bg-black/20 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">当前团队人数</span>
                <span className="font-bold text-amber-400">{levelInfo.teamCount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">当前等级</span>
                <span className="font-bold text-amber-400">V{levelInfo.level}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">极差收益比例</span>
                <span className="font-bold text-amber-400">{levelInfo.percent}%</span>
              </div>

              {/* 升级进度 */}
              {levelInfo.nextLevelRequirement && (
                <div className="pt-3 border-t border-amber-500/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300 text-sm">升级到 V{levelInfo.level + 1}</span>
                    <span className="text-amber-400 text-sm font-semibold">
                      {levelInfo.nextLevelPercent}% 收益
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressToNext}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{levelInfo.teamCount.toLocaleString()}</span>
                    <span>还需 {(levelInfo.nextLevelRequirement - levelInfo.teamCount).toLocaleString()} 人</span>
                    <span>{levelInfo.nextLevelRequirement.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 最近奖励 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-amber-300">最近极差奖励</span>
            </div>

            <div className="bg-black/20 rounded-lg p-4">
              {recentDifferentialRewards.length > 0 ? (
                <div className="space-y-3">
                  {recentDifferentialRewards.slice(0, 5).map((reward, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-amber-500/10 last:border-b-0">
                      <div>
                        <div className="text-sm font-semibold text-amber-400">
                          +{parseFloat(reward.amount).toFixed(4)} MC
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(reward.timestamp * 1000).toLocaleDateString()}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                  
                  <div className="pt-2 text-center">
                    <span className="text-xs text-amber-400">
                      总计 {recentDifferentialRewards.length} 条极差奖励记录
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">暂无极差奖励记录</p>
                  <p className="text-gray-500 text-xs mt-1">
                    当您的下级赎回流动性时，将基于其静态收益获得极差奖励
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 说明信息 */}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-300">
              <p className="font-semibold mb-1">极差奖励机制说明：</p>
              <ul className="space-y-1 text-amber-300/80">
                <li>• 当您的下级用户赎回流动性时，系统会基于其静态收益计算极差奖励</li>
                <li>• 奖励金额 = 静态收益 × (您的等级比例 - 下级等级比例)</li>
                <li>• 建设更大的团队可以获得更高的V等级和更多极差奖励</li>
                <li>• 极差奖励会在下级赎回时立即发放到您的账户 (50% MC + 50% JBC)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DifferentialRewardStatus;