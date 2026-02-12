import React, { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

// Layout
import Header from './components/layout/Header';
import AdUnit from './components/layout/AdUnit';

// Features
import FileUploader from './components/features/FileUploader';
import ChatInterface from './components/features/ChatInterface';
import SearchInterface from './components/features/SearchInterface';
import CommuteRadius from './components/features/CommuteRadius';

// Hooks
import useSectionSearch from './hooks/useSectionSearch';
import useLegalAssistant from './hooks/useLegalAssistant';

// Default Data
import lawData from './assets/lawData.json';

const LawApp = () => {
    // UI State
    const [activeTab, setActiveTab] = useState('chat');
    const [error, setError] = useState(null);

    // Data State - Initialize with default law data
    const [sections, setSections] = useState(lawData.sections || []);
    const [fileName, setFileName] = useState(lawData.fileName || "Law File");
    const [stats, setStats] = useState(lawData.stats || { totalSections: 0, totalWords: 0 });

    // Search State
    const [searchType, setSearchType] = useState('section');
    const [searchQuery, setSearchQuery] = useState("");
    const [sectionQuery, setSectionQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);

    // Chat State
    const [chatQuery, setChatQuery] = useState("");

    // Custom Hooks
    const { findSectionById, findRelevantSectionsByText, findContextForAI } = useSectionSearch(sections);
    
    const {
        isThinking,
        loadingAction,
        aiAnswer,
        answerSources,
        simplifications,
        setSimplifications, // Exposed setter for closing
        drafts,
        setDrafts, // Exposed setter
        quizzes,
        setQuizzes, // Exposed setter
        handleAskQuestion,
        handleSimplify,
        handleDraftLetter,
        handleGeneralDraft,
        handleQuiz
    } = useLegalAssistant(findContextForAI);

    // Handlers
    const handleUploadSuccess = (name, parsedSections, fileStats) => {
        setFileName(name);
        setSections(parsedSections);
        setStats(fileStats);
        setError(null);
    };

    const handleUploadError = (msg) => {
        setError(msg);
        setSections([]);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-right text-slate-800" dir="rtl">
            <Header activeTab={activeTab} setActiveTab={setActiveTab} />

            <main className="max-w-5xl mx-auto px-4 py-8">
                <AdUnit position="באנר עליון" slotId="1234567890" />

                {activeTab === 'commute' ? (
                    <CommuteRadius />
                ) : sections.length === 0 ? (
                    <>
                        <FileUploader onUploadSuccess={handleUploadSuccess} onError={handleUploadError} />
                        {error && (
                            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-center gap-2">
                                <AlertCircle size={20}/>{error}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Loaded File Status Bar */}
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm mb-6 text-sm">
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle size={16} />
                                <span>נטען: {fileName} ({stats.totalSections} סעיפים)</span>
                            </div>
                            <button onClick={() => setSections([])} className="text-red-500 hover:underline">
                                החלף קובץ
                            </button>
                        </div>

                        {activeTab === 'chat' && (
                            <ChatInterface 
                                chatQuery={chatQuery}
                                setChatQuery={setChatQuery}
                                handleAskQuestion={handleAskQuestion}
                                aiAnswer={aiAnswer}
                                isThinking={isThinking}
                                loadingAction={loadingAction}
                                handleGeneralDraft={handleGeneralDraft}
                                drafts={drafts}
                                setDrafts={setDrafts}
                                answerSources={answerSources}
                                setActiveTab={setActiveTab}
                                setSearchType={setSearchType}
                                setSectionQuery={setSectionQuery}
                            />
                        )}

                        {activeTab === 'search' && (
                            <SearchInterface 
                                searchType={searchType}
                                setSearchType={setSearchType}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                sectionQuery={sectionQuery}
                                setSectionQuery={setSectionQuery}
                                searchResults={searchResults}
                                setSearchResults={setSearchResults}
                                findSectionById={findSectionById}
                                findRelevantSectionsByText={findRelevantSectionsByText}
                                handleSimplify={handleSimplify}
                                handleDraftLetter={handleDraftLetter}
                                handleQuiz={handleQuiz}
                                loadingAction={loadingAction}
                                simplifications={simplifications}
                                setSimplifications={setSimplifications}
                                drafts={drafts}
                                setDrafts={setDrafts}
                                quizzes={quizzes}
                                setQuizzes={setQuizzes}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default LawApp;
