import React, { useEffect, useState } from 'react';
import { AppTab } from '../types';
import { Diamond, Home, Pickaxe, Users, ArrowLeftRight, Settings, PlusCircle, Globe, ChevronDown } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWeb3 } from '../Web3Context';
import { useChainId, useSwitchChain } from 'wagmi';

interface NavbarProps {
  currentTab: AppTab;
  setTab: (tab: AppTab) => void;
  walletConnected: boolean;
  connectWallet: () => void;
}

const LANGUAGES = [
    { code: 'zh', label: '简体中文' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'ar', label: 'العربية' }
];

const Navbar: React.FC<NavbarProps> = ({ currentTab, setTab }) => {
  const { t, language, setLanguage } = useLanguage();
  const { protocolContract, account, isConnected } = useWeb3();
  const [isOwner, setIsOwner] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const MC_CHAIN_ID = 88813;

  useEffect(() => {
    const checkOwner = async () => {
      if (protocolContract && account) {
        try {
          const owner = await protocolContract.owner();
          setIsOwner(owner.toLowerCase() === account.toLowerCase());
        } catch (e) {
          console.error("Failed to check owner", e);
        }
      }
    };
    checkOwner();
  }, [protocolContract, account]);

  // Automatic Chain Switching/Adding
  useEffect(() => {
      const ensureMcChain = async () => {
          if (isConnected && chainId !== MC_CHAIN_ID) {
              console.log("Incorrect chain detected. Attempting to switch to MC Chain...");
              // Try standard switch first if available in wallet (via Wagmi)
              if (switchChain) {
                  try {
                      switchChain({ chainId: MC_CHAIN_ID });
                      return; 
                  } catch (error) {
                      console.log("Switch chain via wagmi failed, trying wallet_addEthereumChain...", error);
                  }
              }

              // Fallback to manual add/switch
              await addMcChain();
          }
      };

      ensureMcChain();
  }, [isConnected, chainId, switchChain]);

  const addMcChain = async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x15AF5', // 88813 in hex
                    chainName: 'MC Chain',
                    nativeCurrency: {
                        name: 'MC',
                        symbol: 'MC',
                        decimals: 18
                    },
                    rpcUrls: ['https://chain.mcerscan.com/'],
                    blockExplorerUrls: ['https://mcerscan.com']
                }]
            });
        } catch (error) {
            console.error("Failed to add network", error);
        }
    } else {
        // Silent fail or minimal log, don't alert automatically to annoy user
        console.warn("Wallet extension not found for auto-add network.");
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTab(AppTab.HOME)}>
              <div className="bg-gradient-to-tr from-macoin-600 to-macoin-400 p-2 rounded-xl shadow-lg shadow-macoin-500/20">
                  <Diamond size={24} className="text-white" />
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">JBC <span className="text-macoin-600">RWA</span></span>
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
              {isOwner && (
                  <button 
                      onClick={() => setTab(AppTab.ADMIN)} 
                      className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.ADMIN ? 'text-red-600' : 'text-slate-500 hover:text-red-600'}`}
                  >
                      <Settings size={18} /> Admin
                  </button>
              )}
            </div>

            {/* Wallet Connect */}
            <div className="flex items-center gap-4">
               <div className="relative">
                   <button
                      onClick={() => setIsLangOpen(!isLangOpen)}
                      className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-2"
                      title="Switch Language"
                   >
                      <Globe size={20} />
                      <span className="text-sm font-bold hidden sm:inline">
                          {LANGUAGES.find(l => l.code === language)?.label || 'Language'}
                      </span>
                      <ChevronDown size={16} />
                   </button>
                   
                   {isLangOpen && (
                       <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-1 z-50">
                           {LANGUAGES.map((lang) => (
                               <button
                                   key={lang.code}
                                   onClick={() => {
                                       setLanguage(lang.code as any);
                                       setIsLangOpen(false);
                                   }}
                                   className={`w-full px-4 py-2 text-left text-sm font-medium hover:bg-slate-50 transition-colors ${language === lang.code ? 'text-macoin-600 bg-macoin-50' : 'text-slate-600'}`}
                               >
                                   {lang.label}
                               </button>
                           ))}
                       </div>
                   )}
               </div>
               {/* Button removed as requested for auto-logic */}
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Nav (Simple Bottom Bar) - Moved out of nav to ensure fixed positioning works correctly */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around items-center h-16">
            <button onClick={() => setTab(AppTab.HOME)} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.HOME ? 'text-macoin-600 bg-macoin-50' : 'text-slate-400'}`}>
                <Home size={20} />
                <span className="text-[10px] font-medium">{t.nav.home}</span>
            </button>
            <button onClick={() => setTab(AppTab.MINING)} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.MINING ? 'text-macoin-600 bg-macoin-50' : 'text-slate-400'}`}>
                <Pickaxe size={20} />
                <span className="text-[10px] font-medium">{t.nav.mining}</span>
            </button>
            <button onClick={() => setTab(AppTab.SWAP)} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.SWAP ? 'text-macoin-600 bg-macoin-50' : 'text-slate-400'}`}>
                <ArrowLeftRight size={20} />
                <span className="text-[10px] font-medium">Swap</span>
            </button>
            <button onClick={() => setTab(AppTab.TEAM)} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.TEAM ? 'text-macoin-600 bg-macoin-50' : 'text-slate-400'}`}>
                <Users size={20} />
                <span className="text-[10px] font-medium">{t.nav.team}</span>
            </button>
             {isOwner && (
                <button onClick={() => setTab(AppTab.ADMIN)} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.ADMIN ? 'text-red-600 bg-red-50' : 'text-slate-400'}`}>
                    <Settings size={20} />
                    <span className="text-[10px] font-medium">Admin</span>
                </button>
            )}
        </div>
      </div>
    </>
  );
};

export default Navbar;