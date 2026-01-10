import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Search, Edit3, Save, X, AlertTriangle, RefreshCw, User, Settings, Droplets, Clock, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { useWeb3 } from '../src/Web3Context';
import { useLanguage } from '../src/LanguageContext';
import toast from 'react-hot-toast';
import { formatContractError } from '../utils/errorFormatter';

interface UserInfo {
    address: string;
    referrer: string;
    activeDirects: number;
    teamCount: number;
    totalRevenue: string;
    currentCap: string;
    isActive: boolean;
    refundFeeAmount: string;
    maxTicketAmount: string;
    level: number;
    levelPercent: number;
}

interface StakePosition {
    index: number;
    id: string;
    amount: string;
    startTime: number;
    cycleDays: number;
    active: boolean;
    paid: string;
    endTime: number;
    progress: number;
    status: 'active' | 'completed' | 'redeemed';
    pendingReward: string;
}

interface StakeEvent {
    txHash: string;
    blockNumber: number;
    timestamp: number;
    amount: string;
    cycleDays: number;
    stakeId: string;
}

interface EditableUserData {
    referrer: string;
    activeDirects: string;
    teamCount: string;
    totalRevenue: string;
    currentCap: string;
    refundFeeAmount: string;
}

const AdminUserManager: React.FC = () => {
    const { protocolContract, isOwner, provider } = useWeb3();
    const { t } = useLanguage();
    
    const [searchAddress, setSearchAddress] = useState('');
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState<EditableUserData>({
        referrer: '',
        activeDirects: '',
        teamCount: '',
        totalRevenue: '',
        currentCap: '',
        refundFeeAmount: ''
    });
    
    // 流动性质押相关状态
    const [userStakes, setUserStakes] = useState<StakePosition[]>([]);
    const [stakeEvents, setStakeEvents] = useState<StakeEvent[]>([]);
    const [loadingStakes, setLoadingStakes] = useState(false);
    const [secondsInUnit, setSecondsInUnit] = useState(86400); // 默认1天

    const calculateLevel = (teamCount: number) => {
        // 更新的极差裂变机制等级标准
        if (teamCount >= 100000) return { level: 9, percent: 45 };  // V9: 100,000个地址，45%极差收益
        if (teamCount >= 30000) return { level: 8, percent: 40 };   // V8: 30,000个地址，40%极差收益
        if (teamCount >= 10000) return { level: 7, percent: 35 };   // V7: 10,000个地址，35%极差收益
        if (teamCount >= 3000) return { level: 6, percent: 30 };    // V6: 3,000个地址，30%极差收益
        if (teamCount >= 1000) return { level: 5, percent: 25 };    // V5: 1,000个地址，25%极差收益
        if (teamCount >= 300) return { level: 4, percent: 20 };     // V4: 300个地址，20%极差收益
        if (teamCount >= 100) return { level: 3, percent: 15 };     // V3: 100个地址，15%极差收益
        if (teamCount >= 30) return { level: 2, percent: 10 };      // V2: 30个地址，10%极差收益
        if (teamCount >= 10) return { level: 1, percent: 5 };       // V1: 10个地址，5%极差收益
        return { level: 0, percent: 0 };
    };

    // 获取收益率 (与合约保持一致)
    const getRate = (cycleDays: number): bigint => {
        if (cycleDays === 7) return 13333334n;      // 1.3333334%
        if (cycleDays === 15) return 16666667n;     // 1.6666667%
        if (cycleDays === 30) return 20000000n;     // 2.0%
        return 0n;
    };

    // 获取用户流动性质押数据
    const fetchUserStakes = async (userAddress: string) => {
        if (!protocolContract || !provider) return;
        
        setLoadingStakes(true);
        try {
            // 获取 SECONDS_IN_UNIT
            try {
                const s = await protocolContract.SECONDS_IN_UNIT();
                setSecondsInUnit(Number(s));
            } catch (e) {
                console.warn("Failed to fetch SECONDS_IN_UNIT, using default 86400");
            }

            const currentTime = Math.floor(Date.now() / 1000);
            const stakes: StakePosition[] = [];
            let index = 0;

            // 遍历获取所有质押
            while (true) {
                try {
                    const stakeData = await protocolContract.userStakes(userAddress, index);
                    // struct Stake { id, amount, startTime, cycleDays, active, paid }
                    const id = stakeData[0].toString();
                    const amount = stakeData[1];
                    const startTime = Number(stakeData[2]);
                    const cycleDays = Number(stakeData[3]);
                    const active = stakeData[4];
                    const paid = stakeData[5];

                    const durationSeconds = cycleDays * secondsInUnit;
                    const endTime = startTime + durationSeconds;
                    
                    let status: StakePosition['status'] = 'redeemed';
                    if (active) {
                        status = currentTime >= endTime ? 'completed' : 'active';
                    }

                    // 计算进度
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(100, Math.max(0, (elapsed / durationSeconds) * 100));

                    // 计算待领取收益
                    const ratePerBillion = getRate(cycleDays);
                    const unitsPassed = Math.min(cycleDays, Math.floor((currentTime - startTime) / secondsInUnit));
                    const totalShouldBe = (amount * ratePerBillion * BigInt(unitsPassed)) / 1000000000n;
                    const pendingReward = totalShouldBe > paid ? totalShouldBe - paid : 0n;

                    stakes.push({
                        index,
                        id,
                        amount: ethers.formatEther(amount),
                        startTime,
                        cycleDays,
                        active,
                        paid: ethers.formatEther(paid),
                        endTime,
                        progress,
                        status,
                        pendingReward: ethers.formatEther(pendingReward)
                    });

                    index++;
                    if (index > 50) break; // 安全限制
                } catch (e) {
                    break; // 遍历完成
                }
            }

            setUserStakes(stakes);

            // 获取历史质押事件
            try {
                const currentBlock = await provider.getBlockNumber();
                const fromBlock = Math.max(0, currentBlock - 100000); // 最近10万个区块
                
                const filter = protocolContract.filters.LiquidityStaked(userAddress);
                const events = await protocolContract.queryFilter(filter, fromBlock);
                
                const eventList: StakeEvent[] = [];
                for (const event of events) {
                    const block = await event.getBlock();
                    if (event.args) {
                        eventList.push({
                            txHash: event.transactionHash,
                            blockNumber: event.blockNumber,
                            timestamp: block.timestamp,
                            amount: ethers.formatEther(event.args[1]),
                            cycleDays: Number(event.args[2]),
                            stakeId: event.args[3].toString()
                        });
                    }
                }
                
                // 按时间倒序排列
                eventList.sort((a, b) => b.timestamp - a.timestamp);
                setStakeEvents(eventList);
            } catch (e) {
                console.warn("Failed to fetch stake events:", e);
                setStakeEvents([]);
            }

        } catch (error) {
            console.error('Fetch user stakes error:', error);
            toast.error('获取质押数据失败');
        } finally {
            setLoadingStakes(false);
        }
    };

    const searchUser = async () => {
        if (!protocolContract || !ethers.isAddress(searchAddress)) {
            toast.error('请输入有效的钱包地址');
            return;
        }

        setLoading(true);
        try {
            const info = await protocolContract.userInfo(searchAddress);
            const ticket = await protocolContract.userTicket(searchAddress);
            
            // Get level information
            const { level, percent: levelPercent } = calculateLevel(Number(info.teamCount));

            const userData: UserInfo = {
                address: searchAddress,
                referrer: info.referrer,
                activeDirects: Number(info.activeDirects),
                teamCount: Number(info.teamCount),
                totalRevenue: ethers.formatEther(info.totalRevenue),
                currentCap: ethers.formatEther(info.currentCap),
                isActive: info.isActive,
                refundFeeAmount: ethers.formatEther(info.refundFeeAmount),
                maxTicketAmount: ethers.formatEther(info.maxTicketAmount),
                level,
                levelPercent
            };

            setUserInfo(userData);
            setEditData({
                referrer: userData.referrer,
                activeDirects: userData.activeDirects.toString(),
                teamCount: userData.teamCount.toString(),
                totalRevenue: userData.totalRevenue,
                currentCap: userData.currentCap,
                refundFeeAmount: userData.refundFeeAmount
            });

            // 同时获取用户的质押数据
            await fetchUserStakes(searchAddress);

        } catch (error) {
            console.error('Search user error:', error);
            toast.error(formatContractError(error));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveChanges = async () => {
        console.log('🔍 [AdminUserManager] handleSaveChanges called');
        
        if (!protocolContract) {
            toast.error('合约未连接，请检查钱包连接');
            return;
        }

        if (!userInfo) {
            toast.error('用户信息未加载，请先搜索用户');
            return;
        }

        setLoading(true);
        try {
            // 准备更新数据
            const newActiveDirects = parseInt(editData.activeDirects);
            const newTeamCount = parseInt(editData.teamCount);
            const newReferrer = editData.referrer.trim();
            
            // 检查推荐人地址是否有效
            const shouldUpdateReferrer = newReferrer !== '' && 
                                        ethers.isAddress(newReferrer) && 
                                        newReferrer.toLowerCase() !== userInfo.referrer.toLowerCase();
            const shouldUpdateActiveDirects = !isNaN(newActiveDirects) && newActiveDirects !== userInfo.activeDirects;
            const shouldUpdateTeamCount = !isNaN(newTeamCount) && newTeamCount !== userInfo.teamCount;

            if (!shouldUpdateReferrer && !shouldUpdateActiveDirects && !shouldUpdateTeamCount) {
                toast('没有需要更新的数据', { icon: 'ℹ️', duration: 3000 });
                setEditMode(false);
                setLoading(false);
                return;
            }

            // 验证推荐人地址格式
            if (shouldUpdateReferrer && !ethers.isAddress(newReferrer)) {
                toast.error('推荐人地址格式无效');
                setLoading(false);
                return;
            }

            // 检查是否将推荐人设置为自己的地址
            if (shouldUpdateReferrer && newReferrer.toLowerCase() === userInfo.address.toLowerCase()) {
                toast.error('不能将自己设置为推荐人');
                setLoading(false);
                return;
            }

            console.log('🚀 [AdminUserManager] Updating user data...');
            
            // 先处理推荐人修改（如果合约支持）
            if (shouldUpdateReferrer && protocolContract.adminSetReferrer) {
                console.log('📝 [AdminUserManager] Updating referrer...');
                const referrerTx = await protocolContract.adminSetReferrer(
                    userInfo.address,
                    newReferrer
                );
                console.log('⏳ [AdminUserManager] Waiting for referrer update confirmation...');
                await referrerTx.wait();
                console.log('✅ [AdminUserManager] Referrer update confirmed:', referrerTx.hash);
            }
            
            // 使用 adminUpdateUserData 一次性更新其他数据
            if (protocolContract.adminUpdateUserData && (shouldUpdateActiveDirects || shouldUpdateTeamCount)) {
                const tx = await protocolContract.adminUpdateUserData(
                    userInfo.address,
                    shouldUpdateActiveDirects, shouldUpdateActiveDirects ? newActiveDirects : 0,
                    shouldUpdateTeamCount, shouldUpdateTeamCount ? newTeamCount : 0,
                    false, 0, // updateTotalRevenue
                    false, 0, // updateCurrentCap
                    false, 0  // updateRefundFee
                );

                console.log('⏳ [AdminUserManager] Waiting for transaction confirmation...');
                await tx.wait();
                console.log('✅ [AdminUserManager] Transaction confirmed:', tx.hash);
            } else if (shouldUpdateActiveDirects || shouldUpdateTeamCount) {
                // 如果 adminUpdateUserData 不存在，尝试回退到旧的单独函数（为了兼容性，虽然可能不存在）
                console.warn('⚠️ [AdminUserManager] adminUpdateUserData not found, trying individual setters...');
                const updates: Promise<any>[] = [];

                if (shouldUpdateActiveDirects && protocolContract.adminSetActiveDirects) {
                    updates.push(protocolContract.adminSetActiveDirects(userInfo.address, newActiveDirects));
                }
                
                if (shouldUpdateTeamCount && protocolContract.adminSetTeamCount) {
                    updates.push(protocolContract.adminSetTeamCount(userInfo.address, newTeamCount));
                }

                if (updates.length === 0) {
                    throw new Error('合约不支持此时的用户数据更新操作');
                }

                await Promise.all(updates.map(p => p.then(tx => tx.wait())));
            }

            toast.success('用户数据更新成功！');
            
            // 重新加载用户信息
            await searchUser();
            setEditMode(false);
        } catch (error: any) {
            console.error('❌ [AdminUserManager] Update error:', error);
            const errorMessage = formatContractError(error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (!isOwner) {
        return (
            <div className="glass-panel p-6 rounded-xl bg-red-900/30 border border-red-500/50">
                <div className="flex items-center gap-3 text-red-400">
                    <AlertTriangle size={24} />
                    <div>
                        <h3 className="font-bold text-lg">权限不足</h3>
                        <p className="text-sm text-red-300">只有合约所有者才能访问用户管理功能</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Information Notice */}
            <div className="glass-panel p-4 rounded-xl bg-green-900/30 border border-green-500/50">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="text-green-400 mt-0.5 flex-shrink-0" size={20} />
                    <div className="text-sm text-green-200">
                        <div className="font-bold mb-1">管理员功能</div>
                        <p>作为合约所有者，您可以修改用户的推荐人、活跃直推数量和团队成员数量。这些修改会影响用户的层级奖励层级和等级。</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li><strong>推荐人：</strong>修改用户的推荐关系，将重新计算整个推荐链的团队人数</li>
                            <li>活跃直推数：影响层级奖励的可获得层级数（1个=5层，2个=10层，3+=15层）</li>
                            <li>团队成员数：影响用户的等级（V0-V9）和极差奖励比例</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Search Section */}
            <div className="glass-panel p-6 rounded-xl bg-gray-900/50 border border-blue-500/30">
                <div className="flex items-center gap-3 mb-4">
                    <User className="text-blue-400" size={24} />
                    <h3 className="text-xl font-bold text-white">用户管理</h3>
                </div>
                
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                        placeholder="输入用户钱包地址 (0x...)"
                        className="flex-1 p-3 border border-gray-700 bg-gray-900/50 rounded-lg text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    <button
                        onClick={searchUser}
                        disabled={loading || !searchAddress}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 font-bold flex items-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
                        搜索
                    </button>
                </div>
            </div>

            {/* User Info Display */}
            {userInfo && (
                <div className="glass-panel p-6 rounded-xl bg-gray-900/50 border border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Settings className="text-green-400" size={24} />
                            <h3 className="text-xl font-bold text-white">用户信息</h3>
                        </div>
                        <div className="flex gap-2">
                            {!editMode ? (
                                <>
                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 font-bold flex items-center gap-2"
                                    >
                                        <Edit3 size={16} />
                                        编辑
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('🔘 [AdminUserManager] Save button clicked');
                                            handleSaveChanges();
                                        }}
                                        disabled={loading}
                                        className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center gap-2 transition-all"
                                        type="button"
                                    >
                                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                        保存更改
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditMode(false);
                                            setEditData({
                                                referrer: userInfo.referrer,
                                                activeDirects: userInfo.activeDirects.toString(),
                                                teamCount: userInfo.teamCount.toString(),
                                                totalRevenue: userInfo.totalRevenue,
                                                currentCap: userInfo.currentCap,
                                                refundFeeAmount: userInfo.refundFeeAmount
                                            });
                                        }}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-bold flex items-center gap-2"
                                    >
                                        <X size={16} />
                                        取消
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">钱包地址</label>
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <span className="text-white font-mono text-sm break-all">{userInfo.address}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">推荐人地址</label>
                                {editMode ? (
                                    <input
                                        type="text"
                                        value={editData.referrer}
                                        onChange={(e) => setEditData({...editData, referrer: e.target.value})}
                                        className="w-full p-3 border border-gray-700 bg-gray-900/50 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        placeholder="0x..."
                                    />
                                ) : (
                                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                        <span className="text-white font-mono text-sm break-all">
                                            {userInfo.referrer || '无推荐人'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">活跃直推数量</label>
                                {editMode ? (
                                    <input
                                        type="number"
                                        value={editData.activeDirects}
                                        onChange={(e) => setEditData({...editData, activeDirects: e.target.value})}
                                        className="w-full p-3 border border-gray-700 bg-gray-900/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                ) : (
                                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                        <span className="text-white font-bold">{userInfo.activeDirects}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">团队人数</label>
                                {editMode ? (
                                    <input
                                        type="number"
                                        value={editData.teamCount}
                                        onChange={(e) => setEditData({...editData, teamCount: e.target.value})}
                                        className="w-full p-3 border border-gray-700 bg-gray-900/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                ) : (
                                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                        <span className="text-white font-bold">{userInfo.teamCount}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Financial Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">总收益 (MC)</label>
                                {editMode ? (
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editData.totalRevenue}
                                        onChange={(e) => setEditData({...editData, totalRevenue: e.target.value})}
                                        className="w-full p-3 border border-gray-700 bg-gray-900/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                ) : (
                                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                        <span className="text-green-400 font-bold">{parseFloat(userInfo.totalRevenue).toFixed(4)} MC</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">当前上限 (MC)</label>
                                {editMode ? (
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editData.currentCap}
                                        onChange={(e) => setEditData({...editData, currentCap: e.target.value})}
                                        className="w-full p-3 border border-gray-700 bg-gray-900/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                ) : (
                                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                        <span className="text-blue-400 font-bold">{parseFloat(userInfo.currentCap).toFixed(4)} MC</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">退款费用 (MC)</label>
                                {editMode ? (
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editData.refundFeeAmount}
                                        onChange={(e) => setEditData({...editData, refundFeeAmount: e.target.value})}
                                        className="w-full p-3 border border-gray-700 bg-gray-900/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                ) : (
                                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                        <span className="text-yellow-400 font-bold">{parseFloat(userInfo.refundFeeAmount).toFixed(4)} MC</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">用户等级</label>
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <span className="text-purple-400 font-bold">
                                        V{userInfo.level} ({userInfo.levelPercent}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Info */}
                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-sm text-gray-400">活跃状态</div>
                                <div className={`font-bold ${userInfo.isActive ? 'text-green-400' : 'text-red-400'}`}>
                                    {userInfo.isActive ? '活跃' : '非活跃'}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-sm text-gray-400">最大门票</div>
                                <div className="text-white font-bold">{parseFloat(userInfo.maxTicketAmount).toFixed(0)} MC</div>
                            </div>
                            <div className="text-center">
                                <div className="text-sm text-gray-400">收益进度</div>
                                <div className="text-white font-bold">
                                    {userInfo.currentCap !== '0' 
                                        ? `${((parseFloat(userInfo.totalRevenue) / parseFloat(userInfo.currentCap)) * 100).toFixed(1)}%`
                                        : '0%'
                                    }
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-sm text-gray-400">剩余额度</div>
                                <div className="text-white font-bold">
                                    {(parseFloat(userInfo.currentCap) - parseFloat(userInfo.totalRevenue)).toFixed(4)} MC
                                </div>
                            </div>
                        </div>
                    </div>

                    {editMode && (
                        <div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-yellow-400 mt-0.5 flex-shrink-0" size={20} />
                                <div className="text-sm text-yellow-200">
                                    <div className="font-bold mb-1">修改用户数据注意事项：</div>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        <li><strong>修改推荐人：</strong>将重新计算整个推荐链的团队人数，并更新旧推荐人和新推荐人的直推列表</li>
                                        <li><strong>修改活跃直推数：</strong>影响层级奖励的可获得层级数（1个=5层，2个=10层，3+=15层）</li>
                                        <li><strong>修改团队人数：</strong>影响用户的等级（V0-V9）和极差奖励比例</li>
                                        <li>修改收益数据可能影响用户的出局状态</li>
                                        <li>请确保数据的准确性，错误的修改可能影响系统稳定性</li>
                                        <li>建议在修改前备份相关数据</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 流动性质押明细 */}
            {userInfo && (
                <div className="glass-panel p-6 rounded-xl bg-gray-900/50 border border-cyan-500/30">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Droplets className="text-cyan-400" size={24} />
                            <h3 className="text-xl font-bold text-white">流动性质押明细</h3>
                        </div>
                        <button
                            onClick={() => fetchUserStakes(userInfo.address)}
                            disabled={loadingStakes}
                            className="px-4 py-2 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 font-bold flex items-center gap-2 text-sm"
                        >
                            {loadingStakes ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                            刷新
                        </button>
                    </div>

                    {loadingStakes ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="animate-spin text-cyan-400" size={32} />
                            <span className="ml-3 text-gray-400">加载质押数据...</span>
                        </div>
                    ) : userStakes.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Droplets size={48} className="mx-auto mb-3 opacity-50" />
                            <p>该用户暂无流动性质押记录</p>
                        </div>
                    ) : (
                        <>
                            {/* 质押统计汇总 */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                    <div className="text-sm text-gray-400 mb-1">总质押数</div>
                                    <div className="text-xl font-bold text-white">{userStakes.length} 笔</div>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                    <div className="text-sm text-gray-400 mb-1">活跃质押</div>
                                    <div className="text-xl font-bold text-green-400">
                                        {userStakes.filter(s => s.status === 'active').length} 笔
                                    </div>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                    <div className="text-sm text-gray-400 mb-1">总质押金额</div>
                                    <div className="text-xl font-bold text-cyan-400">
                                        {userStakes.reduce((sum, s) => sum + parseFloat(s.amount), 0).toFixed(2)} MC
                                    </div>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                    <div className="text-sm text-gray-400 mb-1">已领取收益</div>
                                    <div className="text-xl font-bold text-yellow-400">
                                        {userStakes.reduce((sum, s) => sum + parseFloat(s.paid), 0).toFixed(4)} MC
                                    </div>
                                </div>
                            </div>

                            {/* 质押列表 */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-400">当前质押列表</h4>
                                {userStakes.map((stake) => (
                                    <div 
                                        key={stake.index}
                                        className={`p-4 rounded-lg border ${
                                            stake.status === 'active' 
                                                ? 'bg-green-900/20 border-green-500/30' 
                                                : stake.status === 'completed'
                                                ? 'bg-yellow-900/20 border-yellow-500/30'
                                                : 'bg-gray-800/30 border-gray-700/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-mono text-gray-500">#{stake.id}</span>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    stake.status === 'active' 
                                                        ? 'bg-green-500/20 text-green-400' 
                                                        : stake.status === 'completed'
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                    {stake.status === 'active' ? '进行中' : stake.status === 'completed' ? '待赎回' : '已赎回'}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-white">{parseFloat(stake.amount).toFixed(4)} MC</div>
                                                <div className="text-xs text-gray-400">{stake.cycleDays} 天周期</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <div className="text-gray-500 text-xs">开始时间</div>
                                                <div className="text-gray-300">
                                                    {new Date(stake.startTime * 1000).toLocaleString('zh-CN', {
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-gray-500 text-xs">结束时间</div>
                                                <div className="text-gray-300">
                                                    {new Date(stake.endTime * 1000).toLocaleString('zh-CN', {
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-gray-500 text-xs">已领取</div>
                                                <div className="text-yellow-400 font-mono">{parseFloat(stake.paid).toFixed(4)} MC</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-500 text-xs">待领取</div>
                                                <div className="text-green-400 font-mono">{parseFloat(stake.pendingReward).toFixed(4)} MC</div>
                                            </div>
                                        </div>

                                        {/* 进度条 */}
                                        {stake.status !== 'redeemed' && (
                                            <div className="mt-3">
                                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                    <span>进度</span>
                                                    <span>{stake.progress.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-gray-700 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full transition-all ${
                                                            stake.status === 'completed' ? 'bg-yellow-500' : 'bg-cyan-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, stake.progress)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* 历史质押事件 */}
                    {stakeEvents.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-700">
                            <h4 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                                <Clock size={16} />
                                历史质押事件记录 ({stakeEvents.length} 笔)
                            </h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {stakeEvents.map((event, idx) => (
                                    <div 
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 text-sm"
                                    >
                                        <div className="flex items-center gap-3">
                                            <TrendingUp className="text-cyan-400" size={16} />
                                            <div>
                                                <div className="text-white font-bold">{parseFloat(event.amount).toFixed(4)} MC</div>
                                                <div className="text-xs text-gray-500">
                                                    {event.cycleDays} 天 · ID #{event.stakeId}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-gray-300">
                                                {new Date(event.timestamp * 1000).toLocaleString('zh-CN')}
                                            </div>
                                            <a 
                                                href={`https://mcerscan.com/tx/${event.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-cyan-400 hover:underline"
                                            >
                                                {event.txHash.slice(0, 10)}...{event.txHash.slice(-8)}
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUserManager;