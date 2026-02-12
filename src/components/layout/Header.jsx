import React from 'react';
import { Scale, Sparkles, Search, MapPin } from 'lucide-react';

const Header = ({ activeTab, setActiveTab }) => {
    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg text-white">
                        <Scale size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold leading-none">חוק התכנון והבניה</h1>
                        <span className="text-xs text-slate-500">עוזר משפטי חכם</span>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('chat')} 
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex gap-2 ${activeTab === 'chat' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Sparkles size={16} /> שאל את החוק
                    </button>
                    <button 
                        onClick={() => setActiveTab('search')} 
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex gap-2 ${activeTab === 'search' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Search size={16} /> איתור וחיפוש
                    </button>
                    <button 
                        onClick={() => setActiveTab('commute')} 
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex gap-2 ${activeTab === 'commute' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <MapPin size={16} /> רדיוס יוממות
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
