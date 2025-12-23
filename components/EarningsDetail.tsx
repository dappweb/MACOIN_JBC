import React, { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { Clock, ExternalLink, Gift, RefreshCw } from 'lucide-react';
import { useWeb3 } from '../Web3Context';
import { useLanguage } from '../LanguageContext';

interface RewardRecord {
  hash: string;
  user: string;
  mcAmount: string;
  jbcAmount: string;
  rewardType: number;
  ticketId: string;
  blockNumber: number;
  timestamp: number;
  status: 'confirmed' | 'pending';
}

const EarningsDetail: React.FC = () => {
  const { protocolContract, account, provider } = useWeb3();
  const { t } = useLanguage();
  const [records, setRecords] = useState<RewardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [viewMode, setViewMode] = useState<'self' | 'all'>('self');

  useEffect(() => {
    const checkOwner = async () => {
      if (protocolContract && account) {
        try {
          const owner = await protocolContract.owner();
          const isOwnerAccount = owner.toLowerCase() === account.toLowerCase();
          setIsOwner(isOwnerAccount);
          if (isOwnerAccount) {
            setViewMode('all');
          }
        } catch (err) {
          console.error('Failed to check owner', err);
          setIsOwner(false);
        }
      }
    };
    checkOwner();
  }, [protocolContract, account]);

  const fetchRecords = async () => {
    if (!protocolContract || !account || !provider) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000);

      const targetUser = isOwner && viewMode === 'all' ? null : account;
      const events = await protocolContract.queryFilter(
        protocolContract.filters.RewardClaimed(targetUser),
        fromBlock,
      );

      const rows: RewardRecord[] = [];

      for (const event of events) {
        try {
          const block = await provider.getBlock(event.blockNumber);
          const mcAmount = event.args ? ethers.formatEther(event.args[1]) : '0';
          const jbcAmount = event.args ? ethers.formatEther(event.args[2]) : '0';
          const rewardType = event.args ? Number(event.args[3]) : 0;
          const ticketId = event.args ? event.args[4].toString() : '';

          rows.push({
            hash: event.transactionHash,
            user: event.args ? event.args[0] : '',
            mcAmount,
            jbcAmount,
            rewardType,
            ticketId,
            blockNumber: event.blockNumber,
            timestamp: block ? block.timestamp : 0,
            status: 'confirmed',
          });
        } catch (err) {
          console.error('Error parsing reward event:', err, event);
        }
      }

      rows.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(rows);
    } catch (err) {
      console.error('Failed to fetch earnings records:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [protocolContract, account, viewMode, isOwner]);

  const totals = useMemo(() => {
    return records.reduce(
      (acc, row) => {
        acc.mc += parseFloat(row.mcAmount || '0');
        acc.jbc += parseFloat(row.jbcAmount || '0');
        return acc;
      },
      { mc: 0, jbc: 0 },
    );
  }, [records]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const explorerUrl = 'https://sepolia.etherscan.io';
  const ui = t.earnings || {};
  const getRewardTypeLabel = (value: number) => {
    if (value === 0) return ui.staticReward || 'Static Reward';
    if (value === 1) return ui.dynamicReward || 'Dynamic Reward';
    return ui.unknownType || 'Unknown';
  };

  if (!account) {
    return (
      <div className="max-w-6xl mx-auto mt-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <Gift className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">{ui.connectWallet || 'Connect Your Wallet'}</h3>
          <p className="text-gray-500">{ui.connectWalletDesc || 'Connect your wallet to view earnings details'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">{ui.title || 'Earnings Details'}</h2>
              <p className="text-emerald-100">{ui.subtitle || 'View your on-chain reward history'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={() => setViewMode('self')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'self'
                      ? 'bg-white text-emerald-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {ui.mySelf || 'My Earnings'}
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-white text-emerald-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {ui.allUsers || 'All Users'}
                </button>
              </div>
            )}
            <button
              onClick={fetchRecords}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {ui.refresh || 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="text-sm text-gray-500 mb-2">{ui.totalMc || 'Total MC Rewards'}</div>
          <div className="text-2xl font-bold text-emerald-600">{totals.mc.toFixed(4)} MC</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="text-sm text-gray-500 mb-2">{ui.totalJbc || 'Total JBC Rewards'}</div>
          <div className="text-2xl font-bold text-emerald-600">{totals.jbc.toFixed(4)} JBC</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">{ui.loading || 'Loading...'}</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Gift className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">{ui.noRecords || 'No Reward Records'}</h3>
          <p className="text-gray-500">{ui.noRecordsDesc || 'No reward claims yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((row, index) => (
            <div
              key={`${row.hash}-${index}`}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">
                    <Gift className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-bold text-gray-900">{t.history.reward_claimed || 'Reward Claimed'}</h4>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {t.history.confirmed || 'Confirmed'}
                      </span>
                      {isOwner && viewMode === 'all' && row.user && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-100 text-blue-700">
                          {row.user.slice(0, 6)}...{row.user.slice(-4)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 mb-2">
                      <p className="text-sm text-gray-600">
                        {ui.mcAmount || 'MC Reward'}:{' '}
                        <span className="font-semibold text-emerald-600">{parseFloat(row.mcAmount).toFixed(4)} MC</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        {ui.jbcAmount || 'JBC Reward'}:{' '}
                        <span className="font-semibold text-emerald-600">{parseFloat(row.jbcAmount).toFixed(4)} JBC</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        {ui.rewardType || 'Reward Type'}:{' '}
                        <span className="font-semibold text-slate-700">{getRewardTypeLabel(row.rewardType)}</span>
                      </p>
                      {row.ticketId && (
                        <p className="text-sm text-gray-600">
                          {ui.ticketId || 'Ticket ID'}:{' '}
                          <span className="font-semibold text-slate-700">{row.ticketId}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(row.timestamp)}
                      </div>
                      <div>{ui.block || 'Block'}: {row.blockNumber}</div>
                    </div>
                  </div>
                </div>
                <a
                  href={`${explorerUrl}/tx/${row.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-mono text-gray-600 transition-colors"
                >
                  {row.hash.slice(0, 6)}...{row.hash.slice(-4)}
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

export default EarningsDetail;
