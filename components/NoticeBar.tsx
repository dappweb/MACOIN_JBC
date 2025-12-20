import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { Megaphone, X } from 'lucide-react';

const NoticeBar: React.FC = () => {
  const { language } = useLanguage();
  const [announcement, setAnnouncement] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  const loadAnnouncement = () => {
    // 从 localStorage 读取公告
    const storedAnnouncements = localStorage.getItem('announcements');

    if (storedAnnouncements) {
      try {
        const announcements = JSON.parse(storedAnnouncements);
        const content = announcements[language] || announcements['en'] || '';

        if (content) {
          setAnnouncement(content);
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      } catch (err) {
        console.error('Failed to parse announcements', err);
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
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

  if (!isVisible || !announcement) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-100 text-yellow-800 px-4 py-3 relative animate-fade-in">
        <div className="max-w-7xl mx-auto flex items-start gap-3 pr-8">
            <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">
                {announcement}
            </p>
        </div>
        <button
            onClick={() => setIsVisible(false)}
            className="absolute top-3 right-4 text-yellow-600 hover:text-yellow-900 transition-colors"
        >
            <X size={18} />
        </button>
    </div>
  );
};

export default NoticeBar;
