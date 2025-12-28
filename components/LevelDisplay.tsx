import React from 'react';
import { Crown, Users, TrendingUp } from 'lucide-react';

interface LevelDisplayProps {
  teamCount: number;
  showDetails?: boolean;
  className?: string;
}

const LevelDisplay: React.FC<LevelDisplayProps> = ({ 
  teamCount, 
  showDetails = false, 
  className = "" 
}) => {
  
  // 极差裂变机制等级计算
  const getLevelInfo = (count: number) => {
    if (count >= 100000) return { level: 9, percent: 45, name: "V9", color: "from-purple-500 to-pink-500", nextReq: null };
    if (count >= 30000) return { level: 8, percent: 40, name: "V8", color: "from-indigo-500 to-purple-500", nextReq: 100000 };
    if (count >= 10000) return { level: 7, percent: 35, name: "V7", color: "from-blue-500 to-indigo-500", nextReq: 30000 };
    if (count >= 3000) return { level: 6, percent: 30, name: "V6", color: "from-cyan-500 to-blue-500", nextReq: 10000 };
    if (count >= 1000) return { level: 5, percent: 25, name: "V5", color: "from-teal-500 to-cyan-500", nextReq: 3000 };
    if (count >= 300) return { level: 4, percent: 20, name: "V4", color: "from-green-500 to-teal-500", nextReq: 1000 };
    if (count >= 100) return { level: 3, percent: 15, name: "V3", color: "from-yellow-500 to-green-500", nextReq: 300 };
    if (count >= 30) return { level: 2, percent: 10, name: "V2", color: "from-orange-500 to-yellow-500", nextReq: 100 };
    if (count >= 10) return { level: 1, percent: 5, name: "V1", color: "from-red-500 to-orange-500", nextReq: 30 };
    return { level: 0, percent: 0, name: "V0", color: "from-gray-500 to-gray-600", nextReq: 10 };
  };

  const levelInfo = getLevelInfo(teamCount);
  const progress = levelInfo.nextReq ? (teamCount / levelInfo.nextReq) * 100 : 100;

  if (!showDetails) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className={`px-3 py-1 rounded-lg bg-gradient-to-r ${levelInfo.color} text-white font-bold text-sm`}>
          {levelInfo.name}
        </div>
        <span className="text-sm text-gray-400">
          {levelInfo.percent}%
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 rounded-xl border border-gray-600/50 backdrop-blur-sm ${className}`}>
      {/* 等级标题 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          <span className="text-lg font-bold text-white">当前等级</span>
        </div>
        <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${levelInfo.color} text-white font-bold`}>
          {levelInfo.name}
        </div>
      </div>

      {/* 等级信息 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-blue-400">团队人数</span>
          </div>
          <div className="text-xl font-bold text-white">{teamCount.toLocaleString()}</div>
        </div>
        
        <div className="text-center p-3 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400">极差收益</span>
          </div>
          <div className="text-xl font-bold text-white">{levelInfo.percent}%</div>
        </div>
      </div>

      {/* 进度条 */}
      {levelInfo.nextReq && (
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>升级进度</span>
            <span>{teamCount.toLocaleString()} / {levelInfo.nextReq.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full bg-gradient-to-r ${levelInfo.color} transition-all duration-500`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-400 mt-1 text-center">
            还需 {(levelInfo.nextReq - teamCount).toLocaleString()} 人升级到 V{levelInfo.level + 1}
          </div>
        </div>
      )}

      {/* 等级说明 */}
      <div className="text-xs text-gray-400 text-center">
        极差裂变机制：团队人数越多，极差收益比例越高
      </div>
    </div>
  );
};

export default LevelDisplay;