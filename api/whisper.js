export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        // req.body debe contener: { audio: base64String }
        const { audio } = req.body;

        if (!audio) {
            return res.status(400).json({ error: 'No audio provided' });
        }

        // Convertir base64 a Buffer
        const audioBuffer = Buffer.from(audio, 'base64');

        // Crear FormData
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', audioBuffer, 'audio.webm');
        form.append('model', 'whisper-1');

        // Llamar a Whisper
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...form.getHeaders()
            },
            body: form
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json({ text: data.text });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
