import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatsPanel from './components/StatsPanel';
import MiningPanel from './components/MiningPanel';
import TeamLevel from './components/TeamLevel';
import WhitepaperModal from './components/WhitepaperModal';
import SwapPanel from './components/SwapPanel';
import { AppTab } from './types';
import { MOCK_USER_STATS } from './constants';
import { ArrowLeftRight } from 'lucide-react';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { Web3Provider, useWeb3 } from './Web3Context';

// Create an inner component to use the hook
const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.HOME);
  const [loading, setLoading] = useState(true);
  const [showWhitepaper, setShowWhitepaper] = useState(false);
  const { t } = useLanguage();
  const { connectWallet, isConnected } = useWeb3();

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
        setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

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
        walletConnected={isConnected} 
        connectWallet={connectWallet}
      />
      
      <WhitepaperModal 
        isOpen={showWhitepaper} 
        onClose={() => setShowWhitepaper(false)} 
      />

      <main className="pt-24 px-4 sm:px-6 lg:px-8">
        
        {/* Render Tab Content */}
        {currentTab === AppTab.HOME && (
            <StatsPanel 
                stats={MOCK_USER_STATS} 
                onJoinClick={() => setCurrentTab(AppTab.MINING)}
                onWhitepaperClick={() => setShowWhitepaper(true)}
            />
        )}
        
        {currentTab === AppTab.MINING && <MiningPanel />}
        
        {currentTab === AppTab.TEAM && <TeamLevel />}

        {currentTab === AppTab.SWAP && <SwapPanel />}

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
            <Web3Provider>
                <AppContent />
            </Web3Provider>
        </LanguageProvider>
    )
}

export default App;