import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatsPanel from './components/StatsPanel';
import MiningPanel from './components/MiningPanel';
import TeamLevel from './components/TeamLevel';
import WhitepaperModal from './components/WhitepaperModal';
import SwapPanel from './components/SwapPanel';
import AdminPanel from './components/AdminPanel';
import NoticeBar from './components/NoticeBar';
import { AppTab } from './types';
import { MOCK_USER_STATS } from './constants';
import { ArrowLeftRight } from 'lucide-react';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { Web3Provider, useWeb3 } from './Web3Context';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './config';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

// Create an inner component to use the hook
const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.HOME);
  const [loading, setLoading] = useState(true);
  const [showWhitepaper, setShowWhitepaper] = useState(false);
  const { t } = useLanguage();

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
                <h1 className="text-2xl font-bold text-slate-900 tracking-widest animate-pulse">JBC <span className="text-macoin-600">RWA</span></h1>
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
      />
      
      <NoticeBar />

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

        {currentTab === AppTab.ADMIN && <AdminPanel />}

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

import { Toaster } from 'react-hot-toast';

// ...

const App: React.FC = () => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    <LanguageProvider>
                        <Web3Provider>
                            <AppContent />
                            <Toaster position="top-center" />
                        </Web3Provider>
                    </LanguageProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}

export default App;