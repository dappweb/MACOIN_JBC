import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { Megaphone, X } from 'lucide-react';
import { API_BASE_URL } from '../constants';

const NoticeBar: React.FC = () => {
  const { language } = useLanguage();
  const [announcement, setAnnouncement] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const fetchAnnouncement = async () => {
        try {
            // For testing: Return hardcoded announcement if API fetch fails or for local dev
            const mockAnnouncement = {
                zh: "系统维护通知：为了提供更好的服务，我们将于 2024年12月20日 进行系统升级。期间可能会出现短暂的服务中断，请您谅解。",
                en: "System Maintenance Notice: To provide better service, we will perform a system upgrade on Dec 20, 2024. Service may be briefly interrupted.",
            };

            // Fetch from Cloudflare D1 Worker
            // Note: API_BASE_URL needs to be a valid URL. If it's a placeholder, this will fail.
            if (API_BASE_URL && !API_BASE_URL.includes("api.macoin-jbc.com")) {
                 const res = await fetch(`${API_BASE_URL}/announcement?lang=${language}`);
                 if (res.ok) {
                    const data = await res.json();
                    if (data.content) {
                        setAnnouncement(data.content);
                        setIsVisible(true);
                        return;
                    }
                 }
            }
            
            // Fallback to mock data for demo/testing
            const content = mockAnnouncement[language as keyof typeof mockAnnouncement] || mockAnnouncement.en;
            setAnnouncement(content);
            setIsVisible(true);

        } catch (err) {
            console.log("Failed to fetch announcement, using fallback", err);
            // Fallback
             const mockAnnouncement = {
                zh: "系统维护通知：为了提供更好的服务，我们将于 2024年12月20日 进行系统升级。期间可能会出现短暂的服务中断，请您谅解。",
                en: "System Maintenance Notice: To provide better service, we will perform a system upgrade on Dec 20, 2024. Service may be briefly interrupted.",
            };
            const content = mockAnnouncement[language as keyof typeof mockAnnouncement] || mockAnnouncement.en;
            setAnnouncement(content);
            setIsVisible(true);
        }
    };

    fetchAnnouncement();
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
