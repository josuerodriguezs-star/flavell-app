export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        // Convertir formato Gemini a formato Claude
        const messages = req.body.contents
            .filter(msg => msg.role === 'user' || msg.role === 'model')
            .map(msg => ({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: msg.parts[0].text
            }));

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-opus-4-1',
                max_tokens: 1024,
                system: req.body.system_instruction?.parts?.[0]?.text || '',
                messages: messages,
                temperature: req.body.generationConfig?.temperature || 0.8
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Convertir respuesta Claude a formato Gemini
        const geminiFormat = {
            candidates: [{
                content: {
                    parts: [{
                        text: data.content[0].text
                    }]
                }
            }]
        };

        return res.status(200).json(geminiFormat);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
