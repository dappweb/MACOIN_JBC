import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useWeb3, CONTRACT_ADDRESSES } from '../Web3Context';
import { ArrowLeftRight, RotateCw } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const SwapPanel: React.FC = () => {
  const { t } = useLanguage();
  const { mcContract, jbcContract, protocolContract, account, isConnected, provider, hasReferrer, isOwner } = useWeb3();
  
  const [payAmount, setPayAmount] = useState('');
  const [getAmount, setGetAmount] = useState('');
  const [isSelling, setIsSelling] = useState(false); // false = Buy JBC (Pay MC), true = Sell JBC (Pay JBC)
  const [balanceMC, setBalanceMC] = useState<string>('0.0');
  const [balanceJBC, setBalanceJBC] = useState<string>('0.0');
  const [poolMC, setPoolMC] = useState<string>('0.0');
  const [poolJBC, setPoolJBC] = useState<string>('0.0');
  const [isLoading, setIsLoading] = useState(false);
  const [isRotated, setIsRotated] = useState(false);

  // 提取余额获取逻辑为独立函数，方便在交易后刷新
  const fetchBalances = async () => {
    // 1. Fetch Pool Liquidity (Public Data)
    // 只要有合约实例即可获取，不需要连接钱包
    if (protocolContract) {
        try {
            // Pool Liquidity should be fetched from Protocol Contract state variables
            // swapReserveMC and swapReserveJBC
            
            console.log('💰 [SwapPanel] 正在获取池子储备量...')
            
            // Note: If contract instance is created with provider, these calls are read-only
            const poolMcBal = await protocolContract.swapReserveMC();
            const poolMcFormatted = ethers.formatEther(poolMcBal);
            setPoolMC(poolMcFormatted);
            console.log('💰 [SwapPanel] MC 池子储备:', poolMcFormatted, 'MC')
            console.log('💰 [SwapPanel] MC 池子储备 (原始):', poolMcBal.toString(), 'wei')

            const poolJbcBal = await protocolContract.swapReserveJBC();
            const poolJbcFormatted = ethers.formatEther(poolJbcBal);
            setPoolJBC(poolJbcFormatted);
            console.log('💰 [SwapPanel] JBC 池子储备:', poolJbcFormatted, 'JBC')
            console.log('💰 [SwapPanel] JBC 池子储备 (原始):', poolJbcBal.toString(), 'wei')
            
            // 计算 LP 总量
            const mcAmount = parseFloat(poolMcFormatted);
            const jbcAmount = parseFloat(poolJbcFormatted);
            const totalLpTokens = mcAmount + jbcAmount;
            
            console.log('📊 [SwapPanel] ========== LP 总量统计 ==========')
            console.log('📊 [SwapPanel] MC 数量:', mcAmount.toFixed(4), 'MC')
            console.log('📊 [SwapPanel] JBC 数量:', jbcAmount.toFixed(4), 'JBC')
            console.log('📊 [SwapPanel] LP 总量 (MC + JBC):', totalLpTokens.toFixed(4))
            console.log('📊 [SwapPanel] =====================================')
        } catch (err) {
            console.error("❌ [SwapPanel] 获取池子余额失败:", err);
        }
    } else {
         console.log('⚠️ [SwapPanel] protocolContract 未初始化')
    }

    // 2. Fetch User Balances (Private Data)
    if (isConnected && account) {
        try {
            if (mcContract) {
                // Fetch ERC20 MC Balance (Contract uses ERC20)
                const mcBal = await mcContract.balanceOf(account);
                setBalanceMC(ethers.formatEther(mcBal));
            }

            if (jbcContract) {
                const jbcBal = await jbcContract.balanceOf(account);
                setBalanceJBC(ethers.formatEther(jbcBal));
            }

            // Optional: Log native balance for debugging
            if (provider) {
                const native = await provider.getBalance(account);
            }

        } catch (err) {
            console.error("Failed to fetch user balances", err);
        }
    }
  };

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [isConnected, account, mcContract, jbcContract, protocolContract, provider]);

  // Debounce effect for calculating estimate
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateEstimate(payAmount);
    }, 1000);

    return () => clearTimeout(timer);
  }, [payAmount, isSelling, poolMC, poolJBC]);

  const handleSwap = async () => {
      if (!protocolContract || !payAmount) return;
      setIsLoading(true);
      try {
          const amount = ethers.parseEther(payAmount);
          let tx;

          if (isSelling) {
              // Sell JBC: Approve JBC -> SwapJBCToMC
              if (jbcContract) {
                  const allowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
                  if (allowance < amount) {
                      const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, ethers.MaxUint256);
                      await approveTx.wait();
                  }
              }
              tx = await protocolContract.swapJBCToMC(amount);
          } else {
              // Buy JBC: Approve MC -> SwapMCToJBC
              if (mcContract) {
                  const allowance = await mcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
                  if (allowance < amount) {
                      const approveTx = await mcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, ethers.MaxUint256);
                      await approveTx.wait();
                  }
              }
              tx = await protocolContract.swapMCToJBC(amount);
          }
          
          await tx.wait();
          toast.success("Swap Successful!");
          setPayAmount('');
          setGetAmount('');
          // 刷新余额和池子数据
          await fetchBalances();
      } catch (err: any) {
          toast.error("Swap Failed: " + (err.reason || err.message));
      } finally {
          setIsLoading(false);
      }
  };

  const calculateEstimate = (val: string) => {
      if (!val) {
          setGetAmount('');
          return;
      }
      
      const amount = parseFloat(val);
      if (isNaN(amount) || amount <= 0) {
          setGetAmount('');
          return;
      }

      const rMc = parseFloat(poolMC);
      const rJbc = parseFloat(poolJBC);

      let received = 0;

      // AMM Formula: dy = (y * dx) / (x + dx)
      // x = ReserveIn, y = ReserveOut, dx = AmountIn
      
      if (isSelling) {
          // Sell JBC (Input JBC) -> Get MC
          // 1. Tax 25% on Input
          const tax = amount * 0.25;
          const amountToSwap = amount - tax;
          
          // 2. AMM Swap (Input JBC, Output MC)
          // ReserveIn = JBC Pool, ReserveOut = MC Pool
          if (rJbc > 0 && rMc > 0) {
              // Note: rJbc is current pool.
              received = (amountToSwap * rMc) / (rJbc + amountToSwap);
          }
      } else {
          // Buy JBC (Input MC) -> Get JBC
          // 1. AMM Swap (Input MC, Output JBC)
          // ReserveIn = MC Pool, ReserveOut = JBC Pool
          let outPreTax = 0;
          if (rMc > 0 && rJbc > 0) {
              outPreTax = (amount * rJbc) / (rMc + amount);
          }
          
          // 2. Tax 50% on Output
          const tax = outPreTax * 0.50;
          received = outPreTax - tax;
      }
      
      setGetAmount(received.toFixed(4));
  };

  const handleInput = (val: string) => {
      // Get current balance based on selling or buying
      const currentBalance = parseFloat(isSelling ? balanceJBC : balanceMC);
      const inputAmount = parseFloat(val);
      
      // Check if input exceeds balance
      if (!isNaN(inputAmount) && inputAmount > currentBalance) {
          toast.error(`Insufficient balance. Max: ${currentBalance.toFixed(4)} ${isSelling ? 'JBC' : 'MC'}`);
          setPayAmount(currentBalance.toString());
          return;
      }
      
      setPayAmount(val);
  };

  const toggleDirection = () => {
      setIsSelling(!isSelling);
      setIsRotated(!isRotated);
      setPayAmount('');
      setGetAmount('');
  };

  return (
    <div className="max-w-md mx-auto mt-4 md:mt-10 glass-panel p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl relative animate-fade-in bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
        <div className="absolute inset-0 bg-neon-500/5 blur-3xl rounded-full"></div>
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-center relative z-10 text-white">{t.swap.title}</h2>

        {/* 推荐人提示 - 非管理员且未绑定推荐人时显示 */}
        {isConnected && !hasReferrer && !isOwner && (
          <div className="bg-amber-900/20 border-2 border-amber-500/50 rounded-xl p-4 mb-4 relative z-10 backdrop-blur-sm">
            <p className="text-amber-300 text-sm font-bold text-center">
              ⚠️ {t.referrer.noReferrer}
            </p>
            <p className="text-amber-200/80 text-xs text-center mt-1">
              Please go to Mining panel to bind a referrer first
            </p>
          </div>
        )}

        <div className="space-y-3 md:space-y-4 relative z-10">
            {/* Pay Input */}
            <div className="bg-gray-800/50 p-3 md:p-4 rounded-lg md:rounded-xl border border-gray-700 transition-all focus-within:ring-2 focus-within:ring-neon-500/50">
                <div className="flex justify-between text-xs md:text-sm text-gray-400 mb-2">
                    <span>{t.swap.pay}</span>
                    <span className="truncate ml-2">{t.swap.balance}: {isSelling ? balanceJBC : balanceMC} {isSelling ? 'JBC' : 'MC'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => handleInput(e.target.value)}
                        placeholder="0.0"
                        className="bg-transparent text-xl md:text-2xl font-bold focus:outline-none w-full text-white placeholder-gray-600"
                    />
                    <span className={`pl-2 pr-4 md:px-3 py-1 rounded-lg font-bold border shadow-sm text-sm md:text-base whitespace-nowrap flex items-center gap-1 ${isSelling ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-gray-900 text-gray-300 border-gray-700'}`}>
                        {isSelling ? (
                            <>
                                <img src="/mc_chain.png" alt="JBC" className="w-4 h-4 md:w-5 md:h-5 rounded-full" />
                                JBC
                            </>
                        ) : (
                            <>
                                <img src="/logo.png" alt="MC" className="w-4 h-4 md:w-5 md:h-5 rounded-full" />
                                MC
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Switch Button */}
            <div className="flex justify-center -my-1.5 md:-my-2 relative z-20">
                <button
                    onClick={toggleDirection}
                    className={`bg-gray-900 border-2 border-neon-500 p-1.5 md:p-2 rounded-full text-neon-400 transition-transform duration-500 shadow-lg shadow-neon-500/30 hover:shadow-neon-500/50 ${isRotated ? 'rotate-180' : ''}`}
                >
                    <ArrowLeftRight size={18} className="md:w-5 md:h-5" />
                </button>
            </div>

            {/* Receive Input */}
            <div className="bg-gray-800/50 p-3 md:p-4 rounded-lg md:rounded-xl border border-gray-700">
                    <div className="flex justify-between text-xs md:text-sm text-gray-400 mb-2">
                    <span>{t.swap.get}</span>
                    <span className="truncate ml-2">{t.swap.balance}: {!isSelling ? balanceJBC : balanceMC} {!isSelling ? 'JBC' : 'MC'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <input
                        type="text"
                        value={getAmount}
                        disabled
                        placeholder="0.0"
                        className="bg-transparent text-xl md:text-2xl font-bold focus:outline-none w-full text-gray-500 placeholder-gray-700"
                    />
                    <span className={`pl-2 pr-4 md:px-3 py-1 rounded-lg font-bold border shadow-sm text-sm md:text-base whitespace-nowrap flex items-center gap-1 ${!isSelling ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-gray-900 text-gray-300 border-gray-700'}`}>
                        {!isSelling ? (
                            <>
                                <img src="/mc_chain.png" alt="JBC" className="w-4 h-4 md:w-5 md:h-5 rounded-full" />
                                JBC
                            </>
                        ) : (
                            <>
                                <img src="/logo.png" alt="MC" className="w-4 h-4 md:w-5 md:h-5 rounded-full" />
                                MC
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Slippage Info */}
            <div className="bg-red-900/20 border border-red-500/30 p-3 rounded-lg text-xs text-red-300 flex flex-col gap-1 backdrop-blur-sm">
                <div className={`flex justify-between ${isSelling ? 'font-bold' : 'opacity-50'}`}>
                    <span>{t.swap.slipSell}</span>
                    {isSelling && <span>(Active)</span>}
                </div>
                <div className={`flex justify-between ${!isSelling ? 'font-bold' : 'opacity-50'}`}>
                    <span>{t.swap.slipBuy}</span>
                    {!isSelling && <span>(Active)</span>}
                </div>
            </div>

            {/* Pool Liquidity Info */}
            <div className="bg-gray-800/50 p-3 rounded-lg text-xs text-gray-400 flex justify-between items-center border border-gray-700">
                <span className="font-bold">{t.swap.poolLiquidity}:</span>
                <div className="flex gap-3">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-neon-500"></div> {parseFloat(poolMC).toLocaleString()} MC</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> {parseFloat(poolJBC).toLocaleString()} JBC</span>
                </div>
            </div>

            {/* Action Button */}
            {!isConnected ? (
                 <button disabled className="w-full py-4 bg-gray-800 text-gray-500 font-bold text-lg rounded-xl cursor-not-allowed border border-gray-700">
                    Connect Wallet
                </button>
            ) : !hasReferrer && !isOwner ? (
                <button disabled className="w-full py-4 bg-amber-900/30 text-amber-400 font-bold text-lg rounded-xl cursor-not-allowed border border-amber-500/50">
                    ⚠️ {t.referrer.noReferrer}
                </button>
            ) : (
                <button 
                    onClick={handleSwap}
                    disabled={isLoading || !payAmount}
                    className="w-full py-4 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-bold text-lg rounded-xl transition-colors shadow-lg shadow-neon-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading && <RotateCw className="animate-spin" size={20} />}
                    {t.swap.confirm}
                </button>
            )}
        </div>
    </div>
  );
};

export default SwapPanel;
