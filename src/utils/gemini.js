export const callGemini = async (prompt) => {
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
