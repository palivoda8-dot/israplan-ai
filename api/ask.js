const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `אתה עורך דין מומחה לחוק התכנון והבניה הישראלי.
  נתח את השאלה הבאה: "${query}"
  
  ענה בדיוק במבנה הבא (JSON):
  {
    "top": "שורה תחתונה ברורה וישירה",
    "caveats": "רשימת סייגים והגבלות רלוונטיים מהחוק",
    "recs": "המלצות פרקטיות (מה לעשות עכשיו)",
    "summary": "סיכום קצר ומקצועי"
  }
  
  הקפד על דיוק משפטי מקסימלי. אם מדובר בהפקעה של 30%, ציין את סעיף 190 וסעיף 197.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch[0]);
    
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch AI answer" });
  }
};
