import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../Web3Context';
import { useLanguage } from '../LanguageContext';
import { FileText, ExternalLink, Filter, RefreshCw, Clock, TrendingUp, TrendingDown, Package, Lock, Gift, Unlock } from 'lucide-react';
import { ethers } from 'ethers';

interface Transaction {
  hash: string;
  user: string; // Add user address field
  type: 'ticket_purchased' | 'liquidity_staked' | 'reward_claimed' | 'redeemed' | 'swap_mc_to_jbc' | 'swap_jbc_to_mc';
  amount: string;
  amount2?: string; // For rewards (MC + JBC) or swap tax
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
        protocolContract.queryFilter(protocolContract.filters.RewardClaimed(targetUser), fromBlock),
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
      case 'redeemed': return <Unlock className="w-5 h-5 text-orange-500" />;
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

  const filteredTransactions = filterType === 'all'
    ? transactions
    : transactions.filter(tx => tx.type === filterType);

  const explorerUrl = 'https://sepolia.etherscan.io'; // Change based on network

  if (!account) {
    return (
      <div className="max-w-6xl mx-auto mt-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">{t.history.connectWallet}</h3>
          <p className="text-gray-500">{t.history.connectWalletDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-macoin-500 to-macoin-600 rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">{t.history.title}</h2>
              <p className="text-macoin-100">{t.history.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={() => setViewMode('self')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'self'
                      ? 'bg-white text-macoin-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {t.history.mySelf || '我的记录'}
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-white text-macoin-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {t.history.allUsers || '所有用户'}
                </button>
              </div>
            )}
            <button
              onClick={fetchTransactions}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {t.history.refresh}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-5 h-5 text-gray-500" />
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-macoin-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.history.all}
          </button>
          {Object.entries(eventTypeMap).map(([_, value]) => (
            <button
              key={value}
              onClick={() => setFilterType(value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === value
                  ? 'bg-macoin-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.history[value]}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="w-12 h-12 border-4 border-macoin-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">{t.history.loading}</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">{t.history.noTransactions}</h3>
          <p className="text-gray-500">{t.history.noTransactionsDesc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx, index) => (
            <div
              key={`${tx.hash}-${index}`}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">
                    {getTypeIcon(tx.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-bold text-gray-900">{getTypeName(tx.type)}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {tx.status === 'confirmed' ? t.history.confirmed : t.history.pending}
                      </span>
                      {/* Show user address for admin viewing all */}
                      {isOwner && viewMode === 'all' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-100 text-blue-700">
                          {tx.user.slice(0, 6)}...{tx.user.slice(-4)}
                        </span>
                      )}
                    </div>

                    {/* Amount Display */}
                    <div className="space-y-1 mb-2">
                      {tx.type === 'reward_claimed' ? (
                        <>
                          <p className="text-sm text-gray-600">
                            {t.history.mcReward}: <span className="font-semibold text-macoin-600">{parseFloat(tx.amount).toFixed(2)} MC</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            {t.history.jbcReward}: <span className="font-semibold text-macoin-600">{parseFloat(tx.amount2 || '0').toFixed(2)} JBC</span>
                          </p>
                        </>
                      ) : tx.type === 'liquidity_staked' ? (
                        <>
                          <p className="text-sm text-gray-600">
                            {t.history.amount}: <span className="font-semibold text-macoin-600">{parseFloat(tx.amount).toFixed(2)} MC</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            {t.history.cycle}: <span className="font-semibold text-macoin-600">{tx.amount2} {t.mining.days}</span>
                          </p>
                        </>
                      ) : tx.type === 'swap_mc_to_jbc' ? (
                        <>
                          <p className="text-sm text-gray-600">
                            {t.history.paid}: <span className="font-semibold text-red-600">{parseFloat(tx.amount).toFixed(2)} MC</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            {t.history.received}: <span className="font-semibold text-green-600">{parseFloat(tx.amount2 || '0').toFixed(2)} JBC</span>
                          </p>
                        </>
                      ) : tx.type === 'swap_jbc_to_mc' ? (
                        <>
                          <p className="text-sm text-gray-600">
                            {t.history.paid}: <span className="font-semibold text-red-600">{parseFloat(tx.amount).toFixed(2)} JBC</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            {t.history.received}: <span className="font-semibold text-green-600">{parseFloat(tx.amount2 || '0').toFixed(2)} MC</span>
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-600">
                          {t.history.amount}: <span className="font-semibold text-macoin-600">{parseFloat(tx.amount).toFixed(2)} MC</span>
                        </p>
                      )}
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
                <a
                  href={`${explorerUrl}/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-mono text-gray-600 transition-colors"
                >
                  {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
