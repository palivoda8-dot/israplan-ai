import React, { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { parseFileContent, extractSectionsFromHTML } from '../../utils/fileParser';

const FileUploader = ({ onUploadSuccess, onError }) => {
    const [loading, setLoading] = useState(false);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target.result;
            if (content) {
                try {
                    const html = parseFileContent(content);
                    const parsed = extractSectionsFromHTML(html);

                    if (parsed.length > 0) {
                        const stats = {
                            totalSections: parsed.length,
                            totalWords: parsed.reduce((acc, c) => acc + c.content.length, 0)
                        };
                        onUploadSuccess(file.name, parsed, stats);
                    } else {
                        onError("לא זוהו סעיפים. ייתכן שהקובץ פגום.");
                    }
                } catch (err) {
                    console.error("Parsing error:", err);
                    onError("שגיאה בעיבוד הקובץ.");
                }
            }
            setLoading(false);
        };

        reader.onerror = () => {
            setLoading(false);
            onError("שגיאה בקריאת הקובץ.");
        };

        reader.readAsText(file);
    };

    return (
        <div className="max-w-xl mx-auto mt-4 text-center">
            <h2 className="text-3xl font-bold mb-2">טען את קובץ החוק</h2>
            <p className="text-slate-600 mb-8">המערכת תומכת בקבצי HTML/MHTML מנבו</p>
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-dashed border-slate-300 hover:border-blue-500 relative transition-all group">
                <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    accept=".html,.htm,.mhtml"
                />
                {loading ? (
                    <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-4"></div>
                        <p>מעבד...</p>
                    </div>
                ) : (
                    <div className="group-hover:scale-105 transition-transform">
                        <Upload className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                        <p className="font-bold text-lg">לחץ להעלאה</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUploader;
