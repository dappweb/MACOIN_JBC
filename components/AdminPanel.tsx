import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../Web3Context';
import { Settings, Save, AlertTriangle, Megaphone } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../constants';

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

  // User Management
  const [targetUser, setTargetUser] = useState('');
  const [newReferrer, setNewReferrer] = useState('');
  const [activeDirects, setActiveDirects] = useState('');
  const [teamCount, setTeamCount] = useState('');

  // Announcement Management
  const [announceZh, setAnnounceZh] = useState('');
  const [announceEn, setAnnounceEn] = useState('');

  // Load current announcements
  useEffect(() => {
    const storedAnnouncements = localStorage.getItem('announcements');
    if (storedAnnouncements) {
      try {
        const announcements = JSON.parse(storedAnnouncements);
        setAnnounceZh(announcements.zh || '');
        setAnnounceEn(announcements.en || '');
      } catch (err) {
        console.error('Failed to load announcements', err);
      }
    }
  }, []);

  // Liquidity Management
  const [mcLiquidityAmount, setMcLiquidityAmount] = useState('');
  const [jbcLiquidityAmount, setJbcLiquidityAmount] = useState('');
  const [mcLiquidityRemoveAmount, setMcLiquidityRemoveAmount] = useState('');
  const [jbcLiquidityRemoveAmount, setJbcLiquidityRemoveAmount] = useState('');

  const publishAnnouncement = () => {
    try {
      const announcements = {
        zh: announceZh,
        en: announceEn
      };
      localStorage.setItem('announcements', JSON.stringify(announcements));
      toast.success(t.admin.announcementSuccess);

      // 触发 NoticeBar 更新（通过 storage 事件）
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Failed to publish announcement', err);
      toast.error('Failed to publish announcement');
    }
  };

  const clearAnnouncement = () => {
    try {
      localStorage.removeItem('announcements');
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
      toast.error(t.admin.failed + (err.reason || err.message));
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
      toast.error(t.admin.failed + (err.reason || err.message));
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
      toast.error(t.admin.failed + (err.reason || err.message));
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
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const updateUserStats = async () => {
    if (!protocolContract || !targetUser) return;
    setLoading(true);
    try {
        const tx = await protocolContract.adminSetUserStats(targetUser, activeDirects, teamCount);
        await tx.wait();
        toast.success(t.admin.success);
    } catch (err: any) {
        toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
        setLoading(false);
    }
  };

  const updateReferrer = async () => {
    if (!protocolContract || !targetUser || !newReferrer) return;
    setLoading(true);
    try {
        const tx = await protocolContract.adminSetReferrer(targetUser, newReferrer);
        await tx.wait();
        toast.success(t.admin.success);
    } catch (err: any) {
        toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
        setLoading(false);
    }
  };

  const addLiquidity = async (tokenType: 'MC' | 'JBC') => {
    if (!isConnected || !provider) {
        toast.error("Connect wallet first");
        return;
    }

    setLoading(true);
    try {
        const { CONTRACT_ADDRESSES } = await import('../Web3Context');
        const signer = await provider.getSigner();

        if (tokenType === 'MC' && mcLiquidityAmount) {
            const amount = ethers.parseEther(mcLiquidityAmount);

            if (!mcContract) {
                toast.error("MC contract not found");
                return;
            }

            // Transfer MC to protocol contract
            const tx = await mcContract.connect(signer).transfer(CONTRACT_ADDRESSES.PROTOCOL, amount);
            await tx.wait();
            toast.success(`Added ${mcLiquidityAmount} MC to pool!`);
            setMcLiquidityAmount('');
        } else if (tokenType === 'JBC' && jbcLiquidityAmount) {
            const amount = ethers.parseEther(jbcLiquidityAmount);

            if (!jbcContract) {
                toast.error("JBC contract not found");
                return;
            }

            // Transfer JBC to protocol contract
            const tx = await jbcContract.connect(signer).transfer(CONTRACT_ADDRESSES.PROTOCOL, amount);
            await tx.wait();
            toast.success(`Added ${jbcLiquidityAmount} JBC to pool!`);
            setJbcLiquidityAmount('');
        }
    } catch (err: any) {
        console.error(err);
        toast.error("Failed: " + (err.reason || err.message));
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
        toast.error(t.admin.failed + (err.reason || err.message));
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
              {t.admin.publishAnnouncement}
            </button>
            <button
              onClick={clearAnnouncement}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold rounded-lg transition-colors border border-gray-600"
            >
              {t.admin.clearAnnouncement}
            </button>
          </div>
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

      {/* Wallet Addresses */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white">{t.admin.wallets}</h3>
          <div className="space-y-3 md:space-y-4">
              <div>
                  <label className="block text-xs md:text-sm text-gray-400 mb-1">{t.admin.marketingWallet}</label>
                  <input type="text" value={marketingWallet} onChange={e => setMarketingWallet(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-xs md:text-sm text-gray-400 mb-1">{t.admin.treasuryWallet}</label>
                  <input type="text" value={treasuryWallet} onChange={e => setTreasuryWallet(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-xs md:text-sm text-gray-400 mb-1">{t.admin.lpWallet}</label>
                  <input type="text" value={lpWallet} onChange={e => setLpWallet(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-xs md:text-sm text-gray-400 mb-1">{t.admin.buybackWallet}</label>
                  <input type="text" value={buybackWallet} onChange={e => setBuybackWallet(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>
              <button onClick={updateWallets} disabled={loading} className="w-full py-2 md:py-2.5 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-bold rounded-lg mt-2 disabled:opacity-50 text-sm md:text-base shadow-lg shadow-neon-500/30">
                  {t.admin.updateWallets}
              </button>
          </div>
      </div>

      {/* User Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white">{t.admin.userMgmt}</h3>
          <div className="space-y-3 md:space-y-4">
              <div>
                  <label className="block text-xs md:text-sm text-gray-400 mb-1">{t.admin.userAddr}</label>
                  <input type="text" value={targetUser} onChange={e => setTargetUser(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 border-t border-gray-800 pt-3 md:pt-4">
                  <div>
                      <label className="block text-xs md:text-sm text-gray-400 mb-1">{t.admin.newReferrer}</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                          <input type="text" value={newReferrer} onChange={e => setNewReferrer(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600" placeholder="0x..." />
                          <button onClick={updateReferrer} disabled={loading} className="px-3 md:px-4 py-2 md:py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 text-xs md:text-sm whitespace-nowrap border border-gray-600">
                              {t.admin.updateReferrer}
                          </button>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                          <label className="text-xs md:text-sm text-gray-400 w-20 md:w-24">{t.admin.activeDirects}</label>
                          <input type="number" value={activeDirects} onChange={e => setActiveDirects(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm" />
                      </div>
                      <div className="flex gap-2 items-center">
                          <label className="text-xs md:text-sm text-gray-400 w-20 md:w-24">{t.admin.teamCount}</label>
                          <input type="number" value={teamCount} onChange={e => setTeamCount(e.target.value)} className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm" />
                      </div>
                      <button onClick={updateUserStats} disabled={loading} className="w-full py-2 md:py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 text-xs md:text-sm border border-gray-600">
                          {t.admin.updateUser}
                      </button>
                  </div>
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
                  <label className="block text-sm font-medium text-gray-300">{t.admin.removeMcLiquidity || 'Remove MC Liquidity'}</label>
                  <input 
                      type="number" 
                      value={mcLiquidityRemoveAmount} 
                      onChange={e => setMcLiquidityRemoveAmount(e.target.value)} 
                      className="w-full p-2 md:p-2.5 border border-gray-700 rounded bg-gray-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      placeholder={t.admin.amountInMc || 'Amount in MC'}
                  />
                  <button 
                      onClick={() => removeLiquidity('MC')} 
                      disabled={loading || !mcLiquidityRemoveAmount}
                      className="w-full py-2 md:py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-400 hover:to-red-500 disabled:opacity-50 text-sm md:text-base font-bold shadow-lg shadow-red-500/30"
                  >
                      {t.admin.removeMcFromPool || 'Remove MC from Pool'}
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
                  <label className="block text-sm font-medium text-gray-300">{t.admin.removeJbcLiquidity || 'Remove JBC Liquidity'}</label>
                  <input 
                      type="number" 
                      value={jbcLiquidityRemoveAmount} 
                      onChange={e => setJbcLiquidityRemoveAmount(e.target.value)} 
                      className="w-full p-2 md:p-2.5 border border-gray-700 rounded bg-gray-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      placeholder={t.admin.amountInJbc || 'Amount in JBC'}
                  />
                  <button 
                      onClick={() => removeLiquidity('JBC')} 
                      disabled={loading || !jbcLiquidityRemoveAmount}
                      className="w-full py-2 md:py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-400 hover:to-red-500 disabled:opacity-50 text-sm md:text-base font-bold shadow-lg shadow-red-500/30"
                  >
                      {t.admin.removeJbcFromPool || 'Remove JBC from Pool'}
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default AdminPanel;
