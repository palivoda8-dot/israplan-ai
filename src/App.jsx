import React, { useState, useEffect } from 'react';
import { Search, Upload, AlertCircle, CheckCircle, Sparkles, X, PenTool, HelpCircle, CheckSquare, Hash, Type, Scale, MapPin, Building2, Home, Compass } from 'lucide-react';
import AdUnit from './components/AdUnit';
import CommuteRadius from './components/CommuteRadius';
import { parseFileContent, extractSectionsFromHTML } from './utils/fileParser';

const LawApp = () => {
    const [activeTab, setActiveTab] = useState('home');
    const [searchType, setSearchType] = useState('section');
    const [sections, setSections] = useState([]);
    const [fileName, setFileName] = useState("");
    const [stats, setStats] = useState({ totalSections: 0, totalWords: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sectionQuery, setSectionQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [chatQuery, setChatQuery] = useState("");
    const [aiAnswer, setAiAnswer] = useState(null);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [answerSources, setAnswerSources] = useState([]);
    const [simplifications, setSimplifications] = useState({});
    const [drafts, setDrafts] = useState({});
    const [quizzes, setQuizzes] = useState({});
    const [loadingAction, setLoadingAction] = useState(null);

    // --- SECURE API CALL ---
    const callGemini = async (prompt) => {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            return data.text || "לא התקבלה תשובה.";
        } catch (error) {
            console.error(error);
            return "אירעה שגיאה בתקשורת עם השרת.";
        }
    };

    const findSectionById = (idQuery) => {
        if (!idQuery.trim() || sections.length === 0) return [];
        const cleanQuery = idQuery.replace(/['"״׳]/g, '').replace(/^סעיף\s+/, '').trim();
        return sections.filter(section => {
            if (!section.id) return false;
            const secId = section.id.toString().replace(/['"״׳]/g, '').trim();
            if (secId === cleanQuery) return true;
            if (secId.startsWith(cleanQuery)) {
                const remainder = secId.slice(cleanQuery.length);
                return isNaN(parseInt(remainder));
            }
            return false;
        }).slice(0, 10);
    };

    const findRelevantSectionsByText = (queryText, limit = 20) => {
        if (!queryText.trim() || sections.length === 0) return [];
        const terms = queryText.trim().toLowerCase().split(/\s+/).filter(t => t.length > 1);
        return sections.map(section => {
            let score = 0;
            const content = section.content.toLowerCase();
            const title = section.title.toLowerCase();
            terms.forEach(term => {
                if (title.includes(term)) score += 50;
                const matches = content.split(term).length - 1;
                score += matches;
            });
            return { ...section, score };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    };

    const findContextForAI = (queryText, limit = 25) => {
        let results = [];
        const sectionMatches = queryText.match(/(?:סעיף\s*)?(\d+(?:[א-ת]{1,2}|'[א-ת])?)/g);
        if (sectionMatches) {
            sectionMatches.forEach(match => {
                const id = match.replace(/סעיף\s*/, '').trim();
                results = [...results, ...findSectionById(id)];
            });
        }
        results = [...results, ...findRelevantSectionsByText(queryText, limit)];
        const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());
        return uniqueResults.slice(0, limit);
    };

    useEffect(() => {
        if (activeTab === 'search') {
            if (searchType === 'section') {
                setSearchResults(findSectionById(sectionQuery));
            } else {
                setSearchResults(findRelevantSectionsByText(searchQuery));
            }
        }
    }, [searchQuery, sectionQuery, searchType, sections, activeTab]);

    const handleAskQuestion = async () => {
        if (!chatQuery.trim()) return;
        setIsAiThinking(true);
        setAiAnswer(null);
        setDrafts(prev => {const n = {...prev}; delete n['general-draft']; return n;});
        const relevant = findContextForAI(chatQuery, 25);
        setAnswerSources(relevant);
        if (relevant.length === 0) {
            setAiAnswer("לא נמצא מידע רלוונטי בקובץ. ניתן לשאול שאלות כלליות על תכנון ובניה.");
            setIsAiThinking(false);
            return;
        }
        const context = relevant.map(r => `[סעיף ${r.id} - ${r.title}]: ${r.content}`).join("\n\n");
        const prompt = `אתה יועץ תכנון ובניה מומחה. ענה לשאלה: ${chatQuery}. קטעי החוק הרלוונטיים: ${context}. אם השאלה כללית בתכנון, ענה מניסיונך תוך התייחסות לחוק.`;
        const ans = await callGemini(prompt);
        setAiAnswer(ans);
        setIsAiThinking(false);
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setLoading(true);
        setFileName(file.name);
        setSections([]);
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            if (content) {
                const html = parseFileContent(content);
                const parsed = extractSectionsFromHTML(html);
                if (parsed.length > 0) {
                    setSections(parsed);
                    setStats({ totalSections: parsed.length, totalWords: parsed.reduce((acc, c) => acc + c.content.length, 0) });
                } else {
                    setError("לא זוהו סעיפים. ייתכן שהקובץ פגום.");
                }
            }
            setLoading(false);
        };
        reader.readAsText(file);
    };

    const handleSimplify = async (id, title, content) => {
        if (simplifications[id] || loadingAction) return;
        setLoadingAction({id, type: 'simplify'});
        const ans = await callGemini(`הסבר את סעיף ${title} בשפה פשוטה לאדריכל או מתכנן:\n${content}`);
        setSimplifications(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    };

    const handleDraftLetter = async (id, title, content) => {
        if (drafts[id] || loadingAction) return;
        setLoadingAction({id, type: 'draft'});
        const ans = await callGemini(`כתוב טיוטת מכתב לרשות התכנון המסתמך על סעיף ${title}. תוכן: ${content}.`);
        setDrafts(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    };

    const handleGeneralDraft = async () => {
        const id = 'general-draft';
        if (drafts[id] || loadingAction) return;
        setLoadingAction({id, type: 'draft'});
        const ans = await callGemini(`כתוב טיוטת חוות דעת תכנונית המבוססת על השאלה: ${chatQuery} והתשובה: ${aiAnswer}`);
        setDrafts(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    };

    const handleQuiz = async (id, title, content) => {
        if (quizzes[id] || loadingAction) return;
        setLoadingAction({id, type: 'quiz'});
        const ans = await callGemini(`כתוב שאלת מקצועית על סעיף ${title} למתכננים. תוכן: ${content}.`);
        setQuizzes(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-right text-slate-800" dir="rtl">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div onClick={() => setActiveTab('home')} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                        <div className="bg-emerald-600 p-2 rounded-lg text-white"><Building2 size={24} /></div>
                        <div><h1 className="text-xl font-bold leading-none tracking-tight">Israplan</h1><span className="text-xs text-slate-500 font-medium">הבית לתכנון ובניה</span></div>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setActiveTab('home')} className={`hidden sm:flex px-4 py-1.5 rounded-md text-sm font-medium transition-all gap-2 ${activeTab === 'home' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Home size={16} /> ראשי</button>
                        <button onClick={() => setActiveTab('chat')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex gap-2 ${activeTab === 'chat' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Sparkles size={16} /> יועץ תכנון</button>
                        <button onClick={() => setActiveTab('search')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex gap-2 ${activeTab === 'search' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Search size={16} /> חוק התכנון</button>
                        <button onClick={() => setActiveTab('commute')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex gap-2 ${activeTab === 'commute' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><MapPin size={16} /> רדיוס יוממות</button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8">
                <AdUnit position="באנר עליון" slotId="1234567890" />

                {activeTab === 'home' && (
                    <div className="animate-fade-in space-y-12">
                        <div className="text-center py-10 space-y-4">
                            <h2 className="text-4xl font-bold text-slate-900">ברוכים הבאים ל-Israplan</h2>
                            <p className="text-xl text-slate-600 max-w-2xl mx-auto">הפלטפורמה המתקדמת למתכננים, אדריכלים והציבור הרחב. ניתוח תב"עות, איתור מידע תכנוני וחישובי נגישות במקום אחד.</p>
                        </div>
                        
                        <div className="grid md:grid-cols-3 gap-6">
                            <div onClick={() => setActiveTab('chat')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group">
                                <div className="bg-emerald-100 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform"><Compass size={24}/></div>
                                <h3 className="text-xl font-bold mb-2">יועץ תכנון (AI)</h3>
                                <p className="text-slate-500">עוזר חכם לניתוח מסמכים סטטוטוריים ותקנות. העלה קובץ וקבל תשובות מיידיות.</p>
                            </div>
                            
                            <div onClick={() => setActiveTab('commute')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group">
                                <div className="bg-sky-100 w-12 h-12 rounded-xl flex items-center justify-center text-sky-600 mb-4 group-hover:scale-110 transition-transform"><MapPin size={24}/></div>
                                <h3 className="text-xl font-bold mb-2">רדיוס יוממות</h3>
                                <p className="text-slate-500">מחשבון חכם לאיתור אזורי מגורים לפי זמן נסיעה למקום העבודה. אידיאלי למחפשי דירה.</p>
                            </div>

                            <div onClick={() => setActiveTab('search')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group">
                                <div className="bg-amber-100 w-12 h-12 rounded-xl flex items-center justify-center text-amber-600 mb-4 group-hover:scale-110 transition-transform"><Search size={24}/></div>
                                <h3 className="text-xl font-bold mb-2">חוק התכנון</h3>
                                <p className="text-slate-500">מנוע חיפוש מהיר בתוך מסמכי התכנון והבניה. איתור לפי סעיפים, מילות מפתח ונושאים.</p>
                            </div>
                        </div>

                        <div className="bg-indigo-50 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-indigo-100">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-indigo-900">יש לך מסמך תכנוני לניתוח?</h3>
                                <p className="text-indigo-700">העלה קובץ HTML/MHTML של תוכנית או חוק והתחל לחקור אותו עם ה-AI שלנו.</p>
                            </div>
                            <button onClick={() => setActiveTab('chat')} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">התחל ניתוח</button>
                        </div>
                    </div>
                )}

                {activeTab === 'commute' ? (
                    <CommuteRadius />
                ) : activeTab !== 'home' && sections.length === 0 ? (
                    <div className="max-w-xl mx-auto mt-4 text-center animate-fade-in">
                        <button onClick={() => setActiveTab('home')} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-emerald-600 mx-auto transition-colors"><Home size={16}/> חזרה לדף הבית</button>
                        <h2 className="text-3xl font-bold mb-2 text-slate-900">טען מסמך תכנוני</h2>
                        <p className="text-slate-600 mb-8">המערכת תומכת בקבצי תב"ע, חוקים ותקנות (HTML/MHTML)</p>
                        <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-dashed border-slate-300 hover:border-emerald-500 relative transition-all group">
                            <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            {loading ? 
                                <div className="flex flex-col items-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4"></div>
                                    <p className="font-medium text-emerald-800">מעבד את קובץ החוק...</p>
                                </div> : 
                                <div>
                                    <Upload className="mx-auto h-16 w-16 text-emerald-500 mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    <p className="font-bold text-xl mb-2 text-slate-800">הפעל את מנוע הניתוח</p>
                                    <p className="text-slate-500 text-sm mb-6">העלה קובץ HTML מנבו להפעלת כלי הניתוח המשפטי</p>
                                    <button className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md">בחר קובץ</button>
                                </div>
                            }
                        </div>
                        {error && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-center gap-2 border border-red-100"><AlertCircle size={20}/>{error}</div>}
                    </div>
                ) : activeTab !== 'home' && (
                    <>
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm mb-6 text-sm border-r-4 border-emerald-500">
                            <div className="flex items-center gap-2 text-slate-700"><CheckCircle className="text-emerald-500" size={16} /><span>קובץ פעיל: {fileName} ({stats.totalSections} סעיפים)</span></div>
                            <div className="flex gap-4">
                                <button onClick={() => setActiveTab('home')} className="text-slate-500 hover:text-emerald-600 flex items-center gap-1"><Home size={14}/> ראשי</button>
                                <button onClick={() => setSections([])} className="text-slate-400 hover:text-red-500 transition-colors">החלף קובץ</button>
                            </div>
                        </div>

                        {activeTab === 'chat' && (
                            <div className="space-y-6">
                                <div className="text-center mb-6"><h2 className="text-3xl font-black text-slate-900">היועץ התכנוני שלך</h2><p className="text-slate-500">שאל על זכויות, הליכים, וסעיפים בחוק התכנון והבניה</p></div>
                                <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-200 flex gap-2 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                                    <input className="flex-grow p-4 text-lg outline-none rounded-xl" placeholder="למשל: מהם התנאים להגשת תביעה לפי סעיף 197?" value={chatQuery} onChange={e => setChatQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskQuestion()} />
                                    <button onClick={handleAskQuestion} disabled={isAiThinking} className="bg-emerald-600 text-white px-8 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm">{isAiThinking ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/> : <Sparkles size={20}/>} שאל</button>
                                </div>

                                {aiAnswer && (
                                    <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden animate-fade-in">
                                        <div className="bg-emerald-50/50 p-4 border-b border-emerald-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2"><Sparkles className="text-emerald-600" size={20} /><h3 className="font-bold text-emerald-900">ניתוח תכנוני חכם</h3></div>
                                            <button onClick={handleGeneralDraft} disabled={loadingAction?.id === 'general-draft'} className="flex items-center gap-1 text-xs bg-white text-emerald-700 px-4 py-2 rounded-full hover:bg-emerald-50 border border-emerald-200 transition-colors shadow-sm font-bold">
                                                {loadingAction?.id === 'general-draft' ? <div className="animate-spin h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full"/> : <PenTool size={14} />} נסח חוות דעת
                                            </button>
                                        </div>
                                        <div className="p-8 prose max-w-none whitespace-pre-line text-slate-800 leading-relaxed text-lg">{aiAnswer}</div>
                                        
                                        {drafts['general-draft'] && (
                                            <div className="mx-8 mb-8 bg-slate-50 p-6 rounded-xl text-sm text-slate-800 border border-slate-200 relative animate-fade-in">
                                                <button onClick={() => setDrafts(prev => {const n = {...prev}; delete n['general-draft']; return n;})} className="absolute top-4 left-4 text-slate-400 hover:text-slate-700"><X size={16}/></button>
                                                <div className="font-bold mb-3 flex items-center gap-1 text-emerald-700"><PenTool size={18}/> טיוטת חוות דעת תכנונית:</div>
                                                <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-white p-4 rounded-lg border border-slate-200 shadow-inner">{drafts['general-draft']}</div>
                                            </div>
                                        )}
                                        
                                        <div className="px-8 pb-4"><AdUnit position="בתוך התשובה" slotId="9876543210" /></div>

                                        {answerSources.length > 0 && (
                                            <div className="bg-slate-50/50 p-5 border-t border-slate-100">
                                                <div className="text-sm font-bold text-slate-500 mb-3">סעיפי חוק רלוונטיים:</div>
                                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                                                    {answerSources.slice(0, 5).map((src, i) => (
                                                        <div key={i} className="flex-shrink-0 bg-white border border-slate-200 px-4 py-3 rounded-xl text-xs w-72 h-28 overflow-hidden shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer" onClick={() => {
                                                            setActiveTab('search');
                                                            setSearchType('section');
                                                            setSectionQuery(src.id);
                                                        }}>
                                                            <div className="font-bold text-emerald-700 truncate mb-1">סעיף {src.id}: {src.title}</div>
                                                            <div className="text-slate-500 line-clamp-3 leading-normal">{src.content}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'search' && (
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex gap-4 mb-6">
                                        <button onClick={() => {setSearchType('section'); setSectionQuery(''); setSearchResults([])}} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${searchType === 'section' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><Hash size={18}/> איתור סעיף</button>
                                        <button onClick={() => {setSearchType('free'); setSearchQuery(''); setSearchResults([])}} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${searchType === 'free' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><Type size={18}/> חיפוש חופשי</button>
                                    </div>
                                    {searchType === 'section' ? <input className="w-full p-4 border border-slate-200 rounded-xl text-xl font-mono direction-ltr text-right focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="מספר סעיף (לדוגמה: 145)" value={sectionQuery} onChange={e => setSectionQuery(e.target.value)} /> : <input className="w-full p-4 border border-slate-200 rounded-xl text-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="מילות מפתח (לדוגמה: הקלה, שימוש חורג...)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />}
                                </div>

                                <div className="space-y-4">
                                    {searchResults.map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-300 transition-all">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
                                                    <h4 className="font-bold text-xl text-slate-900 border-r-4 border-emerald-500 pr-3">{item.title}</h4>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleSimplify(item.id, item.title, item.content)} disabled={loadingAction?.id === item.id} className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-3 py-2 rounded-full hover:bg-emerald-100 border border-emerald-100 transition-all font-bold">{loadingAction?.id === item.id && loadingAction?.type === 'simplify' ? <div className="animate-spin h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full"/> : <Sparkles size={14} />} הסבר מקצועי</button>
                                                        <button onClick={() => handleDraftLetter(item.id, item.title, item.content)} disabled={loadingAction?.id === item.id} className="flex items-center gap-1.5 text-xs bg-slate-50 text-slate-700 px-3 py-2 rounded-full hover:bg-slate-100 border border-slate-200 transition-all font-bold">{loadingAction?.id === item.id && loadingAction?.type === 'draft' ? <div className="animate-spin h-3 w-3 border-2 border-slate-600 border-t-transparent rounded-full"/> : <PenTool size={14} />} נסח מכתב</button>
                                                        <button onClick={() => handleQuiz(item.id, item.title, item.content)} disabled={loadingAction?.id === item.id} className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-full hover:bg-amber-100 border border-amber-200 transition-all font-bold">{loadingAction?.id === item.id && loadingAction?.type === 'quiz' ? <div className="animate-spin h-3 w-3 border-2 border-amber-700 border-t-transparent rounded-full"/> : <HelpCircle size={14} />} בחן אותי</button>
                                                    </div>
                                                </div>
                                                <div className="text-slate-700 whitespace-pre-line leading-relaxed text-base mb-5 bg-slate-50/30 p-4 rounded-xl">{item.content}</div>
                                                <div className="space-y-3">
                                                    {simplifications[item.id] && <div className="bg-emerald-50/50 p-4 rounded-xl text-sm text-emerald-900 border border-emerald-100 relative animate-fade-in"><button onClick={() => setSimplifications(prev => {const n = {...prev}; delete n[item.id]; return n;})} className="absolute top-3 left-3 text-emerald-300 hover:text-emerald-500"><X size={16}/></button><div className="font-bold mb-2 flex items-center gap-1 text-emerald-700"><Sparkles size={16}/> פרשנות תכנונית:</div>{simplifications[item.id]}</div>}
                                                    {drafts[item.id] && <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-800 border border-slate-200 relative animate-fade-in"><button onClick={() => setDrafts(prev => {const n = {...prev}; delete n[item.id]; return n;})} className="absolute top-3 left-3 text-slate-400 hover:text-slate-600"><X size={16}/></button><div className="font-bold mb-2 flex items-center gap-1 text-emerald-700"><PenTool size={16}/> טיוטת מסמך:</div><div className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-white p-3 rounded-lg border border-slate-200 shadow-sm mt-1">{drafts[item.id]}</div></div>}
                                                    {quizzes[item.id] && <div className="bg-amber-50 p-4 rounded-xl text-sm text-amber-900 border border-amber-100 relative animate-fade-in"><button onClick={() => setQuizzes(prev => {const n = {...prev}; delete n[item.id]; return n;})} className="absolute top-3 left-3 text-amber-400 hover:text-amber-700"><X size={16}/></button><div className="font-bold mb-2 flex items-center gap-1 text-amber-700"><CheckSquare size={16}/> בחן את עצמך:</div><div className="whitespace-pre-wrap">{quizzes[item.id]}</div></div>}
                                                </div>
                                            </div>
                                            {(idx + 1) % 3 === 0 && <AdUnit position={`בין תוצאות החיפוש #${idx+1}`} slotId={`list-${idx}`} />}
                                        </React.Fragment>
                                    ))}
                                    {(searchType === 'section' ? sectionQuery : searchQuery) && searchResults.length === 0 && <div className="text-center text-slate-400 py-16"><Search size={48} className="mx-auto mb-4 opacity-20" /><p className="text-lg">לא מצאנו סעיף תואם, נסה חיפוש חופשי</p></div>}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
            <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-slate-200 text-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-emerald-600 opacity-50 grayscale hover:grayscale-0 transition-all cursor-default"><Building2 size={20} /><span className="font-bold">Israplan AI</span></div>
                    <p className="text-slate-400 text-xs">המידע באתר אינו מהווה ייעוץ משפטי או תכנוני רשמי. השימוש באחריות המשתמש.</p>
                </div>
            </footer>
        </div>
    );
};

export default LawApp;
