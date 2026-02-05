const { useState, useEffect } = React;
const { Search, Upload, AlertCircle, CheckCircle, BookOpen, Sparkles, MessageSquare, X, FileText, Scale, Hash, Type, PenTool, HelpCircle, CheckSquare, DollarSign } = lucide;

// --- AD UNIT COMPONENT ---
const AdUnit = ({ position, slotId }) => {
    return (
        <div className="w-full my-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-400 min-h-[120px] animate-fade-in relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-gray-200 text-xs px-2 py-1 rounded text-gray-500">פרסומת</div>
            <DollarSign className="mb-2 opacity-50" size={24} />
            <span className="font-bold text-sm text-gray-500">שטח פרסום ({position})</span>
            <span className="text-xs text-center mt-1 max-w-md">
                כאן יופיעו מודעות Google AdSense. (Slot ID: {slotId || 'טרם הוגדר'})
            </span>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
const LawApp = () => {
    const [activeTab, setActiveTab] = useState('chat');
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
    const [userApiKey, setUserApiKey] = useState("");

    const defaultApiKey = ""; 
    const getApiKey = () => userApiKey || defaultApiKey;

    const decodeQuotedPrintable = (input) => {
        try {
            let clean = input.replace(/=\r?\n/g, '');
            clean = clean.replace(/=([0-9A-F]{2})/gi, '%$1');
            return decodeURIComponent(clean);
        } catch (e) { return input; }
    };

    const parseFileContent = (content) => {
        try {
            let htmlContent = content;
            if (content.includes("multipart/related") || content.includes("MIME-Version")) {
                const match = content.match(/<html[\s\S]*?<\/html>/i);
                if (match) {
                    htmlContent = match[0];
                    if (content.includes("Content-Transfer-Encoding: quoted-printable") || /=D7/i.test(htmlContent)) {
                        htmlContent = decodeQuotedPrintable(htmlContent);
                    }
                }
            }
            return htmlContent;
        } catch (e) { return content; }
    };

    const extractSectionsFromHTML = (htmlString) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        doc.querySelectorAll('script, style, meta, link, noscript').forEach(s => s.remove());
        const text = doc.body.innerText || "";
        const lines = text.split('\n');
        const extractedSections = [];
        let currentSection = { id: "intro", title: "מבוא / הגדרות", content: "" };
        
        const sectionRegex = /^\s*(?:סעיף\s+)?(\d+(?:[א-ת]{1,2}|'[א-ת])?)\.?\s*$/;
        const sectionStartRegex = /^\s*(?:סעיף\s+)?(\d+(?:[א-ת]{1,2}|'[א-ת])?)\.?\s+/;
        const chapterRegex = /^\s*(?:פרק|סימן|תוספת)\s+[א-ת]+/;

        lines.forEach(line => {
            const cleanLine = line.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim();
            if (!cleanLine) return;
            if (chapterRegex.test(cleanLine)) {
                currentSection.content += `\n[${cleanLine}]\n`;
                return;
            }
            let match = cleanLine.match(sectionRegex);
            if (!match) match = cleanLine.match(sectionStartRegex);
            
            if (match && cleanLine.length < 50) {
                if (currentSection.content.trim().length > 0) extractedSections.push({...currentSection});
                currentSection = { id: match[1], title: cleanLine, content: "" };
            } else {
                currentSection.content += cleanLine + "\n";
            }
        });
        if (currentSection.content.trim().length > 0) extractedSections.push(currentSection);
        return extractedSections;
    };

    const callGemini = async (prompt) => {
        const key = getApiKey();
        if (!key) return "אנא הזן מפתח API של גוגל (Gemini Key) בחלק העליון של המסך כדי להשתמש בתכונות החכמות.";
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                }
            );
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "לא התקבלה תשובה.";
        } catch (error) {
            console.error(error);
            return "אירעה שגיאה. בדוק את מפתח ה-API שלך ונסה שנית.";
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
            setAiAnswer("לא נמצא מידע רלוונטי בקובץ.");
            setIsAiThinking(false);
            return;
        }
        const context = relevant.map(r => `[סעיף ${r.id} - ${r.title}]: ${r.content}`).join("\n\n");
        const prompt = `אתה עורך דין מומחה לחוק התכנון והבניה הישראלי. שאלה: ${chatQuery}. קטעי החוק: ${context}. הוראות: 1. דייקנות. 2. מבנה: שורה תחתונה, פרקטיקה, זכויות, סייגים. 3. ציטוט חובה.`;
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

    const handleAskQuestion = async () => {
        if (!chatQuery.trim() || isAiThinking) return;
        setIsAiThinking(true);
        setAiAnswer(null);
        try {
            const context = sections.slice(0, 10).map(s => `${s.title}: ${s.content}`).join('\n');
            const ans = await callGemini(`בהתבסס על החוק הבא:\n${context}\nענה על השאלה: ${chatQuery}`);
            setAiAnswer(ans);
        } catch (e) {
            setAiAnswer("אירעה שגיאה בביצוע השאלה.");
        }
        setIsAiThinking(false);
    };

    const callGemini = async (prompt) => {
        return "זוהי תשובה זמנית מאחר ואין חיבור API מוגדר.";
    };

    const handleSimplify = async (id, title, content) => {
        if (simplifications[id] || loadingAction) return;
        setLoadingAction({id, type: 'simplify'});
        const ans = await callGemini(`הסבר את סעיף ${title} בעברית פשוטה:\n${content}`);
        setSimplifications(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    };

    const handleDraftLetter = async (id, title, content) => {
        if (drafts[id] || loadingAction) return;
        setLoadingAction({id, type: 'draft'});
        const ans = await callGemini(`כתוב מכתב רשמי (טיוטה) המסתמך על סעיף ${title}. תוכן: ${content}.`);
        setDrafts(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    };

    const handleGeneralDraft = async () => {
        const id = 'general-draft';
        if (drafts[id] || loadingAction) return;
        setLoadingAction({id, type: 'draft'});
        const ans = await callGemini(`כתוב מכתב רשמי המבוסס על השאלה: ${chatQuery} והתשובה: ${aiAnswer}`);
        setDrafts(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    };

    const handleQuiz = async (id, title, content) => {
        if (quizzes[id] || loadingAction) return;
        setLoadingAction({id, type: 'quiz'});
        const ans = await callGemini(`כתוב שאלת טריוויה אמריקאית על סעיף ${title}. תוכן: ${content}.`);
        setQuizzes(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 text-right text-gray-800" dir="rtl">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg text-white"><Scale size={24} /></div>
                        <div><h1 className="text-xl font-bold leading-none">חוק התכנון והבניה</h1><span className="text-xs text-gray-500">עוזר משפטי חכם</span></div>
                    </div>
                    {sections.length > 0 && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('chat')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex gap-2 ${activeTab === 'chat' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}><Sparkles size={16} /> שאל את החוק</button>
                            <button onClick={() => setActiveTab('search')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex gap-2 ${activeTab === 'search' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}><Search size={16} /> איתור וחיפוש</button>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-4 text-xs text-gray-400 text-center">
                    <input type="password" placeholder="הכנס מפתח Gemini API (אופציונלי)" className="bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none text-center w-64" value={userApiKey} onChange={e => setUserApiKey(e.target.value)} />
                </div>

                <AdUnit position="באנר עליון" slotId="1234567890" />

                {sections.length === 0 ? (
                    <div className="max-w-xl mx-auto mt-4 text-center">
                        <h2 className="text-3xl font-bold mb-2">טען את קובץ החוק</h2>
                        <p className="text-gray-600 mb-8">המערכת תומכת בקבצי HTML/MHTML מנבו</p>
                        <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-dashed border-gray-300 hover:border-blue-500 relative transition-all">
                            <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            {loading ? <div className="flex flex-col items-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-4"></div><p>מעבד...</p></div> : <><Upload className="mx-auto h-12 w-12 text-blue-600 mb-4" /><p className="font-bold text-lg">לחץ להעלאה</p></>}
                        </div>
                        {error && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-center gap-2"><AlertCircle size={20}/>{error}</div>}
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm mb-6 text-sm">
                            <div className="flex items-center gap-2 text-green-600"><CheckCircle size={16} /><span>נטען: {fileName} ({stats.totalSections} סעיפים)</span></div>
                            <button onClick={() => setSections([])} className="text-red-500 underline">החלף קובץ</button>
                        </div>

                        {activeTab === 'chat' && (
                            <div className="space-y-6">
                                <div className="text-center mb-6"><h2 className="text-2xl font-bold">מה תרצה לברר?</h2></div>
                                <div className="bg-white p-2 rounded-2xl shadow border flex gap-2">
                                    <input className="flex-grow p-3 text-lg outline-none" placeholder="למשל: תוך כמה זמן אפשר להגיש תביעת פיצויים לפי סעיף 197?" value={chatQuery} onChange={e => setChatQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskQuestion()} />
                                    <button onClick={handleAskQuestion} disabled={isAiThinking} className="bg-blue-600 text-white px-6 rounded-xl font-bold flex items-center gap-2">{isAiThinking ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/> : <Sparkles size={20}/>} שאל</button>
                                </div>

                                {aiAnswer && (
                                    <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-fade-in">
                                        <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2"><Sparkles className="text-indigo-600" size={20} /><h3 className="font-bold text-indigo-900">תשובת העוזר המשפטי</h3></div>
                                            <button onClick={handleGeneralDraft} disabled={loadingAction?.id === 'general-draft'} className="flex items-center gap-1 text-xs bg-white text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-sm">
                                                {loadingAction?.id === 'general-draft' ? <div className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full"/> : <PenTool size={14} />} נסח מכתב
                                            </button>
                                        </div>
                                        <div className="p-6 prose max-w-none whitespace-pre-line text-gray-800">{aiAnswer}</div>
                                        
                                        {drafts['general-draft'] && (
                                            <div className="mx-6 mb-6 bg-emerald-50 p-4 rounded-lg text-sm text-emerald-900 border border-emerald-100 relative animate-fade-in">
                                                <button onClick={() => setDrafts(prev => {const n = {...prev}; delete n['general-draft']; return n;})} className="absolute top-2 left-2 text-emerald-400 hover:text-emerald-700"><X size={14}/></button>
                                                <div className="font-bold mb-2 flex items-center gap-1"><PenTool size={16}/> טיוטת מכתב רשמי:</div>
                                                <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-white p-3 rounded border border-emerald-100 shadow-sm">{drafts['general-draft']}</div>
                                            </div>
                                        )}

                                        <div className="px-6"><AdUnit position="בתוך התשובה" slotId="9876543210" /></div>

                                        {answerSources.length > 0 && (
                                            <div className="bg-gray-50 p-4 border-t border-gray-100">
                                                <div className="text-sm font-bold text-gray-500 mb-2">מקורות רלוונטיים:</div>
                                                <div className="flex gap-2 overflow-x-auto pb-2">
                                                    {answerSources.slice(0, 5).map((src, i) => (
                                                        <div key={i} className="flex-shrink-0 bg-white border px-3 py-2 rounded text-xs w-64 h-24 overflow-hidden shadow-sm">
                                                            <div className="font-bold text-blue-600 truncate">{src.title}</div>
                                                            <div className="text-gray-500 mt-1 line-clamp-3">{src.content}</div>
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
                                <div className="bg-white p-4 rounded-xl shadow-sm border">
                                    <div className="flex gap-4 mb-4 border-b pb-4">
                                        <button onClick={() => {setSearchType('section'); setSectionQuery(''); setSearchResults([])}} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${searchType === 'section' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-600'}`}><Hash size={18}/> לפי מספר סעיף</button>
                                        <button onClick={() => {setSearchType('free'); setSearchQuery(''); setSearchResults([])}} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${searchType === 'free' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-600'}`}><Type size={18}/> חיפוש חופשי</button>
                                    </div>
                                    {searchType === 'section' ? <input className="w-full p-3 border rounded-lg text-lg font-mono direction-ltr text-right" placeholder="הכנס מספר סעיף (לדוגמה: 197)" value={sectionQuery} onChange={e => setSectionQuery(e.target.value)} /> : <input className="w-full p-3 border rounded-lg text-lg" placeholder="הכנס מילות מפתח..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />}
                                </div>

                                <div className="space-y-4">
                                    {searchResults.map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border hover:border-blue-300 transition-all">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                                                    <h4 className="font-bold text-lg text-gray-800">{item.title}</h4>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleSimplify(item.id, item.title, item.content)} disabled={loadingAction?.id === item.id} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-100 border border-indigo-200 transition-colors">{loadingAction?.id === item.id && loadingAction?.type === 'simplify' ? <div className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full"/> : <Sparkles size={14} />} הסבר</button>
                                                        <button onClick={() => handleDraftLetter(item.id, item.title, item.content)} disabled={loadingAction?.id === item.id} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-100 border border-emerald-200 transition-colors">{loadingAction?.id === item.id && loadingAction?.type === 'draft' ? <div className="animate-spin h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full"/> : <PenTool size={14} />} נסח מכתב</button>
                                                        <button onClick={() => handleQuiz(item.id, item.title, item.content)} disabled={loadingAction?.id === item.id} className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full hover:bg-amber-100 border border-amber-200 transition-colors">{loadingAction?.id === item.id && loadingAction?.type === 'quiz' ? <div className="animate-spin h-3 w-3 border-2 border-amber-700 border-t-transparent rounded-full"/> : <HelpCircle size={14} />} בחן אותי</button>
                                                    </div>
                                                </div>
                                                <div className="text-gray-700 whitespace-pre-line leading-relaxed mb-4">{item.content}</div>
                                                <div className="space-y-3">
                                                    {simplifications[item.id] && <div className="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-900 border border-indigo-100 relative animate-fade-in"><button onClick={() => setSimplifications(prev => {const n = {...prev}; delete n[item.id]; return n;})} className="absolute top-2 left-2 text-indigo-400 hover:text-indigo-700"><X size={14}/></button><div className="font-bold mb-1 flex items-center gap-1"><Sparkles size={14}/> הסבר פשוט:</div>{simplifications[item.id]}</div>}
                                                    {drafts[item.id] && <div className="bg-emerald-50 p-3 rounded-lg text-sm text-emerald-900 border border-emerald-100 relative animate-fade-in"><button onClick={() => setDrafts(prev => {const n = {...prev}; delete n[item.id]; return n;})} className="absolute top-2 left-2 text-emerald-400 hover:text-emerald-700"><X size={14}/></button><div className="font-bold mb-1 flex items-center gap-1"><PenTool size={14}/> טיוטת מכתב:</div><div className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-white p-2 rounded border border-emerald-100 shadow-sm mt-1">{drafts[item.id]}</div></div>}
                                                    {quizzes[item.id] && <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-900 border border-amber-100 relative animate-fade-in"><button onClick={() => setQuizzes(prev => {const n = {...prev}; delete n[item.id]; return n;})} className="absolute top-2 left-2 text-amber-400 hover:text-amber-700"><X size={14}/></button><div className="font-bold mb-1 flex items-center gap-1"><CheckSquare size={14}/> בחן את עצמך:</div><div className="whitespace-pre-wrap">{quizzes[item.id]}</div></div>}
                                                </div>
                                            </div>
                                            {(idx + 1) % 3 === 0 && <AdUnit position={`בין תוצאות החיפוש #${idx+1}`} slotId={`list-${idx}`} />}
                                        </React.Fragment>
                                    ))}
                                    {(searchType === 'section' ? sectionQuery : searchQuery) && searchResults.length === 0 && <div className="text-center text-gray-500 py-10">לא נמצאו תוצאות</div>}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<LawApp />);
