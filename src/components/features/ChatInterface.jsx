import React, { useState } from 'react';
import { Sparkles, PenTool, X, CheckSquare } from 'lucide-react';
import AdUnit from '../layout/AdUnit';

const ChatInterface = ({
    chatQuery,
    setChatQuery,
    handleAskQuestion,
    aiAnswer,
    isThinking,
    loadingAction,
    handleGeneralDraft,
    drafts,
    setDrafts,
    answerSources,
    setActiveTab,
    setSearchType,
    setSectionQuery
}) => {
    
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleAskQuestion(chatQuery);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">מה תרצה לברר?</h2>
            </div>
            
            <div className="bg-white p-2 rounded-2xl shadow border flex gap-2">
                <input 
                    className="flex-grow p-3 text-lg outline-none rounded-xl" 
                    placeholder="למשל: תוך כמה זמן אפשר להגיש תביעת פיצויים לפי סעיף 197?" 
                    value={chatQuery} 
                    onChange={e => setChatQuery(e.target.value)} 
                    onKeyDown={handleKeyPress} 
                />
                <button 
                    onClick={() => handleAskQuestion(chatQuery)} 
                    disabled={isThinking} 
                    className="bg-blue-600 text-white px-6 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                    {isThinking ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/>
                    ) : (
                        <Sparkles size={20}/>
                    )} 
                    שאל
                </button>
            </div>

            {aiAnswer && (
                <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-fade-in">
                    <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="text-indigo-600" size={20} />
                            <h3 className="font-bold text-indigo-900">תשובת העוזר המשפטי</h3>
                        </div>
                        <button 
                            onClick={() => handleGeneralDraft(chatQuery, aiAnswer)} 
                            disabled={loadingAction?.id === 'general-draft'} 
                            className="flex items-center gap-1 text-xs bg-white text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-sm"
                        >
                            {loadingAction?.id === 'general-draft' ? (
                                <div className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full"/>
                            ) : (
                                <PenTool size={14} />
                            )} 
                            נסח מכתב
                        </button>
                    </div>
                    
                    <div className="p-6 prose max-w-none whitespace-pre-line text-slate-800 leading-relaxed">
                        {aiAnswer}
                    </div>
                    
                    {drafts['general-draft'] && (
                        <div className="mx-6 mb-6 bg-emerald-50 p-4 rounded-lg text-sm text-emerald-900 border border-emerald-100 relative animate-fade-in">
                            <button 
                                onClick={() => setDrafts(prev => {const n = {...prev}; delete n['general-draft']; return n;})} 
                                className="absolute top-2 left-2 text-emerald-400 hover:text-emerald-700"
                            >
                                <X size={14}/>
                            </button>
                            <div className="font-bold mb-2 flex items-center gap-1">
                                <PenTool size={16}/> טיוטת מכתב רשמי:
                            </div>
                            <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-white p-3 rounded border border-emerald-100 shadow-sm">
                                {drafts['general-draft']}
                            </div>
                        </div>
                    )}

                    <div className="px-6">
                        <AdUnit position="בתוך התשובה" slotId="9876543210" />
                    </div>

                    {answerSources.length > 0 && (
                        <div className="bg-slate-50 p-4 border-t border-slate-100">
                            <div className="text-sm font-bold text-slate-500 mb-2">מקורות רלוונטיים:</div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                {answerSources.slice(0, 5).map((src, i) => (
                                    <div 
                                        key={i} 
                                        className="flex-shrink-0 bg-white border px-3 py-2 rounded text-xs w-64 h-24 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
                                        onClick={() => {
                                            setActiveTab('search');
                                            setSearchType('section');
                                            setSectionQuery(src.id);
                                        }}
                                    >
                                        <div className="font-bold text-blue-600 truncate">{src.title}</div>
                                        <div className="text-slate-500 mt-1 line-clamp-3">{src.content}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChatInterface;
