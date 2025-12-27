import React, { useState, useEffect } from 'react';
import { useWeb3, CONTRACT_ADDRESSES } from '../Web3Context';
import { Settings, Save, AlertTriangle, Megaphone, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../constants';
import { formatContractError } from '../utils/errorFormatter';

const AdminPanel: React.FC = () => {
  const { t } = useLanguage();
  const { protocolContract, isConnected, account, provider, mcContract, jbcContract } = useWeb3();
  const [loading, setLoading] = useState(false);

  // Distribution Percents
  const [direct, setDirect] = useState('25');
  const [level, setLevel] = useState('15');
  const [marketing, setMarketing] = useState('5');
  const [buyback, setBuyback] = useState('5');
  const [lp, setLp] = useState('25');
  const [treasury, setTreasury] = useState('25');

  // Swap Taxes
  const [buyTax, setBuyTax] = useState('50');
  const [sellTax, setSellTax] = useState('25');

  // Redemption Fee
  const [redeemFee, setRedeemFee] = useState('1');

  // Wallets
  const [marketingWallet, setMarketingWallet] = useState('');
  const [treasuryWallet, setTreasuryWallet] = useState('');
  const [lpWallet, setLpWallet] = useState('');
  const [buybackWallet, setBuybackWallet] = useState('');
  
  // Current Wallets (Displayed)
  const [currentMarketing, setCurrentMarketing] = useState('');
  const [currentTreasury, setCurrentTreasury] = useState('');
  const [currentLp, setCurrentLp] = useState('');
  const [currentBuyback, setCurrentBuyback] = useState('');

  // Announcement Management
  const [announceZh, setAnnounceZh] = useState('');
  const [announceEn, setAnnounceEn] = useState('');
  const [announcementList, setAnnouncementList] = useState<Array<{id: number, zh: string, en: string}>>([]);

  // Load current announcements
  useEffect(() => {
    const storedAnnouncements = localStorage.getItem('announcements');
    if (storedAnnouncements) {
      try {
        const parsed = JSON.parse(storedAnnouncements);
        
        if (Array.isArray(parsed)) {
            setAnnouncementList(parsed);
        } else {
            // Migration from single object to array
            if (parsed.zh || parsed.en) {
                setAnnouncementList([{ id: Date.now(), zh: parsed.zh, en: parsed.en }]);
            }
        }
      } catch (err) {
        console.error('Failed to load announcements', err);
      }
    }
  }, []);

  // Ownership
  const [newOwnerAddress, setNewOwnerAddress] = useState('');

  const handleTransferOwnership = async () => {
    if (!protocolContract || !ethers.isAddress(newOwnerAddress)) {
        toast.error('Invalid address');
        return;
    }
    
    // Safety check: Don't allow transfer to zero address
    if (newOwnerAddress === ethers.ZeroAddress) {
        toast.error('Cannot transfer to zero address');
        return;
    }

    setLoading(true);
    try {
        const tx = await protocolContract.transferOwnership(newOwnerAddress);
        await tx.wait();
        toast.success(t.admin.success);
        setNewOwnerAddress('');
    } catch (err: any) {
        toast.error(formatContractError(err));
    } finally {
        setLoading(false);
    }
  };

  // Liquidity Management
  const [mcLiquidityAmount, setMcLiquidityAmount] = useState('');
  const [jbcLiquidityAmount, setJbcLiquidityAmount] = useState('');

  // Level Reward Pool Management
  const [levelRewardPool, setLevelRewardPool] = useState('0');

  // Feature Controls
  const [ticketFlexibility, setTicketFlexibility] = useState('72');
  const [liquidityEnabled, setLiquidityEnabled] = useState(true);
  const [redeemEnabled, setRedeemEnabled] = useState(true);
  const [levelConfigJson, setLevelConfigJson] = useState(JSON.stringify([
      {minDirects: 100000, level: 9, percent: 45},
      {minDirects: 30000, level: 8, percent: 40},
      {minDirects: 10000, level: 7, percent: 35},
      {minDirects: 3000, level: 6, percent: 30},
      {minDirects: 1000, level: 5, percent: 25},
      {minDirects: 300, level: 4, percent: 20},
      {minDirects: 100, level: 3, percent: 15},
      {minDirects: 30, level: 2, percent: 10},
      {minDirects: 10, level: 1, percent: 5}
  ], null, 2));

  useEffect(() => {
    if (protocolContract) {
      // Check if functions exist to avoid errors on old deployments if not fully updated
      // But we assume we updated the contract
      protocolContract.liquidityEnabled().then(setLiquidityEnabled).catch(console.error);
      protocolContract.redeemEnabled().then(setRedeemEnabled).catch(console.error);
      protocolContract.ticketFlexibilityDuration().then((d: any) => setTicketFlexibility((Number(d) / 3600).toString())).catch(console.error);

      // Fetch current wallet addresses
      protocolContract.marketingWallet().then(setCurrentMarketing).catch(console.error);
      protocolContract.treasuryWallet().then(setCurrentTreasury).catch(console.error);
      protocolContract.lpInjectionWallet().then(setCurrentLp).catch(console.error);
      protocolContract.buybackWallet().then(setCurrentBuyback).catch(console.error);

      // Fetch level reward pool balance
      protocolContract.levelRewardPool().then((balance: any) => {
        setLevelRewardPool(ethers.formatEther(balance));
      }).catch(console.error);
    }
  }, [protocolContract]);

  const updateLevelConfigs = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const configs = JSON.parse(levelConfigJson);
      const tx = await protocolContract.setLevelConfigs(configs);
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const updateTicketFlexibility = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const seconds = Number(ticketFlexibility) * 3600;
      const tx = await protocolContract.setTicketFlexibilityDuration(seconds);
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleLiquidity = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setLiquidityEnabled(!liquidityEnabled);
      await tx.wait();
      setLiquidityEnabled(!liquidityEnabled);
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleRedeem = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setRedeemEnabled(!redeemEnabled);
      await tx.wait();
      setRedeemEnabled(!redeemEnabled);
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDailyBurn = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
        const tx = await protocolContract.dailyBurn();
        await tx.wait();
        toast.success("Daily burn executed successfully!");
    } catch (err: any) {
        console.error(err);
        toast.error(formatContractError(err));
    } finally {
        setLoading(false);
    }
  };

  const publishAnnouncement = () => {
    try {
      if (!announceZh && !announceEn) return;

      const newAnnouncement = {
        id: Date.now(),
        zh: announceZh,
        en: announceEn
      };
      
      const newList = [...announcementList, newAnnouncement];
      setAnnouncementList(newList);
      localStorage.setItem('announcements', JSON.stringify(newList));
      
      setAnnounceZh('');
      setAnnounceEn('');
      
      toast.success(t.admin.announcementSuccess);
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Failed to publish announcement', err);
      toast.error('Failed to publish announcement');
    }
  };

  const deleteAnnouncement = (id: number) => {
    try {
      const newList = announcementList.filter(item => item.id !== id);
      setAnnouncementList(newList);
      localStorage.setItem('announcements', JSON.stringify(newList));
      
      toast.success(t.admin.announcementCleared);
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Failed to delete announcement', err);
      toast.error('Failed to delete announcement');
    }
  };

  const clearAnnouncement = () => {
    try {
      localStorage.removeItem('announcements');
      setAnnouncementList([]);
      setAnnounceZh('');
      setAnnounceEn('');
      toast.success(t.admin.announcementCleared);

      // 触发 NoticeBar 更新
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Failed to clear announcement', err);
      toast.error('Failed to clear announcement');
    }
  };

  const updateDistribution = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setDistributionPercents(
        direct, level, marketing, buyback, lp, treasury
      );
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const updateSwapTaxes = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setSwapTaxes(buyTax, sellTax);
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const updateRedeemFee = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setRedemptionFee(redeemFee);
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const updateWallets = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
        // Simple check
        if (!marketingWallet || !treasuryWallet || !lpWallet || !buybackWallet) {
            toast.error(t.admin.required);
            return;
        }
      const tx = await protocolContract.setWallets(marketingWallet, treasuryWallet, lpWallet, buybackWallet);
      await tx.wait();
      
      // Update displayed current values
      setCurrentMarketing(marketingWallet);
      setCurrentTreasury(treasuryWallet);
      setCurrentLp(lpWallet);
      setCurrentBuyback(buybackWallet);
      
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };



  const addLiquidity = async (tokenType: 'MC' | 'JBC') => {
    if (!isConnected || !provider || !protocolContract) {
        toast.error("Connect wallet first");
        return;
    }

    setLoading(true);
    try {
        const signer = await provider.getSigner();

        if (tokenType === 'MC' && mcLiquidityAmount) {
            const amount = ethers.parseEther(mcLiquidityAmount);

            if (!mcContract) {
                toast.error("MC contract not found");
                return;
            }

            // Step 1: Check current allowance
            const allowance = await mcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
            console.log('Current MC allowance:', ethers.formatEther(allowance));
            console.log('Required amount:', ethers.formatEther(amount));
            
            if (allowance < amount) {
                toast.loading('Approving MC tokens...', { id: 'approve' });
                const approveTx = await mcContract.connect(signer).approve(CONTRACT_ADDRESSES.PROTOCOL, amount);
                await approveTx.wait();
                toast.success("MC approved!", { id: 'approve' });
            }

            // Step 2: Call protocol's addLiquidity function
            toast.loading('Adding MC liquidity...', { id: 'addLiq' });
            const tx = await protocolContract.connect(signer).addLiquidity(amount, 0);
            await tx.wait();
            toast.success(`Added ${mcLiquidityAmount} MC to pool!`, { id: 'addLiq' });
            setMcLiquidityAmount('');
            
        } else if (tokenType === 'JBC' && jbcLiquidityAmount) {
            const amount = ethers.parseEther(jbcLiquidityAmount);

            if (!jbcContract) {
                toast.error("JBC contract not found");
                return;
            }

            // Step 1: Check current allowance
            const allowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
            console.log('Current JBC allowance:', ethers.formatEther(allowance));
            console.log('Required amount:', ethers.formatEther(amount));
            
            if (allowance < amount) {
                toast.loading('Approving JBC tokens...', { id: 'approve' });
                const approveTx = await jbcContract.connect(signer).approve(CONTRACT_ADDRESSES.PROTOCOL, amount);
                await approveTx.wait();
                toast.success("JBC approved!", { id: 'approve' });
            }

            // Step 2: Call protocol's addLiquidity function
            toast.loading('Adding JBC liquidity...', { id: 'addLiq' });
            const tx = await protocolContract.connect(signer).addLiquidity(0, amount);
            await tx.wait();
            toast.success(`Added ${jbcLiquidityAmount} JBC to pool!`, { id: 'addLiq' });
            setJbcLiquidityAmount('');
        }
    } catch (err: any) {
        console.error('Add liquidity error:', err);
        toast.dismiss('approve');
        toast.dismiss('addLiq');
        
        // Enhanced error handling
        if (err.message?.includes('Ownable: caller is not the owner')) {
            toast.error('Only contract owner can add liquidity');
        } else if (err.message?.includes('insufficient funds')) {
            toast.error('Insufficient token balance');
        } else if (err.message?.includes('InvalidAmount')) {
            toast.error('Invalid amount - must be greater than 0');
        } else {
            toast.error(formatContractError(err));
        }
    } finally {
        setLoading(false);
    }
  };

  const removeLiquidity = async (tokenType: 'MC' | 'JBC') => {
    if (!protocolContract || !isConnected || !provider || !account) {
        toast.error(t.admin.failed);
        return;
    }

    setLoading(true);
    try {
        const signer = await provider.getSigner();

        if (tokenType === 'MC' && mcLiquidityRemoveAmount) {
            const amount = ethers.parseEther(mcLiquidityRemoveAmount);
            const tx = await protocolContract.connect(signer).adminWithdrawMC(amount, account);
            await tx.wait();
            toast.success(t.admin.success);
            setMcLiquidityRemoveAmount('');
        } else if (tokenType === 'JBC' && jbcLiquidityRemoveAmount) {
            const amount = ethers.parseEther(jbcLiquidityRemoveAmount);
            const tx = await protocolContract.connect(signer).adminWithdrawJBC(amount, account);
            await tx.wait();
            toast.success(t.admin.success);
            setJbcLiquidityRemoveAmount('');
        }
    } catch (err: any) {
        console.error(err);
        toast.error(formatContractError(err));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fade-in pb-20">
      <div className="text-center space-y-1 md:space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center gap-2">
            <Settings className="text-red-400 md:w-7 md:h-7" size={24} /> {t.admin.title}
        </h2>
        <p className="text-sm md:text-base text-gray-400">{t.admin.subtitle}</p>
      </div>

      {/* Announcement Management - 最优先显示 */}
      <div className="glass-panel p-6 md:p-8 rounded-xl md:rounded-2xl bg-gradient-to-br from-amber-900/30 to-amber-800/30 border-2 border-amber-500/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
            <Megaphone className="text-amber-400" size={24} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-white">{t.admin.announcement}</h3>
            <p className="text-sm text-gray-400">{t.admin.announcementDesc}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">{t.admin.announcementZh}</label>
            <textarea
              value={announceZh}
              onChange={(e) => setAnnounceZh(e.target.value)}
              placeholder={t.admin.announcementPlaceholder}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-700 bg-gray-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-white placeholder-gray-500 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">{t.admin.announcementEn}</label>
            <textarea
              value={announceEn}
              onChange={(e) => setAnnounceEn(e.target.value)}
              placeholder={t.admin.announcementPlaceholder}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-700 bg-gray-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-white placeholder-gray-500 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={publishAnnouncement}
              disabled={!announceZh && !announceEn}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30"
            >
              {t.admin.publishAnnouncement || "Add Announcement"}
            </button>
            <button
              onClick={clearAnnouncement}
              className="px-6 py-3 bg-red-900/50 hover:bg-red-800/50 text-red-200 font-bold rounded-lg transition-colors border border-red-800"
            >
              {t.admin.clearAnnouncement || "Clear All"}
            </button>
          </div>

          {/* Announcement List */}
          {announcementList.length > 0 && (
            <div className="mt-6 space-y-3">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Current Announcements ({announcementList.length})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {announcementList.map((item) => (
                        <div key={item.id} className="bg-gray-900/50 border border-amber-900/30 rounded-lg p-3 flex justify-between items-start gap-3 group">
                            <div className="flex-1 space-y-1">
                                {item.zh && <p className="text-sm text-gray-200"><span className="text-amber-500 text-xs font-bold mr-1">ZH</span> {item.zh}</p>}
                                {item.en && <p className="text-sm text-gray-400"><span className="text-blue-500 text-xs font-bold mr-1">EN</span> {item.en}</p>}
                            </div>
                            <button 
                                onClick={() => deleteAnnouncement(item.id)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete"
                            >
                                <AlertTriangle size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Distribution Settings */}
          <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800">
              <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white">{t.admin.distSettings}</h3>
              <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.direct}</label>
                      <input type="number" value={direct} onChange={e => setDirect(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.level}</label>
                      <input type="number" value={level} onChange={e => setLevel(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.marketing}</label>
                      <input type="number" value={marketing} onChange={e => setMarketing(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.buyback}</label>
                      <input type="number" value={buyback} onChange={e => setBuyback(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.lp}</label>
                      <input type="number" value={lp} onChange={e => setLp(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.treasury}</label>
                      <input type="number" value={treasury} onChange={e => setTreasury(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <div className="pt-2 border-t border-gray-800 text-xs md:text-sm text-gray-400">
                      {t.admin.total}: {Number(direct)+Number(level)+Number(marketing)+Number(buyback)+Number(lp)+Number(treasury)}% (Must be 100)
                  </div>
                  <button onClick={updateDistribution} disabled={loading} className="w-full py-2 md:py-2.5 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-bold rounded-lg mt-2 disabled:opacity-50 text-sm md:text-base shadow-lg shadow-neon-500/30">
                      {t.admin.updateDist}
                  </button>
              </div>
          </div>

          {/* Swap Taxes */}
          <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800">
              <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white">{t.admin.swapTaxes}</h3>
              <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.buyTax}</label>
                      <input type="number" value={buyTax} onChange={e => setBuyTax(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.sellTax}</label>
                      <input type="number" value={sellTax} onChange={e => setSellTax(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <button onClick={updateSwapTaxes} disabled={loading} className="w-full py-2 md:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg mt-2 disabled:opacity-50 text-sm md:text-base shadow-lg shadow-amber-500/30">
                      {t.admin.updateTaxes}
                  </button>
              </div>

              <h3 className="text-lg md:text-xl font-bold mt-6 md:mt-8 mb-3 md:mb-4 text-white">{t.admin.redeemFee}</h3>
              <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base text-gray-300">{t.admin.fee}</label>
                      <input type="number" value={redeemFee} onChange={e => setRedeemFee(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm md:text-base" />
                  </div>
                  <button onClick={updateRedeemFee} disabled={loading} className="w-full py-2 md:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg mt-2 disabled:opacity-50 text-sm md:text-base shadow-lg shadow-amber-500/30">
                      {t.admin.updateFee}
                  </button>
              </div>
          </div>
      </div>

      {/* Protocol Features */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white">{t.admin.featureSettings}</h3>
          
          {/* Level Configs */}
          <div className="space-y-2 mb-6">
              <label className="text-sm md:text-base text-gray-300 block mb-1">{t.admin.levelConfig}</label>
              <textarea 
                  value={levelConfigJson} 
                  onChange={e => setLevelConfigJson(e.target.value)} 
                  rows={6}
                  className="w-full p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-xs font-mono"
              />
              <button onClick={updateLevelConfigs} disabled={loading} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 text-sm">
                  {t.admin.updateLevel}
              </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ticket Flexibility */}
              <div className="space-y-2">
                  <label className="text-sm md:text-base text-gray-300 block">{t.admin.ticketFlex}</label>
                  <div className="flex gap-2">
                      <input 
                          type="number" 
                          value={ticketFlexibility} 
                          onChange={e => setTicketFlexibility(e.target.value)} 
                          className="flex-1 p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm" 
                      />
                      <button onClick={updateTicketFlexibility} disabled={loading} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 text-sm whitespace-nowrap">
                          {t.admin.updateFlex}
                      </button>
                  </div>
              </div>

              {/* Switches */}
              <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-gray-700 rounded bg-gray-900/30">
                      <span className="text-gray-300 text-sm">{t.admin.liquiditySwitch}</span>
                      <button 
                          onClick={toggleLiquidity}
                          disabled={loading}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${liquidityEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                      >
                          {liquidityEnabled ? <CheckCircle size={14} /> : <XCircle size={14} />}
                          {liquidityEnabled ? t.admin.enabled : t.admin.disabled}
                      </button>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-700 rounded bg-gray-900/30">
                      <span className="text-gray-300 text-sm">{t.admin.redeemSwitch}</span>
                      <button 
                          onClick={toggleRedeem}
                          disabled={loading}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${redeemEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                      >
                          {redeemEnabled ? <CheckCircle size={14} /> : <XCircle size={14} />}
                          {redeemEnabled ? t.admin.enabled : t.admin.disabled}
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* Wallet Addresses */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white">{t.admin.wallets}</h3>
          <div className="space-y-3 md:space-y-4">
              <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs md:text-sm text-gray-400">{t.admin.marketingWallet}</label>
                    <span className="text-xs font-mono text-gray-500" title={currentMarketing}>
                        {currentMarketing ? `${currentMarketing.substring(0,6)}...${currentMarketing.substring(currentMarketing.length-4)}` : '...'}
                    </span>
                  </div>
                  <input type="text" value={marketingWallet} onChange={e => setMarketingWallet(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>
              <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs md:text-sm text-gray-400">{t.admin.treasuryWallet}</label>
                    <span className="text-xs font-mono text-gray-500" title={currentTreasury}>
                        {currentTreasury ? `${currentTreasury.substring(0,6)}...${currentTreasury.substring(currentTreasury.length-4)}` : '...'}
                    </span>
                  </div>
                  <input type="text" value={treasuryWallet} onChange={e => setTreasuryWallet(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>
              <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs md:text-sm text-gray-400">{t.admin.lpWallet}</label>
                    <span className="text-xs font-mono text-gray-500" title={currentLp}>
                        {currentLp ? `${currentLp.substring(0,6)}...${currentLp.substring(currentLp.length-4)}` : '...'}
                    </span>
                  </div>
                  <input type="text" value={lpWallet} onChange={e => setLpWallet(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>
              <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs md:text-sm text-gray-400">{t.admin.buybackWallet}</label>
                    <span className="text-xs font-mono text-gray-500" title={currentBuyback}>
                        {currentBuyback ? `${currentBuyback.substring(0,6)}...${currentBuyback.substring(currentBuyback.length-4)}` : '...'}
                    </span>
                  </div>
                  <input type="text" value={buybackWallet} onChange={e => setBuybackWallet(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>
              <button onClick={updateWallets} disabled={loading} className="w-full py-2 md:py-2.5 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-bold rounded-lg mt-2 disabled:opacity-50 text-sm md:text-base shadow-lg shadow-neon-500/30">
                  {t.admin.updateWallets}
              </button>
          </div>
      </div>

      {/* Protocol Maintenance */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white">Protocol Maintenance</h3>
          <div className="space-y-3">
               <div className="flex items-center justify-between p-3 border border-gray-700 rounded bg-gray-900/30">
                  <div>
                      <span className="text-gray-300 text-sm font-bold block">Daily Burn</span>
                      <span className="text-gray-500 text-xs">Burn 1% of JBC in LP Pool (Once per 24h)</span>
                  </div>
                  <button 
                      onClick={handleDailyBurn}
                      disabled={loading}
                      className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-lg text-sm font-bold transition-all"
                  >
                      Execute Burn
                  </button>
              </div>
          </div>
      </div>

      {/* Liquidity Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-red-500/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <AlertTriangle className="text-red-400" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-white">{t.admin.liquidityMgmtTitle || 'Pool Liquidity (Admin Only)'}</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-4">{t.admin.liquidityMgmtDesc || 'Transfer tokens to or from the protocol contract to add or remove swap liquidity.'}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">{t.admin.addMcLiquidity || 'Add MC Liquidity'}</label>
                  <input 
                      type="number" 
                      value={mcLiquidityAmount} 
                      onChange={e => setMcLiquidityAmount(e.target.value)} 
                      className="w-full p-2 md:p-2.5 border border-gray-700 rounded bg-gray-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-neon-500/50"
                      placeholder={t.admin.amountInMc || 'Amount in MC'}
                  />
                  <button 
                      onClick={() => addLiquidity('MC')} 
                      disabled={loading || !mcLiquidityAmount}
                      className="w-full py-2 md:py-2.5 bg-gradient-to-r from-neon-500 to-neon-600 text-black rounded-lg hover:from-neon-400 hover:to-neon-500 disabled:opacity-50 text-sm md:text-base font-bold shadow-lg shadow-neon-500/30"
                  >
                      {t.admin.addMcToPool || 'Add MC to Pool'}
                  </button>
              </div>
              
              <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">{t.admin.addJbcLiquidity || 'Add JBC Liquidity'}</label>
                  <input 
                      type="number" 
                      value={jbcLiquidityAmount} 
                      onChange={e => setJbcLiquidityAmount(e.target.value)} 
                      className="w-full p-2 md:p-2.5 border border-gray-700 rounded bg-gray-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      placeholder={t.admin.amountInJbc || 'Amount in JBC'}
                  />
                  <button 
                      onClick={() => addLiquidity('JBC')} 
                      disabled={loading || !jbcLiquidityAmount}
                      className="w-full py-2 md:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-lg hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-sm md:text-base font-bold shadow-lg shadow-amber-500/30"
                  >
                      {t.admin.addJbcToPool || 'Add JBC to Pool'}
                  </button>
              </div>
          </div>
      </div>

      {/* Level Reward Pool Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-yellow-500/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Settings className="text-yellow-400" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-white">Level Reward Pool Management</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-4">Manage the level reward pool that accumulates unclaimed layer rewards.</p>
          
          <div className="space-y-4">
              {/* Pool Balance Display */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-yellow-500/20">
                  <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Current Pool Balance:</span>
                      <span className="text-lg font-bold text-yellow-400">{parseFloat(levelRewardPool).toFixed(4)} MC</span>
                  </div>
              </div>

          </div>
      </div>

      {/* Super Admin Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-purple-500/30 backdrop-blur-sm mt-6">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Settings className="text-purple-400" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-white">Super Admin Management</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-4">Transfer ownership of the contract to a new address. This action is irreversible.</p>
          
          <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">New Owner Address</label>
              <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                      type="text" 
                      value={newOwnerAddress} 
                      onChange={e => setNewOwnerAddress(e.target.value)} 
                      className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50" 
                      placeholder="0x..." 
                  />
                  <button 
                      onClick={handleTransferOwnership} 
                      disabled={loading || !newOwnerAddress} 
                      className="px-4 py-2 md:py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 text-sm font-bold whitespace-nowrap shadow-lg shadow-purple-500/30"
                  >
                      Transfer Ownership
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default AdminPanel;
