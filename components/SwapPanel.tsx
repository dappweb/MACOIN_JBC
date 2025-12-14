import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useWeb3, CONTRACT_ADDRESSES } from '../Web3Context';
import { ArrowLeftRight, RotateCw } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const SwapPanel: React.FC = () => {
  const { t } = useLanguage();
  const { mcContract, jbcContract, protocolContract, account, isConnected, provider } = useWeb3();
  
  const [payAmount, setPayAmount] = useState('');
  const [getAmount, setGetAmount] = useState('');
  const [isSelling, setIsSelling] = useState(false); // false = Buy JBC (Pay MC), true = Sell JBC (Pay JBC)
  const [balanceMC, setBalanceMC] = useState<string>('0.0');
  const [balanceJBC, setBalanceJBC] = useState<string>('0.0');
  const [poolMC, setPoolMC] = useState<string>('0.0');
  const [poolJBC, setPoolJBC] = useState<string>('0.0');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBalances = async () => {
        if (isConnected && account) {
            try {
                if (mcContract) {
                    // Fetch ERC20 MC Balance (Contract uses ERC20)
                    const mcBal = await mcContract.balanceOf(account);
                    setBalanceMC(ethers.formatEther(mcBal));

                    // Pool Liquidity (MC is ERC20 in contract)
                    const poolMcBal = await mcContract.balanceOf(CONTRACT_ADDRESSES.PROTOCOL);
                    setPoolMC(ethers.formatEther(poolMcBal));
                }

                if (jbcContract) {
                    const jbcBal = await jbcContract.balanceOf(account);
                    setBalanceJBC(ethers.formatEther(jbcBal));

                    // Pool Liquidity
                    const poolJbcBal = await jbcContract.balanceOf(CONTRACT_ADDRESSES.PROTOCOL);
                    setPoolJBC(ethers.formatEther(poolJbcBal));
                }

                // Optional: Log native balance for debugging
                if (provider) {
                    const native = await provider.getBalance(account);
                    console.log("Native Balance:", ethers.formatEther(native));
                }

            } catch (err) {
                console.error("Failed to fetch balances", err);
            }
        }
    };
    fetchBalances();
  }, [isConnected, account, mcContract, jbcContract, provider]);

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
          // Refresh balances (optional, or rely on useEffect dependency if logic added)
      } catch (err: any) {
          console.error(err);
          toast.error("Swap Failed: " + (err.reason || err.message));
      } finally {
          setIsLoading(false);
      }
  };

  const handleInput = (val: string) => {
      setPayAmount(val);
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

  const toggleDirection = () => {
      setIsSelling(!isSelling);
      setPayAmount('');
      setGetAmount('');
  };

  return (
    <div className="max-w-md mx-auto mt-10 glass-panel p-8 rounded-3xl relative animate-fade-in">
        <div className="absolute inset-0 bg-macoin-500/5 blur-3xl rounded-full"></div>
        <h2 className="text-2xl font-bold mb-6 text-center relative z-10 text-slate-900">{t.swap.title}</h2>
        
        <div className="space-y-4 relative z-10">
            {/* Pay Input */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 transition-all focus-within:ring-2 focus-within:ring-macoin-500/50">
                <div className="flex justify-between text-sm text-slate-500 mb-2">
                    <span>{t.swap.pay}</span>
                    <span>{t.swap.balance}: {isSelling ? balanceJBC : balanceMC} {isSelling ? 'JBC' : 'MC'}</span>
                </div>
                <div className="flex items-center justify-between">
                    <input 
                        type="number" 
                        value={payAmount}
                        onChange={(e) => handleInput(e.target.value)}
                        placeholder="0.0" 
                        className="bg-transparent text-2xl font-bold focus:outline-none w-full text-slate-900" 
                    />
                    <span className={`px-3 py-1 rounded-lg font-bold border border-slate-200 shadow-sm text-slate-700 ${isSelling ? 'bg-yellow-100 text-yellow-700' : 'bg-white'}`}>
                        {isSelling ? 'JBC' : 'MC'}
                    </span>
                </div>
            </div>

            {/* Switch Button */}
            <div className="flex justify-center -my-2 relative z-20">
                <button 
                    onClick={toggleDirection}
                    className="bg-white border border-macoin-500 p-2 rounded-full text-macoin-600 hover:rotate-180 transition-transform duration-500 shadow-sm hover:shadow-md"
                >
                    <ArrowLeftRight size={20} />
                </button>
            </div>

            {/* Receive Input */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between text-sm text-slate-500 mb-2">
                    <span>{t.swap.get}</span>
                    <span>{t.swap.balance}: {!isSelling ? balanceJBC : balanceMC} {!isSelling ? 'JBC' : 'MC'}</span>
                </div>
                <div className="flex items-center justify-between">
                    <input 
                        type="text" 
                        value={getAmount}
                        disabled 
                        placeholder="0.0" 
                        className="bg-transparent text-2xl font-bold focus:outline-none w-full text-slate-400" 
                    />
                    <span className={`px-3 py-1 rounded-lg font-bold border border-slate-200 shadow-sm text-slate-700 ${!isSelling ? 'bg-yellow-100 text-yellow-700' : 'bg-white'}`}>
                        {!isSelling ? 'JBC' : 'MC'}
                    </span>
                </div>
            </div>

            {/* Slippage Info */}
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-xs text-red-600 flex flex-col gap-1">
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
            <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500 flex justify-between items-center border border-slate-200">
                <span className="font-bold">{t.swap.poolLiquidity}:</span>
                <div className="flex gap-3">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-macoin-500"></div> {parseFloat(poolMC).toLocaleString()} MC</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> {parseFloat(poolJBC).toLocaleString()} JBC</span>
                </div>
            </div>

            {/* Action Button */}
            {!isConnected ? (
                 <button disabled className="w-full py-4 bg-slate-200 text-slate-400 font-bold text-lg rounded-xl cursor-not-allowed">
                    Connect Wallet
                </button>
            ) : (
                <button 
                    onClick={handleSwap}
                    disabled={isLoading || !payAmount}
                    className="w-full py-4 bg-macoin-500 text-white font-bold text-lg rounded-xl hover:bg-macoin-600 transition-colors shadow-lg shadow-macoin-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
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
