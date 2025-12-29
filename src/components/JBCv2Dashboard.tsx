import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Coins, 
  TrendingUp, 
  Lock, 
  Unlock, 
  ArrowUpDown, 
  BarChart3,
  Settings,
  Shield,
  Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// JBCv2 合约 ABI (简化版)
const JBCv2_ABI = [
  // 基本信息
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function VERSION() view returns (string)',
  
  // 税收信息
  'function getTaxInfo() view returns (uint256 buyTax, uint256 sellTax, uint256 transferTax, bool enabled)',
  'function getSupplyInfo() view returns (uint256 totalSupply_, uint256 maxSupply_, uint256 totalBurned_, uint256 circulatingSupply)',
  
  // 质押功能
  'function getStakingInfo(address user) view returns (uint256 stakedAmount, uint256 stakingTime, uint256 lockPeriod, uint256 pendingRewards, bool canUnstake)',
  'function stake(uint256 amount, uint256 lockPeriod)',
  'function unstake(uint256 amount)',
  'function claimReward()',
  'function pendingReward(address user) view returns (uint256)',
  
  // 转账功能
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  
  // 治理功能
  'function getVotes(address account) view returns (uint256)',
  'function delegate(address delegatee)',
  
  // 事件
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Staked(address indexed user, uint256 amount)',
  'event Unstaked(address indexed user, uint256 amount)',
  'event RewardClaimed(address indexed user, uint256 amount)'
];

interface JBCv2DashboardProps {
  contractAddress: string;
}

