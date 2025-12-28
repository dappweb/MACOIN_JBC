import React, { useState, useEffect } from 'react';
import { useWeb3, CONTRACT_ADDRESSES } from '../src/Web3Context';
import { Settings, Save, AlertTriangle, Megaphone, CheckCircle, XCircle, Users } from 'lucide-react';
import { useLanguage } from '../src/LanguageContext';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../src/constants';
import { formatContractError } from '../utils/errorFormatter';
import { formatEnhancedContractError } from '../utils/contractErrorDecoder';
import { isUsingLatestContract } from '../utils/contractAddressResolver';
import AdminUserManager from './AdminUserManager';

const AdminPanel: React.FC = () => {
  const { t } = useLanguage();
  const { protocolContract, isConnected, account, provider, mcContract, jbcContract, isOwner } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'settings'>('overview');

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
        toast.error(t.admin.invalidAddress);
        return;
    }
    
    // Safety check: Don't allow transfer to zero address
    if (newOwnerAddress === ethers.ZeroAddress) {
        toast.error(t.admin.zeroAddressError);
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
  const [mcLiquidityRemoveAmount, setMcLiquidityRemoveAmount] = useState('');
  const [jbcLiquidityRemoveAmount, setJbcLiquidityRemoveAmount] = useState('');
  const [swapReserveMC, setSwapReserveMC] = useState('0');
  const [swapReserveJBC, setSwapReserveJBC] = useState('0');

  // User Management
  const [searchUserAddress, setSearchUserAddress] = useState('');
  const [searchedUserInfo, setSearchedUserInfo] = useState<any>(null);
  const [newTeamCount, setNewTeamCount] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [fundToken, setFundToken] = useState<'MC' | 'JBC'>('MC');

  // Fetch Swap Reserves
  useEffect(() => {
    if (protocolContract) {
        protocolContract.swapReserveMC().then((res: any) => setSwapReserveMC(ethers.formatEther(res))).catch(console.error);
        protocolContract.swapReserveJBC().then((res: any) => setSwapReserveJBC(ethers.formatEther(res))).catch(console.error);
    }
  }, [protocolContract, loading]); // Refresh on loading change (after tx)

  // Contract address validation
  const [contractAddressWarning, setContractAddressWarning] = useState(false);

  // Level Reward Pool Management
  const [levelRewardPool, setLevelRewardPool] = useState('0');

  useEffect(() => {
    const checkContractAddress = async () => {
      if (protocolContract) {
        const isLatest = await isUsingLatestContract(CONTRACT_ADDRESSES.PROTOCOL);
        setContractAddressWarning(!isLatest);
      }
    };
    checkContractAddress();
  }, [protocolContract]);

  // Feature Controls
  const [ticketFlexibility, setTicketFlexibility] = useState('0');
  const [liquidityEnabled, setLiquidityEnabled] = useState(true);
  const [redeemEnabled, setRedeemEnabled] = useState(true);

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
      const tx = await protocolContract.setOperationalStatus(!liquidityEnabled, redeemEnabled);
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
      const tx = await protocolContract.setOperationalStatus(liquidityEnabled, !redeemEnabled);
      await tx.wait();
      setRedeemEnabled(!redeemEnabled);
      toast.success(t.admin.success);
    } catch (err: any) {
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
      toast.error(t.admin.publishFail);
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
      toast.error(t.admin.deleteFail);
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
      toast.error(t.admin.clearFail);
    }
  };

  const updateDistribution = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setDistributionConfig(
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
      const tx = await protocolContract.setRedemptionFeePercent(redeemFee);
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
        toast.error(t.admin.connectFirst);
        return;
    }

    setLoading(true);
    try {
        const signer = await provider.getSigner();

        if (tokenType === 'MC' && mcLiquidityAmount) {
            const amount = ethers.parseEther(mcLiquidityAmount);

            if (!mcContract) {
                toast.error(t.admin.mcContractNotFound);
                return;
            }

            // Step 1: Check current allowance
            const allowance = await mcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
            console.log('Current MC allowance:', ethers.formatEther(allowance));
            console.log('Required amount:', ethers.formatEther(amount));
            
            if (allowance < amount) {
                toast.loading(t.admin.approvingMc, { id: 'approve' });
                const approveTx = await mcContract.connect(signer).approve(CONTRACT_ADDRESSES.PROTOCOL, amount);
                await approveTx.wait();
                toast.success(t.admin.mcApproved, { id: 'approve' });
            }

            // Step 2: Call protocol's addLiquidity function
            toast.loading(t.admin.addingMc, { id: 'addLiq' });
            const tx = await protocolContract.connect(signer).addLiquidity(amount, 0);
            await tx.wait();
            toast.success(`${t.admin.addedMc} (${mcLiquidityAmount} MC)`, { id: 'addLiq' });
            setMcLiquidityAmount('');
            
        } else if (tokenType === 'JBC' && jbcLiquidityAmount) {
            const amount = ethers.parseEther(jbcLiquidityAmount);

            if (!jbcContract) {
                toast.error(t.admin.jbcContractNotFound);
                return;
            }

            // Step 1: Check current allowance
            const allowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
            console.log('Current JBC allowance:', ethers.formatEther(allowance));
            console.log('Required amount:', ethers.formatEther(amount));
            
            if (allowance < amount) {
                toast.loading(t.admin.approvingJbc, { id: 'approve' });
                const approveTx = await jbcContract.connect(signer).approve(CONTRACT_ADDRESSES.PROTOCOL, amount);
                await approveTx.wait();
                toast.success(t.admin.jbcApproved, { id: 'approve' });
            }

            // Step 2: Call protocol's addLiquidity function
            toast.loading(t.admin.addingJbc, { id: 'addLiq' });
            const tx = await protocolContract.connect(signer).addLiquidity(0, amount);
            await tx.wait();
            toast.success(`${t.admin.addedJbc} (${jbcLiquidityAmount} JBC)`, { id: 'addLiq' });
            setJbcLiquidityAmount('');
        }
    } catch (err: any) {
        console.error('Add liquidity error:', err);
        toast.dismiss('approve');
        toast.dismiss('addLiq');
        
        // Use enhanced error handling
        toast.error(formatEnhancedContractError(err, t));
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
        if (tokenType === 'MC' && mcLiquidityRemoveAmount) {
            const amount = ethers.parseEther(mcLiquidityRemoveAmount);
            // withdrawSwapReserves(toMC, amountMC, toJBC, amountJBC)
            const tx = await protocolContract.withdrawSwapReserves(account, amount, ethers.ZeroAddress, 0);
            await tx.wait();
            toast.success(t.admin.success);
            setMcLiquidityRemoveAmount('');
        } else if (tokenType === 'JBC' && jbcLiquidityRemoveAmount) {
            const amount = ethers.parseEther(jbcLiquidityRemoveAmount);
            // withdrawSwapReserves(toMC, amountMC, toJBC, amountJBC)
            const tx = await protocolContract.withdrawSwapReserves(ethers.ZeroAddress, 0, account, amount);
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

  const fetchUserInfo = async () => {
    if (!protocolContract || !ethers.isAddress(searchUserAddress)) {
        toast.error(t.admin.invalidAddress);
        return;
    }
    setLoading(true);
    try {
        const info = await protocolContract.userInfo(searchUserAddress);
        // Get level
        let level = '0';
        try {
            // Try getLevelByTeamCount first as it's more relevant for admin updates
            const levelInfo = await protocolContract.getLevelByTeamCount(info.teamCount);
            level = levelInfo[0].toString();
        } catch (e) {
            console.warn('Failed to fetch level', e);
        }

        setSearchedUserInfo({
            referrer: info.referrer,
            activeDirects: info.activeDirects.toString(),
            teamCount: info.teamCount.toString(),
            totalRevenue: ethers.formatEther(info.totalRevenue),
            isActive: info.isActive,
            maxTicketAmount: ethers.formatEther(info.maxTicketAmount),
            currentCap: ethers.formatEther(info.currentCap),
            level: level
        });
        setNewTeamCount(info.teamCount.toString());
    } catch (err: any) {
        console.error(err);
        toast.error(formatContractError(err));
    } finally {
        setLoading(false);
    }
  };

  const updateTeamCount = async () => {
    if (!protocolContract || !searchUserAddress) return;
    setLoading(true);
    try {
        const tx = await protocolContract.batchUpdateTeamCounts([searchUserAddress], [newTeamCount]);
        await tx.wait();
        toast.success(t.admin.success);
        fetchUserInfo(); // Refresh
    } catch (err: any) {
        console.error(err);
        toast.error(formatContractError(err));
    } finally {
        setLoading(false);
    }
  };

  const fundUser = async () => {
      if (!protocolContract || !searchUserAddress || !fundAmount) return;
      if (!window.confirm(t.admin.confirmFund)) return;

      setLoading(true);
      try {
          const tokenAddress = fundToken === 'MC' ? CONTRACT_ADDRESSES.MC_TOKEN : CONTRACT_ADDRESSES.JBC_TOKEN;
          const amount = ethers.parseEther(fundAmount);
          
          const tx = await protocolContract.rescueTokens(tokenAddress, searchUserAddress, amount);
          await tx.wait();
          
          toast.success(t.admin.success);
          setFundAmount('');
      } catch (err: any) {
          console.error(err);
          toast.error(formatContractError(err));
      } finally {
          setLoading(false);
      }
  };

  const withdrawAll = async (tokenType: 'MC' | 'JBC') => {
      if (!protocolContract || !mcContract || !jbcContract) return;
      if (!window.confirm(t.admin.confirmWithdraw)) return;
      
      setLoading(true);
      try {
          // 1. Withdraw Swap Reserves first (for accounting)
          const reserveMC = await protocolContract.swapReserveMC();
          const reserveJBC = await protocolContract.swapReserveJBC();
          
          if (reserveMC > 0 || reserveJBC > 0) {
             const tx1 = await protocolContract.withdrawSwapReserves(account, reserveMC, account, reserveJBC);
             await tx1.wait();
          }
          
          // 2. Rescue remaining tokens
          const tokenContract = tokenType === 'MC' ? mcContract : jbcContract;
          const balance = await tokenContract.balanceOf(CONTRACT_ADDRESSES.PROTOCOL);
          
          if (balance > 0) {
              const tx2 = await protocolContract.rescueTokens(await tokenContract.getAddress(), account, balance);
              await tx2.wait();
          }
          
          toast.success(t.admin.withdrawSuccess);
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

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="flex bg-gray-900/50 rounded-xl p-1 border border-gray-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Settings className="inline mr-2" size={16} />
            系统设置
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'users'
                ? 'bg-green-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Users className="inline mr-2" size={16} />
            用户管理
          </button>
        </div>
      </div>

      {/* Non-Owner Warning */}
      {isConnected && !isOwner && (
        <div className="bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r shadow-lg mb-6">
          <div className="flex items-start">
            <AlertTriangle className="text-red-400 mt-0.5 mr-3 flex-shrink-0" size={20} />
            <div>
              <h3 className="text-red-400 font-bold text-base md:text-lg">Permission Warning</h3>
              <p className="text-red-200/80 text-sm mt-1">
                You are currently connected with an address that is <strong>NOT</strong> the contract owner.
                You can view the dashboard, but <span className="text-red-100 font-bold underline">any attempt to update data will fail</span>.
              </p>
              <div className="mt-2 p-2 bg-black/40 rounded border border-red-500/20">
                  <p className="text-gray-400 text-xs font-mono">
                    Current Address: <span className="text-white">{account}</span>
                  </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contract Address Warning */}
      {contractAddressWarning && (
        <div className="bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded-r shadow-lg mb-6">
          <div className="flex items-start">
            <AlertTriangle className="text-yellow-400 mt-0.5 mr-3 flex-shrink-0" size={20} />
            <div>
              <h3 className="text-yellow-400 font-bold text-base md:text-lg">Contract Address Warning</h3>
              <p className="text-yellow-200/80 text-sm mt-1">
                The frontend may be using an outdated contract address. This could cause admin functions to fail.
                <span className="text-yellow-100 font-bold"> Please refresh the page or contact support.</span>
              </p>
              <div className="mt-2 p-2 bg-black/40 rounded border border-yellow-500/20">
                  <p className="text-gray-400 text-xs font-mono">
                    Current Contract: <span className="text-white">{CONTRACT_ADDRESSES.PROTOCOL}</span>
                  </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'users' ? (
        <AdminUserManager />
      ) : (
        <>
          {/* Original Admin Panel Content */}

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
              placeholder="Enter announcement content..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-700 bg-gray-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-white placeholder-gray-500 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3">
             <button 
               onClick={() => {
                   setAnnouncementList([]);
                   localStorage.removeItem('announcements');
                   window.dispatchEvent(new Event('storage'));
                   toast.success(t.admin.announcementCleared);
               }}
               className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 text-sm font-bold border border-red-500/30"
             >
               {t.admin.clearAnnouncement}
             </button>
             <button 
               onClick={publishAnnouncement}
               disabled={!announceZh && !announceEn}
               className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-sm font-bold shadow-lg shadow-amber-500/30"
             >
               {t.admin.publishAnnouncement}
             </button>
          </div>

          {/* Current Announcements List */}
          {announcementList.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-700/50">
                <h4 className="text-sm font-bold text-gray-400 mb-3">{t.admin.currentAnnouncements}</h4>
                <div className="space-y-3">
                    {announcementList.map((ann) => (
                        <div key={ann.id} className="bg-gray-900/40 rounded-lg p-3 border border-gray-700 flex justify-between items-start gap-4">
                            <div className="space-y-1 flex-1">
                                {ann.zh && <p className="text-sm text-gray-200"><span className="text-xs text-amber-500 font-bold mr-2">ZH</span>{ann.zh}</p>}
                                {ann.en && <p className="text-sm text-gray-200"><span className="text-xs text-blue-500 font-bold mr-2">EN</span>{ann.en}</p>}
                                <p className="text-xs text-gray-500 mt-1">{new Date(ann.id).toLocaleString()}</p>
                            </div>
                            <button 
                                onClick={() => deleteAnnouncement(ann.id)}
                                className="text-gray-500 hover:text-red-400 p-1"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>
      </div>

      {/* User Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-blue-500/30 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Settings className="text-blue-400" size={20} />
            <h3 className="text-lg md:text-xl font-bold text-white">{t.admin.userManagerTitle}</h3>
        </div>
        <p className="text-xs md:text-sm text-gray-400 mb-4">{t.admin.userManagerDesc}</p>
        
        <div className="space-y-4">
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={searchUserAddress} 
                    onChange={e => setSearchUserAddress(e.target.value)} 
                    className="flex-1 p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm font-mono placeholder-gray-600" 
                    placeholder={t.admin.searchUserPlaceholder} 
                />
                <button 
                    onClick={fetchUserInfo} 
                    disabled={loading || !searchUserAddress} 
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 text-sm font-bold"
                >
                    {t.admin.search}
                </button>
            </div>

            {searchedUserInfo && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-blue-500/20 space-y-3">
                    <h4 className="text-sm font-bold text-white border-b border-gray-700 pb-2">{t.admin.userInfo}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-400 block">{t.admin.referrer}</span>
                            <span className="text-white font-mono break-all">{searchedUserInfo.referrer}</span>
                        </div>
                        <div>
                            <span className="text-gray-400 block">{t.admin.activeDirects}</span>
                            <span className="text-white font-mono">{searchedUserInfo.activeDirects}</span>
                        </div>
                        <div>
                            <span className="text-gray-400 block">{t.admin.totalRevenue}</span>
                            <span className="text-white font-mono">{searchedUserInfo.totalRevenue} MC</span>
                        </div>
                        <div>
                            <span className="text-gray-400 block">{t.admin.isActive}</span>
                            <span className={searchedUserInfo.isActive ? "text-green-400" : "text-red-400"}>
                                {searchedUserInfo.isActive ? "Yes" : "No"}
                            </span>
                        </div>
                    </div>
                    
                    <div className="pt-3 border-t border-gray-700">
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t.admin.updateTeamCount}</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={newTeamCount} 
                                onChange={e => setNewTeamCount(e.target.value)} 
                                className="w-24 p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm" 
                            />
                            <button 
                                onClick={updateTeamCount} 
                                disabled={loading} 
                                className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 disabled:opacity-50 text-sm font-bold"
                            >
                                {t.admin.update}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{t.admin.teamCountNote}</p>
                    </div>

                    <div className="pt-3 border-t border-gray-700">
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t.admin.fundUser}</label>
                        <p className="text-xs text-red-400 mb-2">{t.admin.fundWarning}</p>
                        <div className="flex gap-2">
                            <select 
                                value={fundToken}
                                onChange={(e) => setFundToken(e.target.value as 'MC' | 'JBC')}
                                className="p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm"
                            >
                                <option value="MC">MC</option>
                                <option value="JBC">JBC</option>
                            </select>
                            <input 
                                type="number" 
                                value={fundAmount} 
                                onChange={e => setFundAmount(e.target.value)} 
                                className="flex-1 p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm" 
                                placeholder="Amount"
                            />
                            <button 
                                onClick={fundUser} 
                                disabled={loading || !fundAmount} 
                                className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded hover:bg-green-600/30 disabled:opacity-50 text-sm font-bold"
                            >
                                {t.admin.transfer}
                            </button>
                        </div>
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

      {/* Liquidity Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-red-500/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <AlertTriangle className="text-red-400" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-white">{t.admin.liquidityMgmtTitle}</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-4">{t.admin.liquidityMgmtDesc}</p>
          
          <div className="space-y-6">
              {/* Add Liquidity */}
              <div>
                  <h4 className="text-sm font-bold text-green-400 border-b border-gray-700 pb-2 mb-3">{t.admin.addLiquidity}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-300">{t.admin.addMcLiquidity}</label>
                          <input 
                              type="number" 
                              value={mcLiquidityAmount} 
                              onChange={e => setMcLiquidityAmount(e.target.value)} 
                              className="w-full p-2 md:p-2.5 border border-gray-700 rounded bg-gray-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-neon-500/50"
                              placeholder={t.admin.amountInMc}
                          />
                          <button 
                              onClick={() => addLiquidity('MC')} 
                              disabled={loading || !mcLiquidityAmount}
                              className="w-full py-2 md:py-2.5 bg-gradient-to-r from-neon-500 to-neon-600 text-black rounded-lg hover:from-neon-400 hover:to-neon-500 disabled:opacity-50 text-sm md:text-base font-bold shadow-lg shadow-neon-500/30"
                          >
                              {t.admin.addMcToPool}
                          </button>
                      </div>
                      
                      <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-300">{t.admin.addJbcLiquidity}</label>
                          <input 
                              type="number" 
                              value={jbcLiquidityAmount} 
                              onChange={e => setJbcLiquidityAmount(e.target.value)} 
                              className="w-full p-2 md:p-2.5 border border-gray-700 rounded bg-gray-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                              placeholder={t.admin.amountInJbc}
                          />
                          <button 
                              onClick={() => addLiquidity('JBC')} 
                              disabled={loading || !jbcLiquidityAmount}
                              className="w-full py-2 md:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-lg hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-sm md:text-base font-bold shadow-lg shadow-amber-500/30"
                          >
                              {t.admin.addJbcToPool}
                          </button>
                      </div>
                  </div>
              </div>

              {/* Remove Liquidity */}
              <div>
                  <h4 className="text-sm font-bold text-red-400 border-b border-gray-700 pb-2 mb-3">{t.admin.removeLiquidity}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                          <div className="flex justify-between">
                              <label className="block text-sm font-medium text-gray-300">{t.admin.removeMcLiquidity}</label>
                              <span className="text-xs text-gray-500">{t.admin.currentReserves}: {parseFloat(swapReserveMC).toFixed(2)} MC</span>
                          </div>
                          <input 
                              type="number" 
                              value={mcLiquidityRemoveAmount} 
                              onChange={e => setMcLiquidityRemoveAmount(e.target.value)} 
                              className="w-full p-2 md:p-2.5 border border-gray-700 rounded bg-gray-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                              placeholder={t.admin.amountInMc}
                          />
                          <button 
                              onClick={() => removeLiquidity('MC')} 
                              disabled={loading || !mcLiquidityRemoveAmount}
                              className="w-full py-2 md:py-2.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 disabled:opacity-50 text-sm md:text-base font-bold"
                          >
                              {t.admin.remove}
                          </button>
                      </div>

                      <div className="space-y-3">
                          <div className="flex justify-between">
                              <label className="block text-sm font-medium text-gray-300">{t.admin.removeJbcLiquidity}</label>
                              <span className="text-xs text-gray-500">{t.admin.currentReserves}: {parseFloat(swapReserveJBC).toFixed(2)} JBC</span>
                          </div>
                          <input 
                              type="number" 
                              value={jbcLiquidityRemoveAmount} 
                              onChange={e => setJbcLiquidityRemoveAmount(e.target.value)} 
                              className="w-full p-2 md:p-2.5 border border-gray-700 rounded bg-gray-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                              placeholder={t.admin.amountInJbc}
                          />
                          <button 
                              onClick={() => removeLiquidity('JBC')} 
                              disabled={loading || !jbcLiquidityRemoveAmount}
                              className="w-full py-2 md:py-2.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 disabled:opacity-50 text-sm md:text-base font-bold"
                          >
                              {t.admin.remove}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Emergency Withdraw */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-red-600/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <AlertTriangle className="text-red-500" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-white">{t.admin.emergencyWithdrawTitle}</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-4">{t.admin.emergencyWithdrawDesc}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                  onClick={() => withdrawAll('MC')} 
                  disabled={loading}
                  className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm md:text-base font-bold shadow-lg shadow-red-600/20 border border-red-500"
              >
                  {t.admin.withdrawAllMc}
              </button>
              <button 
                  onClick={() => withdrawAll('JBC')} 
                  disabled={loading}
                  className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm md:text-base font-bold shadow-lg shadow-red-600/20 border border-red-500"
              >
                  {t.admin.withdrawAllJbc}
              </button>
          </div>
      </div>

      {/* Level Reward Pool Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-yellow-500/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Settings className="text-yellow-400" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-white">{t.admin.levelRewardPoolTitle}</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-4">{t.admin.levelRewardPoolDesc}</p>
          
          <div className="space-y-4">
              {/* Pool Balance Display */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-yellow-500/20">
                  <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">{t.admin.currentPoolBalance}:</span>
                      <span className="text-lg font-bold text-yellow-400">{parseFloat(levelRewardPool).toFixed(4)} MC</span>
                  </div>
              </div>

          </div>
      </div>

      {/* Super Admin Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-purple-500/30 backdrop-blur-sm mt-6">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Settings className="text-purple-400" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-white">{t.admin.superAdminTitle}</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-4">{t.admin.superAdminDesc}</p>
          
          <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">{t.admin.newOwnerAddress}</label>
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
                      {t.admin.transferOwnership}
                  </button>
              </div>
          </div>
      </div>
        </>
      )}
    </div>
  );
};

export default AdminPanel;
