export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const { audio } = req.body;

        if (!audio) {
            return res.status(400).json({ error: 'No audio provided' });
        }

        // Decodificar base64 a buffer
        const audioBuffer = Buffer.from(audio, 'base64');

        if (audioBuffer.length === 0) {
            return res.status(400).json({ error: 'Empty audio buffer' });
        }

        // Construir multipart para OpenAI
        const boundary = String(Math.random()).substring(2);
        
        const part1 = Buffer.from(
            `--${boundary}\r\n` +
            'Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n' +
            'Content-Type: audio/webm\r\n\r\n'
        );

        const part2 = Buffer.from(
            `\r\n--${boundary}\r\n` +
            'Content-Disposition: form-data; name="model"\r\n\r\n' +
            'whisper-1\r\n' +
            `--${boundary}--\r\n`
        );

        const body = Buffer.concat([part1, audioBuffer, part2]);

        // Llamar API Whisper
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Whisper API error:', data);
            return res.status(response.status).json({ 
                error: data.error?.message || 'Whisper API failed' 
            });
        }

        return res.status(200).json({ text: data.text || '' });

    } catch (error) {
        console.error('Whisper handler error:', error);
        return res.status(500).json({ error: error.message });
    }
}
