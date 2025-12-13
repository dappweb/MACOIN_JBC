import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useWeb3, CONTRACT_ADDRESSES } from '../Web3Context';
import { ArrowLeftRight, RotateCw } from 'lucide-react';
import { ethers } from 'ethers';
import { MOCK_USER_STATS } from '../constants';

const SwapPanel: React.FC = () => {
  const { t } = useLanguage();
  const { mcContract, jbcContract, protocolContract, account, isConnected } = useWeb3();
  
  const [payAmount, setPayAmount] = useState('');
  const [getAmount, setGetAmount] = useState('');
  const [isSelling, setIsSelling] = useState(false); // false = Buy JBC (Pay MC), true = Sell JBC (Pay JBC)
  const [balanceMC, setBalanceMC] = useState<string>('0.0');
  const [balanceJBC, setBalanceJBC] = useState<string>('0.0');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBalances = async () => {
        if (isConnected && account) {
            try {
                if (mcContract) {
                    const mcBal = await mcContract.balanceOf(account);
                    setBalanceMC(ethers.formatEther(mcBal));
                } else {
                    setBalanceMC(MOCK_USER_STATS.balanceMC.toString());
                }

                if (jbcContract) {
                    const jbcBal = await jbcContract.balanceOf(account);
                    setBalanceJBC(ethers.formatEther(jbcBal));
                } else {
                    setBalanceJBC(MOCK_USER_STATS.balanceJBC.toString());
                }
            } catch (err) {
                console.error("Failed to fetch balances", err);
                // Fallback
                setBalanceMC(MOCK_USER_STATS.balanceMC.toString());
                setBalanceJBC(MOCK_USER_STATS.balanceJBC.toString());
            }
        }
    };
    fetchBalances();
  }, [isConnected, account, mcContract, jbcContract]);

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
          alert("Swap Successful!");
          setPayAmount('');
          setGetAmount('');
          // Refresh balances (optional, or rely on useEffect dependency if logic added)
      } catch (err: any) {
          console.error(err);
          alert("Swap Failed: " + (err.reason || err.message));
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
      // Mock calculation with price 1:1 and tax
      const amount = parseFloat(val);
      let received = 0;
      if (isSelling) {
          // Sell JBC: 25% Tax
          received = amount * 0.75;
      } else {
          // Buy JBC: 50% Tax
          received = amount * 0.50;
      }
      setGetAmount(received.toFixed(2));
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
