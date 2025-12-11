import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatsPanel from './components/StatsPanel';
import MiningPanel from './components/MiningPanel';
import TeamLevel from './components/TeamLevel';
import { AppTab } from './types';
import { MOCK_USER_STATS } from './constants';
import { ArrowLeftRight } from 'lucide-react';
import { LanguageProvider, useLanguage } from './LanguageContext';

// Create an inner component to use the hook
const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.HOME);
  const [walletConnected, setWalletConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
        setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleConnectWallet = () => {
    setWalletConnected(true);
  };

  if (loading) {
    return (
        <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-macoin-500 rounded-xl animate-spin mb-8 shadow-xl"></div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-widest animate-pulse">MACOIN <span className="text-macoin-600">RWA</span></h1>
                <p className="text-slate-500 text-sm mt-2">Loading Protocol Data...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-macoin-200 selection:text-black font-sans pb-20">
      <Navbar 
        currentTab={currentTab} 
        setTab={setCurrentTab} 
        walletConnected={walletConnected} 
        connectWallet={handleConnectWallet}
      />

      <main className="pt-24 px-4 sm:px-6 lg:px-8">
        
        {/* Render Tab Content */}
        {currentTab === AppTab.HOME && <StatsPanel stats={MOCK_USER_STATS} />}
        
        {currentTab === AppTab.MINING && <MiningPanel />}
        
        {currentTab === AppTab.TEAM && <TeamLevel />}

        {currentTab === AppTab.SWAP && (
             <div className="max-w-md mx-auto mt-10 glass-panel p-8 rounded-3xl relative">
                <div className="absolute inset-0 bg-macoin-500/5 blur-3xl rounded-full"></div>
                <h2 className="text-2xl font-bold mb-6 text-center relative z-10 text-slate-900">{t.swap.title}</h2>
                
                <div className="space-y-4 relative z-10">
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                        <div className="flex justify-between text-sm text-slate-500 mb-2">
                            <span>{t.swap.pay}</span>
                            <span>{t.swap.balance}: {MOCK_USER_STATS.balanceMC} MC</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <input type="number" placeholder="0.0" className="bg-transparent text-2xl font-bold focus:outline-none w-full text-slate-900" />
                            <span className="bg-white px-3 py-1 rounded-lg font-bold border border-slate-200 shadow-sm text-slate-700">MC</span>
                        </div>
                    </div>

                    <div className="flex justify-center -my-2 relative z-20">
                        <button className="bg-white border border-macoin-500 p-2 rounded-full text-macoin-600 hover:rotate-180 transition-transform duration-500 shadow-sm">
                            <ArrowLeftRight size={20} />
                        </button>
                    </div>

                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                         <div className="flex justify-between text-sm text-slate-500 mb-2">
                            <span>{t.swap.get}</span>
                            <span>{t.swap.balance}: {MOCK_USER_STATS.balanceJBC} JBC</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <input type="number" placeholder="0.0" disabled className="bg-transparent text-2xl font-bold focus:outline-none w-full text-slate-400" />
                            <span className="bg-white px-3 py-1 rounded-lg font-bold border border-slate-200 shadow-sm text-slate-700">JBC</span>
                        </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-xs text-red-600">
                        <p>{t.swap.slipSell}</p>
                        <p>{t.swap.slipBuy}</p>
                    </div>

                    <button className="w-full py-4 bg-macoin-500 text-white font-bold text-lg rounded-xl hover:bg-macoin-600 transition-colors shadow-lg shadow-macoin-500/20">
                        {t.swap.confirm}
                    </button>
                </div>
             </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p className="mb-2">{t.footer.rights}</p>
            <p>{t.footer.audit}</p>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    )
}

export default App;