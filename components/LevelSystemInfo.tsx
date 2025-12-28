import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Crown, Users, Percent, TrendingUp } from 'lucide-react';

const LevelSystemInfo: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const levels = [
    { level: 1, name: "V1", requirement: 10, reward: 5, color: "from-red-500 to-orange-500" },
    { level: 2, name: "V2", requirement: 30, reward: 10, color: "from-orange-500 to-yellow-500" },
    { level: 3, name: "V3", requirement: 100, reward: 15, color: "from-yellow-500 to-green-500" },
    { level: 4, name: "V4", requirement: 300, reward: 20, color: "from-green-500 to-teal-500" },
    { level: 5, name: "V5", requirement: 1000, reward: 25, color: "from-teal-500 to-cyan-500" },
    { level: 6, name: "V6", requirement: 3000, reward: 30, color: "from-cyan-500 to-blue-500" },
    { level: 7, name: "V7", requirement: 10000, reward: 35, color: "from-blue-500 to-indigo-500" },
    { level: 8, name: "V8", requirement: 30000, reward: 40, color: "from-indigo-500 to-purple-500" },
    { level: 9, name: "V9", requirement: 100000, reward: 45, color: "from-purple-500 to-pink-500" },
  ];

  return (
    <div className="max-w-4xl mx-auto mt-4 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-6 rounded-xl border border-gray-600/50 backdrop-blur-sm">
      {/* 标题 */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-lg flex items-center justify-center backdrop-blur-sm border border-purple-400/20">
            <Crown className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">极差裂变机制</h2>
            <p className="text-sm text-gray-400">V1至V9等级系统详情</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {isExpanded ? '收起' : '展开'}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="mt-6 space-y-4">
          {/* 说明 */}
          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/40 p-4 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-blue-400">机制说明</span>
            </div>
            <p className="text-sm text-blue-300">
              极差裂变机制根据您的团队人数确定等级，等级越高，获得的极差收益比例越高。
              团队人数包括您直接推荐和间接推荐的所有有效地址。
            </p>
          </div>

          {/* 等级表格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {levels.map((level) => (
              <div 
                key={level.level}
                className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 p-4 rounded-lg border border-gray-600/30 hover:border-gray-500/50 transition-all duration-300"
              >
                {/* 等级标识 */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`px-3 py-1 rounded-lg bg-gradient-to-r ${level.color} text-white font-bold text-sm`}>
                    {level.name}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{level.reward}%</div>
                    <div className="text-xs text-gray-400">极差收益</div>
                  </div>
                </div>

                {/* 要求 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">
                      需要 <span className="font-bold text-white">{level.requirement.toLocaleString()}</span> 个地址
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">
                      获得 <span className="font-bold text-green-400">{level.reward}%</span> 极差收益
                    </span>
                  </div>
                </div>

                {/* 进度示例 */}
                <div className="mt-3 pt-3 border-t border-gray-600/30">
                  <div className="text-xs text-gray-400 text-center">
                    {level.level === 1 ? "入门等级" : 
                     level.level <= 3 ? "初级等级" :
                     level.level <= 6 ? "中级等级" :
                     level.level <= 8 ? "高级等级" : "顶级等级"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 收益计算示例 */}
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/40 p-4 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="font-bold text-green-400">收益计算示例</span>
            </div>
            <div className="text-sm text-green-300 space-y-1">
              <p>• 假设下级质押1000 MC，您的团队有500人（V4等级）</p>
              <p>• 您可获得极差收益：1000 × 20% = 200 MC</p>
              <p>• 团队人数越多，收益比例越高，最高可达45%</p>
            </div>
          </div>

          {/* 升级建议 */}
          <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 border border-amber-500/40 p-4 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-amber-400">升级建议</span>
            </div>
            <div className="text-sm text-amber-300 space-y-1">
              <p>• 积极推广，扩大团队规模</p>
              <p>• 帮助下级用户成长，提升整体活跃度</p>
              <p>• 关注团队质量，确保用户长期参与</p>
              <p>• 定期查看等级进度，制定升级计划</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelSystemInfo;