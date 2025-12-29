import React, { useState, useEffect } from 'react';
import { useWeb3, CONTRACT_ADDRESSES, DAILY_BURN_MANAGER_ABI } from '../src/Web3Context';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { Flame, Clock, RotateCw, Info } from 'lucide-react';

const DailyBurnPanel: React.FC = () => {
  const { jbcContract, protocolContract, account, isConnected, isOwner, provider } = useWeb3();
  
  // 创建每日燃烧管理合约实例
  const [dailyBurnContract, setDailyBurnContract] = useState<ethers.Contract | null>(null);
  
  const [burnInfo, setBurnInfo] = useState({
    canBurn: false,
    lastBurnTime: 0,
    nextBurnTime: 0,
    jbcReserve: '0',
    burnAmount: '0',
    hoursUntilNext: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isBurning, setIsBurning] = useState(false);

  // 初始化每日燃烧合约
  useEffect(() => {
    if (provider) {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.DAILY_BURN_MANAGER,
        DAILY_BURN_MANAGER_ABI,
        provider
      );
      setDailyBurnContract(contract);
    }
  }, [provider]);

  // 获取燃烧信息
  const fetchBurnInfo = async () => {
    if (!protocolContract || !dailyBurnContract) return;

    try {
      const [canBurn, lastBurnTime, nextBurnTime, burnAmount, jbcReserve] = await Promise.all([
        dailyBurnContract.canBurn(),
        dailyBurnContract.lastBurnTime(),
        dailyBurnContract.nextBurnTime(),
        dailyBurnContract.getBurnAmount(),
        protocolContract.swapReserveJBC()
      ]);

      const lastBurnTimestamp = Number(lastBurnTime);
      const nextBurnTimestamp = Number(nextBurnTime);
      const now = Math.floor(Date.now() / 1000);
      
      const hoursUntilNext = Math.max(0, (nextBurnTimestamp - now) / 3600);

      setBurnInfo({
        canBurn,
        lastBurnTime: lastBurnTimestamp,
        nextBurnTime: nextBurnTimestamp,
        jbcReserve: ethers.formatEther(jbcReserve),
        burnAmount: ethers.formatEther(burnAmount),
        hoursUntilNext
      });

    } catch (error) {
      console.error('获取燃烧信息失败:', error);
    }
  };

  useEffect(() => {
    fetchBurnInfo();
    const interval = setInterval(fetchBurnInfo, 30000); // 每30秒更新
    return () => clearInterval(interval);
  }, [protocolContract, dailyBurnContract]);

  // 执行每日燃烧 - 使用新的燃烧管理合约
  const handleDailyBurn = async () => {
    if (!dailyBurnContract || !burnInfo.canBurn) return;

    setIsBurning(true);
    try {
      console.log('🔥 [DailyBurnPanel] 执行每日燃烧 (使用燃烧管理合约)');
      
      toast.loading('正在执行每日燃烧...', { id: 'daily-burn' });
      
      // 使用燃烧管理合约执行燃烧
      const burnTx = await dailyBurnContract.connect(provider?.getSigner()).dailyBurn();
      console.log('📝 [DailyBurnPanel] 燃烧交易哈希:', burnTx.hash);
      
      await burnTx.wait();
      console.log('✅ [DailyBurnPanel] 每日燃烧完成');
      
      toast.success('每日燃烧执行成功！', { id: 'daily-burn' });
      
      // 刷新信息
      await fetchBurnInfo();
      
    } catch (error: any) {
      console.error('❌ [DailyBurnPanel] 燃烧失败:', error);
      
      let errorMessage = '每日燃烧失败';
      if (error.message.includes('Too early')) {
        errorMessage = '距离上次燃烧不足24小时';
      } else if (error.message.includes('No JBC')) {
        errorMessage = '池子中没有JBC可燃烧';
      } else if (error.message.includes('Burn amount too small')) {
        errorMessage = '燃烧数量太小';
      } else if (error.reason) {
        errorMessage = `失败原因: ${error.reason}`;
      }
      
      toast.error(errorMessage, { id: 'daily-burn' });
    } finally {
      setIsBurning(false);
    }
  };

  // 如果不是管理员，不显示面板
  if (!isConnected || !isOwner) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto mt-4 glass-panel p-6 rounded-2xl relative animate-fade-in bg-gray-900/40 border border-gray-700 backdrop-blur-sm">
      {/* 增强背景效果 */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-yellow-500/10 blur-2xl rounded-2xl"></div>
      <div className="absolute inset-0 bg-orange-500/5 blur-3xl rounded-full animate-pulse"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-lg flex items-center justify-center backdrop-blur-sm border border-orange-400/20">
            <Flame className="w-4 h-4 text-orange-300" />
          </div>
          <h2 className="text-xl font-bold text-white">每日燃烧管理</h2>
        </div>

        {/* 燃烧状态 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 rounded-xl border border-gray-600/50 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-orange-400">燃烧状态</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between p-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20">
              <span className="text-gray-400">JBC 池子储备:</span>
              <span className="text-white font-bold">{parseFloat(burnInfo.jbcReserve).toLocaleString()} JBC</span>
            </div>
            
            <div className="flex justify-between p-2 bg-gradient-to-r from-red-500/10 to-yellow-500/10 rounded-lg border border-red-500/20">
              <span className="text-gray-400">可燃烧数量 (1%):</span>
              <span className="text-white font-bold">{parseFloat(burnInfo.burnAmount).toFixed(2)} JBC</span>
            </div>
            
            <div className="flex justify-between p-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
              <span className="text-gray-400">上次燃烧时间:</span>
              <span className="text-white font-mono text-xs">
                {burnInfo.lastBurnTime > 0 
                  ? new Date(burnInfo.lastBurnTime * 1000).toLocaleString()
                  : '从未燃烧'
                }
              </span>
            </div>
            
            <div className="flex justify-between p-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
              <span className="text-gray-400">下次可燃烧:</span>
              <span className="text-white font-mono text-xs">
                {new Date(burnInfo.nextBurnTime * 1000).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 倒计时 - 增强视觉效果 */}
        {!burnInfo.canBurn && (
          <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 border border-amber-500/40 p-3 rounded-lg text-amber-300 mb-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 animate-pulse" />
              <span className="font-bold">等待中</span>
            </div>
            <p className="text-sm">
              还需等待 <span className="font-bold text-amber-200">{burnInfo.hoursUntilNext.toFixed(1)}</span> 小时才能执行下次燃烧
            </p>
          </div>
        )}

        {/* 可燃烧提示 - 增强视觉效果 */}
        {burnInfo.canBurn && parseFloat(burnInfo.burnAmount) > 0 && (
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/40 p-3 rounded-lg text-green-300 mb-4 backdrop-blur-sm animate-pulse">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 animate-bounce" />
              <span className="font-bold">可以燃烧 (临时方案)</span>
            </div>
            <p className="text-sm">
              将通过swap机制触发燃烧效果，需要100 MC
            </p>
          </div>
        )}

        {/* 功能说明 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/20 border border-blue-500/40 p-3 rounded-lg text-blue-300 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-4 h-4" />
            <span className="font-bold">临时燃烧方案</span>
          </div>
          <p className="text-sm">
            由于合约中暂无dailyBurn函数，使用swap机制实现燃烧效果。
            正式版本将通过合约升级添加专用燃烧函数。
          </p>
        </div>

        {/* 执行按钮 - 增强视觉效果 */}
        <button
          onClick={handleDailyBurn}
          disabled={!burnInfo.canBurn || parseFloat(burnInfo.burnAmount) === 0 || isBurning}
          className={`w-full py-4 font-bold text-lg rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center gap-2 transform hover:scale-105 ${
            burnInfo.canBurn && parseFloat(burnInfo.burnAmount) > 0
              ? 'bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 hover:from-orange-400 hover:via-red-400 hover:to-yellow-400 text-white shadow-orange-500/40 hover:shadow-orange-500/60'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
          }`}
        >
          {isBurning && <RotateCw className="animate-spin" size={20} />}
          {isBurning ? '燃烧中...' : '执行每日燃烧'}
        </button>

        {/* 说明 */}
        <div className="mt-4 text-xs text-gray-400 text-center">
          <p>每日燃烧会销毁池子中1%的JBC代币，减少总供应量</p>
          <p>燃烧间隔：24小时</p>
        </div>
      </div>
    </div>
  );
};

export default DailyBurnPanel;