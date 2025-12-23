import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface WhitepaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WhitepaperModal: React.FC<WhitepaperModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  
  if (!isOpen) return null;

  const isChinese = language === 'zh';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-neon-500/20 overflow-hidden flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gradient-to-r from-neon-500/10 to-amber-500/10 z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">
                {isChinese ? '金宝协议白皮书' : 'Jinbao Protocol Whitepaper'}
            </h2>
            <p className="text-sm text-gray-400">
                {isChinese ? 'DeFi 4.0 • 双币持续上涨新纪元' : 'DeFi 4.0 • Dual-Token Architecture'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 sm:p-10 space-y-8 text-gray-300 leading-relaxed bg-gray-900/50">
          
          {isChinese ? (
              // Chinese Content
              <>
                <section>
                    <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-neon-500 pl-3">
                    一、JBC分配机制和交易规则
                    </h3>
                    <ul className="list-disc pl-5 space-y-2">
                    <li><strong>发行总量:</strong> 1亿枚 JBC</li>
                    <ul className="list-circle pl-5 mt-1 space-y-1 text-gray-400">
                        <li><strong>流动性池 (LP):</strong> 500万 (权限全丢/销毁)</li>
                        <li><strong>流动性挖矿产出:</strong> 9500万</li>
                    </ul>
                    <li><strong>卖出滑点:</strong> 25% (25%进入黑洞地址销毁)</li>
                    <li><strong>买入滑点:</strong> 50% (50%进入黑洞地址销毁)</li>
                    <li><strong>每日通缩:</strong> JBC底池每日自动销毁1%数量</li>
                    <li><strong>卖出机制:</strong> JBC卖出时50%币量直接销毁，50%回到底池，用户拿到原交易量的金额。
                        <p className="mt-1 text-sm bg-gray-800/50 p-2 rounded text-gray-400 italic border border-gray-700">
                        举例：JBC此时价格为1$，用户卖出100枚JBC，50枚JBC进入黑洞销毁地址，剩余50枚JBC回到底池，用户获得100$的MC。
                        </p>
                    </li>
                    </ul>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-neon-500 pl-3">
                    二、参与机制和动静态收益
                    </h3>
                    
                    <div className="mb-6">
                        <h4 className="font-bold text-white mb-2">1. 门票端分配机制</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="font-bold text-neon-400">25%</span> 直推奖励
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="font-bold text-amber-400">15%</span> 层级奖 (推荐1-3个有效地址拿5-15层)
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="font-bold text-amber-400">25%</span> 国库资金 (黄金托底)
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="font-bold text-neon-400">25%</span> 增加底池资金厚度
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 col-span-1 sm:col-span-2">
                                <span className="font-bold text-neon-400">5%</span> 市场基金 & <span className="font-bold text-amber-400">5%</span> 直接进入底池购买JBC
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-white mb-2">2. 流动性要求</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-800/50 text-gray-400 uppercase font-mono">
                                    <tr>
                                        <th className="p-3">门票</th>
                                        <th className="p-3">所需流动性</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    <tr><td className="p-3 font-bold text-neon-400">100 MC</td><td className="p-3">150 MC</td></tr>
                                    <tr><td className="p-3 font-bold text-neon-400">300 MC</td><td className="p-3">450 MC</td></tr>
                                    <tr><td className="p-3 font-bold text-neon-400">500 MC</td><td className="p-3">750 MC</td></tr>
                                    <tr><td className="p-3 font-bold text-neon-400">1000 MC</td><td className="p-3">1500 MC</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-white mb-2">3. 提供流动性收益比例</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>7天周期:</strong> 日化 2.0%</li>
                            <li><strong>15天周期:</strong> 日化 2.5%</li>
                            <li><strong>30天周期:</strong> 日化 3.0%</li>
                        </ul>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-white mb-2">4. 结算机制</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>投入:</strong> MC</li>
                            <li><strong>产出:</strong> 50% MC + 50% JBC</li>
                            <li><strong>说明:</strong> MC币本位结算，JBC金本位结算。</li>
                        </ul>
                    </div>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-neon-500 pl-3">
                    三、极差裂变机制 (V1-V9)
                    </h3>
                    <p className="mb-4">获得 5% 至 45% 的极差收益。</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-800/50 text-gray-400 uppercase font-mono">
                                <tr>
                                    <th className="p-2">等级</th>
                                    <th className="p-2">要求有效地址数</th>
                                    <th className="p-2">极差奖励比例</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                <tr><td className="p-2 font-bold text-neon-400">V1</td><td className="p-2">10</td><td className="p-2 text-amber-400">5%</td></tr>
                                <tr><td className="p-2 font-bold text-neon-400">V2</td><td className="p-2">30</td><td className="p-2 text-amber-400">10%</td></tr>
                                <tr><td className="p-2 font-bold text-neon-400">V3</td><td className="p-2">100</td><td className="p-2 text-amber-400">15%</td></tr>
                                <tr><td className="p-2 font-bold text-neon-400">V4</td><td className="p-2">300</td><td className="p-2 text-amber-400">20%</td></tr>
                                <tr><td className="p-2 font-bold text-neon-400">V5</td><td className="p-2">1,000</td><td className="p-2 text-amber-400">25%</td></tr>
                                <tr><td className="p-2 font-bold text-neon-400">V6</td><td className="p-2">3,000</td><td className="p-2 text-amber-400">30%</td></tr>
                                <tr><td className="p-2 font-bold text-neon-400">V7</td><td className="p-2">10,000</td><td className="p-2 text-amber-400">35%</td></tr>
                                <tr><td className="p-2 font-bold text-neon-400">V8</td><td className="p-2">30,000</td><td className="p-2 text-amber-400">40%</td></tr>
                                <tr><td className="p-2 font-bold text-neon-400">V9</td><td className="p-2">100,000</td><td className="p-2 text-amber-400">45%</td></tr>
                            </tbody>
                        </table>
                        <p className="text-xs text-gray-500 mt-2">* 完整表格请参阅详细文档</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-neon-500 pl-3">
                    四、双币燃烧持续上涨设计
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                            <h5 className="font-bold text-amber-400 mb-2">一份投资两份收益</h5>
                            <p className="text-sm text-gray-300">MC + JBC 双币收益，财富双倍增长。</p>
                        </div>
                        <div className="p-4 bg-neon-500/10 rounded-xl border border-neon-500/30">
                            <h5 className="font-bold text-neon-400 mb-2">完全公开透明</h5>
                            <p className="text-sm text-gray-300">权限全丢，链上可查，公平公正。</p>
                        </div>
                        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                            <h5 className="font-bold text-amber-400 mb-2">超强长寿基因</h5>
                            <p className="text-sm text-gray-300">多保险托底 (黄金储备 + 国库)，确保长期稳定。</p>
                        </div>
                    </div>
                </section>
              </>
          ) : (
              // English Content
              <>
                <section>
                    <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-neon-500 pl-3">
                    I. JBC Allocation Mechanism and Trading Rules
                    </h3>
                    <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Total Supply:</strong> 100 Million JBC</li>
                    <ul className="list-circle pl-5 mt-1 space-y-1 text-gray-400">
                        <li><strong>Liquidity Pool (LP):</strong> 5 Million (Permissions Relinquished/Burnt)</li>
                        <li><strong>Liquidity Mining Output:</strong> 95 Million</li>
                    </ul>
                    <li><strong>Sell Slippage:</strong> 25% (25% sent to Black Hole Address for burning)</li>
                    <li><strong>Buy Slippage:</strong> 50% (50% sent to Black Hole Address for burning)</li>
                    <li><strong>Daily Deflation:</strong> 1% of the JBC Liquidity Pool is automatically burnt daily.</li>
                    <li><strong>Selling Mechanism:</strong> When selling JBC, 50% of the token amount is directly burnt, and 50% returns to the pool. The user receives the USDT/MC value equivalent to the original transaction amount.
                        <p className="mt-1 text-sm bg-gray-800/50 p-2 rounded text-gray-400 italic border border-gray-700">
                        Example: If JBC price is $1 and a user sells 100 JBC: 50 JBC go to the black hole (burnt), 50 JBC return to the pool, and the user receives $100 worth of MC.
                        </p>
                    </li>
                    </ul>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-neon-500 pl-3">
                    II. Participation Mechanism & Dynamic/Static Rewards
                    </h3>
                    
                    <div className="mb-6">
                        <h4 className="font-bold text-white mb-2">1. Ticket Fund Allocation</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="font-bold text-neon-400">25%</span> Direct Referral Reward
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="font-bold text-amber-400">15%</span> Level Reward (15 Layers)
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="font-bold text-amber-400">25%</span> Treasury Fund (Gold-Backed)
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="font-bold text-neon-400">25%</span> Liquidity Injection
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-white mb-2">2. Liquidity Requirements</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-800/50 text-gray-400 uppercase font-mono">
                                    <tr>
                                        <th className="p-3">Ticket</th>
                                        <th className="p-3">Required Liquidity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    <tr><td className="p-3 font-bold text-neon-400">100 MC</td><td className="p-3">150 MC</td></tr>
                                    <tr><td className="p-3 font-bold text-neon-400">300 MC</td><td className="p-3">450 MC</td></tr>
                                    <tr><td className="p-3 font-bold text-neon-400">500 MC</td><td className="p-3">750 MC</td></tr>
                                    <tr><td className="p-3 font-bold text-neon-400">1000 MC</td><td className="p-3">1500 MC</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-white mb-2">3. Mining Rewards & Settlement</h4>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>Cycles:</strong> 7 Days (2.0%), 15 Days (2.5%), 30 Days (3.0%)</li>
                            <li><strong>Settlement:</strong> 50% MC (Coin-Based) + 50% JBC (Gold-Based)</li>
                            <li><strong>Redemption:</strong> 1% Fee applies. Principal + Interest returned automatically upon maturity.</li>
                        </ul>
                    </div>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-neon-500 pl-3">
                    III. V-Series Differential Fission Mechanism
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-800/50 text-gray-400 uppercase font-mono">
                                <tr>
                                    <th className="p-3">Level</th>
                                    <th className="p-3">Active Addrs</th>
                                    <th className="p-3">Reward Ratio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 bg-gray-900/30">
                                <tr><td className="p-3 font-bold text-neon-400">V1</td><td className="p-3">10</td><td className="p-3 text-amber-400 font-bold">5%</td></tr>
                                <tr><td className="p-3 font-bold text-neon-400">V2</td><td className="p-3">30</td><td className="p-3 text-amber-400 font-bold">10%</td></tr>
                                <tr><td className="p-3 font-bold text-neon-400">V3</td><td className="p-3">100</td><td className="p-3 text-amber-400 font-bold">15%</td></tr>
                                <tr><td className="p-3 font-bold text-neon-400">V4</td><td className="p-3">300</td><td className="p-3 text-amber-400 font-bold">20%</td></tr>
                                <tr><td className="p-3 font-bold text-neon-400">V5</td><td className="p-3">1,000</td><td className="p-3 text-amber-400 font-bold">25%</td></tr>
                                <tr><td className="p-3 font-bold text-neon-400">V6</td><td className="p-3">3,000</td><td className="p-3 text-amber-400 font-bold">30%</td></tr>
                                <tr><td className="p-3 font-bold text-neon-400">V7</td><td className="p-3">10,000</td><td className="p-3 text-amber-400 font-bold">35%</td></tr>
                                <tr><td className="p-3 font-bold text-neon-400">V8</td><td className="p-3">30,000</td><td className="p-3 text-amber-400 font-bold">40%</td></tr>
                                <tr><td className="p-3 font-bold text-neon-400">V9</td><td className="p-3">100,000</td><td className="p-3 text-amber-400 font-bold">45%</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-neon-500 pl-3">
                    IV. Sustainable Growth Design
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                            <h5 className="font-bold text-amber-400 mb-2">Double Revenue</h5>
                            <p className="text-sm text-gray-300">One investment, two types of asset returns (MC + JBC).</p>
                        </div>
                        <div className="p-4 bg-neon-500/10 rounded-xl border border-neon-500/30">
                            <h5 className="font-bold text-neon-400 mb-2">Transparency</h5>
                            <p className="text-sm text-gray-300">Fully open and transparent; Contract permissions relinquished.</p>
                        </div>
                        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                            <h5 className="font-bold text-amber-400 mb-2">Strong Foundation</h5>
                            <p className="text-sm text-gray-300">Multi-insurance backing (Gold Reserves + Treasury).</p>
                        </div>
                    </div>
                </section>
              </>
          )}

        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-900/80 flex justify-end">
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-gradient-to-r from-neon-500 to-neon-600 text-black font-bold rounded-lg hover:from-neon-400 hover:to-neon-500 transition-colors shadow-lg shadow-neon-500/30"
            >
                {isChinese ? '关闭' : 'Close'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default WhitepaperModal;
