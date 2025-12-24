import React, { useState, useEffect } from "react"
import Navbar from "./components/Navbar"
import NoticeBar from "./components/NoticeBar"
import StatsPanel from "./components/StatsPanel"
import MiningPanel from "./components/MiningPanel"
import TeamLevel from "./components/TeamLevel"
import WhitepaperModal from "./components/WhitepaperModal"
import SwapPanel from "./components/SwapPanel"
import AdminPanel from "./components/AdminPanel"
import TransactionHistory from "./components/TransactionHistory"
import EarningsDetail from "./components/EarningsDetail"
import PullToRefresh from "./components/PullToRefresh"
import { AppTab } from "./types"
import { MOCK_USER_STATS } from "./constants"
import { ArrowLeftRight } from "lucide-react"
import { LanguageProvider, useLanguage } from "./LanguageContext"
import { Web3Provider, useWeb3 } from "./Web3Context"

import { WagmiProvider } from "wagmi"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { config } from "./config"
import "@rainbow-me/rainbowkit/styles.css"
import iconImg from "./icon.png"

const queryClient = new QueryClient()

// Create an inner component to use the hook
const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.HOME)
  const [loading, setLoading] = useState(true)
  const [showWhitepaper, setShowWhitepaper] = useState(false)
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
            <img src={iconImg} alt="" />
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
    switch (currentTab) {
      case AppTab.HOME:
        return '/bg-1.png'
      case AppTab.MINING:
        return '/bg-2.png'
      case AppTab.TEAM:
        return '/bg-3.png'
      case AppTab.SWAP:
        return '/bg-4.png'
      case AppTab.HISTORY:
        return '/bg-5.png'
      case AppTab.EARNINGS:
        return '/bg-6.png'
      default:
        return '/bg-1.png'
    }
  }

  return (
    <div 
      className="min-h-screen bg-black text-white selection:bg-neon-500 selection:text-black font-sans pb-20 md:pb-8 relative"
      style={{
        backgroundImage: `url(${getBackgroundImage()})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* 添加半透明遮罩层以确保内容可读性 */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"></div>
      
      <Navbar currentTab={currentTab} setTab={setCurrentTab} />

      <WhitepaperModal isOpen={showWhitepaper} onClose={() => setShowWhitepaper(false)} />

      <PullToRefresh onRefresh={handleRefresh} className="pt-20 md:pt-24">
        <main className="px-3 sm:px-4 md:px-6 lg:px-8 mb-16 md:mb-0">
          <NoticeBar />
          {/* Render Tab Content */}
          {currentTab === AppTab.HOME && (
            <StatsPanel
              stats={{
                ...MOCK_USER_STATS,
                balanceMC: 0,
                balanceJBC: 0,
                totalRevenue: 0,
                teamCount: 0,
                activeInvestment: 0,
                pendingRewards: 0,
              }}
              onJoinClick={() => setCurrentTab(AppTab.MINING)}
              onWhitepaperClick={() => setShowWhitepaper(true)}
            />
          )}

          {currentTab === AppTab.MINING && <MiningPanel />}

          {currentTab === AppTab.TEAM && <TeamLevel />}

          {currentTab === AppTab.SWAP && <SwapPanel />}

          {currentTab === AppTab.HISTORY && <TransactionHistory />}

          {currentTab === AppTab.EARNINGS && <EarningsDetail />}

          {currentTab === AppTab.ADMIN && <AdminPanel />}
        </main>
      </PullToRefresh>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-800 py-8 bg-black">
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
              <AppContent />
              <Toaster position="top-center" />
            </Web3Provider>
          </LanguageProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App




