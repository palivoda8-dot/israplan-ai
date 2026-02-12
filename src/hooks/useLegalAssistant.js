import { useState, useCallback } from 'react';
import { callGemini } from '../utils/gemini';

const useLegalAssistant = (findContextForAI) => {
    const [isThinking, setIsThinking] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [aiAnswer, setAiAnswer] = useState(null);
    const [answerSources, setAnswerSources] = useState([]);
    
    // Drafts and Simplifications could be managed here or in parent
    const [simplifications, setSimplifications] = useState({});
    const [drafts, setDrafts] = useState({});
    const [quizzes, setQuizzes] = useState({});

    const handleAskQuestion = useCallback(async (query) => {
        if (!query.trim()) return;
        
        setIsThinking(true);
        setAiAnswer(null);
        setDrafts(prev => {
            const n = {...prev};
            delete n['general-draft'];
            return n;
        });

        // 1. Find relevant sections
        const relevant = findContextForAI(query, 25);
        setAnswerSources(relevant);
        
        if (relevant.length === 0) {
            setAiAnswer("לא נמצא מידע רלוונטי בקובץ.");
            setIsThinking(false);
            return;
        }

        // 2. Prepare context
        const context = relevant.map(r => `[סעיף ${r.id} - ${r.title}]: ${r.content}`).join("\n\n");
        
        // 3. Build Prompt
        const prompt = `אתה עורך דין מומחה לחוק התכנון והבניה הישראלי. שאלה: ${query}. קטעי החוק: ${context}. הוראות: 1. דייקנות. 2. מבנה: שורה תחתונה, פרקטיקה, זכויות, סייגים. 3. ציטוט חובה.`;
        
        // 4. Call API
        const ans = await callGemini(prompt);
        setAiAnswer(ans);
        setIsThinking(false);
    }, [findContextForAI]);

    const handleSimplify = useCallback(async (id, title, content) => {
        if (simplifications[id] || loadingAction) return;
        
        setLoadingAction({id, type: 'simplify'});
        const ans = await callGemini(`הסבר את סעיף ${title} בעברית פשוטה:\n${content}`);
        
        setSimplifications(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    }, [simplifications, loadingAction]);

    const handleDraftLetter = useCallback(async (id, title, content) => {
        if (drafts[id] || loadingAction) return;
        
        setLoadingAction({id, type: 'draft'});
        const ans = await callGemini(`כתוב מכתב רשמי (טיוטה) המסתמך על סעיף ${title}. תוכן: ${content}.`);
        
        setDrafts(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    }, [drafts, loadingAction]);

    const handleGeneralDraft = useCallback(async (query, answer) => {
        const id = 'general-draft';
        if (drafts[id] || loadingAction) return;
        
        setLoadingAction({id, type: 'draft'});
        const ans = await callGemini(`כתוב מכתב רשמי המבוסס על השאלה: ${query} והתשובה: ${answer}`);
        
        setDrafts(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    }, [drafts, loadingAction]);

    const handleQuiz = useCallback(async (id, title, content) => {
        if (quizzes[id] || loadingAction) return;
        
        setLoadingAction({id, type: 'quiz'});
        const ans = await callGemini(`כתוב שאלת טריוויה אמריקאית על סעיף ${title}. תוכן: ${content}.`);
        
        setQuizzes(prev => ({...prev, [id]: ans}));
        setLoadingAction(null);
    }, [quizzes, loadingAction]);
    
    // Clear helpers
    const clearSimplification = (id) => setSimplifications(prev => {const n = {...prev}; delete n[id]; return n;});
    const clearDraft = (id) => setDrafts(prev => {const n = {...prev}; delete n[id]; return n;});
    const clearQuiz = (id) => setQuizzes(prev => {const n = {...prev}; delete n[id]; return n;});

    return {
        isThinking,
        loadingAction,
        aiAnswer,
        answerSources,
        simplifications,
        drafts,
        quizzes,
        handleAskQuestion,
        handleSimplify,
        handleDraftLetter,
        handleGeneralDraft,
        handleQuiz,
        clearSimplification,
        clearDraft,
        clearQuiz
    };
};

export default useLegalAssistant;
