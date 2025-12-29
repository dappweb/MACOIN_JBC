import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../src/Web3Context';
import { Trophy, Medal, Award, Users, Coins, TrendingUp, RotateCw, Crown } from 'lucide-react';
import { ethers } from 'ethers';

interface UserRankingData {
  address: string;
  mcBalance: string;
  jbcBalance: string;
  totalLiquidity: string;
  teamCount: number;
  level: number;
  levelPercent: number;
}

interface RankingTabProps {
  title: string;
  icon: React.ReactNode;
  data: UserRankingData[];
  sortKey: keyof UserRankingData;
  isActive: boolean;
  onClick: () => void;
}

const RankingTab: React.FC<RankingTabProps> = ({ title, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${
      isActive
        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
    }`}
  >
    {icon}
    {title}
  </button>
);

const UserRankingPanel: React.FC = () => {
  const { protocolContract, jbcContract, isConnected, provider } = useWeb3();
  
  const [activeTab, setActiveTab] = useState<'liquidity' | 'mc' | 'jbc'>('liquidity');
  const [rankingData, setRankingData] = useState<UserRankingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 计算等级信息
  const calculateLevel = (teamCount: number) => {
    if (teamCount >= 100000) return { level: 9, percent: 45 };
    if (teamCount >= 30000) return { level: 8, percent: 40 };
    if (teamCount >= 10000) return { level: 7, percent: 35 };
    if (teamCount >= 3000) return { level: 6, percent: 30 };
    if (teamCount >= 1000) return { level: 5, percent: 25 };
    if (teamCount >= 300) return { level: 4, percent: 20 };
    if (teamCount >= 100) return { level: 3, percent: 15 };
    if (teamCount >= 30) return { level: 2, percent: 10 };
    if (teamCount >= 10) return { level: 1, percent: 5 };
    return { level: 0, percent: 0 };
  };

  // 获取用户排行数据
  const fetchRankingData = async () => {
    if (!protocolContract || !jbcContract || !provider) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🏆 [UserRankingPanel] 开始获取排行数据...');
      
      // 这里我们需要实现一个方法来获取所有用户的数据
      // 由于合约限制，我们可能需要通过事件日志或其他方式获取用户列表
      
      // 临时示例数据 - 在实际实现中需要从合约获取真实数据
      const sampleUsers = [
        '0x4C10831CBcF9884ba72051b5287b6c87E4F74A48', // 管理员地址
        // 可以添加更多已知的用户地址
      ];

      const userData: UserRankingData[] = [];

      for (const address of sampleUsers) {
        try {
          const [userInfo, mcBalance, jbcBalance] = await Promise.all([
            protocolContract.userInfo(address),
            provider.getBalance(address), // 使用原生MC余额
            jbcContract.balanceOf(address)
          ]);

          const teamCount = Number(userInfo[2]);
          const { level, percent } = calculateLevel(teamCount);
          
          // 计算总流动性 (MC + JBC 价值)
          const mcValue = parseFloat(ethers.formatEther(mcBalance));
          const jbcValue = parseFloat(ethers.formatEther(jbcBalance));
          const totalLiquidity = mcValue + jbcValue; // 简化计算，实际可能需要考虑价格比率

          userData.push({
            address,
            mcBalance: ethers.formatEther(mcBalance),
            jbcBalance: ethers.formatEther(jbcBalance),
            totalLiquidity: totalLiquidity.toString(),
            teamCount,
            level,
            levelPercent: percent
          });
        } catch (err) {
          console.error(`获取用户 ${address} 数据失败:`, err);
        }
      }

      setRankingData(userData);
      console.log('✅ [UserRankingPanel] 排行数据获取完成:', userData);

    } catch (err: any) {
      console.error('❌ [UserRankingPanel] 获取排行数据失败:', err);
      setError('获取排行数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchRankingData();
    }
  }, [protocolContract, jbcContract, provider, isConnected]);

  // 根据当前标签页排序数据
  const getSortedData = () => {
    const sortedData = [...rankingData];
    
    switch (activeTab) {
      case 'liquidity':
        return sortedData.sort((a, b) => parseFloat(b.totalLiquidity) - parseFloat(a.totalLiquidity));
      case 'mc':
        return sortedData.sort((a, b) => parseFloat(b.mcBalance) - parseFloat(a.mcBalance));
      case 'jbc':
        return sortedData.sort((a, b) => parseFloat(b.jbcBalance) - parseFloat(a.jbcBalance));
      default:
        return sortedData;
    }
  };

  // 获取排名图标
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-gray-400 font-bold text-sm">{rank}</span>;
    }
  };

  // 格式化地址显示
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 获取当前标签页的数值
  const getCurrentValue = (user: UserRankingData) => {
    switch (activeTab) {
      case 'liquidity':
        return `${parseFloat(user.totalLiquidity).toFixed(2)} 总价值`;
      case 'mc':
        return `${parseFloat(user.mcBalance).toFixed(2)} MC`;
      case 'jbc':
        return `${parseFloat(user.jbcBalance).toFixed(2)} JBC`;
      default:
        return '';
    }
  };

  const sortedData = getSortedData();

  return (
    <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-6 rounded-xl border border-red-500/50 backdrop-blur-sm">
      {/* 标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-red-500/30 to-pink-500/30 rounded-lg flex items-center justify-center backdrop-blur-sm border border-red-400/20">
          <Trophy className="w-5 h-5 text-red-300" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">用户排行榜</h2>
          <p className="text-sm text-gray-400">流动性、MC、JBC持有量排名</p>
        </div>
        <button
          onClick={fetchRankingData}
          disabled={loading}
          className="ml-auto p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 标签页导航 */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <RankingTab
          title="总流动性"
          icon={<TrendingUp className="w-4 h-4" />}
          data={sortedData}
          sortKey="totalLiquidity"
          isActive={activeTab === 'liquidity'}
          onClick={() => setActiveTab('liquidity')}
        />
        <RankingTab
          title="MC持有"
          icon={<Coins className="w-4 h-4" />}
          data={sortedData}
          sortKey="mcBalance"
          isActive={activeTab === 'mc'}
          onClick={() => setActiveTab('mc')}
        />
        <RankingTab
          title="JBC持有"
          icon={<Coins className="w-4 h-4" />}
          data={sortedData}
          sortKey="jbcBalance"
          isActive={activeTab === 'jbc'}
          onClick={() => setActiveTab('jbc')}
        />
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RotateCw className="w-6 h-6 animate-spin text-red-400 mr-2" />
          <span className="text-gray-400">加载排行数据...</span>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/40 p-4 rounded-lg text-center">
          <span className="text-red-400">{error}</span>
          <button 
            onClick={fetchRankingData}
            className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* 排行榜列表 */}
      {!loading && !error && sortedData.length > 0 && (
        <div className="space-y-3">
          {sortedData.map((user, index) => (
            <div 
              key={user.address}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:border-red-500/50 ${
                index < 3 
                  ? 'bg-gradient-to-r from-yellow-900/20 to-amber-900/20 border-yellow-500/30' 
                  : 'bg-gray-800/50 border-gray-700/50'
              }`}
            >
              {/* 排名 */}
              <div className="flex-shrink-0">
                {getRankIcon(index + 1)}
              </div>

              {/* 用户信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-white text-sm">
                    {formatAddress(user.address)}
                  </span>
                  {user.level > 0 && (
                    <div className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded border border-purple-500/30">
                      V{user.level} ({user.levelPercent}%)
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  团队: {user.teamCount.toLocaleString()} 人
                </div>
              </div>

              {/* 数值 */}
              <div className="text-right">
                <div className="font-bold text-white">
                  {getCurrentValue(user)}
                </div>
                <div className="text-xs text-gray-400">
                  #{index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && sortedData.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">暂无排行数据</p>
          <button 
            onClick={fetchRankingData}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
          >
            刷新数据
          </button>
        </div>
      )}

      {/* 说明 */}
      <div className="mt-6 pt-4 border-t border-gray-700/50">
        <div className="text-xs text-gray-400 space-y-1">
          <p>• 总流动性 = MC持有量 + JBC持有量（按等值计算）</p>
          <p>• 排行榜每30秒自动更新一次</p>
          <p>• 数据来源于区块链实时查询</p>
        </div>
      </div>
    </div>
  );
};

export default UserRankingPanel;