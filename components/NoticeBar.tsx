import React, { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '../src/LanguageContext';
import { Megaphone, X, Info } from 'lucide-react';
import { API_BASE_URL } from '../src/constants';

const NoticeBar: React.FC = () => {
  const { language } = useLanguage();
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  // Modal state for long announcements
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);

  const demoAnnouncements: Record<string, string[]> = {
    zh: [
      "🎉 金宝协议正式上线！DeFi 4.0 创新双币模型，开启财富新篇章。",
      "📢 邀请好友加入可享丰厚极差奖励，最高可达 45%！"
    ],
    en: [
      "🎉 Jinbao Protocol is live! DeFi 4.0 Dual-Token Model.",
      "📢 Invite friends to earn up to 45% differential rewards!"
    ]
  };

  // Parse announcements from stored data
  const parseAnnouncements = useCallback((data: any, langKey: string): string[] => {
    if (!data) return [];
    
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Handle array format
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => item[langKey] || item['en'] || item)
          .filter((content: any) => typeof content === 'string' && content.trim());
      }
      
      // Handle single object format
      const content = parsed[langKey] || parsed['en'] || '';
      return content ? [content] : [];
    } catch {
      return [];
    }
  }, []);

  // Fetch announcements from API
  const fetchFromAPI = useCallback(async (langKey: string): Promise<string[]> => {
    if (!API_BASE_URL) return [];
    
    try {
      const response = await fetch(`${API_BASE_URL}/announcement?lang=${langKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      if (data.content) {
        // Cache to localStorage
        localStorage.setItem('announcements_api_cache', JSON.stringify({
          [langKey]: data.content,
          timestamp: Date.now()
        }));
        return [data.content];
      }
      return [];
    } catch (err) {
      console.warn('Failed to fetch announcements from API:', err);
      return [];
    }
  }, []);

  const loadAnnouncement = useCallback(async () => {
    const langKey = (language === 'zh' || language === 'zh-TW') ? 'zh' : 'en';
    
    // Priority 1: Try to fetch from API (for all users)
    const apiAnnouncements = await fetchFromAPI(langKey);
    if (apiAnnouncements.length > 0) {
      setAnnouncements(apiAnnouncements);
      setIsVisible(true);
      return;
    }

    // Priority 2: Check localStorage (admin's local announcements or cache)
    const storedAnnouncements = localStorage.getItem('announcements');
    if (storedAnnouncements) {
      const contents = parseAnnouncements(storedAnnouncements, langKey);
      if (contents.length > 0) {
        setAnnouncements(contents);
        setIsVisible(true);
        return;
      }
    }

    // Priority 3: Check API cache
    const apiCache = localStorage.getItem('announcements_api_cache');
    if (apiCache) {
      try {
        const cached = JSON.parse(apiCache);
        // Cache valid for 1 hour
        if (cached.timestamp && Date.now() - cached.timestamp < 3600000) {
          if (cached[langKey]) {
            setAnnouncements([cached[langKey]]);
            setIsVisible(true);
            return;
          }
        }
      } catch {
        // Ignore cache errors
      }
    }

    // Priority 4: Fallback to demo announcements
    setAnnouncements(demoAnnouncements[langKey] || demoAnnouncements['en']);
    setIsVisible(true);
  }, [language, fetchFromAPI, parseAnnouncements]);

  useEffect(() => {
    loadAnnouncement();

    // Listen for storage events (when other tabs update)
    const handleStorageChange = () => {
      loadAnnouncement();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Refresh announcements every 5 minutes
    const refreshInterval = setInterval(loadAnnouncement, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(refreshInterval);
    };
  }, [language, loadAnnouncement]);

  // 轮播逻辑
  useEffect(() => {
    if (announcements.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 4000); // 每4秒切换一次

    return () => clearInterval(interval);
  }, [announcements]);

  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  if (!isVisible || announcements.length === 0) return null;

  return (
    <>
      <div className="bg-amber-50/10 border-b border-amber-500/30 text-amber-300 px-4 py-3 relative animate-fade-in backdrop-blur-sm mb-6 rounded-xl border border-amber-500/20 overflow-hidden">
          <div className="max-w-7xl mx-auto flex items-start gap-3 pr-8 cursor-pointer" onClick={() => setSelectedNotice(announcements[currentIndex])}>
              <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 overflow-hidden relative h-6">
                  {announcements.map((text, index) => (
                      <p 
                          key={index}
                          className={`text-sm font-medium leading-relaxed absolute top-0 left-0 w-full transition-all duration-500 ease-in-out transform flex items-center gap-2 ${
                              index === currentIndex 
                                  ? 'translate-y-0 opacity-100' 
                                  : 'translate-y-8 opacity-0'
                          }`}
                      >
                          <span className="truncate">{truncateText(text, 60)}</span>
                          {text.length > 60 && (
                            <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded text-amber-200 flex items-center gap-1 hover:bg-amber-500/30 transition-colors whitespace-nowrap">
                              <Info size={12} /> {(language === 'zh' || language === 'zh-TW') ? '点击查看详情' : 'Click for details'}
                            </span>
                          )}
                      </p>
                  ))}
              </div>
          </div>
      </div>

      {/* Announcement Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedNotice(null)}
          />
          
          <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-neon-500/20 overflow-hidden flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gradient-to-r from-neon-500/10 to-amber-500/10 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-full text-amber-400 border border-amber-500/30">
                  <Megaphone size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">
                  {(language === 'zh' || language === 'zh-TW') ? '系统公告' : 'Announcement'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedNotice(null)}
                className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh] bg-gray-900/50">
              <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                {selectedNotice}
              </p>
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-900 flex justify-end">
              <button 
                onClick={() => setSelectedNotice(null)}
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg transition-all shadow-lg shadow-amber-500/30"
              >
                {(language === 'zh' || language === 'zh-TW') ? '关闭' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NoticeBar;
