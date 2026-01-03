import React, { useState, useEffect } from 'react';
import { useWeb3, CONTRACT_ADDRESSES } from '../src/Web3Context';
import { useGlobalRefresh, useEventRefresh } from '../hooks/useGlobalRefresh';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { RotateCw, Plus, Minus, Info, TrendingUp } from 'lucide-react';

const AdminLiquidityPanel: React.FC = () => {
  const { jbcContract, protocolContract, account, isConnected, isOwner, mcBalance, refreshMcBalance } = useWeb3();
  
  // 使用全局刷新机制
  const { balances, onTransactionSuccess } = useGlobalRefresh();
  
  const [mcAmount, setMcAmount] = useState('');
  const [jbcAmount, setJbcAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [poolMC, setPoolMC] = useState<string>('0.0');
  const [poolJBC, setPoolJBC] = useState<string>('0.0');
  const [previousPoolMC, setPreviousPoolMC] = useState<string>('0.0');
  const [previousPoolJBC, setPreviousPoolJBC] = useState<string>('0.0');
  const [showProgress, setShowProgress] = useState(false);

  // 从全局状态获取余额
  const balanceMC = ethers.formatEther(mcBalance || 0n);
  const balanceJBC = balances.jbc;

  // 监听池子数据变化事件
  useEventRefresh('poolDataChanged', () => {
    console.log('🏊 [AdminLiquidityPanel] 池子数据变化，刷新显示');
    fetchPoolData();
  });

  // 获取池子数据
  const fetchPoolData = async () => {
    if (!protocolContract) return;

    try {
      const [poolMcBal, poolJbcBal] = await Promise.all([
        protocolContract.swapReserveMC(),
        protocolContract.swapReserveJBC()
      ]);

      // 保存之前的值用于比较
      setPreviousPoolMC(poolMC);
      setPreviousPoolJBC(poolJBC);

      const newPoolMC = ethers.formatEther(poolMcBal);
      const newPoolJBC = ethers.formatEther(poolJbcBal);

      setPoolMC(newPoolMC);
      setPoolJBC(newPoolJBC);

      // 如果数值发生变化，显示进度动画
      if (newPoolMC !== poolMC || newPoolJBC !== poolJBC) {
        setShowProgress(true);
        setTimeout(() => setShowProgress(false), 3000);
      }
    } catch (error) {
      console.error('获取池子数据失败:', error);
    }
  };

  // 获取数据
  const fetchData = async () => {
    await fetchPoolData();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchPoolData, 30000); // 只刷新池子数据，余额由全局状态管理
    return () => clearInterval(interval);
  }, [protocolContract]);

  // 添加流动性
  const handleAddLiquidity = async () => {
    if (!protocolContract || !jbcContract) return;
    
    // 确保输入值是有效的数字字符串
    const mcAmountStr = mcAmount?.trim() || '0';
    const jbcAmountStr = jbcAmount?.trim() || '0';
    
    // 验证输入格式
    if (mcAmountStr && isNaN(parseFloat(mcAmountStr))) {
      toast.error('MC数量格式无效');
      return;
    }
    if (jbcAmountStr && isNaN(parseFloat(jbcAmountStr))) {
      toast.error('JBC数量格式无效');
      return;
    }
    
    const mcAmountWei = mcAmountStr !== '0' ? ethers.parseEther(mcAmountStr) : 0n;
    const jbcAmountWei = jbcAmountStr !== '0' ? ethers.parseEther(jbcAmountStr) : 0n;
    
    if (mcAmountWei === 0n && jbcAmountWei === 0n) {
      toast.error('请输入要添加的流动性数量');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 [AdminLiquidityPanel] 开始添加流动性');
      console.log('   账户地址:', account);
      console.log('   MC 数量:', mcAmountStr, 'Wei:', mcAmountWei.toString());
      console.log('   JBC 数量:', jbcAmountStr, 'Wei:', jbcAmountWei.toString());
      console.log('   合约地址:', CONTRACT_ADDRESSES.PROTOCOL);
      
      // 检查原生MC余额
      if (mcAmountWei > 0n) {
        const currentMcBalance = mcBalance || 0n;
        console.log('   MC 当前余额:', ethers.formatEther(currentMcBalance));
        if (currentMcBalance < mcAmountWei) {
          toast.error(`MC余额不足，需要 ${ethers.formatEther(mcAmountWei)} MC`);
          return;
        }
      }

      // 检查并授权JBC代币
      if (jbcAmountWei > 0n) {
        const jbcAllowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
        console.log('   JBC 当前授权:', ethers.formatEther(jbcAllowance));
        if (jbcAllowance < jbcAmountWei) {
          toast.loading('正在授权JBC代币...', { id: 'approve-jbc' });
          const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, ethers.MaxUint256);
          await approveTx.wait();
          toast.success('JBC代币授权成功', { id: 'approve-jbc' });
        }
      }

      // 添加流动性 - 原生MC版本
      console.log('💧 [AdminLiquidityPanel] 调用 addLiquidity');
      console.log('   参数: jbcAmount =', jbcAmountWei.toString());
      console.log('   value: mcAmount =', mcAmountWei.toString());
      
      toast.loading('正在添加流动性...', { id: 'add-liquidity' });
      
      // 构建交易参数
      const txParams: any = {};
      if (mcAmountWei > 0n) {
        txParams.value = mcAmountWei;
      }
      
      // 先尝试静态调用
      try {
        await protocolContract.addLiquidity.staticCall(jbcAmountWei, txParams);
        console.log('✅ [AdminLiquidityPanel] 静态调用成功');
      } catch (staticError) {
        console.error('❌ [AdminLiquidityPanel] 静态调用失败:', staticError);
        throw staticError;
      }
      
      // 执行交易 - 原生MC作为value发送，JBC作为参数
      const tx = await protocolContract.addLiquidity(jbcAmountWei, txParams);
      console.log('📝 [AdminLiquidityPanel] 交易哈希:', tx.hash);
      
      await tx.wait();
      console.log('✅ [AdminLiquidityPanel] 交易确认');
      
      toast.success('流动性添加成功！', { id: 'add-liquidity' });
      setMcAmount('');
      setJbcAmount('');
      
      // 使用全局刷新机制
      await onTransactionSuccess('liquidity');
      
      // 刷新原生MC余额
      await refreshMcBalance();
      
      // 显示进度动画
      setShowProgress(true);
      setTimeout(() => setShowProgress(false), 3000);
      
    } catch (error: any) {
      console.error('❌ [AdminLiquidityPanel] 添加流动性失败:', error);
      console.error('   错误详情:', {
        message: error.message,
        reason: error.reason,
        code: error.code,
        data: error.data
      });
      
      let errorMessage = '添加流动性失败';
      if (error.message.includes('OwnableUnauthorizedAccount')) {
        errorMessage = '权限错误：您不是合约拥有者';
      } else if (error.message.includes('invalid BigNumberish value')) {
        errorMessage = '参数格式错误，请检查输入的数量';
      } else if (error.reason) {
        errorMessage = `失败原因: ${error.reason}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, { id: 'add-liquidity' });
    } finally {
      setIsLoading(false);
    }
  };

  // 如果不是管理员，不显示面板
  if (!isConnected || !isOwner) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto mt-4 glass-panel p-6 rounded-2xl relative animate-fade-in bg-gray-900/40 border border-gray-700 backdrop-blur-sm">
      {/* 增强背景效果 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-cyan-500/10 blur-2xl rounded-2xl"></div>
      <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full animate-pulse"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-lg flex items-center justify-center backdrop-blur-sm border border-blue-400/20">
            <Plus className="w-4 h-4 text-blue-300" />
          </div>
          <h2 className="text-xl font-bold text-white">管理员 - 流动性管理</h2>
        </div>

        {/* 当前池子状态 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 rounded-xl border border-gray-600/50 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-blue-400">当前池子储备</span>
            {showProgress && (
              <div className="flex items-center gap-1 ml-auto">
                <TrendingUp className="w-3 h-3 text-green-400 animate-bounce" />
                <span className="text-xs text-green-400 animate-pulse">已更新</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
              <div className={`text-2xl font-bold text-white transition-all duration-500 ${showProgress ? 'scale-110 text-green-400' : ''}`}>
                {parseFloat(poolMC).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">MC</div>
              {showProgress && parseFloat(poolMC) > parseFloat(previousPoolMC) && (
                <div className="text-xs text-green-400 animate-pulse">
                  +{(parseFloat(poolMC) - parseFloat(previousPoolMC)).toFixed(2)}
                </div>
              )}
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20">
              <div className={`text-2xl font-bold text-white transition-all duration-500 ${showProgress ? 'scale-110 text-green-400' : ''}`}>
                {parseFloat(poolJBC).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">JBC</div>
              {showProgress && parseFloat(poolJBC) > parseFloat(previousPoolJBC) && (
                <div className="text-xs text-green-400 animate-pulse">
                  +{(parseFloat(poolJBC) - parseFloat(previousPoolJBC)).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MC 输入 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 rounded-xl border border-gray-600/50 mb-3 backdrop-blur-sm hover:border-blue-500/30 transition-all duration-300">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>添加 MC</span>
            <span>余额: {balanceMC} MC</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={mcAmount}
              onChange={(e) => setMcAmount(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-xl font-bold focus:outline-none w-full text-white placeholder-gray-600 focus:text-blue-300 transition-colors"
            />
            <button
              onClick={() => setMcAmount(balanceMC)}
              className="px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs rounded-lg transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
            >
              最大
            </button>
          </div>
        </div>

        {/* JBC 输入 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 rounded-xl border border-gray-600/50 mb-4 backdrop-blur-sm hover:border-amber-500/30 transition-all duration-300">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>添加 JBC</span>
            <span>余额: {balanceJBC} JBC</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={jbcAmount}
              onChange={(e) => setJbcAmount(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-xl font-bold focus:outline-none w-full text-white placeholder-gray-600 focus:text-amber-300 transition-colors"
            />
            <button
              onClick={() => setJbcAmount(balanceJBC)}
              className="px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
            >
              最大
            </button>
          </div>
        </div>

        {/* 提示信息 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/40 p-3 rounded-lg text-xs text-blue-300 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-3 h-3" />
            <span className="font-bold">管理员权限</span>
          </div>
          <p>只有合约拥有者可以添加流动性。您可以添加MC、JBC或两者。添加后将自动刷新显示。</p>
        </div>

        {/* 添加按钮 - 增强视觉效果 */}
        <button
          onClick={handleAddLiquidity}
          disabled={isLoading || (!mcAmount && !jbcAmount)}
          className="w-full py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 hover:from-blue-400 hover:via-purple-400 hover:to-cyan-400 text-white font-bold text-lg rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/40 hover:shadow-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105 transform"
        >
          {isLoading && <RotateCw className="animate-spin" size={20} />}
          {isLoading ? '添加中...' : '添加流动性'}
        </button>
      </div>
    </div>
  );
};

export default AdminLiquidityPanel;