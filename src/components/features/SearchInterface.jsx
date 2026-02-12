import React, { useEffect } from 'react';
import { Hash, Type, Sparkles, PenTool, HelpCircle, X, CheckSquare } from 'lucide-react';
import AdUnit from '../layout/AdUnit';

const SearchInterface = ({
    searchType,
    setSearchType,
    searchQuery,
    setSearchQuery,
    sectionQuery,
    setSectionQuery,
    searchResults,
    setSearchResults,
    findSectionById,
    findRelevantSectionsByText,
    handleSimplify,
    handleDraftLetter,
    handleQuiz,
    loadingAction,
    simplifications,
    setSimplifications,
    drafts,
    setDrafts,
    quizzes,
    setQuizzes
}) => {

    useEffect(() => {
        if (searchType === 'section') {
            setSearchResults(findSectionById(sectionQuery));
        } else {
            setSearchResults(findRelevantSectionsByText(searchQuery));
        }
    }, [searchQuery, sectionQuery, searchType, findSectionById, findRelevantSectionsByText, setSearchResults]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex gap-4 mb-4 border-b pb-4">
                    <button 
                        onClick={() => {setSearchType('section'); setSectionQuery(''); setSearchResults([])}} 
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${searchType === 'section' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <Hash size={18}/> לפי מספר סעיף
                    </button>
                    <button 
                        onClick={() => {setSearchType('free'); setSearchQuery(''); setSearchResults([])}} 
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${searchType === 'free' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <Type size={18}/> חיפוש חופשי
                    </button>
                </div>
                
                {searchType === 'section' ? (
                    <input 
                        className="w-full p-3 border rounded-lg text-lg font-mono direction-ltr text-right focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="הכנס מספר סעיף (לדוגמה: 197)" 
                        value={sectionQuery} 
                        onChange={e => setSectionQuery(e.target.value)} 
                    />
                ) : (
                    <input 
                        className="w-full p-3 border rounded-lg text-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="הכנס מילות מפתח..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                    />
                )}
            </div>

            <div className="space-y-4">
                {searchResults.map((item, idx) => (
                    <React.Fragment key={idx}>
                        <div className="bg-white p-4 rounded-lg shadow-sm border hover:border-blue-300 transition-all">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                                <h4 className="font-bold text-lg text-slate-800">{item.title}</h4>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleSimplify(item.id, item.title, item.content)} 
                                        disabled={loadingAction?.id === item.id} 
                                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                    >
                                        {loadingAction?.id === item.id && loadingAction?.type === 'simplify' ? (
                                            <div className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full"/>
                                        ) : (
                                            <Sparkles size={14} />
                                        )} 
                                        הסבר
                                    </button>
                                    <button 
                                        onClick={() => handleDraftLetter(item.id, item.title, item.content)} 
                                        disabled={loadingAction?.id === item.id} 
                                        className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                    >
                                        {loadingAction?.id === item.id && loadingAction?.type === 'draft' ? (
                                            <div className="animate-spin h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full"/>
                                        ) : (
                                            <PenTool size={14} />
                                        )} 
                                        נסח מכתב
                                    </button>
                                    <button 
                                        onClick={() => handleQuiz(item.id, item.title, item.content)} 
                                        disabled={loadingAction?.id === item.id} 
                                        className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full hover:bg-amber-100 border border-amber-200 transition-colors"
                                    >
                                        {loadingAction?.id === item.id && loadingAction?.type === 'quiz' ? (
                                            <div className="animate-spin h-3 w-3 border-2 border-amber-700 border-t-transparent rounded-full"/>
                                        ) : (
                                            <HelpCircle size={14} />
                                        )} 
                                        בחן אותי
                                    </button>
                                </div>
                            </div>
                            
                            <div className="text-slate-700 whitespace-pre-line leading-relaxed mb-4">{item.content}</div>
                            
                            <div className="space-y-3">
                                {simplifications[item.id] && (
                                    <div className="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-900 border border-indigo-100 relative animate-fade-in">
                                        <button 
                                            onClick={() => setSimplifications(prev => {const n = {...prev}; delete n[item.id]; return n;})} 
                                            className="absolute top-2 left-2 text-indigo-400 hover:text-indigo-700"
                                        >
                                            <X size={14}/>
                                        </button>
                                        <div className="font-bold mb-1 flex items-center gap-1"><Sparkles size={14}/> הסבר פשוט:</div>
                                        {simplifications[item.id]}
                                    </div>
                                )}
                                {drafts[item.id] && (
                                    <div className="bg-emerald-50 p-3 rounded-lg text-sm text-emerald-900 border border-emerald-100 relative animate-fade-in">
                                        <button 
                                            onClick={() => setDrafts(prev => {const n = {...prev}; delete n[item.id]; return n;})} 
                                            className="absolute top-2 left-2 text-emerald-400 hover:text-emerald-700"
                                        >
                                            <X size={14}/>
                                        </button>
                                        <div className="font-bold mb-1 flex items-center gap-1"><PenTool size={14}/> טיוטת מכתב:</div>
                                        <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-white p-2 rounded border border-emerald-100 shadow-sm mt-1">
                                            {drafts[item.id]}
                                        </div>
                                    </div>
                                )}
                                {quizzes[item.id] && (
                                    <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-900 border border-amber-100 relative animate-fade-in">
                                        <button 
                                            onClick={() => setQuizzes(prev => {const n = {...prev}; delete n[item.id]; return n;})} 
                                            className="absolute top-2 left-2 text-amber-400 hover:text-amber-700"
                                        >
                                            <X size={14}/>
                                        </button>
                                        <div className="font-bold mb-1 flex items-center gap-1"><CheckSquare size={14}/> בחן את עצמך:</div>
                                        <div className="whitespace-pre-wrap">{quizzes[item.id]}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {(idx + 1) % 3 === 0 && <AdUnit position={`בין תוצאות החיפוש #${idx+1}`} slotId={`list-${idx}`} />}
                    </React.Fragment>
                ))}
                {(searchType === 'section' ? sectionQuery : searchQuery) && searchResults.length === 0 && (
                    <div className="text-center text-slate-500 py-10">לא נמצאו תוצאות</div>
                )}
            </div>
        </div>
    );
};

export default SearchInterface;
