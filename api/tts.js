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

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                input: text,
                voice: 'nova',
                speed: 0.95
                instructions: 'Habla en español con un tono cálido, pausado y conversacional. Evita sonar monótona. Usa inflexión natural, como si estuvieras teniendo una conversación real con un estudiante universitario.'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json(error);
        }

        // Devolver el audio como base64
        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');

        return res.status(200).json({ audio: audioBase64, format: 'mp3' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
