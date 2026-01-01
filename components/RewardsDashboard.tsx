import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Coins, 
  TrendingUp, 
  Users, 
  Flame, 
  Clock, 
  Gift,
  Target,
  Award
} from 'lucide-react';
import { TimeDisplayFormatter } from '@/utils/TimeDisplayFormatter';

interface RewardsDashboardProps {
  userAddress: string;
  contractInstance: any;
}

interface UserOverview {
  info: {
    totalTickets: string;
    totalStaked: string;
    totalRewards: string;
    referralCount: number;
    teamCount: number;
    vLevel: number;
    isActive: boolean;
  };
  totalTickets: number;
  activeStakes: number;
  pendingDynamicRewards: string;
  claimableDynamicRewards: string;
}

interface SystemStats {
  totalUsers: number;
  totalTicketsSold: string;
  totalStakedAmount: string;
  totalBurnedJBC: string;
  currentBurnRound: number;
  nextBurnTime: number;
}

export const RewardsDashboard: React.FC<RewardsDashboardProps> = ({
  userAddress,
  contractInstance
}) => {
  const [userOverview, setUserOverview] = useState<UserOverview | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [timeFormatter, setTimeFormatter] = useState<TimeDisplayFormatter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeData();
  }, [userAddress, contractInstance]);

  const initializeData = async () => {
    try {
      setLoading(true);

      // 初始化时间格式化器
      const formatter = TimeDisplayFormatter.createFormatter(true);
      setTimeFormatter(formatter);

      // 获取用户概览
      if (userAddress && contractInstance) {
        const overview = await contractInstance.getUserOverview(userAddress);
        setUserOverview({
          info: {
            totalTickets: overview.info.totalTickets.toString(),
            totalStaked: overview.info.totalStaked.toString(),
            totalRewards: overview.info.totalRewards.toString(),
            referralCount: Number(overview.info.referralCount),
            teamCount: Number(overview.info.teamCount),
            vLevel: Number(overview.info.vLevel),
            isActive: overview.info.isActive
          },
          totalTickets: Number(overview.totalTickets),
          activeStakes: Number(overview.activeStakes),
          pendingDynamicRewards: overview.pendingDynamicRewards.toString(),
          claimableDynamicRewards: overview.claimableDynamicRewards.toString()
        });
      }

      // 获取系统统计
      if (contractInstance) {
        const stats = await contractInstance.getSystemStats();
        setSystemStats({
          totalUsers: Number(stats._totalUsers),
          totalTicketsSold: stats._totalTicketsSold.toString(),
          totalStakedAmount: stats._totalStakedAmount.toString(),
          totalBurnedJBC: stats._totalBurnedJBC.toString(),
          currentBurnRound: Number(stats._currentBurnRound),
          nextBurnTime: Number(stats._nextBurnTime)
        });
      }

    } catch (error) {
      console.error('初始化数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimDynamicRewards = async () => {
    try {
      if (!contractInstance) return;
      
      const tx = await contractInstance.claimDynamicRewards();
      await tx.wait();
      
      // 刷新数据
      await initializeData();
      
      // 显示成功通知
      console.log('动态奖励提取成功');
    } catch (error) {
      console.error('提取动态奖励失败:', error);
    }
  };

  const getVLevelInfo = (vLevel: number) => {
    const levels = [
      { level: 0, name: 'V0', color: 'bg-gray-500', percent: 0 },
      { level: 1, name: 'V1', color: 'bg-green-500', percent: 5 },
      { level: 2, name: 'V2', color: 'bg-blue-500', percent: 10 },
      { level: 3, name: 'V3', color: 'bg-purple-500', percent: 15 },
      { level: 4, name: 'V4', color: 'bg-pink-500', percent: 20 },
      { level: 5, name: 'V5', color: 'bg-yellow-500', percent: 25 },
      { level: 6, name: 'V6', color: 'bg-orange-500', percent: 30 },
      { level: 7, name: 'V7', color: 'bg-red-500', percent: 35 },
      { level: 8, name: 'V8', color: 'bg-indigo-500', percent: 40 },
      { level: 9, name: 'V9', color: 'bg-gradient-to-r from-yellow-400 to-red-500', percent: 45 }
    ];
    
    return levels.find(l => l.level === vLevel) || levels[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  const vLevelInfo = userOverview ? getVLevelInfo(userOverview.info.vLevel) : null;

  return (
    <div className="space-y-6">
      {/* 时间单位状态指示器 */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium">
              ✅ 时间单位已修复 - 现在使用真实天数计算
            </span>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              86400秒/天
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 用户概览 */}
      {userOverview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">V等级</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge className={`${vLevelInfo?.color} text-white`}>
                  {vLevelInfo?.name}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {vLevelInfo?.percent}% 极差收益
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                团队: {userOverview.info.teamCount} 人
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总门票</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userOverview.totalTickets}
              </div>
              <p className="text-xs text-muted-foreground">
                价值 {(Number(userOverview.info.totalTickets) / 1e18).toFixed(2)} MC
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃质押</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userOverview.activeStakes}
              </div>
              <p className="text-xs text-muted-foreground">
                总额 {(Number(userOverview.info.totalStaked) / 1e18).toFixed(2)} MC
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">推荐团队</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userOverview.info.referralCount}
              </div>
              <p className="text-xs text-muted-foreground">
                直推人数
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 四种奖励机制 */}
      <Tabs defaultValue="dynamic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="static">静态奖励</TabsTrigger>
          <TabsTrigger value="dynamic">动态奖励</TabsTrigger>
          <TabsTrigger value="burn">燃烧奖励</TabsTrigger>
          <TabsTrigger value="trading">交易奖励</TabsTrigger>
        </TabsList>

        <TabsContent value="static" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>静态奖励 (质押挖矿)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">2.0%</div>
                    <div className="text-sm text-blue-800">7天质押日收益</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">2.5%</div>
                    <div className="text-sm text-green-800">15天质押日收益</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">3.0%</div>
                    <div className="text-sm text-purple-800">30天质押日收益</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  基于质押金额和周期的固定收益，每日自动生成，到期可提取
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dynamic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Gift className="h-5 w-5" />
                  <span>动态奖励 (推荐奖励)</span>
                </div>
                {userOverview && Number(userOverview.claimableDynamicRewards) > 0 && (
                  <Button onClick={handleClaimDynamicRewards} size="sm">
                    提取奖励
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userOverview && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <div className="text-lg font-bold text-yellow-600">
                        {(Number(userOverview.pendingDynamicRewards) / 1e18).toFixed(4)} MC
                      </div>
                      <div className="text-sm text-yellow-800">待解锁奖励</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">
                        {(Number(userOverview.claimableDynamicRewards) / 1e18).toFixed(4)} MC
                      </div>
                      <div className="text-sm text-green-800">可提取奖励</div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">直推奖励</span>
                    <Badge variant="secondary">25% MC (即时解锁)</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">层级奖励</span>
                    <Badge variant="secondary">1% MC × 15层 (即时解锁)</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">极差奖励</span>
                    <Badge variant="secondary">V0-V9差额 (30天解锁)</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="burn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Flame className="h-5 w-5" />
                <span>燃烧奖励 (日燃烧分红)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemStats && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50 rounded-lg">
                      <div className="text-lg font-bold text-red-600">
                        {(Number(systemStats.totalBurnedJBC) / 1e18).toFixed(2)} JBC
                      </div>
                      <div className="text-sm text-red-800">总燃烧数量</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <div className="text-lg font-bold text-orange-600">
                        第 {systemStats.currentBurnRound} 轮
                      </div>
                      <div className="text-sm text-orange-800">当前燃烧轮次</div>
                    </div>
                  </div>
                )}
                
                {systemStats && timeFormatter && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-800">下次燃烧时间</div>
                    <div className="text-lg font-bold text-blue-600">
                      {timeFormatter.formatBurnCountdown(systemStats.nextBurnTime)}
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground">
                  每24小时燃烧JBC代币，燃烧收益按用户活跃度和持仓比例分配
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>交易奖励 (AMM手续费分红)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">MC/JBC 交易对</div>
                    <div className="text-sm text-purple-800">AMM自动做市商</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">交易手续费</span>
                    <Badge variant="secondary">0.3%</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">分红比例</span>
                    <Badge variant="secondary">基于贡献度</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">奖励代币</span>
                    <Badge variant="secondary">MC + JBC</Badge>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  参与AMM流动性提供和交易，获得手续费分红奖励
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 系统统计 */}
      {systemStats && (
        <Card>
          <CardHeader>
            <CardTitle>系统统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {systemStats.totalUsers}
                </div>
                <div className="text-sm text-muted-foreground">总用户数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(Number(systemStats.totalTicketsSold) / 1e18).toFixed(0)}
                </div>
                <div className="text-sm text-muted-foreground">门票销售 (MC)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(Number(systemStats.totalStakedAmount) / 1e18).toFixed(0)}
                </div>
                <div className="text-sm text-muted-foreground">总质押 (MC)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {(Number(systemStats.totalBurnedJBC) / 1e18).toFixed(0)}
                </div>
                <div className="text-sm text-muted-foreground">总燃烧 (JBC)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RewardsDashboard;