import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../src/Web3Context';
import { useEventRefresh } from '../hooks/useGlobalRefresh';
import LevelDisplay from './LevelDisplay';
import { RotateCw } from 'lucide-react';

interface AdminLevelDisplayProps {
  account: string;
}

const AdminLevelDisplay: React.FC<AdminLevelDisplayProps> = ({ account }) => {
  const { protocolContract } = useWeb3();
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamCount = async () => {
    if (!protocolContract || !account) return;

    try {
      setLoading(true);
      setError(null);
      
      const userInfo = await protocolContract.userInfo(account);
      const count = Number(userInfo[2]); // teamCount is at index 2
      setTeamCount(count);
      
    } catch (err: any) {
      console.error('获取团队数据失败:', err);
      setError('无法获取团队数据');
    } finally {
      setLoading(false);
    }
  };

  // 监听等级变化事件
  useEventRefresh('userLevelChanged', () => {
    console.log('📊 [AdminLevelDisplay] 用户等级变化，刷新团队数据');
    fetchTeamCount();
  });

  // 监听门票状态变化事件（可能影响团队统计）
  useEventRefresh('ticketStatusChanged', () => {
    console.log('🎫 [AdminLevelDisplay] 门票状态变化，刷新团队数据');
    fetchTeamCount();
  });

  useEffect(() => {
    fetchTeamCount();
    const interval = setInterval(fetchTeamCount, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, [protocolContract, account]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-6 rounded-xl border border-gray-600/50 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2">
          <RotateCw className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-gray-400">加载等级信息...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 p-6 rounded-xl border border-red-500/40 backdrop-blur-sm">
        <div className="text-center">
          <span className="text-red-400">{error}</span>
          <button 
            onClick={fetchTeamCount}
            className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <LevelDisplay 
      teamCount={teamCount} 
      showDetails={true}
      className="w-full"
    />
  );
};

export default AdminLevelDisplay;