export default function JBCv2Dashboard({ contractAddress }: JBCv2DashboardProps) {
  const { address, isConnected } = useAccount();
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [lockPeriod, setLockPeriod] = useState('7'); // 默认7天
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // 合约读取
  const { data: tokenInfo } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: JBCv2_ABI,
    functionName: 'name',
  });

  const { data: symbol } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: JBCv2_ABI,
    functionName: 'symbol',
  });

  const { data: version } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: JBCv2_ABI,
    functionName: 'VERSION',
  });

  const { data: balance } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: JBCv2_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!address }
  });

  const { data: taxInfo } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: JBCv2_ABI,
    functionName: 'getTaxInfo',
  });

  const { data: supplyInfo } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: JBCv2_ABI,
    functionName: 'getSupplyInfo',
  });

  const { data: stakingInfo } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: JBCv2_ABI,
    functionName: 'getStakingInfo',
    args: [address],
    query: { enabled: !!address }
  });

  const { data: votingPower } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: JBCv2_ABI,
    functionName: 'getVotes',
    args: [address],
    query: { enabled: !!address }
  });

  // 合约写入
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // 质押功能
  const handleStake = async () => {
    if (!stakeAmount || !lockPeriod) {
      toast.error('请输入质押数量和锁定期');
      return;
    }

    try {
      const amount = parseEther(stakeAmount);
      const lockSeconds = parseInt(lockPeriod) * 24 * 60 * 60; // 转换为秒

      writeContract({
        address: contractAddress as `0x${string}`,
        abi: JBCv2_ABI,
        functionName: 'stake',
        args: [amount, lockSeconds],
      });
    } catch (error) {
      toast.error('质押失败: ' + (error as Error).message);
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount) {
      toast.error('请输入解除质押数量');
      return;
    }

    try {
      const amount = parseEther(unstakeAmount);
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: JBCv2_ABI,
        functionName: 'unstake',
        args: [amount],
      });
    } catch (error) {
      toast.error('解除质押失败: ' + (error as Error).message);
    }
  };

  const handleClaimReward = async () => {
    try {
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: JBCv2_ABI,
        functionName: 'claimReward',
      });
    } catch (error) {
      toast.error('领取奖励失败: ' + (error as Error).message);
    }
  };

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) {
      toast.error('请输入转账地址和数量');
      return;
    }

    try {
      const amount = parseEther(transferAmount);
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: JBCv2_ABI,
        functionName: 'transfer',
        args: [transferTo as `0x${string}`, amount],
      });
    } catch (error) {
      toast.error('转账失败: ' + (error as Error).message);
    }
  };

  // 交易成功提示
  useEffect(() => {
    if (isSuccess) {
      toast.success('交易成功!');
      setStakeAmount('');
      setUnstakeAmount('');
      setTransferAmount('');
      setTransferTo('');
    }
  }, [isSuccess]);

  if (!isConnected) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg text-gray-600">请连接钱包以使用 JBC v2.0 功能</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* 头部信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-6 w-6" />
            {tokenInfo} ({symbol}) v{version}
            <Badge variant="secondary">JBC v2.0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">我的余额</p>
              <p className="text-2xl font-bold">
                {balance ? formatEther(balance) : '0'} JBC
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">投票权重</p>
              <p className="text-2xl font-bold">
                {votingPower ? formatEther(votingPower) : '0'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">总供应量</p>
              <p className="text-2xl font-bold">
                {supplyInfo ? formatEther(supplyInfo[0]) : '0'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">流通供应量</p>
              <p className="text-2xl font-bold">
                {supplyInfo ? formatEther(supplyInfo[3]) : '0'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要功能区 */}
      <Tabs defaultValue="stake" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="stake">质押</TabsTrigger>
          <TabsTrigger value="transfer">转账</TabsTrigger>
          <TabsTrigger value="governance">治理</TabsTrigger>
          <TabsTrigger value="analytics">分析</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        {/* 质押标签页 */}
        <TabsContent value="stake" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 质押操作 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  质押 JBC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">质押数量</label>
                  <Input
                    type="number"
                    placeholder="输入质押数量"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">锁定期 (天)</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={lockPeriod}
                    onChange={(e) => setLockPeriod(e.target.value)}
                  >
                    <option value="7">7天 (基础奖励)</option>
                    <option value="15">15天 (增强奖励)</option>
                    <option value="30">30天 (最高奖励)</option>
                    <option value="90">90天 (超级奖励)</option>
                  </select>
                </div>
                <Button 
                  onClick={handleStake} 
                  disabled={isPending || isConfirming}
                  className="w-full"
                >
                  {isPending || isConfirming ? '处理中...' : '质押'}
                </Button>
              </CardContent>
            </Card>

            {/* 解除质押 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Unlock className="h-5 w-5" />
                  解除质押
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stakingInfo && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm">已质押: {formatEther(stakingInfo[0])} JBC</p>
                    <p className="text-sm">待领取奖励: {formatEther(stakingInfo[3])} JBC</p>
                    <p className="text-sm">
                      状态: {stakingInfo[4] ? 
                        <Badge variant="default">可解除</Badge> : 
                        <Badge variant="secondary">锁定中</Badge>
                      }
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">解除数量</label>
                  <Input
                    type="number"
                    placeholder="输入解除质押数量"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleUnstake} 
                    disabled={isPending || isConfirming || !stakingInfo?.[4]}
                    className="flex-1"
                  >
                    解除质押
                  </Button>
                  <Button 
                    onClick={handleClaimReward} 
                    disabled={isPending || isConfirming}
                    variant="outline"
                    className="flex-1"
                  >
                    领取奖励
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 转账标签页 */}
        <TabsContent value="transfer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                转账 JBC
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">接收地址</label>
                <Input
                  placeholder="0x..."
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">转账数量</label>
                <Input
                  type="number"
                  placeholder="输入转账数量"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>
              {taxInfo && (
                <div className="bg-yellow-50 p-3 rounded-md">
                  <p className="text-sm text-yellow-800">
                    💡 转账将收取 {(taxInfo[2] / 100).toFixed(0)}% 的税费 (普通转账免税)
                  </p>
                </div>
              )}
              <Button 
                onClick={handleTransfer} 
                disabled={isPending || isConfirming}
                className="w-full"
              >
                {isPending || isConfirming ? '处理中...' : '转账'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 治理标签页 */}
        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                治理参与
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">治理功能即将推出</p>
                <p className="text-sm text-gray-500">
                  您的投票权重: {votingPower ? formatEther(votingPower) : '0'} JBC
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 分析标签页 */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>供应量分析</CardTitle>
              </CardHeader>
              <CardContent>
                {supplyInfo && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>流通供应量</span>
                        <span>{((Number(formatEther(supplyInfo[3])) / Number(formatEther(supplyInfo[1]))) * 100).toFixed(2)}%</span>
                      </div>
                      <Progress 
                        value={(Number(formatEther(supplyInfo[3])) / Number(formatEther(supplyInfo[1]))) * 100} 
                        className="mt-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">总供应量</p>
                        <p className="font-semibold">{formatEther(supplyInfo[0])}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">最大供应量</p>
                        <p className="font-semibold">{formatEther(supplyInfo[1])}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">已燃烧</p>
                        <p className="font-semibold">{formatEther(supplyInfo[2])}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">流通量</p>
                        <p className="font-semibold">{formatEther(supplyInfo[3])}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>税收信息</CardTitle>
              </CardHeader>
              <CardContent>
                {taxInfo && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>买入税</span>
                      <Badge variant="outline">{(taxInfo[0] / 100).toFixed(0)}%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>卖出税</span>
                      <Badge variant="outline">{(taxInfo[1] / 100).toFixed(0)}%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>转账税</span>
                      <Badge variant="outline">{taxInfo[2] === 0 ? "免税" : (taxInfo[2] / 100).toFixed(0) + "%"}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>税收状态</span>
                      <Badge variant={taxInfo[3] ? "default" : "secondary"}>
                        {taxInfo[3] ? "启用" : "禁用"}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 设置标签页 */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                合约信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>合约地址</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {contractAddress}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span>代币名称</span>
                  <span>{tokenInfo}</span>
                </div>
                <div className="flex justify-between">
                  <span>代币符号</span>
                  <span>{symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>合约版本</span>
                  <Badge>{version}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}