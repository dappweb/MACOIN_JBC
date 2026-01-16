import React, { useState, useEffect } from 'react';
import { useWeb3, PROTOCOL_ABI } from '../src/Web3Context';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { formatContractError } from '../utils/errorFormatter';
import { RefreshCw, Database, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface UserFinancialData {
    address: string;
    totalTicketPurchased: bigint;      // 累计购买票金额
    totalLiquidityStaked: bigint;      // 累计提供流动性金额
    totalRewardsClaimed: bigint;       // 累计领取收益（MC部分）
    totalRedeemed: bigint;             // 累计赎回金额
    ticketCount: number;               // 购买票次数
    stakeCount: number;                 // 提供流动性次数
    rewardClaimCount: number;          // 领取收益次数
    redeemCount: number;                // 赎回次数
}

interface UpdateProgress {
    totalUsers: number;
    processedUsers: number;
    updatedUsers: number;
    failedUsers: number;
    currentUser: string | null;
}

// 旧合约地址（用于查询历史数据）
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const AdminFinancialDataUpdater: React.FC = () => {
    const { protocolContract, provider, isOwner, account } = useWeb3();
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [userData, setUserData] = useState<Map<string, UserFinancialData>>(new Map());
    const [progress, setProgress] = useState<UpdateProgress>({
        totalUsers: 0,
        processedUsers: 0,
        updatedUsers: 0,
        failedUsers: 0,
        currentUser: null
    });
    const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
    const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
    const [autoUpdateInterval, setAutoUpdateInterval] = useState<NodeJS.Timeout | null>(null);

    // 从链上事件扫描用户财务数据（包括新旧合约）
    const scanUserFinancialData = async () => {
        if (!protocolContract || !provider) {
            toast.error('合约或提供者未连接');
            return;
        }

        setScanning(true);
        toast.loading('正在扫描链上事件（新旧合约）...', { id: 'scan-events' });

        try {
            const currentBlock = await provider.getBlockNumber();
            const fromBlock = 0; // 从区块0开始查询，包含所有历史数据

            console.log(`📊 [FinancialData] 开始扫描事件（新旧合约），区块范围: ${fromBlock} - ${currentBlock}`);

            // 创建旧合约实例
            const oldProtocolContract = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

            // 获取新合约的所有相关事件
            const [newTicketEvents, newStakeEvents, newRewardEvents, newRedeemEvents] = await Promise.all([
                protocolContract.queryFilter(protocolContract.filters.TicketPurchased(), fromBlock, currentBlock),
                protocolContract.queryFilter(protocolContract.filters.LiquidityStaked(), fromBlock, currentBlock),
                protocolContract.queryFilter(protocolContract.filters.RewardClaimed(), fromBlock, currentBlock),
                protocolContract.queryFilter(protocolContract.filters.Redeemed(), fromBlock, currentBlock),
            ]);

            // 获取旧合约的所有相关事件
            let oldTicketEvents: any[] = [];
            let oldStakeEvents: any[] = [];
            let oldRewardEvents: any[] = [];
            let oldRedeemEvents: any[] = [];
            
            try {
                toast.loading('正在查询旧合约事件...', { id: 'scan-old' });
                [oldTicketEvents, oldStakeEvents, oldRewardEvents, oldRedeemEvents] = await Promise.all([
                    oldProtocolContract.queryFilter(oldProtocolContract.filters.TicketPurchased(), fromBlock, currentBlock),
                    oldProtocolContract.queryFilter(oldProtocolContract.filters.LiquidityStaked(), fromBlock, currentBlock),
                    oldProtocolContract.queryFilter(oldProtocolContract.filters.RewardClaimed(), fromBlock, currentBlock),
                    oldProtocolContract.queryFilter(oldProtocolContract.filters.Redeemed(), fromBlock, currentBlock),
                ]);
                console.log(`✅ [FinancialData] 旧合约查询成功`);
            } catch (error: any) {
                console.warn(`⚠️ [FinancialData] 旧合约查询失败: ${error.message}`);
                toast.warning('旧合约查询失败，仅显示新合约数据', { id: 'scan-old', duration: 5000 });
                // 继续使用空数组，不影响新合约数据
            }

            // 合并新旧合约的事件
            const ticketEvents = [...newTicketEvents, ...oldTicketEvents];
            const stakeEvents = [...newStakeEvents, ...oldStakeEvents];
            const rewardEvents = [...newRewardEvents, ...oldRewardEvents];
            const redeemEvents = [...newRedeemEvents, ...oldRedeemEvents];

            console.log(`📊 [FinancialData] 找到事件:`, {
                新合约: {
                    tickets: newTicketEvents.length,
                    stakes: newStakeEvents.length,
                    rewards: newRewardEvents.length,
                    redeems: newRedeemEvents.length
                },
                旧合约: {
                    tickets: oldTicketEvents.length,
                    stakes: oldStakeEvents.length,
                    rewards: oldRewardEvents.length,
                    redeems: oldRedeemEvents.length
                },
                总计: {
                    tickets: ticketEvents.length,
                    stakes: stakeEvents.length,
                    rewards: rewardEvents.length,
                    redeems: redeemEvents.length
                }
            });

            // 处理购买票事件
            const userDataMap = new Map<string, UserFinancialData>();

            ticketEvents.forEach((event) => {
                if (event.args && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const amount = event.args.amount || 0n;

                    if (!userDataMap.has(user)) {
                        userDataMap.set(user, {
                            address: user,
                            totalTicketPurchased: 0n,
                            totalLiquidityStaked: 0n,
                            totalRewardsClaimed: 0n,
                            totalRedeemed: 0n,
                            ticketCount: 0,
                            stakeCount: 0,
                            rewardClaimCount: 0,
                            redeemCount: 0
                        });
                    }

                    const data = userDataMap.get(user)!;
                    data.totalTicketPurchased += BigInt(amount.toString());
                    data.ticketCount++;
                }
            });

            // 处理提供流动性事件
            stakeEvents.forEach((event) => {
                if (event.args && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const amount = event.args.amount || 0n;

                    if (!userDataMap.has(user)) {
                        userDataMap.set(user, {
                            address: user,
                            totalTicketPurchased: 0n,
                            totalLiquidityStaked: 0n,
                            totalRewardsClaimed: 0n,
                            totalRedeemed: 0n,
                            ticketCount: 0,
                            stakeCount: 0,
                            rewardClaimCount: 0,
                            redeemCount: 0
                        });
                    }

                    const data = userDataMap.get(user)!;
                    data.totalLiquidityStaked += BigInt(amount.toString());
                    data.stakeCount++;
                }
            });

            // 处理领取收益事件
            rewardEvents.forEach((event) => {
                if (event.args && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const mcAmount = event.args.mcAmount || 0n;

                    if (!userDataMap.has(user)) {
                        userDataMap.set(user, {
                            address: user,
                            totalTicketPurchased: 0n,
                            totalLiquidityStaked: 0n,
                            totalRewardsClaimed: 0n,
                            totalRedeemed: 0n,
                            ticketCount: 0,
                            stakeCount: 0,
                            rewardClaimCount: 0,
                            redeemCount: 0
                        });
                    }

                    const data = userDataMap.get(user)!;
                    data.totalRewardsClaimed += BigInt(mcAmount.toString());
                    data.rewardClaimCount++;
                }
            });

            // 处理赎回事件
            redeemEvents.forEach((event) => {
                if (event.args && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const principal = event.args.principal || 0n;

                    if (!userDataMap.has(user)) {
                        userDataMap.set(user, {
                            address: user,
                            totalTicketPurchased: 0n,
                            totalLiquidityStaked: 0n,
                            totalRewardsClaimed: 0n,
                            totalRedeemed: 0n,
                            ticketCount: 0,
                            stakeCount: 0,
                            rewardClaimCount: 0,
                            redeemCount: 0
                        });
                    }

                    const data = userDataMap.get(user)!;
                    data.totalRedeemed += BigInt(principal.toString());
                    data.redeemCount++;
                }
            });

            setUserData(userDataMap);
            setProgress({
                totalUsers: userDataMap.size,
                processedUsers: 0,
                updatedUsers: 0,
                failedUsers: 0,
                currentUser: null
            });

            toast.success(`扫描完成！找到 ${userDataMap.size} 个用户`, { id: 'scan-events' });
            console.log(`✅ [FinancialData] 扫描完成，共 ${userDataMap.size} 个用户`);

        } catch (error: any) {
            console.error('❌ [FinancialData] 扫描失败:', error);
            toast.error(formatContractError(error), { id: 'scan-events' });
        } finally {
            setScanning(false);
        }
    };

    // 批量更新用户财务数据
    const updateUserFinancialData = async () => {
        if (!protocolContract || userData.size === 0) {
            toast.error('请先扫描用户数据');
            return;
        }

        if (!window.confirm(`确认更新 ${userData.size} 个用户的财务数据？这将消耗大量gas费用。`)) {
            return;
        }

        setUpdating(true);
        setProgress({
            totalUsers: userData.size,
            processedUsers: 0,
            updatedUsers: 0,
            failedUsers: 0,
            currentUser: null
        });

        const users = Array.from(userData.values());
        let successCount = 0;
        let failCount = 0;

        toast.loading(`开始更新用户数据...`, { id: 'update-data' });

        // 批量处理，每次处理10个用户
        const batchSize = 10;
        for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);
            
            for (const userDataItem of batch) {
                setProgress(prev => ({
                    ...prev,
                    currentUser: userDataItem.address,
                    processedUsers: prev.processedUsers + 1
                }));

                try {
                    // 获取用户当前数据
                    const currentUserInfo = await protocolContract.userInfo(userDataItem.address);
                    const currentTotalRevenue = currentUserInfo.totalRevenue || 0n;
                    const currentCurrentCap = currentUserInfo.currentCap || 0n;

                    // 计算新的累计收益（基于领取的收益）
                    const newTotalRevenue = currentTotalRevenue + userDataItem.totalRewardsClaimed;

                    // 计算新的收益上限（基于购买票金额的3倍）
                    const newCurrentCap = userDataItem.totalTicketPurchased * 3n;

                    // 更新用户数据
                    const updates: Promise<any>[] = [];

                    // 更新累计收益
                    if (newTotalRevenue !== currentTotalRevenue && protocolContract.adminSetTotalRevenue) {
                        updates.push(
                            protocolContract.adminSetTotalRevenue(
                                userDataItem.address,
                                newTotalRevenue
                            ).then(tx => tx.wait())
                        );
                    }

                    // 更新收益上限
                    if (newCurrentCap !== currentCurrentCap && protocolContract.adminSetCurrentCap) {
                        updates.push(
                            protocolContract.adminSetCurrentCap(
                                userDataItem.address,
                                newCurrentCap
                            ).then(tx => tx.wait())
                        );
                    }

                    // 执行更新
                    if (updates.length > 0) {
                        await Promise.all(updates);
                        successCount++;
                        setProgress(prev => ({
                            ...prev,
                            updatedUsers: prev.updatedUsers + 1
                        }));
                    } else {
                        // 没有需要更新的数据
                        successCount++;
                    }

                } catch (error: any) {
                    console.error(`❌ [FinancialData] 更新用户 ${userDataItem.address} 失败:`, error);
                    failCount++;
                    setProgress(prev => ({
                        ...prev,
                        failedUsers: prev.failedUsers + 1
                    }));
                }

                // 避免请求过快
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 批次之间稍作延迟
            if (i + batchSize < users.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        setUpdating(false);
        setLastUpdateTime(new Date());
        setProgress(prev => ({
            ...prev,
            currentUser: null
        }));

        toast.success(
            `更新完成！成功: ${successCount}, 失败: ${failCount}`,
            { id: 'update-data', duration: 5000 }
        );
    };

    // 自动更新功能
    useEffect(() => {
        if (autoUpdateEnabled && !autoUpdateInterval) {
            // 每天凌晨2点执行一次
            const scheduleNextUpdate = () => {
                const now = new Date();
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(2, 0, 0, 0);
                
                const msUntilUpdate = tomorrow.getTime() - now.getTime();
                
                const interval = setTimeout(() => {
                    console.log('🔄 [FinancialData] 执行自动更新...');
                    scanUserFinancialData().then(() => {
                        setTimeout(() => {
                            updateUserFinancialData();
                        }, 5000);
                    });
                    
                    // 设置下一次更新
                    scheduleNextUpdate();
                }, msUntilUpdate);
                
                setAutoUpdateInterval(interval);
                console.log(`⏰ [FinancialData] 下次自动更新时间: ${tomorrow.toLocaleString()}`);
            };

            scheduleNextUpdate();
        } else if (!autoUpdateEnabled && autoUpdateInterval) {
            clearTimeout(autoUpdateInterval);
            setAutoUpdateInterval(null);
        }

        return () => {
            if (autoUpdateInterval) {
                clearTimeout(autoUpdateInterval);
            }
        };
    }, [autoUpdateEnabled]);

    if (!isOwner) {
        return (
            <div className="glass-panel p-6 rounded-xl bg-red-900/30 border border-red-500/50">
                <div className="flex items-center gap-3 text-red-400">
                    <AlertTriangle size={24} />
                    <div>
                        <h3 className="font-bold text-lg">权限不足</h3>
                        <p className="text-sm text-red-300">只有合约所有者才能访问此功能</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 标题和说明 */}
            <div className="glass-panel p-6 rounded-xl bg-gray-900/50 border border-blue-500/30">
                <div className="flex items-center gap-3 mb-4">
                    <Database className="text-blue-400" size={24} />
                    <h3 className="text-xl font-bold text-white">用户财务数据批量更新</h3>
                </div>
                <div className="text-sm text-gray-400 space-y-2">
                    <p>此功能可以从链上事件中扫描所有用户的财务数据，并批量更新到合约中。</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong>购买票数据：</strong>从 TicketPurchased 事件中统计</li>
                        <li><strong>提供流动性数据：</strong>从 LiquidityStaked 事件中统计</li>
                        <li><strong>领取收益数据：</strong>从 RewardClaimed 事件中统计</li>
                        <li><strong>赎回数据：</strong>从 Redeemed 事件中统计</li>
                    </ul>
                    <p className="text-yellow-400 mt-3">
                        ⚠️ 注意：更新操作会消耗大量gas费用，请确保钱包有足够的余额。
                    </p>
                </div>
            </div>

            {/* 控制面板 */}
            <div className="glass-panel p-6 rounded-xl bg-gray-900/50 border border-gray-700">
                <div className="flex flex-wrap gap-4 mb-4">
                    <button
                        onClick={scanUserFinancialData}
                        disabled={scanning || loading}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 font-bold flex items-center gap-2"
                    >
                        {scanning ? <RefreshCw className="animate-spin" size={18} /> : <Database size={18} />}
                        {scanning ? '扫描中...' : '扫描链上事件'}
                    </button>

                    <button
                        onClick={updateUserFinancialData}
                        disabled={updating || loading || userData.size === 0}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 font-bold flex items-center gap-2"
                    >
                        {updating ? <RefreshCw className="animate-spin" size={18} /> : <TrendingUp size={18} />}
                        {updating ? '更新中...' : `批量更新 (${userData.size} 用户)`}
                    </button>

                    <label className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800">
                        <input
                            type="checkbox"
                            checked={autoUpdateEnabled}
                            onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <Clock size={18} className="text-yellow-400" />
                        <span className="text-white font-bold">每日自动更新</span>
                    </label>
                </div>

                {lastUpdateTime && (
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-400" />
                        上次更新时间: {lastUpdateTime.toLocaleString('zh-CN')}
                    </div>
                )}
            </div>

            {/* 进度显示 */}
            {(scanning || updating) && (
                <div className="glass-panel p-6 rounded-xl bg-gray-900/50 border border-gray-700">
                    <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                            <span>进度</span>
                            <span>{progress.processedUsers} / {progress.totalUsers}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(progress.processedUsers / progress.totalUsers) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="text-gray-400">总用户数</div>
                            <div className="text-white font-bold">{progress.totalUsers}</div>
                        </div>
                        <div>
                            <div className="text-gray-400">已处理</div>
                            <div className="text-blue-400 font-bold">{progress.processedUsers}</div>
                        </div>
                        <div>
                            <div className="text-gray-400">成功更新</div>
                            <div className="text-green-400 font-bold">{progress.updatedUsers}</div>
                        </div>
                        <div>
                            <div className="text-gray-400">失败</div>
                            <div className="text-red-400 font-bold">{progress.failedUsers}</div>
                        </div>
                    </div>
                    {progress.currentUser && (
                        <div className="mt-4 text-sm text-gray-400">
                            当前处理: <span className="text-white font-mono">{progress.currentUser}</span>
                        </div>
                    )}
                </div>
            )}

            {/* 数据预览 */}
            {userData.size > 0 && !scanning && !updating && (
                <div className="glass-panel p-6 rounded-xl bg-gray-900/50 border border-gray-700">
                    <h4 className="text-lg font-bold text-white mb-4">数据预览（前10个用户）</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="text-left p-2 text-gray-400">地址</th>
                                    <th className="text-right p-2 text-gray-400">购买票</th>
                                    <th className="text-right p-2 text-gray-400">提供流动性</th>
                                    <th className="text-right p-2 text-gray-400">领取收益</th>
                                    <th className="text-right p-2 text-gray-400">赎回</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from(userData.values()).slice(0, 10).map((data) => (
                                    <tr key={data.address} className="border-b border-gray-800">
                                        <td className="p-2 text-white font-mono text-xs">
                                            {data.address.substring(0, 10)}...{data.address.substring(34)}
                                        </td>
                                        <td className="p-2 text-right text-green-400">
                                            {ethers.formatEther(data.totalTicketPurchased)} MC
                                        </td>
                                        <td className="p-2 text-right text-blue-400">
                                            {ethers.formatEther(data.totalLiquidityStaked)} MC
                                        </td>
                                        <td className="p-2 text-right text-yellow-400">
                                            {ethers.formatEther(data.totalRewardsClaimed)} MC
                                        </td>
                                        <td className="p-2 text-right text-purple-400">
                                            {ethers.formatEther(data.totalRedeemed)} MC
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {userData.size > 10 && (
                        <div className="mt-4 text-sm text-gray-400 text-center">
                            还有 {userData.size - 10} 个用户...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminFinancialDataUpdater;
