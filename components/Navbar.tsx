import React from 'react';
import { AppTab } from '../types';
import { Diamond, Home, Pickaxe, Users, ArrowLeftRight } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface NavbarProps {
  currentTab: AppTab;
  setTab: (tab: AppTab) => void;
  walletConnected: boolean;
  connectWallet: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentTab, setTab }) => {
  const { t } = useLanguage();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTab(AppTab.HOME)}>
            <div className="bg-gradient-to-tr from-macoin-600 to-macoin-400 p-2 rounded-xl shadow-lg shadow-macoin-500/20">
                <Diamond size={24} className="text-white" />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">MACOIN <span className="text-macoin-600">RWA</span></span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <button 
                onClick={() => setTab(AppTab.HOME)} 
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.HOME ? 'text-macoin-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
                <Home size={18} /> {t.nav.home}
            </button>
            <button 
                onClick={() => setTab(AppTab.MINING)} 
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.MINING ? 'text-macoin-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
                <Pickaxe size={18} /> {t.nav.mining}
            </button>
            <button 
                onClick={() => setTab(AppTab.TEAM)} 
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.TEAM ? 'text-macoin-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
                <Users size={18} /> {t.nav.team}
            </button>
            <button 
                onClick={() => setTab(AppTab.SWAP)} 
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.SWAP ? 'text-macoin-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
                <ArrowLeftRight size={18} /> Swap
            </button>
          </div>

          {/* Wallet Connect */}
          <div className="flex items-center gap-4">
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </div>
        </div>
      </div>

      {/* Mobile Nav (Simple Bottom Bar) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe">
        <div className="flex justify-around items-center h-16">
            <button onClick={() => setTab(AppTab.HOME)} className={`p-2 rounded-lg ${currentTab === AppTab.HOME ? 'text-macoin-600 bg-macoin-50' : 'text-slate-400'}`}>
                <Home size={24} />
            </button>
            <button onClick={() => setTab(AppTab.MINING)} className={`p-2 rounded-lg ${currentTab === AppTab.MINING ? 'text-macoin-600 bg-macoin-50' : 'text-slate-400'}`}>
                <Pickaxe size={24} />
            </button>
            <button onClick={() => setTab(AppTab.SWAP)} className={`p-2 rounded-lg ${currentTab === AppTab.SWAP ? 'text-macoin-600 bg-macoin-50' : 'text-slate-400'}`}>
                <ArrowLeftRight size={24} />
            </button>
            <button onClick={() => setTab(AppTab.TEAM)} className={`p-2 rounded-lg ${currentTab === AppTab.TEAM ? 'text-macoin-600 bg-macoin-50' : 'text-slate-400'}`}>
                <Users size={24} />
            </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;