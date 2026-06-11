export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        // El navegador envía FormData multipart
        // Vercel ya parsea esto automáticamente en req.body
        
        // Buscar el archivo en req.files o req.body.file
        let audioBuffer = null;

        // Opción 1: Si viene en req.files (Vercel next.js api)
        if (req.files && req.files.file) {
            audioBuffer = req.files.file.data;
        }
        // Opción 2: Si viene como stream en req
        else {
            // Leer directamente del stream
            const chunks = [];
            
            await new Promise((resolve, reject) => {
                req.on('data', chunk => {
                    chunks.push(chunk);
                });
                
                req.on('end', () => {
                    resolve();
                });
                
                req.on('error', reject);
            });

            if (chunks.length === 0) {
                return res.status(400).json({ error: 'No audio data received' });
            }

            const buffer = Buffer.concat(chunks);
            
            // Extraer audio del multipart manualmente (simple)
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
            
            if (!boundaryMatch) {
                return res.status(400).json({ error: 'No boundary found' });
            }

            const boundary = boundaryMatch[1].replace(/"/g, '');
            
            // Buscar los boundary markers
            const startStr = `--${boundary}`;
            const endStr = `\r\n--${boundary}`;
            
            const startIdx = buffer.indexOf(startStr);
            const endIdx = buffer.indexOf(endStr, startIdx + 1);
            
            if (startIdx === -1 || endIdx === -1) {
                return res.status(400).json({ error: 'Invalid multipart format' });
            }

            // Buscar el double CRLF que separa headers de body
            const headerEndStr = '\r\n\r\n';
            const headerEndIdx = buffer.indexOf(headerEndStr, startIdx);
            
            if (headerEndIdx === -1) {
                return res.status(400).json({ error: 'Invalid headers' });
            }

            // Extraer audio (entre header end y next boundary)
            audioBuffer = buffer.slice(headerEndIdx + 4, endIdx);
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            return res.status(400).json({ error: 'Empty audio file' });
        }

        // Construir multipart para OpenAI
        const boundary = String(Math.random()).substring(2);
        
        const filePart = Buffer.from(
            `--${boundary}\r\n` +
            'Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n' +
            'Content-Type: audio/webm\r\n' +
            '\r\n'
        );

        const modelPart = Buffer.from(
            `\r\n--${boundary}\r\n` +
            'Content-Disposition: form-data; name="model"\r\n' +
            '\r\n' +
            'whisper-1\r\n' +
            `--${boundary}--\r\n`
        );

        const payload = Buffer.concat([filePart, audioBuffer, modelPart]);

        // Llamar Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: payload
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Whisper API error:', {
                status: response.status,
                error: data.error
            });
            return res.status(response.status).json({ 
                error: data.error?.message || 'Whisper API failed' 
            });
        }

        return res.status(200).json({ text: data.text || '' });

    } catch (error) {
        console.error('Whisper handler error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
