import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { Megaphone, X, Info } from 'lucide-react';

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
      "⚠️ 请注意：购买门票后需在72小时内提供流动性，否则门票将失效。",
      "📢 邀请好友加入可享丰厚极差奖励，最高可达 45%！",
      "📜 关于近期系统升级与维护的详细说明：为了提供更优质的服务，我们将于近期进行系统升级。本次升级将优化交易引擎，提升撮合效率，并引入全新的安全风控机制。预计维护时间持续4小时，期间交易功能将暂停，充提币服务可能会延迟到账。请各位用户提前做好资金安排，避免在维护期间进行操作。升级完成后，我们将向所有受影响的用户发放空投补偿，感谢大家的支持与理解！如有任何疑问，请联系社区客服。"
    ],
    en: [
      "🎉 Jinbao Protocol is live! DeFi 4.0 Dual-Token Model.",
      "⚠️ Notice: Liquidity must be provided within 72 hours after ticket purchase.",
      "📢 Invite friends to earn up to 45% differential rewards!",
      "📜 System Upgrade Notice: To provide better service, we will be conducting a system upgrade shortly. This upgrade will optimize the matching engine and introduce new security mechanisms. Maintenance is expected to last 4 hours, during which trading and deposits/withdrawals will be suspended. Please plan your funds accordingly. Airdrop compensation will be distributed after the upgrade. Thank you for your support!"
    ]
  };

  const loadAnnouncement = () => {
    // 从 localStorage 读取公告
    const storedAnnouncements = localStorage.getItem('announcements');

    if (storedAnnouncements) {
      try {
        const parsed = JSON.parse(storedAnnouncements);
        
        // Handle array format (new)
        if (Array.isArray(parsed)) {
            const contents = parsed.map((item: any) => item[language] || item['en']).filter(Boolean);
            if (contents.length > 0) {
                setAnnouncements(contents);
                setIsVisible(true);
            } else {
                setAnnouncements(demoAnnouncements[language] || demoAnnouncements['en']);
                setIsVisible(true);
            }
        } 
        // Handle single object format (legacy/fallback)
        else {
            const content = parsed[language] || parsed['en'] || '';
            if (content) {
                setAnnouncements([content]);
                setIsVisible(true);
            } else {
                setAnnouncements(demoAnnouncements[language] || demoAnnouncements['en']);
                setIsVisible(true);
            }
        }
      } catch (err) {
        console.error('Failed to parse announcements', err);
        setAnnouncements(demoAnnouncements[language] || demoAnnouncements['en']);
        setIsVisible(true);
      }
    } else {
      setAnnouncements(demoAnnouncements[language] || demoAnnouncements['en']);
      setIsVisible(true);
    }
  };

  useEffect(() => {
    loadAnnouncement();

    // 监听 storage 事件（其他标签页或组件更新时触发）
    const handleStorageChange = () => {
      loadAnnouncement();
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [language]);

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
      <div className="bg-amber-50/10 border-b border-amber-500/30 text-amber-300 px-4 py-3 relative animate-fade-in backdrop-blur-sm mb-6 rounded-xl border border-amber-500/20">
          <div className="max-w-7xl mx-auto flex items-start gap-3 pr-8">
              <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 overflow-hidden relative h-6 cursor-pointer" onClick={() => setSelectedNotice(announcements[currentIndex])}>
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
                              <Info size={12} /> {language === 'zh' ? '点击查看详情' : 'Click for details'}
                            </span>
                          )}
                      </p>
                  ))}
              </div>
          </div>
          <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              className="absolute top-3 right-4 text-amber-400 hover:text-amber-200 transition-colors"
          >
              <X size={18} />
          </button>
      </div>

      {/* Announcement Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedNotice(null)}
          />
          
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                  <Megaphone size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  {language === 'zh' ? '系统公告' : 'Announcement'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedNotice(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <p className="text-slate-700 leading-relaxed text-lg whitespace-pre-wrap">
                {selectedNotice}
              </p>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedNotice(null)}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
              >
                {language === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NoticeBar;
