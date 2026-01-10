import React from 'react';
import { Crown, Users, TrendingUp, Star } from 'lucide-react';
import { useLevelOverride, getLevelInfoWithOverride } from '../src/hooks/useLevelOverride';

interface LevelDisplayProps {
  teamCount: number;
  showDetails?: boolean;
  className?: string;
  userAddress?: string | null; // 用于获取等级覆盖
}

const LevelDisplay: React.FC<LevelDisplayProps> = ({ 
  teamCount, 
  showDetails = false, 
  className = "",
  userAddress
}) => {
  
  // 获取等级覆盖
  const { overrideLevel, hasOverride } = useLevelOverride(userAddress);
  
  // 使用覆盖等级或计算等级
  const levelInfo = getLevelInfoWithOverride(teamCount, overrideLevel);
  const progress = levelInfo.nextReq ? (teamCount / levelInfo.nextReq) * 100 : 100;

  if (!showDetails) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className={`px-3 py-1 rounded-lg bg-gradient-to-r ${levelInfo.color} text-white font-bold text-sm flex items-center gap-1`}>
          {levelInfo.isOverride && <Star className="w-3 h-3" />}
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
          {levelInfo.isOverride && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded flex items-center gap-1">
              <Star className="w-3 h-3" /> 特殊
            </span>
          )}
        </div>
        <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${levelInfo.color} text-white font-bold flex items-center gap-1`}>
          {levelInfo.isOverride && <Star className="w-4 h-4" />}
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