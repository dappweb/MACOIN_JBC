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
            // Fetch from Cloudflare D1 Worker
            const res = await fetch(`${API_BASE_URL}/announcement?lang=${language}`);
            if (res.ok) {
                const data = await res.json();
                if (data.content) {
                    setAnnouncement(data.content);
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                }
            }
        } catch (err) {
            console.log("Failed to fetch announcement", err);
            setIsVisible(false);
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
