async function callTTS(apiKey, model, body) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        // Leer el error como texto para no romper si no es JSON
        const errorText = await response.text();
        let errorMsg;
        try { errorMsg = JSON.parse(errorText)?.error?.message || errorText; }
        catch { errorMsg = errorText; }
        throw new Error(`[${model}] ${response.status}: ${errorMsg}`);
    }

    return response;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'No text provided' });

        let response;

        // Intentar primero con gpt-4o-mini-tts (más natural)
        try {
            response = await callTTS(apiKey, 'gpt-4o-mini-tts', {
                model: 'gpt-4o-mini-tts',
                input: text,
                voice: 'nova',
                speed: 0.92,
                instructions: 'Habla en español con un tono cálido, pausado y conversacional. Evita sonar monótona. Usa inflexión natural y ritmo humano, como si estuvieras teniendo una conversación real con un estudiante universitario. Haz pausas breves y naturales entre ideas.'
            });
        } catch (e) {
            console.warn('gpt-4o-mini-tts no disponible, usando tts-1-hd:', e.message);
            // Fallback al modelo estándar
            response = await callTTS(apiKey, 'tts-1-hd', {
                model: 'tts-1-hd',
                input: text,
                voice: 'nova',
                speed: 0.92
            });
        }

        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        return res.status(200).json({ audio: audioBase64, format: 'mp3' });

    } catch (error) {
        console.error('TTS handler error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
