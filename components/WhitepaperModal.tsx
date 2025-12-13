import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface WhitepaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WhitepaperModal: React.FC<WhitepaperModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Jinbao Protocol Whitepaper</h2>
            <p className="text-sm text-slate-500">DeFi 4.0 • Dual-Token Architecture</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
          
          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-4 border-l-4 border-macoin-500 pl-3">
              I. JBC Allocation Mechanism and Trading Rules
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Total Supply:</strong> 100 Million JBC</li>
              <ul className="list-circle pl-5 mt-1 space-y-1 text-slate-600">
                <li><strong>Liquidity Pool (LP):</strong> 5 Million (Permissions Relinquished/Burnt)</li>
                <li><strong>Liquidity Mining Output:</strong> 95 Million</li>
              </ul>
              <li><strong>Sell Slippage:</strong> 25% (25% sent to Black Hole Address for burning)</li>
              <li><strong>Buy Slippage:</strong> 50% (50% sent to Black Hole Address for burning)</li>
              <li><strong>Daily Deflation:</strong> 1% of the JBC Liquidity Pool is automatically burnt daily.</li>
              <li><strong>Selling Mechanism:</strong> When selling JBC, 50% of the token amount is directly burnt, and 50% returns to the pool. The user receives the USDT/MC value equivalent to the original transaction amount.
                <p className="mt-1 text-sm bg-slate-50 p-2 rounded text-slate-500 italic">
                  Example: If JBC price is $1 and a user sells 100 JBC: 50 JBC go to the black hole (burnt), 50 JBC return to the pool, and the user receives $100 worth of MC.
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-4 border-l-4 border-macoin-500 pl-3">
              II. Participation Mechanism & Dynamic/Static Rewards
            </h3>
            
            <div className="mb-6">
                <h4 className="font-bold text-slate-800 mb-2">1. Ticket Fund Allocation</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="font-bold text-macoin-600">25%</span> Direct Referral Reward
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="font-bold text-blue-600">15%</span> Level Reward (15 Layers)
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="font-bold text-purple-600">25%</span> Treasury Fund (Gold-Backed)
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="font-bold text-orange-600">25%</span> Liquidity Injection
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <h4 className="font-bold text-slate-800 mb-2">2. Liquidity Requirements</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-mono">
                            <tr>
                                <th className="p-3">Ticket</th>
                                <th className="p-3">Required Liquidity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr><td className="p-3 font-bold">100 MC</td><td className="p-3">150 MC</td></tr>
                            <tr><td className="p-3 font-bold">300 MC</td><td className="p-3">450 MC</td></tr>
                            <tr><td className="p-3 font-bold">500 MC</td><td className="p-3">750 MC</td></tr>
                            <tr><td className="p-3 font-bold">1000 MC</td><td className="p-3">1500 MC</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <h4 className="font-bold text-slate-800 mb-2">3. Mining Rewards & Settlement</h4>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Cycles:</strong> 7 Days (2.0%), 15 Days (2.5%), 30 Days (3.0%)</li>
                    <li><strong>Settlement:</strong> 50% MC (Coin-Based) + 50% JBC (Gold-Based)</li>
                    <li><strong>Redemption:</strong> 1% Fee applies. Principal + Interest returned automatically upon maturity.</li>
                </ul>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-4 border-l-4 border-macoin-500 pl-3">
              III. V-Series Differential Fission Mechanism
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-mono">
                        <tr>
                            <th className="p-3">Level</th>
                            <th className="p-3">Active Addrs</th>
                            <th className="p-3">Reward Ratio</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        <tr><td className="p-3 font-bold">V1</td><td className="p-3">10</td><td className="p-3 text-macoin-600 font-bold">5%</td></tr>
                        <tr><td className="p-3 font-bold">V2</td><td className="p-3">30</td><td className="p-3 text-macoin-600 font-bold">10%</td></tr>
                        <tr><td className="p-3 font-bold">V3</td><td className="p-3">100</td><td className="p-3 text-macoin-600 font-bold">15%</td></tr>
                        <tr><td className="p-3 font-bold">V4</td><td className="p-3">300</td><td className="p-3 text-macoin-600 font-bold">20%</td></tr>
                        <tr><td className="p-3 font-bold">V5</td><td className="p-3">1,000</td><td className="p-3 text-macoin-600 font-bold">25%</td></tr>
                        <tr><td className="p-3 font-bold">V6</td><td className="p-3">3,000</td><td className="p-3 text-macoin-600 font-bold">30%</td></tr>
                        <tr><td className="p-3 font-bold">V7</td><td className="p-3">10,000</td><td className="p-3 text-macoin-600 font-bold">35%</td></tr>
                        <tr><td className="p-3 font-bold">V8</td><td className="p-3">30,000</td><td className="p-3 text-macoin-600 font-bold">40%</td></tr>
                        <tr><td className="p-3 font-bold">V9</td><td className="p-3">100,000</td><td className="p-3 text-macoin-600 font-bold">45%</td></tr>
                    </tbody>
                </table>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-4 border-l-4 border-macoin-500 pl-3">
              IV. Sustainable Growth Design
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                    <h5 className="font-bold text-yellow-800 mb-2">Double Revenue</h5>
                    <p className="text-sm text-yellow-700">One investment, two types of asset returns (MC + JBC).</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                    <h5 className="font-bold text-green-800 mb-2">Transparency</h5>
                    <p className="text-sm text-green-700">Fully open and transparent; Contract permissions relinquished.</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h5 className="font-bold text-blue-800 mb-2">Strong Foundation</h5>
                    <p className="text-sm text-blue-700">Multi-insurance backing (Gold Reserves + Treasury).</p>
                </div>
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default WhitepaperModal;
