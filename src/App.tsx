import React, { useState, useEffect } from "react"
import Navbar from "../components/Navbar"
import NoticeBar from "../components/NoticeBar"
import StatsPanel from "../components/StatsPanel"
import MiningPanel from "../components/MiningPanel"
import BuyTicketPanel from "../components/BuyTicketPanel"
import TeamLevel from "../components/TeamLevel"
import SwapPanel from "../components/SwapPanel"
import AdminPanel from "../components/AdminPanel"
import TransactionHistory from "../components/TransactionHistory"
import EarningsDetail from "../components/EarningsDetail"
import PullToRefresh from "../components/PullToRefresh"
import { AppTab } from "./types"
import { MOCK_USER_STATS } from "./constants"
import { ArrowLeftRight } from "lucide-react"
import { LanguageProvider, useLanguage } from "./LanguageContext"
import { Web3Provider, useWeb3 } from "./Web3Context"
import { GlobalRefreshProvider } from "../hooks/useGlobalRefresh"

import { WagmiProvider } from "wagmi"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { config } from "./config"
import "@rainbow-me/rainbowkit/styles.css"

const queryClient = new QueryClient()

// Create an inner component to use the hook
const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.HOME)
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  const handleRefresh = async () => {
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 800));
    window.location.reload();
  }

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center relative overflow-hidden">
        <div className="z-10 flex flex-col items-center">
          <div className="w-40 h-40 overflow-hidden  rounded-xl animate-spin mb-8 shadow-xl">
            <img src="/icon.png" alt="" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-widest animate-pulse">
            JBC <span className="text-neon-400">RWA</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2">Loading Protocol Data...</p>
        </div>
      </div>
    )
  }

  // 根据当前标签页设置背景图
  const getBackgroundImage = () => {
    const bgMap = {
      [AppTab.HOME]: '/bg-3.png',
      [AppTab.MINING]: '/bg-16.png',
      [AppTab.BUY_TICKET]: '/bg-16.png',
      [AppTab.TEAM]: '/bg-11.png',
      [AppTab.SWAP]: '/bg-2.png',
      [AppTab.HISTORY]: '/bg-14.png',
      [AppTab.EARNINGS]: '/bg-14.png'
    };
    
    const bgPath = bgMap[currentTab] || '/bg-11.png';
    
    // 开发环境下输出背景图信息
    if (process.env.NODE_ENV === 'development') {
      console.log(`🖼️ Background image for ${currentTab}:`, bgPath);
    }
    
    return bgPath;
  }

  return (
    <div 
      className="min-h-screen bg-black text-white selection:bg-neon-500 selection:text-black font-sans pb-20 md:pb-8 relative overflow-x-hidden"
      style={{
        backgroundImage: `url(${getBackgroundImage()})`,
        backgroundSize:'cover',
        backgroundPosition:currentTab === AppTab.TEAM ? '26% 100%' : currentTab ===AppTab.HISTORY ? '24% 100%' : 'center',
        backgroundAttachment: 'scroll',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* 增强背景图效果 - 减少遮罩层透明度，增加渐变效果 */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/20 via-black/15 to-black/40 z-0"></div>
      
      {/* 添加动态光效 */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/3 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      
      <Navbar currentTab={currentTab} setTab={setCurrentTab} />

      <PullToRefresh onRefresh={handleRefresh} className="pt-20 md:pt-24 relative z-10">
        <main className="px-3 sm:px-4 md:px-6 lg:px-8 mb-16 md:mb-0">
          <NoticeBar />
          {/* Render Tab Content */}
          {currentTab === AppTab.HOME && (
            <StatsPanel
              stats={MOCK_USER_STATS}
              onJoinClick={() => setCurrentTab(AppTab.MINING)}
              onBuyTicketClick={() => setCurrentTab(AppTab.BUY_TICKET)}
            />
          )}

          {currentTab === AppTab.MINING && <MiningPanel />}

          {currentTab === AppTab.BUY_TICKET && (
            <BuyTicketPanel onBack={() => setCurrentTab(AppTab.HOME)} />
          )}

          {currentTab === AppTab.TEAM && <TeamLevel />}

          {currentTab === AppTab.SWAP && <SwapPanel />}

          {currentTab === AppTab.HISTORY && <TransactionHistory />}

          {currentTab === AppTab.EARNINGS && <EarningsDetail />}

          {currentTab === AppTab.ADMIN && <AdminPanel />}
        </main>
      </PullToRefresh>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-800 py-8 bg-black relative z-10">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p className="mb-2">{t.footer.rights}</p>
          <p>{t.footer.audit}</p>
        </div>
      </footer>
    </div>
  )
}

import { Toaster } from "react-hot-toast"

// ...

const App: React.FC = () => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <LanguageProvider>
            <Web3Provider>
              <GlobalRefreshProvider>
                <AppContent />
                <Toaster position="top-center" />
              </GlobalRefreshProvider>
            </Web3Provider>
          </LanguageProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App




