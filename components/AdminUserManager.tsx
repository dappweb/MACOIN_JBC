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
        if (!protocolContract || !userInfo) {
            toast.error('合约未连接或用户信息不存在');
            return;
        }

        setLoading(true);
        try {
            // 检查是否有推荐人变更
            const newReferrer = editData.referrer.trim();
            const oldReferrer = userInfo.referrer;

            if (newReferrer !== oldReferrer) {
                // 验证新推荐人地址
                if (!ethers.isAddress(newReferrer)) {
                    toast.error('请输入有效的推荐人地址');
                    setLoading(false);
                    return;
                }

                if (newReferrer.toLowerCase() === userInfo.address.toLowerCase()) {
                    toast.error('不能将自己设置为推荐人');
                    setLoading(false);
                    return;
                }

                // 调用合约的 adminSetReferrer 函数
                const tx = await protocolContract.adminSetReferrer(userInfo.address, newReferrer);
                toast.success('交易已提交，等待确认...', { duration: 3000 });
                
                // 等待交易确认
                await tx.wait();
                
                toast.success('推荐人修改成功！', { duration: 3000 });
                
                // 重新加载用户信息
                await searchUser();
                setEditMode(false);
            } else {
                toast.info('推荐人地址未变更', { duration: 2000 });
            }

            // 注意：其他字段（activeDirects, teamCount, totalRevenue, currentCap, refundFeeAmount）
            // 在当前合约版本中无法直接修改，这些数据由系统自动计算和维护
            // 如果需要修改这些字段，需要合约添加相应的管理员函数

        } catch (error: any) {
            console.error('Save changes error:', error);
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
            {/* Information Notice */}
            <div className="glass-panel p-4 rounded-xl bg-blue-900/30 border border-blue-500/50">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="text-blue-400 mt-0.5 flex-shrink-0" size={20} />
                    <div className="text-sm text-blue-200">
                        <div className="font-bold mb-1">管理员功能说明</div>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li><strong>推荐人（Referrer）</strong>：可以修改，修改后会自动更新推荐链和团队统计</li>
                            <li><strong>等级（Level）</strong>：根据团队人数（teamCount）自动计算，无法直接修改</li>
                            <li><strong>其他字段</strong>：活跃直推、团队人数、总收益等由系统自动维护，无法手动修改</li>
                            <li>修改推荐人可能会影响用户的等级，因为等级是基于团队人数计算的</li>
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
                                        编辑推荐人
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSaveChanges}
                                        disabled={loading}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 font-bold flex items-center gap-2"
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
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <span className="text-white font-bold">{userInfo.activeDirects}</span>
                                    <span className="text-xs text-gray-500 ml-2">(系统自动计算，不可修改)</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">团队人数</label>
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <span className="text-white font-bold">{userInfo.teamCount}</span>
                                    <span className="text-xs text-gray-500 ml-2">(系统自动计算，不可修改)</span>
                                </div>
                            </div>
                        </div>

                        {/* Financial Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">总收益 (MC)</label>
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <span className="text-green-400 font-bold">{parseFloat(userInfo.totalRevenue).toFixed(4)} MC</span>
                                    <span className="text-xs text-gray-500 ml-2">(只读)</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">当前上限 (MC)</label>
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <span className="text-blue-400 font-bold">{parseFloat(userInfo.currentCap).toFixed(4)} MC</span>
                                    <span className="text-xs text-gray-500 ml-2">(只读)</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">退款费用 (MC)</label>
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <span className="text-yellow-400 font-bold">{parseFloat(userInfo.refundFeeAmount).toFixed(4)} MC</span>
                                    <span className="text-xs text-gray-500 ml-2">(只读)</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">用户等级</label>
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <span className="text-purple-400 font-bold">
                                        V{userInfo.level} ({userInfo.levelPercent}%)
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">(根据团队人数自动计算)</span>
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
                                    <div className="font-bold mb-1">修改推荐人注意事项：</div>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        <li>修改推荐人将重新计算整个推荐链的团队人数（teamCount）</li>
                                        <li>团队人数的变化会自动影响用户的等级（Level）</li>
                                        <li>新推荐人不能是用户自己，也不能形成循环引用</li>
                                        <li>修改后，原推荐人的团队人数会减少，新推荐人的团队人数会增加</li>
                                        <li>此操作不可逆，请谨慎操作</li>
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