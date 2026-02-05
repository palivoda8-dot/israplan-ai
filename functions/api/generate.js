export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const userPrompt = body.prompt;

    if (!userPrompt) {
      return new Response(JSON.stringify({ error: "No prompt provided" }), { status: 400 });
    }

    const apiKey = env.GEMINI_API_KEY; // This comes from Cloudflare Dashboard
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration: No API Key" }), { status: 500 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: userPrompt }] }] })
      }
    );

    const data = await response.json();
    
    // Extract just the text to send back to client, keeping internal structure hidden if needed
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "לא התקבלה תשובה.";

    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}