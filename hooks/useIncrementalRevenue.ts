import { useCallback } from 'react';
import { ethers } from 'ethers';

interface IncrementalRevenueOptions {
  account: string;
  protocolContract: ethers.Contract;
  provider: ethers.Provider;
  lastBlock: number;
  maxBlockDiff?: number; // 如果区块差距超过此值，回退到全量查询
}

const DEFAULT_MAX_BLOCK_DIFF = 10000;

export const useIncrementalRevenue = () => {
  const fetchIncrementalReferralRevenue = useCallback(
    async (options: IncrementalRevenueOptions): Promise<{
      revenue: number;
      lastBlock: number;
      isIncremental: boolean;
    }> => {
      const {
        account,
        protocolContract,
        provider,
        lastBlock,
        maxBlockDiff = DEFAULT_MAX_BLOCK_DIFF,
      } = options;

      try {
        const currentBlock = await provider.getBlockNumber();
        const blockDiff = currentBlock - lastBlock;

        // 如果区块差距太大，返回全量查询标志
        if (blockDiff > maxBlockDiff || lastBlock === 0) {
          const fromBlock = Math.max(0, currentBlock - 50000);
          const events = await protocolContract.queryFilter(
            protocolContract.filters.ReferralRewardPaid(account),
            fromBlock
          );

          let revenue = 0;
          for (const event of events) {
            if (event.args) {
              revenue += parseFloat(ethers.formatEther(event.args[2]));
            }
          }

          return {
            revenue,
            lastBlock: currentBlock,
            isIncremental: false,
          };
        }

        // 增量查询：只查询自上次更新后的新事件
        const events = await protocolContract.queryFilter(
          protocolContract.filters.ReferralRewardPaid(account),
          lastBlock + 1,
          currentBlock
        );

        let newRevenue = 0;
        for (const event of events) {
          if (event.args) {
            newRevenue += parseFloat(ethers.formatEther(event.args[2]));
          }
        }

        return {
          revenue: newRevenue,
          lastBlock: currentBlock,
          isIncremental: true,
        };
      } catch (error) {
        console.error('Failed to fetch incremental referral revenue:', error);
        throw error;
      }
    },
    []
  );

  const fetchIncrementalRewardEvents = useCallback(
    async (options: IncrementalRevenueOptions): Promise<{
      rewardMc: number;
      rewardJbc: number;
      lastBlock: number;
      isIncremental: boolean;
    }> => {
      const {
        account,
        protocolContract,
        provider,
        lastBlock,
        maxBlockDiff = DEFAULT_MAX_BLOCK_DIFF,
      } = options;

      try {
        const currentBlock = await provider.getBlockNumber();
        const blockDiff = currentBlock - lastBlock;

        // 如果区块差距太大，返回全量查询标志
        if (blockDiff > maxBlockDiff || lastBlock === 0) {
          const fromBlock = Math.max(0, currentBlock - 50000);
          const events = await protocolContract.queryFilter(
            protocolContract.filters.RewardClaimed(account),
            fromBlock
          );

          let rewardMc = 0;
          let rewardJbc = 0;
          for (const event of events) {
            if (event.args) {
              rewardMc += parseFloat(ethers.formatEther(event.args[1]));
              rewardJbc += parseFloat(ethers.formatEther(event.args[2]));
            }
          }

          return {
            rewardMc,
            rewardJbc,
            lastBlock: currentBlock,
            isIncremental: false,
          };
        }

        // 增量查询：查询新增的奖励
        // 注意：为了返回总领取量，我们需要查询所有历史事件，而不仅仅是增量部分
        // 但由于性能考虑，如果区块差距不大，我们可以只查询增量部分
        // 但为了确保显示正确的总领取量，我们仍然使用全量查询
        const fromBlock = Math.max(0, currentBlock - 50000);
        const events = await protocolContract.queryFilter(
          protocolContract.filters.RewardClaimed(account),
          fromBlock
        );

        let rewardMc = 0;
        let rewardJbc = 0;
        for (const event of events) {
          if (event.args) {
            rewardMc += parseFloat(ethers.formatEther(event.args[1]));
            rewardJbc += parseFloat(ethers.formatEther(event.args[2]));
          }
        }

        return {
          rewardMc,
          rewardJbc,
          lastBlock: currentBlock,
          isIncremental: false, // 改为 false，因为我们现在总是使用全量查询
        };
      } catch (error) {
        console.error('Failed to fetch incremental reward events:', error);
        throw error;
      }
    },
    []
  );

  return {
    fetchIncrementalReferralRevenue,
    fetchIncrementalRewardEvents,
  };
};

