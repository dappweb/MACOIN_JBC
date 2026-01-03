import React, { useState, useEffect, Suspense, lazy } from "react"
import Navbar from "../components/Navbar"
import NoticeBar from "../components/NoticeBar"
import PullToRefresh from "../components/PullToRefresh"
import ErrorBoundary from "../components/ErrorBoundary"
import { SkeletonCard } from "../components/LoadingSkeletons"
import { AppTab } from "./types"
import { MOCK_USER_STATS } from "./constants"
import { ArrowLeftRight } from "lucide-react"
import { LanguageProvider, useLanguage } from "./LanguageContext"
import { Web3Provider, useWeb3 } from "./Web3Context"
import { GlobalRefreshProvider } from "../hooks/useGlobalRefresh"
import { disableErrorNotifications } from "../utils/toastConfig"

import { WagmiProvider } from "wagmi"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { config } from "./config"
import "@rainbow-me/rainbowkit/styles.css"

// Lazy load heavy components - only load when needed
const StatsPanel = lazy(() => import("../components/StatsPanel"))
const MiningPanel = lazy(() => import("../components/MiningPanel"))
const BuyTicketPanel = lazy(() => import("../components/BuyTicketPanel"))
const TeamLevel = lazy(() => import("../components/TeamLevel"))
// Swap Panel hidden
// const SwapPanel = lazy(() => import("../components/SwapPanel"))
const AdminPanel = lazy(() => import("../components/AdminPanel"))
const TransactionHistory = lazy(() => import("../components/TransactionHistory"))

// Optimize QueryClient with better defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Create an inner component to use the hook
const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.HOME)
  const [appError, setAppError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const { t } = useLanguage()

  const handleRefresh = async () => {
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 800));
    window.location.reload();
  }

  const handleAppError = (error: Error) => {
    console.error('App-level error:', error);
    setAppError(error.message);
  }

  useEffect(() => {
    // Initialize toast configuration - disable error notifications by default
    disableErrorNotifications();
    
    // Fast initialization - check if Web3 is ready
    // Don't wait for contracts if not connected
    const initTimer = setTimeout(() => {
      setIsInitialized(true)
    }, 100) // Minimal delay for smooth transition
    
    return () => clearTimeout(initTimer)
  }, [])

  // Preload next likely component when user hovers over nav
  const preloadComponent = (tab: AppTab) => {
    switch (tab) {
      case AppTab.MINING:
        import("../components/MiningPanel")
        break
      case AppTab.BUY_TICKET:
        import("../components/BuyTicketPanel")
        break
      case AppTab.TEAM:
        import("../components/TeamLevel")
        break
      // Swap Panel hidden
      // case AppTab.SWAP:
      //   import("../components/SwapPanel")
      //   break
      case AppTab.HISTORY:
        import("../components/TransactionHistory")
        break
      case AppTab.ADMIN:
        import("../components/AdminPanel")
        break
    }
  }

  // Minimal loading screen - only show if not initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/15 to-black/40 z-0"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="z-10 flex flex-col items-center">
          <div className="w-32 h-32 md:w-40 md:h-40 overflow-hidden rounded-xl animate-spin mb-6 md:mb-8 shadow-xl">
            <img src="/icon.png" alt="Jinbao Protocol" className="w-full h-full object-cover" loading="eager" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-widest animate-pulse mb-2">
            JBC <span className="text-neon-400">RWA</span>
          </h1>
          <p className="text-gray-400 text-xs md:text-sm animate-pulse">Initializing...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (appError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900/50 border border-red-500/30 rounded-2xl p-8 text-center backdrop-blur-sm">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
            <ArrowLeftRight className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Application Error</h2>
          <p className="text-gray-400 mb-6">{appError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-bold rounded-xl transition-all transform active:scale-95"
          >
            Reload Application
          </button>
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
      [AppTab.HISTORY]: '/bg-14.png'
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
      
      <Navbar 
        currentTab={currentTab} 
        setTab={(tab) => {
          setCurrentTab(tab)
          // Preload adjacent components
          preloadComponent(tab)
        }} 
      />

      <PullToRefresh onRefresh={handleRefresh} className="pt-20 md:pt-24 relative z-10">
        <main className="px-3 sm:px-4 md:px-6 lg:px-8 mb-16 md:mb-0">
          <NoticeBar />
          {/* Render Tab Content with Error Boundaries and Suspense */}
          {currentTab === AppTab.HOME && (
            <ErrorBoundary onError={handleAppError}>
              <Suspense fallback={<SkeletonCard />}>
                <StatsPanel
                  stats={MOCK_USER_STATS}
                  onJoinClick={() => setCurrentTab(AppTab.MINING)}
                  onBuyTicketClick={() => setCurrentTab(AppTab.BUY_TICKET)}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentTab === AppTab.MINING && (
            <ErrorBoundary onError={handleAppError}>
              <Suspense fallback={<SkeletonCard />}>
                <MiningPanel />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentTab === AppTab.BUY_TICKET && (
            <ErrorBoundary onError={handleAppError}>
              <Suspense fallback={<SkeletonCard />}>
                <BuyTicketPanel onBack={() => setCurrentTab(AppTab.HOME)} />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentTab === AppTab.TEAM && (
            <ErrorBoundary onError={handleAppError}>
              <Suspense fallback={<SkeletonCard />}>
                <TeamLevel />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Swap Panel hidden */}
          {/* {currentTab === AppTab.SWAP && (
            <ErrorBoundary onError={handleAppError}>
              <Suspense fallback={<SkeletonCard />}>
                <SwapPanel />
              </Suspense>
            </ErrorBoundary>
          )} */}

          {currentTab === AppTab.HISTORY && (
            <ErrorBoundary onError={handleAppError}>
              <Suspense fallback={<SkeletonCard />}>
                <TransactionHistory />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentTab === AppTab.ADMIN && (
            <ErrorBoundary onError={handleAppError}>
              <Suspense fallback={<SkeletonCard />}>
                <AdminPanel />
              </Suspense>
            </ErrorBoundary>
          )}
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




