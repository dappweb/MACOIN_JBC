import React, { useEffect, useState } from "react"
import { AppTab } from "../src/types"
import { Diamond, Home, Pickaxe, Users, ArrowLeftRight, Settings, PlusCircle, Globe, FileText, Gift, AlertTriangle, LogOut, Copy, Check, ChevronDown, Wallet } from "lucide-react"
import { useLanguage } from "../src/LanguageContext"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useWeb3 } from "../src/Web3Context"
import { useChainId, useSwitchChain } from "wagmi"

interface NavbarProps {
  currentTab: AppTab
  setTab: (tab: AppTab) => void
  walletConnected: boolean
  connectWallet: () => void
}

const Navbar: React.FC<NavbarProps> = ({ currentTab, setTab }) => {
  const { t, language, setLanguage } = useLanguage()
  const { protocolContract, account, isConnected, disconnectWallet } = useWeb3()
  const [isOwner, setIsOwner] = useState(false)
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const MC_CHAIN_ID = 88813

  useEffect(() => {
    const checkOwner = async () => {
      console.log("Navbar Debug Info:", {
        account,
        chainId,
        isConnected,
        protocolAddress: await protocolContract?.getAddress().catch(() => "Unknown"),
      });

      if (protocolContract && account) {
        try {
          const owner = await protocolContract.owner()
          console.log("Navbar Check Owner:", {
            contractOwner: owner,
            userAccount: account,
            isMatch: owner.toLowerCase() === account.toLowerCase()
          });
          setIsOwner(owner.toLowerCase() === account.toLowerCase())
        } catch (e) {
          console.error("Failed to check owner", e)
        }
      }
    }
    checkOwner()
  }, [protocolContract, account, chainId])

  // Automatic Chain Switching/Adding - DISABLED to allow multi-network support
  // Users can manually switch networks using their wallet or the ConnectButton
  // useEffect(() => {
  //     const ensureMcChain = async () => {
  //         if (isConnected && chainId !== MC_CHAIN_ID) {
  //             console.log("Incorrect chain detected. Attempting to switch to MC Chain...");
  //             // Try standard switch first if available in wallet (via Wagmi)
  //             if (switchChain) {
  //                 try {
  //                     switchChain({ chainId: MC_CHAIN_ID });
  //                     return;
  //                 } catch (error) {
  //                     console.log("Switch chain via wagmi failed, trying wallet_addEthereumChain...", error);
  //                 }
  //             }

  //             // Fallback to manual add/switch
  //             await addMcChain();
  //         }
  //     };

  //     ensureMcChain();
  // }, [isConnected, chainId, switchChain]);

  const addMcChain = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x15AF5", // 88813 in hex
              chainName: "MC Chain",
              nativeCurrency: {
                name: "MC",
                symbol: "MC",
                decimals: 18,
              },
              rpcUrls: ["https://chain.mcerscan.com/"],
              blockExplorerUrls: ["https://mcerscan.com"],
            },
          ],
        })
      } catch (error) {
        console.error("Failed to add network", error)
      }
    } else {
      // Silent fail or minimal log, don't alert automatically to annoy user
      console.warn("Wallet extension not found for auto-add network.")
    }
  }

  // Check if on wrong network
  const isWrongNetwork = isConnected && chainId !== MC_CHAIN_ID;

  const handleSwitchNetwork = async () => {
    if (switchChain) {
      try {
        switchChain({ chainId: MC_CHAIN_ID });
      } catch (error) {
        console.log("Switch chain via wagmi failed, trying wallet_addEthereumChain...", error);
        await addMcChain();
      }
    } else {
      await addMcChain();
    }
  };

  const copyAddress = async (address: string | undefined) => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy address", err)
    }
  }

  return (
    <>
      {/* Network Warning Banner */}
      {isWrongNetwork && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-amber-600 to-amber-500 text-black">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} />
              <span className="text-sm font-bold">
                {language === 'zh' ? '您当前不在 MC Chain 网络' : 'You are not on MC Chain network'}
              </span>
            </div>
            <button
              onClick={handleSwitchNetwork}
              className="px-4 py-1.5 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-900 transition-colors"
            >
              {language === 'zh' ? '切换网络' : 'Switch Network'}
            </button>
          </div>
        </div>
      )}

      <nav className={`fixed left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-emerald-500/20 shadow-lg shadow-emerald-500/10 ${isWrongNetwork ? 'top-10' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            {/* Logo */}
            <div className="flex items-center gap-1.5 md:gap-2 cursor-pointer" onClick={() => setTab(AppTab.HOME)}>
              <div className="bg-gradient-to-tr overflow-hidden from-emerald-500 to-emerald-400 rounded-lg md:rounded-xl shadow-lg shadow-emerald-500/30 p-0">
                <img src="/icon.png" alt="" className="w-10 md:h-10" />
              </div>
              <span className="text-lg md:text-2xl font-black text-white tracking-tight">
                JBC <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-500">RWA</span>
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => setTab(AppTab.HOME)}
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.HOME ? "text-emerald-400" : "text-gray-400 hover:text-white"
                  }`}
              >
                <Home size={18} /> {t.nav.home}
              </button>
              <button
                onClick={() => setTab(AppTab.MINING)}
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.MINING ? "text-emerald-400" : "text-gray-400 hover:text-white"
                  }`}
              >
                <Pickaxe size={18} /> {t.nav.mining}
              </button>
              <button
                onClick={() => setTab(AppTab.TEAM)}
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.TEAM ? "text-emerald-400" : "text-gray-400 hover:text-white"
                  }`}
              >
                <Users size={18} /> {t.nav.team}
              </button>
              <button
                onClick={() => setTab(AppTab.SWAP)}
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.SWAP ? "text-emerald-400" : "text-gray-400 hover:text-white"
                  }`}
              >
                <ArrowLeftRight size={18} /> Swap
              </button>
              <button
                onClick={() => setTab(AppTab.HISTORY)}
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.HISTORY ? "text-emerald-400" : "text-gray-400 hover:text-white"
                  }`}
              >
                <FileText size={18} /> {t.nav.history}
              </button>
              <button
                onClick={() => setTab(AppTab.EARNINGS)}
                className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.EARNINGS ? "text-emerald-400" : "text-gray-400 hover:text-white"
                  }`}
              >
                <Gift size={18} /> {t.nav.earnings || "Earnings"}
              </button>
              {isOwner && (
                <button
                  onClick={() => setTab(AppTab.ADMIN)}
                  className={`flex items-center gap-2 font-bold transition-colors ${currentTab === AppTab.ADMIN ? "text-red-400" : "text-gray-400 hover:text-red-400"
                    }`}
                >
                  <Settings size={18} /> Admin
                </button>
              )}
            </div>

            {/* Wallet Connect */}
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
                className="p-1.5 md:p-2 transition-colors rounded-lg md:rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-emerald-400  flex items-center gap-1 md:gap-2 border border-gray-700"
                title="Switch Language"
              >
                <Globe size={18} className="md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-bold hidden sm:inline">
                  {language === "zh" ? "EN" : "ZH"}
                </span>
              </button>
              {/* Button removed as requested for auto-logic */}
              <div className="scale-90 md:scale-100 origin-right relative">
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                  }) => {
                    const ready = mounted && authenticationStatus !== 'loading';
                    const connected =
                      ready &&
                      authenticationStatus !== 'unauthenticated' &&
                      authenticationStatus !== 'reconnecting' &&
                      account; // Ensure account exists before considering connected

                    return (
                      <div
                        {...(!ready && {
                          'aria-hidden': true,
                          'style': {
                            opacity: 0,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          },
                        })}
                      >
                        {(() => {
                          if (!connected) {
                            return (
                              <button 
                                onClick={openConnectModal} 
                                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-2"
                              >
                                <Wallet size={18} />
                                <span>{t.nav.connect}</span>
                              </button>
                            );
                          }

                          if (chain && chain.unsupported) {
                            return (
                              <button onClick={openChainModal} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-xl transition-colors">
                                Wrong network
                              </button>
                            );
                          }

                          return (
                            <div className="relative">
                              <button 
                                onClick={() => setShowWalletMenu(!showWalletMenu)}
                                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-2"
                              >
                                {chain && chain.hasIcon && (
                                  <div
                                    style={{
                                      background: chain.iconBackground,
                                      width: 18,
                                      height: 18,
                                      borderRadius: 999,
                                      overflow: 'hidden',
                                      marginRight: 4,
                                    }}
                                  >
                                    {chain.iconUrl && (
                                      <img
                                        alt={chain.name ?? 'Chain icon'}
                                        src={chain.iconUrl}
                                        style={{ width: 18, height: 18 }}
                                      />
                                    )}
                                  </div>
                                )}
                                <span>{account ? account.displayName : ''}</span>
                                <ChevronDown size={16} />
                              </button>

                              {showWalletMenu && account && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setShowWalletMenu(false)}
                                  />
                                  <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
                                    <button
                                      onClick={() => copyAddress(account.address)}
                                      className="w-full px-4 py-3 text-left text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-3"
                                    >
                                      {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                      {language === 'zh' ? '复制地址' : 'Copy Address'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        disconnectWallet()
                                        setShowWalletMenu(false)
                                      }}
                                      className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors flex items-center gap-3 border-t border-gray-800"
                                    >
                                      <LogOut size={16} />
                                      {language === 'zh' ? '断开连接' : 'Disconnect'}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Nav (Simple Bottom Bar) - Moved out of nav to ensure fixed positioning works correctly */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 border-t border-emerald-500/20 pb-safe z-50 shadow-[0_-4px_20px_rgba(16,185,129,0.1)] backdrop-blur-md">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => setTab(AppTab.HOME)}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.HOME ? "bg-[#10b981]/10" : ""
              }`}
            style={{ color: currentTab === AppTab.HOME ? "#10b981" : "#6B7280" }}
          >
            <Home size={20} />
            <span className="text-[10px] font-medium">{t.nav.home}</span>
          </button>
          <button
            onClick={() => setTab(AppTab.MINING)}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.MINING ? "bg-[#10b981]/10" : ""
              }`}
            style={{ color: currentTab === AppTab.MINING ? "#10b981" : "#6B7280" }}
          >
            <Pickaxe size={20} />
            <span className="text-[10px] font-medium">{t.nav.mining}</span>
          </button>
          <button
            onClick={() => setTab(AppTab.SWAP)}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.SWAP ? "bg-[#10b981]/10" : ""
              }`}
            style={{ color: currentTab === AppTab.SWAP ? "#10b981" : "#6B7280" }}
          >
            <ArrowLeftRight size={20} />
            <span className="text-[10px] font-medium">Swap</span>
          </button>
          <button
            onClick={() => setTab(AppTab.HISTORY)}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.HISTORY ? "bg-[#10b981]/10" : ""
              }`}
            style={{ color: currentTab === AppTab.HISTORY ? "#10b981" : "#6B7280" }}
          >
            <FileText size={20} />
            <span className="text-[10px] font-medium">{t.nav.history}</span>
          </button>
          <button
            onClick={() => setTab(AppTab.EARNINGS)}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.EARNINGS ? "bg-[#10b981]/10" : ""
              }`}
            style={{ color: currentTab === AppTab.EARNINGS ? "#10b981" : "#6B7280" }}
          >
            <Gift size={20} />
            <span className="text-[10px] font-medium">{t.nav.earnings || "Earnings"}</span>
          </button>
          <button
            onClick={() => setTab(AppTab.TEAM)}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.TEAM ? "bg-[#10b981]/10" : ""
              }`}
            style={{ color: currentTab === AppTab.TEAM ? "#10b981" : "#6B7280" }}
          >
            <Users size={20} />
            <span className="text-[10px] font-medium">{t.nav.team}</span>
          </button>
          {isOwner && (
            <button
              onClick={() => setTab(AppTab.ADMIN)}
              className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentTab === AppTab.ADMIN ? "text-red-400 bg-red-500/10" : "text-gray-500"
                }`}
            >
              <Settings size={20} />
              <span className="text-[10px] font-medium">Admin</span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default Navbar

