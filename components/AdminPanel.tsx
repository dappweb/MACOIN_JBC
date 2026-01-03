import React, { useState, useEffect } from 'react';
import { useWeb3, CONTRACT_ADDRESSES, DAILY_BURN_MANAGER_ABI } from '../src/Web3Context';
import { Settings, Save, AlertTriangle, Megaphone, CheckCircle, XCircle, Users, Crown, Flame, Coins } from 'lucide-react';
import { useLanguage } from '../src/LanguageContext';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../src/constants';
import { formatContractError } from '../utils/errorFormatter';
import { formatEnhancedContractError, decodeContractError } from '../utils/contractErrorDecoder';
import { isUsingLatestContract } from '../utils/contractAddressResolver';
import AdminUserManager from './AdminUserManager';
import LevelDisplay from './LevelDisplay';
import LevelSystemInfo from './LevelSystemInfo';
import AdminLevelDisplay from './AdminLevelDisplay';
import NotificationSettings from './NotificationSettings';

const AdminPanel: React.FC = () => {
  const { t } = useLanguage();
  const { protocolContract, isConnected, account, provider, jbcContract, isOwner, mcBalance, refreshMcBalance, signer } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'levels' | 'settings' | 'burn' | 'jbc'>('overview');
  
  // Daily Burn Manager Contract
  const [burnManagerContract, setBurnManagerContract] = useState<ethers.Contract | null>(null);
  
  // Daily Burn Manager State
  const [canBurn, setCanBurn] = useState(false);
  const [nextBurnTime, setNextBurnTime] = useState<bigint | null>(null);
  const [lastBurnTime, setLastBurnTime] = useState<bigint | null>(null);
  const [burnAmount, setBurnAmount] = useState<bigint | null>(null);
  const [timeUntilNextBurn, setTimeUntilNextBurn] = useState<bigint | null>(null);
  const [burnManagerOwner, setBurnManagerOwner] = useState<string | null>(null);
  const [isBurnManagerOwner, setIsBurnManagerOwner] = useState(false);

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
  
  // Buyback Management
  const [buybackWalletBalance, setBuybackWalletBalance] = useState('0');
  const [isBuybackWallet, setIsBuybackWallet] = useState(false);

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

  // Fetch JBC Token Data
  const fetchJbcData = async () => {
    if (!jbcContract || !protocolContract || !account || !provider) return;

    try {
      // Protocol JBC Balance
      const protocolBalance = await jbcContract.balanceOf(CONTRACT_ADDRESSES.PROTOCOL);
      setProtocolJbcBalance(ethers.formatEther(protocolBalance));

      // Protocol MC Balance (Native)
      const protocolMcBalance = await provider.getBalance(CONTRACT_ADDRESSES.PROTOCOL);
      setProtocolMcBalance(ethers.formatEther(protocolMcBalance));

      // Total Supply
      const totalSupply = await jbcContract.totalSupply();
      setJbcTotalSupply(ethers.formatEther(totalSupply));

      // Account Balance
      const accountBalance = await jbcContract.balanceOf(account);
      setAccountJbcBalance(ethers.formatEther(accountBalance));

      // Calculate JBC Price from swap reserves
      const reserveMC = await protocolContract.swapReserveMC();
      const reserveJBC = await protocolContract.swapReserveJBC();
      
      if (reserveJBC > 0n && reserveMC > 0n) {
        const price = Number(reserveMC) / Number(reserveJBC);
        setJbcPrice(price.toFixed(6));
      } else {
        setJbcPrice('1.0');
      }
    } catch (err) {
      console.error('Failed to fetch JBC data:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'jbc') {
      fetchJbcData();
      const interval = setInterval(fetchJbcData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab, jbcContract, protocolContract, account, loading]);

  // Contract address validation
  const [contractAddressWarning, setContractAddressWarning] = useState(false);

  // Level Reward Pool Management
  const [levelRewardPool, setLevelRewardPool] = useState('0');

  // JBC Token Manager State
  const [protocolJbcBalance, setProtocolJbcBalance] = useState('0');
  const [jbcTotalSupply, setJbcTotalSupply] = useState('0');
  const [accountJbcBalance, setAccountJbcBalance] = useState('0');
  const [jbcPrice, setJbcPrice] = useState('0');
  const [jbcTransferAmount, setJbcTransferAmount] = useState('');
  const [jbcTransferTo, setJbcTransferTo] = useState('');
  const [jbcTransferType, setJbcTransferType] = useState<'toProtocol' | 'fromProtocol' | 'toAddress'>('toProtocol');
  
  // Admin Fund Protocol State
  const [fundProtocolJbcAmount, setFundProtocolJbcAmount] = useState('');
  const [fundProtocolMcAmount, setFundProtocolMcAmount] = useState('');
  const [protocolMcBalance, setProtocolMcBalance] = useState('0');

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
  
  // JBC Token Address Management
  const [currentJbcToken, setCurrentJbcToken] = useState<string>('');
  const [newJbcToken, setNewJbcToken] = useState<string>('');

  // Initialize Daily Burn Manager Contract
  useEffect(() => {
    if (signer || provider) {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.DAILY_BURN_MANAGER,
        DAILY_BURN_MANAGER_ABI,
        signer || provider
      );
      setBurnManagerContract(contract);
    } else {
      setBurnManagerContract(null);
    }
  }, [signer, provider]);

  // Fetch Daily Burn Manager Status
  const fetchBurnManagerStatus = async () => {
    if (!burnManagerContract) return;

    try {
      const [canBurnValue, nextBurn, lastBurn, amount, timeUntil, owner] = await Promise.all([
        burnManagerContract.canBurn().catch(() => false),
        burnManagerContract.nextBurnTime().catch(() => 0n),
        burnManagerContract.lastBurnTime().catch(() => 0n),
        burnManagerContract.getBurnAmount().catch(() => 0n),
        burnManagerContract.timeUntilNextBurn().catch(() => 0n),
        burnManagerContract.owner().catch(() => ethers.ZeroAddress),
      ]);

      setCanBurn(canBurnValue);
      setNextBurnTime(nextBurn);
      setLastBurnTime(lastBurn);
      setBurnAmount(amount);
      setTimeUntilNextBurn(timeUntil);
      setBurnManagerOwner(owner);

      if (account && owner) {
        setIsBurnManagerOwner(owner.toLowerCase() === account.toLowerCase());
      }
    } catch (error) {
      console.error('Failed to fetch burn manager status:', error);
    }
  };

  // Fetch burn manager status on mount and when contract changes
  useEffect(() => {
    if (burnManagerContract) {
      fetchBurnManagerStatus();
      // Refresh every 30 seconds
      const interval = setInterval(fetchBurnManagerStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [burnManagerContract, account]);

  // Execute Daily Burn
  const handleDailyBurn = async () => {
    if (!burnManagerContract || !canBurn) {
      toast.error('无法执行燃烧：当前不可用');
      return;
    }

    setLoading(true);
    try {
      const tx = await burnManagerContract.dailyBurn();
      toast.loading('执行每日燃烧中...', { id: 'daily-burn' });
      await tx.wait();
      toast.success('每日燃烧执行成功！', { id: 'daily-burn' });
      await fetchBurnManagerStatus();
    } catch (err: any) {
      toast.error(formatContractError(err), { id: 'daily-burn' });
    } finally {
      setLoading(false);
    }
  };

  // Emergency Pause
  const handleEmergencyPause = async () => {
    if (!burnManagerContract || !isBurnManagerOwner) {
      toast.error('无权限执行此操作');
      return;
    }

    setLoading(true);
    try {
      const tx = await burnManagerContract.emergencyPause();
      toast.loading('紧急暂停中...', { id: 'emergency-pause' });
      await tx.wait();
      toast.success('已紧急暂停燃烧功能', { id: 'emergency-pause' });
      await fetchBurnManagerStatus();
    } catch (err: any) {
      toast.error(formatContractError(err), { id: 'emergency-pause' });
    } finally {
      setLoading(false);
    }
  };

  // Resume Burn
  const handleResumeBurn = async () => {
    if (!burnManagerContract || !isBurnManagerOwner) {
      toast.error('无权限执行此操作');
      return;
    }

    setLoading(true);
    try {
      const tx = await burnManagerContract.resumeBurn();
      toast.loading('恢复燃烧功能中...', { id: 'resume-burn' });
      await tx.wait();
      toast.success('已恢复燃烧功能', { id: 'resume-burn' });
      await fetchBurnManagerStatus();
    } catch (err: any) {
      toast.error(formatContractError(err), { id: 'resume-burn' });
    } finally {
      setLoading(false);
    }
  };

  // Format time
  const formatTime = (seconds: bigint | null): string => {
    if (!seconds || seconds === 0n) return 'N/A';
    const totalSeconds = Number(seconds);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (days > 0) return `${days}天 ${hours}小时 ${minutes}分钟`;
    if (hours > 0) return `${hours}小时 ${minutes}分钟`;
    if (minutes > 0) return `${minutes}分钟 ${secs}秒`;
    return `${secs}秒`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: bigint | null): string => {
    if (!timestamp || timestamp === 0n) return '从未执行';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Execute Buyback and Burn
  const handleExecuteBuybackAndBurn = async () => {
    if (!protocolContract || !provider || !currentBuyback) {
      toast.error('无法执行回购：缺少必要信息');
      return;
    }

    if (!isBuybackWallet) {
      toast.error('只有回购钱包可以执行回购操作');
      return;
    }

    const balance = await provider.getBalance(currentBuyback);
    if (balance === 0n) {
      toast.error('回购钱包余额为 0，无法执行回购');
      return;
    }

    setLoading(true);
    try {
      toast.loading('执行回购销毁中...', { id: 'buyback-burn' });
      const tx = await protocolContract.executeBuybackAndBurn({ value: balance });
      await tx.wait();
      toast.success('回购销毁执行成功！', { id: 'buyback-burn' });
      
      // Refresh balance
      const newBalance = await provider.getBalance(currentBuyback);
      setBuybackWalletBalance(ethers.formatEther(newBalance));
      await refreshMcBalance();
    } catch (err: any) {
      console.error('Buyback and burn error:', err);
      toast.error(formatContractError(err), { id: 'buyback-burn' });
    } finally {
      setLoading(false);
    }
  };

  // Refresh buyback wallet balance
  const refreshBuybackBalance = async () => {
    if (!provider || !currentBuyback) return;
    try {
      const balance = await provider.getBalance(currentBuyback);
      setBuybackWalletBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error('Failed to refresh buyback balance:', err);
    }
  };

  useEffect(() => {
    if (protocolContract) {
      // Check if functions exist to avoid errors on old deployments if not fully updated
      // But we assume we updated the contract
      protocolContract.liquidityEnabled().then(setLiquidityEnabled).catch(console.error);
      protocolContract.redeemEnabled().then(setRedeemEnabled).catch(console.error);
      protocolContract.ticketFlexibilityDuration().then((d: any) => setTicketFlexibility((Number(d) / 3600).toString())).catch(console.error);

      // Fetch current JBC token address
      protocolContract.jbcToken().then((addr: string) => {
        setCurrentJbcToken(addr);
        setNewJbcToken(addr);
      }).catch(console.error);

      // Fetch current wallet addresses
      protocolContract.marketingWallet().then(setCurrentMarketing).catch(console.error);
      protocolContract.treasuryWallet().then(setCurrentTreasury).catch(console.error);
      protocolContract.lpInjectionWallet().then(setCurrentLp).catch(console.error);
      protocolContract.buybackWallet().then((wallet: string) => {
        setCurrentBuyback(wallet);
        // Check if current account is buyback wallet
        if (account && wallet) {
          setIsBuybackWallet(account.toLowerCase() === wallet.toLowerCase());
        }
        // Fetch buyback wallet balance
        if (provider && wallet) {
          provider.getBalance(wallet).then((balance: bigint) => {
            setBuybackWalletBalance(ethers.formatEther(balance));
          }).catch(console.error);
        }
      }).catch(console.error);

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

  const updateJbcToken = async () => {
    if (!protocolContract || !newJbcToken) return;
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newJbcToken)) {
      toast.error("无效的地址格式");
      return;
    }
    
    if (newJbcToken.toLowerCase() === currentJbcToken.toLowerCase()) {
      toast.error("新地址与当前地址相同");
      return;
    }
    
    setLoading(true);
    try {
      const tx = await protocolContract.setJbcToken(newJbcToken);
      await tx.wait();
      setCurrentJbcToken(newJbcToken);
      toast.success("JBC 代币地址更新成功");
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
    
    const total = Number(direct) + Number(level) + Number(marketing) + Number(buyback) + Number(lp) + Number(treasury);
    if (total !== 100) {
      toast.error(t.admin.totalMustBe100);
      return;
    }
    
    setLoading(true);
    try {
      const tx = await protocolContract.setDistributionConfig(
        Number(direct),
        Number(level), 
        Number(marketing),
        Number(buyback),
        Number(lp),
        Number(treasury)
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
      const tx = await protocolContract.setSwapTaxes(Number(buyTax), Number(sellTax));
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
      const tx = await protocolContract.setRedemptionFeePercent(Number(redeemFee));
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
    
    // Validate addresses
    if (!ethers.isAddress(marketingWallet) || !ethers.isAddress(treasuryWallet) || 
        !ethers.isAddress(lpWallet) || !ethers.isAddress(buybackWallet)) {
      toast.error(t.admin.invalidAddress);
      return;
    }
    
    setLoading(true);
    try {
      const tx = await protocolContract.setWallets(
        marketingWallet,
        treasuryWallet, 
        lpWallet,
        buybackWallet
      );
      await tx.wait();
      toast.success(t.admin.success);
      
      // Update current wallet displays
      setCurrentMarketing(marketingWallet);
      setCurrentTreasury(treasuryWallet);
      setCurrentLp(lpWallet);
      setCurrentBuyback(buybackWallet);
      
      // Clear input fields
      setMarketingWallet('');
      setTreasuryWallet('');
      setLpWallet('');
      setBuybackWallet('');
    } catch (err: any) {
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };



  const addLiquidity = async (tokenType: 'MC' | 'JBC') => {
    if (!isConnected || !protocolContract) {
        toast.error(t.admin.connectFirst);
        return;
    }

    // 检查是否是合约拥有者
    if (!isOwner) {
        toast.error('权限错误：只有合约拥有者可以添加流动性');
        return;
    }

    setLoading(true);
    try {
        if (tokenType === 'MC' && mcLiquidityAmount) {
            const amount = ethers.parseEther(mcLiquidityAmount);

            // 检查原生MC余额
            const currentMcBalance = mcBalance || 0n;
            console.log('Current MC balance:', ethers.formatEther(currentMcBalance));
            console.log('Required amount:', ethers.formatEther(amount));
            
            if (currentMcBalance < amount) {
                toast.error(`MC余额不足，需要 ${ethers.formatEther(amount)} MC`);
                return;
            }

            // 调用原生MC版本的addLiquidity - MC作为value发送
            toast.loading(t.admin.addingMc, { id: 'addLiq' });
            const tx = await protocolContract.addLiquidity(0, { value: amount });
            await tx.wait();
            toast.success(`${t.admin.addedMc} (${mcLiquidityAmount} MC)`, { id: 'addLiq' });
            setMcLiquidityAmount('');
            
            // 刷新原生MC余额
            await refreshMcBalance();
            
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
                const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, amount);
                await approveTx.wait();
                toast.success(t.admin.jbcApproved, { id: 'approve' });
            }

            // Step 2: Call protocol's addLiquidity function - JBC作为参数，MC为0
            toast.loading(t.admin.addingJbc, { id: 'addLiq' });
            const tx = await protocolContract.addLiquidity(amount, { value: 0 });
            await tx.wait();
            toast.success(`${t.admin.addedJbc} (${jbcLiquidityAmount} JBC)`, { id: 'addLiq' });
            setJbcLiquidityAmount('');
        }
    } catch (err: any) {
        console.error('Add liquidity error:', err);
        toast.dismiss('approve');
        toast.dismiss('addLiq');
        
        // 检查是否是权限错误
        let errorMessage = formatEnhancedContractError(err, t);
        if (err.data) {
            const decodedError = decodeContractError(err.data);
            if (decodedError === 'OwnableUnauthorizedAccount') {
                errorMessage = '权限错误：您不是合约拥有者，只有合约拥有者可以添加流动性';
            }
        } else if (err.message && (
            err.message.includes('OwnableUnauthorizedAccount') || 
            err.message.includes('caller is not the owner') ||
            err.message.includes('Ownable: caller is not the owner')
        )) {
            errorMessage = '权限错误：您不是合约拥有者，只有合约拥有者可以添加流动性';
        }
        
        toast.error(errorMessage, { duration: 5000 });
    } finally {
        setLoading(false);
    }
  };

  const removeLiquidity = async (tokenType: 'MC' | 'JBC') => {
    if (!protocolContract || !isConnected || !account) {
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
            // Use calculateLevel instead of getLevelByTeamCount
            const levelInfo = await protocolContract.calculateLevel(info.teamCount);
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
        const tx = await protocolContract.adminSetTeamCount(
            searchUserAddress,
            Number(newTeamCount)
        );
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

  const [newActiveDirects, setNewActiveDirects] = useState('');
  const updateActiveDirects = async () => {
    if (!protocolContract || !searchUserAddress) return;
    setLoading(true);
    try {
        const tx = await protocolContract.adminSetActiveDirects(
            searchUserAddress,
            Number(newActiveDirects)
        );
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

  // JBC Transfer Functions
  const transferJbcToProtocol = async () => {
    if (!jbcContract || !account || !jbcTransferAmount) {
      toast.error('请填写转账数量');
      return;
    }

    setLoading(true);
    try {
      const amount = ethers.parseEther(jbcTransferAmount);
      const balance = await jbcContract.balanceOf(account);
      
      if (balance < amount) {
        toast.error('JBC余额不足');
        return;
      }

      // Check allowance
      const allowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
      if (allowance < amount) {
        toast.loading('正在授权JBC...', { id: 'approve-jbc' });
        const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, amount);
        await approveTx.wait();
        toast.success('JBC授权成功', { id: 'approve-jbc' });
      }

      // Transfer to protocol
      toast.loading('正在转账JBC到协议合约...', { id: 'transfer-jbc' });
      const tx = await jbcContract.transfer(CONTRACT_ADDRESSES.PROTOCOL, amount);
      await tx.wait();
      toast.success(`成功转账 ${jbcTransferAmount} JBC 到协议合约`, { id: 'transfer-jbc' });
      
      setJbcTransferAmount('');
      await fetchJbcData();
    } catch (err: any) {
      toast.dismiss('approve-jbc');
      toast.dismiss('transfer-jbc');
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const transferJbcFromProtocol = async () => {
    if (!protocolContract || !jbcContract || !account || !jbcTransferAmount) {
      toast.error('请填写转账数量');
      return;
    }

    if (!window.confirm(`确认从协议合约提取 ${jbcTransferAmount} JBC 到您的地址？`)) {
      return;
    }

    setLoading(true);
    try {
      const amount = ethers.parseEther(jbcTransferAmount);
      const jbcTokenAddress = await jbcContract.getAddress();
      
      toast.loading('正在从协议合约提取JBC...', { id: 'rescue-jbc' });
      const tx = await protocolContract.rescueTokens(jbcTokenAddress, account, amount);
      await tx.wait();
      toast.success(`成功提取 ${jbcTransferAmount} JBC`, { id: 'rescue-jbc' });
      
      setJbcTransferAmount('');
      await fetchJbcData();
    } catch (err: any) {
      toast.dismiss('rescue-jbc');
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const transferJbcToAddress = async () => {
    if (!jbcContract || !account || !jbcTransferAmount || !jbcTransferTo) {
      toast.error('请填写转账数量和接收地址');
      return;
    }

    if (!ethers.isAddress(jbcTransferTo)) {
      toast.error('无效的接收地址');
      return;
    }

    if (!window.confirm(`确认转账 ${jbcTransferAmount} JBC 到 ${jbcTransferTo}？`)) {
      return;
    }

    setLoading(true);
    try {
      const amount = ethers.parseEther(jbcTransferAmount);
      const balance = await jbcContract.balanceOf(account);
      
      if (balance < amount) {
        toast.error('JBC余额不足');
        return;
      }

      toast.loading('正在转账JBC...', { id: 'transfer-jbc-addr' });
      const tx = await jbcContract.transfer(jbcTransferTo, amount);
      await tx.wait();
      toast.success(`成功转账 ${jbcTransferAmount} JBC`, { id: 'transfer-jbc-addr' });
      
      setJbcTransferAmount('');
      setJbcTransferTo('');
      await fetchJbcData();
    } catch (err: any) {
      toast.dismiss('transfer-jbc-addr');
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  // Fund Protocol Functions
  const fundProtocolWithJbc = async () => {
    if (!jbcContract || !account || !fundProtocolJbcAmount) {
      toast.error('请填写JBC数量', {
        duration: 3000,
        style: {
          background: '#1f2937',
          color: '#f87171',
          border: '1px solid #f87171',
        }
      });
      return;
    }

    setLoading(true);
    try {
      const amount = ethers.parseEther(fundProtocolJbcAmount);
      const balance = await jbcContract.balanceOf(account);
      
      if (balance < amount) {
        toast.error('JBC余额不足');
        return;
      }

      // Check allowance
      const allowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
      if (allowance < amount) {
        toast.loading('正在授权JBC...', { id: 'approve-jbc-fund' });
        const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, amount);
        await approveTx.wait();
        toast.success('JBC授权成功', { id: 'approve-jbc-fund' });
      }

      // Transfer to protocol
      toast.loading('正在向协议合约提供JBC...', { id: 'fund-jbc' });
      const tx = await jbcContract.transfer(CONTRACT_ADDRESSES.PROTOCOL, amount);
      await tx.wait();
      toast.success(`成功向协议提供 ${fundProtocolJbcAmount} JBC`, { id: 'fund-jbc' });
      
      setFundProtocolJbcAmount('');
      await fetchJbcData();
    } catch (err: any) {
      toast.dismiss('approve-jbc-fund');
      toast.dismiss('fund-jbc');
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const fundProtocolWithMc = async () => {
    if (!protocolContract || !account || !fundProtocolMcAmount || !mcBalance) {
      toast.error('请填写MC数量', {
        duration: 3000,
        style: {
          background: '#1f2937',
          color: '#f87171',
          border: '1px solid #f87171',
        }
      });
      return;
    }

    const amount = ethers.parseEther(fundProtocolMcAmount);
    if (mcBalance < amount) {
      toast.error(`MC余额不足，需要 ${fundProtocolMcAmount} MC`, {
        duration: 4000,
        style: {
          background: '#1f2937',
          color: '#f87171',
          border: '1px solid #f87171',
        }
      });
      return;
    }

    if (!window.confirm(`确认向协议合约提供 ${fundProtocolMcAmount} MC？\n\n这些资金将用于用户奖励分配。`)) {
      return;
    }

    setLoading(true);
    try {
      toast.loading('正在向协议合约提供MC...', { id: 'fund-mc' });
      // 直接转账原生MC到协议合约
      const tx = await signer?.sendTransaction({
        to: CONTRACT_ADDRESSES.PROTOCOL,
        value: amount
      });
      if (!tx) {
        toast.error('交易创建失败');
        return;
      }
      await tx.wait();
      toast.success(`成功向协议提供 ${fundProtocolMcAmount} MC`, { id: 'fund-mc' });
      
      setFundProtocolMcAmount('');
      await refreshMcBalance();
      await fetchJbcData();
    } catch (err: any) {
      toast.dismiss('fund-mc');
      toast.error(formatContractError(err));
    } finally {
      setLoading(false);
    }
  };

  const withdrawAll = async (tokenType: 'MC' | 'JBC') => {
      if (!protocolContract || !jbcContract) return;
      if (!window.confirm(t.admin.confirmWithdraw)) return;
      
      setLoading(true);
      try {
          // 1. Withdraw Swap Reserves first (for accounting)
          const reserveMC = await protocolContract.swapReserveMC();
          const reserveJBC = await protocolContract.swapReserveJBC();
          
          if (reserveMC > 0 || reserveJBC > 0) {
             const tx1 = await protocolContract.withdrawSwapReserves(
                 account, 
                 reserveMC, 
                 account, 
                 reserveJBC
             );
             await tx1.wait();
          }
          
          // 2. Rescue remaining tokens
          if (tokenType === 'JBC') {
              const balance = await jbcContract.balanceOf(CONTRACT_ADDRESSES.PROTOCOL);
              
              if (balance > 0) {
                  const tx2 = await protocolContract.rescueTokens(await jbcContract.getAddress(), account, balance);
                  await tx2.wait();
              }
          } else if (tokenType === 'MC') {
              // For native MC, we need to rescue any remaining native balance in the contract
              // This would be done through a special function if available, or manual withdrawal
              const contractBalance = await provider.getBalance(CONTRACT_ADDRESSES.PROTOCOL);
              
              if (contractBalance > 0) {
                  // Note: This requires a special function in the contract to withdraw native MC
                  // For now, we'll show a message that manual intervention is needed
                  toast.warning('原生MC提取需要特殊处理，请联系技术支持');
              }
          }
          
          toast.success(t.admin.withdrawSuccess);
          
          // 刷新原生MC余额
          if (tokenType === 'MC') {
              await refreshMcBalance();
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
          <button
            onClick={() => setActiveTab('levels')}
            className={`px-6 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'levels'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Crown className="inline mr-2" size={16} />
            等级系统
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'settings'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Settings className="inline mr-2" size={16} />
            通知设置
          </button>
          <button
            onClick={() => setActiveTab('burn')}
            className={`px-6 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'burn'
                ? 'bg-red-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Flame className="inline mr-2" size={16} />
            每日燃烧
          </button>
          <button
            onClick={() => setActiveTab('jbc')}
            className={`px-6 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'jbc'
                ? 'bg-yellow-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Coins className="inline mr-2" size={16} />
            JBC管理
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
      ) : activeTab === 'levels' ? (
        <div className="space-y-6">
          {/* 等级系统说明 */}
          <LevelSystemInfo />
          
          {/* 当前管理员等级显示 */}
          {isConnected && account && (
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-bold text-white mb-4 text-center">管理员等级状态</h3>
              <AdminLevelDisplay account={account} />
            </div>
          )}
        </div>
      ) : activeTab === 'settings' ? (
        <div className="space-y-6">
          <NotificationSettings />
        </div>
      ) : activeTab === 'burn' ? (
        <div className="space-y-6">
          {/* Daily Burn Manager Panel */}
          <div className="glass-panel p-6 md:p-8 rounded-xl md:rounded-2xl bg-gradient-to-br from-red-900/30 to-orange-800/30 border-2 border-red-500/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/30">
                <Flame className="text-red-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-white">每日燃烧管理</h3>
                <p className="text-sm text-gray-400">管理 JBC 代币的每日自动燃烧功能</p>
              </div>
            </div>

            {/* Contract Info */}
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">合约地址</p>
              <p className="text-sm font-mono text-white break-all">{CONTRACT_ADDRESSES.DAILY_BURN_MANAGER}</p>
              {burnManagerOwner && (
                <>
                  <p className="text-xs text-gray-400 mt-3 mb-1">合约所有者</p>
                  <p className="text-sm font-mono text-white break-all">{burnManagerOwner}</p>
                </>
              )}
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Can Burn Status */}
              <div className={`p-4 rounded-lg border-2 ${canBurn ? 'bg-green-900/30 border-green-500/50' : 'bg-gray-800/50 border-gray-700'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">燃烧状态</span>
                  {canBurn ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-gray-400" size={20} />
                  )}
                </div>
                <p className={`text-lg font-bold ${canBurn ? 'text-green-400' : 'text-gray-400'}`}>
                  {canBurn ? '可以执行燃烧' : '暂不可执行'}
                </p>
              </div>

              {/* Burn Amount */}
              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">燃烧数量</span>
                  <Flame className="text-orange-400" size={20} />
                </div>
                <p className="text-lg font-bold text-orange-400">
                  {burnAmount ? ethers.formatEther(burnAmount) : '0'} JBC
                </p>
              </div>
            </div>

            {/* Time Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Next Burn Time */}
              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                <p className="text-sm text-gray-300 mb-2">下次燃烧时间</p>
                <p className="text-base font-mono text-white">
                  {nextBurnTime ? formatTimestamp(nextBurnTime) : 'N/A'}
                </p>
                {timeUntilNextBurn !== null && timeUntilNextBurn > 0n && (
                  <p className="text-xs text-gray-400 mt-2">
                    剩余时间: {formatTime(timeUntilNextBurn)}
                  </p>
                )}
              </div>

              {/* Last Burn Time */}
              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                <p className="text-sm text-gray-300 mb-2">最后燃烧时间</p>
                <p className="text-base font-mono text-white">
                  {lastBurnTime ? formatTimestamp(lastBurnTime) : '从未执行'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              {/* Execute Daily Burn */}
              <button
                onClick={handleDailyBurn}
                disabled={loading || !canBurn || !isBurnManagerOwner}
                className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all ${
                  canBurn && isBurnManagerOwner
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-lg shadow-red-500/30'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Flame className="inline mr-2" size={18} />
                {loading ? '执行中...' : '执行每日燃烧'}
              </button>

              {/* Emergency Controls */}
              {isBurnManagerOwner && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleEmergencyPause}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-lg font-bold text-white bg-red-700 hover:bg-red-600 disabled:opacity-50 transition-all border border-red-500"
                  >
                    <AlertTriangle className="inline mr-2" size={18} />
                    紧急暂停
                  </button>
                  <button
                    onClick={handleResumeBurn}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-lg font-bold text-white bg-green-700 hover:bg-green-600 disabled:opacity-50 transition-all border border-green-500"
                  >
                    <CheckCircle className="inline mr-2" size={18} />
                    恢复燃烧
                  </button>
                </div>
              )}

              {/* Permission Warning */}
              {!isBurnManagerOwner && account && (
                <div className="p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="text-yellow-400 mt-0.5" size={20} />
                    <div>
                      <p className="text-yellow-400 font-bold text-sm">权限提示</p>
                      <p className="text-yellow-200/80 text-xs mt-1">
                        当前地址不是燃烧管理合约的所有者，无法执行燃烧操作。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Refresh Button */}
              <button
                onClick={fetchBurnManagerStatus}
                disabled={loading || !burnManagerContract}
                className="w-full py-2 px-4 rounded-lg font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition-all border border-gray-700"
              >
                刷新状态
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'jbc' ? (
        <div className="space-y-6">
          {/* JBC Token Manager Panel */}
          <div className="glass-panel p-6 md:p-8 rounded-xl md:rounded-2xl bg-gradient-to-br from-yellow-900/30 to-amber-800/30 border-2 border-yellow-500/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                <Coins className="text-yellow-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-white">JBC 代币管理</h3>
                <p className="text-sm text-gray-400">管理 JBC 代币余额和转账</p>
              </div>
            </div>

            {/* Contract Addresses Display */}
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                <Settings className="text-gray-400" size={16} />
                合约地址信息
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-400 font-medium">协议合约:</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <code className="text-white font-mono break-all text-right">
                      {CONTRACT_ADDRESSES.PROTOCOL}
                    </code>
                    <a
                      href={`https://mcerscan.com/address/${CONTRACT_ADDRESSES.PROTOCOL}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      title="在区块浏览器中查看"
                    >
                      🔗
                    </a>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-400 font-medium">JBC 代币:</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <code className="text-white font-mono break-all text-right">
                      {CONTRACT_ADDRESSES.JBC_TOKEN}
                    </code>
                    <a
                      href={`https://mcerscan.com/address/${CONTRACT_ADDRESSES.JBC_TOKEN}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      title="在区块浏览器中查看"
                    >
                      🔗
                    </a>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-400 font-medium">燃烧管理:</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <code className="text-white font-mono break-all text-right">
                      {CONTRACT_ADDRESSES.DAILY_BURN_MANAGER}
                    </code>
                    <a
                      href={`https://mcerscan.com/address/${CONTRACT_ADDRESSES.DAILY_BURN_MANAGER}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      title="在区块浏览器中查看"
                    >
                      🔗
                    </a>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500">
                    <span className="text-xs">网络:</span>
                    <span className="text-xs font-bold text-gray-400">MC Chain (88813)</span>
                    <span className="text-xs">|</span>
                    <a
                      href="https://mcerscan.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      区块浏览器
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Balance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Protocol Balance */}
              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">协议合约余额</span>
                  <Coins className="text-yellow-400" size={20} />
                </div>
                <p className="text-lg font-bold text-yellow-400">
                  {parseFloat(protocolJbcBalance).toLocaleString('en-US', { maximumFractionDigits: 2 })} JBC
                </p>
                {parseFloat(protocolJbcBalance) < 1000000 && (
                  <p className="text-xs text-red-400 mt-1">⚠️ 余额偏低</p>
                )}
              </div>

              {/* Total Supply */}
              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">总供应量</span>
                  <Coins className="text-blue-400" size={20} />
                </div>
                <p className="text-lg font-bold text-blue-400">
                  {parseFloat(jbcTotalSupply).toLocaleString('en-US', { maximumFractionDigits: 2 })} JBC
                </p>
              </div>

              {/* Account Balance */}
              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">当前账户余额</span>
                  <Coins className="text-green-400" size={20} />
                </div>
                <p className="text-lg font-bold text-green-400">
                  {parseFloat(accountJbcBalance).toLocaleString('en-US', { maximumFractionDigits: 2 })} JBC
                </p>
              </div>

              {/* JBC Price */}
              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">JBC 价格</span>
                  <Coins className="text-purple-400" size={20} />
                </div>
                <p className="text-lg font-bold text-purple-400">
                  {jbcPrice} MC
                </p>
                <p className="text-xs text-gray-400 mt-1">基于交换储备池</p>
              </div>
            </div>

            {/* Warning Alert */}
            {parseFloat(protocolJbcBalance) < 1000000 && (
              <div className="mb-6 p-4 bg-red-900/30 border-l-4 border-red-500 rounded-r">
                <div className="flex items-start">
                  <AlertTriangle className="text-red-400 mt-0.5 mr-3 flex-shrink-0" size={20} />
                  <div>
                    <h3 className="text-red-400 font-bold text-base">JBC 余额警告</h3>
                    <p className="text-red-200/80 text-sm mt-1">
                      协议合约 JBC 余额低于 100 万，可能影响奖励分配。建议及时补充。
                    </p>
                    <div className="mt-2 p-2 bg-black/40 rounded border border-red-500/20">
                      <p className="text-gray-400 text-xs">
                        当前余额: <span className="text-white font-bold">{parseFloat(protocolJbcBalance).toLocaleString('en-US', { maximumFractionDigits: 2 })} JBC</span>
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        建议余额: <span className="text-white">1,000,000+ JBC</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Section */}
            <div className="space-y-6">
              <h4 className="text-lg font-bold text-white border-b border-gray-700 pb-2">JBC 转账管理</h4>
              
              {/* Transfer Type Selection */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setJbcTransferType('toProtocol')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    jbcTransferType === 'toProtocol'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  转入协议
                </button>
                <button
                  onClick={() => setJbcTransferType('fromProtocol')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    jbcTransferType === 'fromProtocol'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  从协议提取
                </button>
                <button
                  onClick={() => setJbcTransferType('toAddress')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    jbcTransferType === 'toAddress'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  转账到地址
                </button>
              </div>

              {/* Transfer Form */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 space-y-4">
                {jbcTransferType === 'toAddress' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">接收地址</label>
                    <input
                      type="text"
                      value={jbcTransferTo}
                      onChange={(e) => setJbcTransferTo(e.target.value)}
                      className="w-full p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm font-mono placeholder-gray-600"
                      placeholder="0x..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">转账数量 (JBC)</label>
                  <input
                    type="number"
                    value={jbcTransferAmount}
                    onChange={(e) => setJbcTransferAmount(e.target.value)}
                    className="w-full p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm placeholder-gray-600"
                    placeholder="0.0"
                  />
                </div>

                <button
                  onClick={() => {
                    if (jbcTransferType === 'toProtocol') {
                      transferJbcToProtocol();
                    } else if (jbcTransferType === 'fromProtocol') {
                      transferJbcFromProtocol();
                    } else {
                      transferJbcToAddress();
                    }
                  }}
                  disabled={loading || !jbcTransferAmount || (jbcTransferType === 'toAddress' && !jbcTransferTo)}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all ${
                    loading || !jbcTransferAmount || (jbcTransferType === 'toAddress' && !jbcTransferTo)
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 shadow-lg shadow-yellow-500/30'
                  }`}
                >
                  {loading ? '处理中...' : 
                   jbcTransferType === 'toProtocol' ? '转入协议合约' :
                   jbcTransferType === 'fromProtocol' ? '从协议合约提取' :
                   '转账到地址'}
                </button>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                <h5 className="text-sm font-bold text-gray-300 mb-2">说明</h5>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• <strong>转入协议</strong>: 将您的 JBC 转入协议合约，用于奖励分配</li>
                  <li>• <strong>从协议提取</strong>: 从协议合约提取 JBC 到您的地址（需要管理员权限）</li>
                  <li>• <strong>转账到地址</strong>: 将您的 JBC 转账到任意地址</li>
                  <li>• 协议合约余额建议保持在 100 万 JBC 以上以确保正常奖励分配</li>
                </ul>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchJbcData}
                disabled={loading || !jbcContract}
                className="w-full py-2 px-4 rounded-lg font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition-all border border-gray-700"
              >
                刷新数据
              </button>
            </div>

            {/* Admin Fund Protocol Section */}
            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30">
                  <Coins className="text-green-400" size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">为协议提供资金</h4>
                  <p className="text-sm text-gray-400">管理员向协议合约提供 JBC 和 MC，用于奖励分配</p>
                </div>
              </div>

              {/* Protocol Balance Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">协议 MC 余额</span>
                    <Coins className="text-blue-400" size={20} />
                  </div>
                  <p className="text-lg font-bold text-blue-400">
                    {parseFloat(protocolMcBalance).toLocaleString('en-US', { maximumFractionDigits: 2 })} MC
                  </p>
                </div>
                <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">协议 JBC 余额</span>
                    <Coins className="text-yellow-400" size={20} />
                  </div>
                  <p className="text-lg font-bold text-yellow-400">
                    {parseFloat(protocolJbcBalance).toLocaleString('en-US', { maximumFractionDigits: 2 })} JBC
                  </p>
                </div>
              </div>

              {/* Fund Protocol Form */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 space-y-4">
                {/* Fund JBC */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    提供 JBC 到协议合约
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={fundProtocolJbcAmount}
                      onChange={(e) => setFundProtocolJbcAmount(e.target.value)}
                      className="flex-1 p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm placeholder-gray-600"
                      placeholder="JBC 数量"
                    />
                    <button
                      onClick={fundProtocolWithJbc}
                      disabled={loading || !fundProtocolJbcAmount}
                      className={`px-6 py-2 rounded-lg font-bold text-white transition-all ${
                        loading || !fundProtocolJbcAmount
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 shadow-lg shadow-yellow-500/30'
                      }`}
                    >
                      {loading ? '处理中...' : '提供 JBC'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    当前账户余额: {parseFloat(accountJbcBalance).toLocaleString('en-US', { maximumFractionDigits: 2 })} JBC
                  </p>
                </div>

                {/* Fund MC */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    提供 MC 到协议合约
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={fundProtocolMcAmount}
                      onChange={(e) => setFundProtocolMcAmount(e.target.value)}
                      className="flex-1 p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm placeholder-gray-600"
                      placeholder="MC 数量"
                    />
                    <button
                      onClick={fundProtocolWithMc}
                      disabled={loading || !fundProtocolMcAmount}
                      className={`px-6 py-2 rounded-lg font-bold text-white transition-all ${
                        loading || !fundProtocolMcAmount
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/30'
                      }`}
                    >
                      {loading ? '处理中...' : '提供 MC'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    当前账户余额: {mcBalance ? parseFloat(ethers.formatEther(mcBalance)).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'} MC
                  </p>
                </div>

                {/* Info */}
                <div className="bg-green-900/20 rounded-lg p-3 border border-green-500/30">
                  <p className="text-xs text-green-300">
                    <strong>说明：</strong>这些资金将直接转入协议合约，用于用户奖励分配（50% MC + 50% JBC）。请确保协议有足够的余额以支持奖励分配。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                        <label className="block text-sm font-medium text-gray-300 mb-2">活跃直推数量 (Active Directs)</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={newActiveDirects} 
                                onChange={e => setNewActiveDirects(e.target.value)} 
                                className="w-24 p-2 border border-gray-700 bg-gray-900/50 rounded text-white text-sm" 
                            />
                            <button 
                                onClick={updateActiveDirects} 
                                disabled={loading} 
                                className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 disabled:opacity-50 text-sm font-bold"
                            >
                                {t.admin.update}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">影响层级奖励 (1个=5层, 2个=10层, 3+=15层)</p>
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

      {/* JBC Token Address Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-amber-500/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <AlertTriangle className="text-amber-400" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-white">JBC 代币地址管理</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-4">⚠️ 警告：更改 JBC 代币地址会影响所有使用该代币的功能，请谨慎操作！</p>
          
          <div className="space-y-3 md:space-y-4">
              <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs md:text-sm text-gray-400">当前 JBC 代币地址</label>
                    <span className="text-xs font-mono text-gray-500" title={currentJbcToken}>
                        {currentJbcToken ? `${currentJbcToken.substring(0,6)}...${currentJbcToken.substring(currentJbcToken.length-4)}` : '加载中...'}
                    </span>
                  </div>
                  <input 
                      type="text" 
                      value={currentJbcToken} 
                      disabled
                      className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-800/50 rounded text-gray-400 text-xs md:text-sm font-mono cursor-not-allowed" 
                      placeholder="0x..."
                  />
              </div>
              <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs md:text-sm text-gray-400">新 JBC 代币地址</label>
                  </div>
                  <input 
                      type="text" 
                      value={newJbcToken} 
                      onChange={e => setNewJbcToken(e.target.value)} 
                      className="w-full p-2 md:p-2.5 border border-gray-700 bg-gray-900/50 rounded text-white text-xs md:text-sm font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50" 
                      placeholder="0x1Bf9ACe2485BC3391150762a109886d0B85f40Da"
                  />
              </div>
              <button 
                  onClick={updateJbcToken} 
                  disabled={loading || !newJbcToken || newJbcToken.toLowerCase() === currentJbcToken.toLowerCase()}
                  className="w-full py-2 md:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg disabled:opacity-50 text-sm md:text-base shadow-lg shadow-amber-500/30"
              >
                  {loading ? '更新中...' : '更新 JBC 代币地址'}
              </button>
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

      {/* Buyback Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gradient-to-br from-orange-900/30 to-red-800/30 border-2 border-orange-500/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg border border-orange-500/30">
                  <Flame className="text-orange-400" size={24} />
              </div>
              <div>
                  <h3 className="text-xl md:text-2xl font-bold text-white">回购管理</h3>
                  <p className="text-sm text-gray-400">管理回购钱包和执行回购销毁</p>
              </div>
          </div>

          {/* Buyback Wallet Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">回购钱包地址</span>
                      <Coins className="text-orange-400" size={20} />
                  </div>
                  <p className="text-sm font-mono text-orange-400 break-all">
                      {currentBuyback || '加载中...'}
                  </p>
              </div>

              <div className="p-4 rounded-lg border-2 bg-gray-800/50 border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">回购钱包余额</span>
                      <Coins className="text-red-400" size={20} />
                  </div>
                  <p className="text-lg font-bold text-red-400">
                      {parseFloat(buybackWalletBalance).toLocaleString('en-US', { maximumFractionDigits: 4 })} MC
                  </p>
                  <button
                      onClick={refreshBuybackBalance}
                      className="mt-2 text-xs text-gray-400 hover:text-gray-300 underline"
                  >
                      刷新余额
                  </button>
              </div>
          </div>

          {/* Permission Warning */}
          {!isBuybackWallet && account && (
              <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                  <div className="flex items-start gap-2">
                      <AlertTriangle className="text-yellow-400 mt-0.5" size={20} />
                      <div>
                          <p className="text-yellow-400 font-bold text-sm">权限提示</p>
                          <p className="text-yellow-200/80 text-xs mt-1">
                              当前地址不是回购钱包，无法执行回购操作。
                          </p>
                          <p className="text-yellow-200/80 text-xs mt-1">
                              回购钱包地址: <span className="font-mono">{currentBuyback}</span>
                          </p>
                      </div>
                  </div>
              </div>
          )}

          {/* Execute Buyback Button */}
          <div className="space-y-4">
              <button
                  onClick={handleExecuteBuybackAndBurn}
                  disabled={loading || !isBuybackWallet || parseFloat(buybackWalletBalance) === 0}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all ${
                      loading || !isBuybackWallet || parseFloat(buybackWalletBalance) === 0
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 shadow-lg shadow-orange-500/30'
                  }`}
              >
                  {loading ? '执行中...' : `执行回购销毁 (${parseFloat(buybackWalletBalance).toLocaleString('en-US', { maximumFractionDigits: 4 })} MC)`}
              </button>

              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="text-xs text-gray-400">
                      <strong className="text-gray-300">说明：</strong>
                      <br />
                      • 回购钱包会接收门票购买金额的 5% 作为回购资金
                      <br />
                      • 点击"执行回购销毁"会将回购钱包中的所有 MC 用于购买并销毁 JBC
                      <br />
                      • 只有回购钱包地址可以执行此操作
                  </p>
              </div>
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
