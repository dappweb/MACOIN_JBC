import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Search, Edit3, Save, X, AlertTriangle, RefreshCw, User, Settings } from 'lucide-react';
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

interface EditableUserData {
    referrer: string;
    activeDirects: string;
    teamCount: string;
    totalRevenue: string;
    currentCap: string;
    refundFeeAmount: string;
}

const AdminUserManager: React.FC = () => {
    const { protocolContract, isOwner } = useWeb3();
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

    const calculateLevel = (teamCount: number) => {
        if (teamCount >= 10000) return { level: 9, percent: 45 };
        if (teamCount >= 5000) return { level: 8, percent: 40 };
        if (teamCount >= 2000) return { level: 7, percent: 35 };
        if (teamCount >= 1000) return { level: 6, percent: 30 };
        if (teamCount >= 500) return { level: 5, percent: 25 };
        if (teamCount >= 200) return { level: 4, percent: 20 };
        if (teamCount >= 100) return { level: 3, percent: 15 };
        if (teamCount >= 50) return { level: 2, percent: 10 };
        if (teamCount >= 20) return { level: 1, percent: 5 };
        return { level: 0, percent: 0 };
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

        } catch (error) {
            console.error('Search user error:', error);
            toast.error(formatContractError(error));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveChanges = async () => {
        if (!protocolContract || !userInfo) return;

        // Validate referrer address
        if (editData.referrer && !ethers.isAddress(editData.referrer)) {
            toast.error('推荐人地址格式无效');
            return;
        }

        // Prevent self-reference
        if (editData.referrer.toLowerCase() === userInfo.address.toLowerCase()) {
            toast.error('不能设置自己为推荐人');
            return;
        }

        setLoading(true);
        try {
            const promises = [];

            // Update referrer if changed
            if (editData.referrer !== userInfo.referrer) {
                if (editData.referrer === '') {
                    toast.error('推荐人地址不能为空');
                    return;
                }
                promises.push(
                    protocolContract.adminSetReferrer(userInfo.address, editData.referrer)
                );
            }

            // Update other user data if changed
            const updateActiveDirects = editData.activeDirects !== userInfo.activeDirects.toString();
            const updateTeamCount = editData.teamCount !== userInfo.teamCount.toString();
            const updateTotalRevenue = editData.totalRevenue !== userInfo.totalRevenue;
            const updateCurrentCap = editData.currentCap !== userInfo.currentCap;
            const updateRefundFee = editData.refundFeeAmount !== userInfo.refundFeeAmount;

            if (updateActiveDirects || updateTeamCount || updateTotalRevenue || updateCurrentCap || updateRefundFee) {
                promises.push(
                    protocolContract.adminUpdateUserData(
                        userInfo.address,
                        updateActiveDirects,
                        updateActiveDirects ? Number(editData.activeDirects) : 0,
                        updateTeamCount,
                        updateTeamCount ? Number(editData.teamCount) : 0,
                        updateTotalRevenue,
                        updateTotalRevenue ? ethers.parseEther(editData.totalRevenue) : 0,
                        updateCurrentCap,
                        updateCurrentCap ? ethers.parseEther(editData.currentCap) : 0,
                        updateRefundFee,
                        updateRefundFee ? ethers.parseEther(editData.refundFeeAmount) : 0
                    )
                );
            }

            // Execute all transactions
            for (const promise of promises) {
                const tx = await promise;
                await tx.wait();
            }

            toast.success('用户信息更新成功');
            setEditMode(false);
            
            // Refresh user data
            await searchUser();

        } catch (error) {
            console.error('Update user error:', error);
            toast.error(formatContractError(error));
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
                                        onClick={handleSaveChanges}
                                        disabled={loading}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 font-bold flex items-center gap-2"
                                    >
                                        <Save size={16} />
                                        保存
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
                                        <li>修改推荐人将重新计算整个推荐链的团队人数</li>
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
        </div>
    );
};

export default AdminUserManager;