import React from 'react';
import { AppTab } from '../types';
import { LayoutDashboard, Pickaxe, Users, Repeat, Menu, X, Wallet, Globe } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface NavbarProps {
  currentTab: AppTab;
  setTab: (tab: AppTab) => void;
  walletConnected: boolean;
  connectWallet: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentTab, setTab, walletConnected, connectWallet }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { language, setLanguage, t } = useLanguage();

  const navItems = [
    { id: AppTab.HOME, label: t.nav.home, icon: <LayoutDashboard size={18} /> },
    { id: AppTab.MINING, label: t.nav.mining, icon: <Pickaxe size={18} /> },
    { id: AppTab.TEAM, label: t.nav.team, icon: <Users size={18} /> },
    { id: AppTab.SWAP, label: t.nav.swap, icon: <Repeat size={18} /> },
  ];

  const toggleLanguage = () => {
      setLanguage(language === 'zh' ? 'en' : 'zh');
  }

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/90 backdrop-blur-lg border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTab(AppTab.HOME)}>
            <div className="w-8 h-8 bg-macoin-500 rounded-lg flex items-center justify-center transform rotate-45 shadow-lg shadow-macoin-500/30">
               <div className="w-4 h-4 bg-white transform -rotate-45" />
            </div>
            <div className="flex flex-col">
                <span className="text-xl font-bold tracking-wider text-slate-900">MACOIN</span>
                <span className="text-xs text-macoin-600 tracking-widest font-bold">RWA JINBAO</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                  currentTab === item.id
                    ? 'text-macoin-700 bg-macoin-50 border border-macoin-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* Wallet & Lang Button */}
          <div className="hidden md:flex items-center gap-3">
             <button 
                onClick={toggleLanguage}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                title="Switch Language"
             >
                <div className="flex items-center gap-1 font-bold text-xs">
                    <Globe size={18} />
                    <span>{language.toUpperCase()}</span>
                </div>
             </button>

             <button 
                onClick={connectWallet}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${
                    walletConnected 
                    ? 'bg-slate-100 border border-slate-300 text-slate-700' 
                    : 'bg-macoin-500 hover:bg-macoin-600 text-white shadow-lg shadow-macoin-500/30'
                }`}
             >
                <Wallet size={18} />
                {walletConnected ? t.nav.connected : t.nav.connect}
             </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-4">
            <button 
                onClick={toggleLanguage}
                className="text-slate-500 font-bold text-sm"
            >
                {language.toUpperCase()}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-500 hover:text-slate-900 p-2"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-3 py-3 rounded-md text-base font-medium ${
                  currentTab === item.id
                    ? 'text-macoin-700 bg-macoin-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            <div className="pt-4 pb-2">
                <button 
                    onClick={connectWallet}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold ${
                        walletConnected 
                        ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                        : 'bg-macoin-500 text-white'
                    }`}
                >
                    <Wallet size={18} />
                    {walletConnected ? t.nav.connected : t.nav.connect}
                </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;