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

        // Convertir base64 a Buffer
        const audioBuffer = Buffer.from(audio, 'base64');

        // Construir FormData manualmente (compatible con Vercel)
        const boundary = String(Math.random()).substring(2);
        let body = '';

        // Parte del archivo
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n`;
        body += `Content-Type: audio/webm\r\n\r\n`;

        // Combinar partes de texto con buffer de audio
        const bodyBuffer = Buffer.concat([
            Buffer.from(body),
            audioBuffer,
            Buffer.from(`\r\n--${boundary}\r\n`),
            Buffer.from(`Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
            Buffer.from(`--${boundary}--\r\n`)
        ]);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: bodyBuffer
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Whisper API error:', data);
            return res.status(response.status).json({ 
                error: data.error?.message || 'Whisper API error' 
            });
        }

        return res.status(200).json({ text: data.text || '' });

    } catch (error) {
        console.error('Whisper handler error:', error);
        return res.status(500).json({ error: error.message });
    }
}
