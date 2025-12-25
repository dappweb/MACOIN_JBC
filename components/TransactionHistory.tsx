import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../Web3Context';
import { useLanguage } from '../LanguageContext';
import { FileText,X,Copy, ExternalLink, Filter, RefreshCw, Clock, TrendingUp, TrendingDown,ChevronRight, Package, Lock, Gift, Unlock } from 'lucide-react';
import { ethers } from 'ethers';

interface Transaction {
  hash: string;
  user: string; // Add user address field
  type: 'ticket_purchased' | 'liquidity_staked' | 'reward_claimed' | 'redeemed' | 'swap_mc_to_jbc' | 'swap_jbc_to_mc';
  amount: string;
  amount2?: string; // For rewards (MC + JBC) or swap tax
  amount3?: string; // For JBC amount in LiquidityStaked
  blockNumber: number;
  timestamp: number;
  status: 'confirmed' | 'pending';
}

const TransactionHistory: React.FC = () => {
  const { protocolContract, jbcContract, account, provider } = useWeb3();
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [viewMode, setViewMode] = useState<'self' | 'all'>('self');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [copied, setCopied] = useState(false);

  const eventTypeMap = {
    'TicketPurchased': 'ticket_purchased',
    'LiquidityStaked': 'liquidity_staked',
    'RewardClaimed': 'reward_claimed',
    'Redeemed': 'redeemed',
    'SwappedMCToJBC': 'swap_mc_to_jbc',
    'SwappedJBCToMC': 'swap_jbc_to_mc'
  };

  // Check if current user is owner
  useEffect(() => {
    const checkOwner = async () => {
      if (protocolContract && account) {
        try {
          const owner = await protocolContract.owner();
          const isOwnerAccount = owner.toLowerCase() === account.toLowerCase();
          setIsOwner(isOwnerAccount);
          // If user is owner, default to viewing all transactions
          if (isOwnerAccount) {
            setViewMode('all');
          }
        } catch (e) {
          console.error("Failed to check owner", e);
          setIsOwner(false);
        }
      }
    };
    checkOwner();
  }, [protocolContract, account]);

  const fetchTransactions = async () => {
    if (!protocolContract || !account || !provider) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000); // Last ~100k blocks

      // Determine which user to query
      const targetUser = (isOwner && viewMode === 'all') ? null : account;

      // Query all relevant events
      // If targetUser is null (admin viewing all), don't filter by user address
      const events = await Promise.all([
        protocolContract.queryFilter(protocolContract.filters.TicketPurchased(targetUser), fromBlock),
        protocolContract.queryFilter(protocolContract.filters.LiquidityStaked(targetUser), fromBlock),
        protocolContract.queryFilter(protocolContract.filters.RewardPaid(targetUser), fromBlock),
        protocolContract.queryFilter(protocolContract.filters.Redeemed(targetUser), fromBlock),
        protocolContract.queryFilter(protocolContract.filters.SwappedMCToJBC(targetUser), fromBlock),
        protocolContract.queryFilter(protocolContract.filters.SwappedJBCToMC(targetUser), fromBlock)
      ]);

      const allEvents = events.flat();

      // Parse events into transactions
      const txs: Transaction[] = [];

      for (const event of allEvents) {
        try {
          const block = await provider.getBlock(event.blockNumber);
          const eventName = event.fragment?.name || event.eventName;

          if (!eventName || !eventTypeMap[eventName as keyof typeof eventTypeMap]) {
            console.warn('Unknown event type:', eventName);
            continue;
          }

          let tx: Transaction = {
            hash: event.transactionHash,
            user: event.args ? event.args[0] : '', // First arg is always the user address
            type: eventTypeMap[eventName as keyof typeof eventTypeMap] as Transaction['type'],
            amount: '0',
            blockNumber: event.blockNumber,
            timestamp: block ? block.timestamp : 0,
            status: 'confirmed'
          };

          // Parse event data based on type (args are 0-indexed: [user, amount, ...])
          if (eventName === 'TicketPurchased' && event.args) {
            tx.amount = ethers.formatEther(event.args[1]); // amount
          } else if (eventName === 'LiquidityStaked' && event.args) {
            tx.amount = ethers.formatEther(event.args[1]); // amount
            tx.amount2 = event.args[2].toString(); // cycleDays
            // Try to read jbcAmount if it exists (args[3])
            if (event.args.length > 3) {
                tx.amount3 = ethers.formatEther(event.args[3]);
            }
          } else if (eventName === 'RewardClaimed' && event.args) {
            tx.amount = ethers.formatEther(event.args[1]); // mcAmount
            tx.amount2 = ethers.formatEther(event.args[2]); // jbcAmount
          } else if (eventName === 'Redeemed' && event.args) {
            tx.amount = ethers.formatEther(event.args[1]); // principal
            tx.amount2 = ethers.formatEther(event.args[2]); // fee
          } else if (eventName === 'SwappedMCToJBC' && event.args) {
            tx.amount = ethers.formatEther(event.args[1]); // mcAmount
            tx.amount2 = ethers.formatEther(event.args[2]); // jbcAmount (received)
          } else if (eventName === 'SwappedJBCToMC' && event.args) {
            tx.amount = ethers.formatEther(event.args[1]); // jbcAmount
            tx.amount2 = ethers.formatEther(event.args[2]); // mcAmount (received)
          }

          txs.push(tx);
        } catch (err) {
          console.error('Error parsing event:', err, event);
        }
      }

      // Sort by timestamp (newest first)
      txs.sort((a, b) => b.timestamp - a.timestamp);

      setTransactions(txs);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [protocolContract, account, viewMode, isOwner]);

  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'ticket_purchased': return <Package className="w-5 h-5 text-blue-500" />;
      case 'liquidity_staked': return <Lock className="w-5 h-5 text-purple-500" />;
      case 'reward_claimed': return <Gift className="w-5 h-5 text-green-500" />;
      case 'redeemed': return <Unlock className="w-5 h-5 text-amber-500" />;
      case 'swap_mc_to_jbc': return <TrendingUp className="w-5 h-5 text-emerald-500" />;
      case 'swap_jbc_to_mc': return <TrendingDown className="w-5 h-5 text-red-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeName = (type: Transaction['type']) => {
    return t.history[type] || type;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getAmountDisplay = (tx: Transaction, isCompact = false) => {
    if (tx.type === 'reward_claimed') {
      return (
        <>
          <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
            {!isCompact && `${t.history.mcReward}: `}
            <span className="font-semibold text-neon-400">{parseFloat(tx.amount).toFixed(2)} MC</span>
          </p>
          <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
            {!isCompact && `${t.history.jbcReward}: `}
            <span className="font-semibold text-amber-400">{parseFloat(tx.amount2 || '0').toFixed(2)} JBC</span>
          </p>
        </>
      );
    } else if (tx.type === 'liquidity_staked') {
      return (
        <>
          <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
            {!isCompact && `${t.history.amount}: `}
            <span className="font-semibold text-neon-400">{parseFloat(tx.amount).toFixed(2)} MC</span>
          </p>
          {tx.amount3 && parseFloat(tx.amount3) > 0 && (
            <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
               {!isCompact && `${t.history.jbcQuantity || "JBC Quantity"}: `}
               <span className="font-semibold text-amber-400">{parseFloat(tx.amount3).toFixed(2)} JBC</span>
            </p>
          )}
          {!isCompact && (
            <p className="text-sm text-gray-400">
              {t.history.cycle}: <span className="font-semibold text-amber-400">{tx.amount2} {t.mining.days}</span>
            </p>
          )}
        </>
      );
    } else if (tx.type === 'swap_mc_to_jbc') {
      return (
        <>
          <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
            {!isCompact && `${t.history.paid}: `}
            <span className="font-semibold text-red-400">-{parseFloat(tx.amount).toFixed(2)} MC</span>
          </p>
          <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
            {!isCompact && `${t.history.received}: `}
            <span className="font-semibold text-neon-400">+{parseFloat(tx.amount2 || '0').toFixed(2)} JBC</span>
          </p>
        </>
      );
    } else if (tx.type === 'swap_jbc_to_mc') {
      return (
        <>
          <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
            {!isCompact && `${t.history.paid}: `}
            <span className="font-semibold text-red-400">-{parseFloat(tx.amount).toFixed(2)} JBC</span>
          </p>
          <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
            {!isCompact && `${t.history.received}: `}
            <span className="font-semibold text-neon-400">+{parseFloat(tx.amount2 || '0').toFixed(2)} MC</span>
          </p>
        </>
      );
    } else {
      return (
        <p className={`text-sm ${isCompact ? 'text-right' : 'text-gray-400'}`}>
          {!isCompact && `${t.history.amount}: `}
          <span className="font-semibold text-neon-400">{parseFloat(tx.amount).toFixed(2)} MC</span>
        </p>
      );
    }
  };

  const filteredTransactions = filterType === 'all'
    ? transactions
    : transactions.filter(tx => tx.type === filterType);

  const explorerUrl = 'https://sepolia.etherscan.io'; // Change based on network

  if (!account) {
    return (
      <div className="max-w-6xl mx-auto mt-8">
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl shadow-lg p-8 text-center backdrop-blur-sm">
          <FileText className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">{t.history.connectWallet}</h3>
          <p className="text-gray-400">{t.history.connectWalletDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-neon-500 to-neon-600 rounded-2xl shadow-xl shadow-neon-500/30 p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-black" />
            <div>
              <h2 className="text-2xl font-bold text-black">{t.history.title}</h2>
              <p className="text-black/80">{t.history.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={() => setViewMode('self')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'self'
                      ? 'bg-black text-neon-400'
                      : 'bg-black/20 text-black hover:bg-black/30'
                  }`}
                >
                  {t.history.mySelf || '我的记录'}
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-black text-neon-400'
                      : 'bg-black/20 text-black hover:bg-black/30'
                  }`}
                >
                  {t.history.allUsers || '所有用户'}
                </button>
              </div>
            )}
            <button
              onClick={fetchTransactions}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-black/30 rounded-lg text-black transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {t.history.refresh}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl shadow-md p-4 mb-6 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2 no-scrollbar">
          <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              filterType === 'all'
                ? 'bg-neon-500/20 text-neon-400 border border-neon-500/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300 border border-gray-700'
            }`}
          >
            {t.history.all}
          </button>
          {Object.entries(eventTypeMap).map(([key, value]) => (
            <button
              key={value}
              onClick={() => setFilterType(value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                filterType === value
                  ? 'bg-neon-500/20 text-neon-400 border border-neon-500/30'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300 border border-gray-700'
              }`}
            >
              {t.history[value]}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl shadow-md p-12 text-center backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-neon-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">{t.history.loading}</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl shadow-md p-12 text-center backdrop-blur-sm">
          <FileText className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">{t.history.noTransactions}</h3>
          <p className="text-gray-400">{t.history.noTransactionsDesc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx, index) => (
            <div
              key={`${tx.hash}-${index}`}
              onClick={() => setSelectedTx(tx)}
              className="bg-gray-900/50 border border-gray-800 rounded-xl shadow-md hover:shadow-lg hover:shadow-neon-500/20 transition-all cursor-pointer backdrop-blur-sm"
            >
              {/* Desktop View */}
              <div className="hidden md:block p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getTypeIcon(tx.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold text-white">{getTypeName(tx.type)}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          tx.status === 'confirmed'
                            ? 'bg-neon-500/20 text-neon-400 border border-neon-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {tx.status === 'confirmed' ? t.history.confirmed : t.history.pending}
                        </span>
                        {/* Show user address for admin viewing all */}
                        {isOwner && viewMode === 'all' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-gray-800 text-gray-300 border border-gray-700">
                            {tx.user.slice(0, 6)}...{tx.user.slice(-4)}
                          </span>
                        )}
                      </div>

                      {/* Amount Display */}
                      <div className="space-y-1 mb-2">
                        {getAmountDisplay(tx, false)}
                      </div>

                      {/* Time and Block */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(tx.timestamp)}
                        </div>
                        <div>
                          {t.history.block}: {tx.blockNumber}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Hash */}
                  <div className="flex flex-col items-end gap-2">
                    <a
                      href={`${explorerUrl}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-mono text-gray-300 transition-colors"
                    >
                      {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Mobile Compact View */}
              <div className="md:hidden p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-800 rounded-lg">
                      {getTypeIcon(tx.type)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{getTypeName(tx.type)}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span>{formatDate(tx.timestamp).split(' ')[0]}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          tx.status === 'confirmed' ? 'bg-neon-500/10 text-neon-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {tx.status === 'confirmed' ? t.history.confirmed : t.history.pending}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="space-y-0.5">
                      {getAmountDisplay(tx, true)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 ml-auto mt-1" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4" onClick={() => setSelectedTx(null)}>
          <div
            className="bg-gray-900 border-t md:border border-gray-800 rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 relative shadow-2xl animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{t.history.details || '交易详情'}</h3>
              <button onClick={() => setSelectedTx(null)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Type & Status */}
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                <div className="flex items-center gap-3">
                  {getTypeIcon(selectedTx.type)}
                  <div>
                    <div className="font-bold text-white">{getTypeName(selectedTx.type)}</div>
                    <div className="text-xs text-gray-400">{formatDate(selectedTx.timestamp)}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  selectedTx.status === 'confirmed'
                    ? 'bg-neon-500/20 text-neon-400 border border-neon-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {selectedTx.status === 'confirmed' ? t.history.confirmed : t.history.pending}
                </span>
              </div>

              {/* Amounts */}
              <div className="space-y-3">
                <div className="text-sm text-gray-400 uppercase font-mono tracking-wider">{t.history.amount || '金额'}</div>
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-800">
                  <div className="space-y-2">
                    {getAmountDisplay(selectedTx, false)}
                  </div>
                </div>
              </div>

              {/* Transaction Info */}
              <div className="space-y-3">
                <div className="text-sm text-gray-400 uppercase font-mono tracking-wider">{t.history.info || '信息'}</div>
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">{t.history.block}:</span>
                    <span className="text-white font-mono">{selectedTx.blockNumber}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-400 text-sm">Hash:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-xs break-all bg-black/30 p-2 rounded w-full">
                        {selectedTx.hash}
                      </span>
                      <button
                        onClick={() => copyToClipboard(selectedTx.hash)}
                        className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                      >
                        {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  {isOwner && viewMode === 'all' && (
                     <div className="flex flex-col gap-1">
                       <span className="text-gray-400 text-sm">User:</span>
                       <span className="text-white font-mono text-xs break-all bg-black/30 p-2 rounded">
                         {selectedTx.user}
                       </span>
                     </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <a
                href={`${explorerUrl}/tx/${selectedTx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-neon-500 hover:bg-neon-600 text-black font-bold rounded-xl text-center transition-colors"
              >
                {t.history.viewOnExplorer || '在浏览器中查看'}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
