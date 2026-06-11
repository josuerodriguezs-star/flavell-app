export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        let buffers = [];

        await new Promise((resolve, reject) => {
            req.on('data', (chunk) => {
                buffers.push(chunk);
            });
            req.on('end', resolve);
            req.on('error', reject);
        });

        const buffer = Buffer.concat(buffers);

        if (buffer.length === 0) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=([^;]+)/);
        
        if (!boundaryMatch) {
            return res.status(400).json({ error: 'Invalid content-type' });
        }

        const boundary = boundaryMatch[1];
        const startMarker = Buffer.from(`--${boundary}`);
        const endMarker = Buffer.from(`\r\n--${boundary}`);

        let startIdx = buffer.indexOf(startMarker);
        if (startIdx === -1) {
            return res.status(400).json({ error: 'File section not found' });
        }

        const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), startIdx);
        if (headerEnd === -1) {
            return res.status(400).json({ error: 'Invalid multipart format' });
        }

        let endIdx = buffer.indexOf(endMarker, headerEnd);
        if (endIdx === -1) {
            endIdx = buffer.length - 2;
        }

        const audioBuffer = buffer.slice(headerEnd + 4, endIdx);

        if (audioBuffer.length === 0) {
            return res.status(400).json({ error: 'Empty audio file' });
        }

        const boundary2 = String(Math.random()).substring(2);
        const parts = [];

        parts.push(`--${boundary2}`);
        parts.push('Content-Disposition: form-data; name="file"; filename="audio.webm"');
        parts.push('Content-Type: audio/webm');
        parts.push('');

        const headerBuffer = Buffer.from(parts.join('\r\n') + '\r\n');
        
        const modelPart = Buffer.from(
            `\r\n--${boundary2}\r\n` +
            'Content-Disposition: form-data; name="model"\r\n' +
            '\r\n' +
            'whisper-1\r\n' +
            `--${boundary2}--\r\n`
        );

        const finalPayload = Buffer.concat([headerBuffer, audioBuffer, modelPart]);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary2}`
            },
            body: finalPayload
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Whisper error:', data);
            return res.status(response.status).json({ 
                error: data.error?.message || 'Whisper API error' 
            });
        }

        return res.status(200).json({ text: data.text || '' });

    } catch (error) {
        console.error('Handler error:', error);
        return res.status(500).json({ error: error.message });
    }
}
