import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    let tempFile = null;

    try {
        // Parsear multipart form-data
        const contentType = req.headers['content-type'] || '';
        
        if (!contentType.includes('multipart/form-data')) {
            return res.status(400).json({ error: 'Expected multipart/form-data' });
        }

        // Obtener el body como buffer
        let buffer = Buffer.alloc(0);

        // Recolectar chunks
        await new Promise((resolve, reject) => {
            req.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
            });
            req.on('end', resolve);
            req.on('error', reject);
        });

        if (buffer.length === 0) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Extraer boundary del content-type
        const boundaryMatch = contentType.match(/boundary=([^;]+)/);
        if (!boundaryMatch) {
            return res.status(400).json({ error: 'Invalid content-type' });
        }

        const boundary = boundaryMatch[1];
        const boundaryBuffer = Buffer.from(`--${boundary}`);

        // Buscar la sección del archivo
        const startIdx = buffer.indexOf(boundaryBuffer);
        if (startIdx === -1) {
            return res.status(400).json({ error: 'File not found in request' });
        }

        // Buscar el siguiente boundary
        const endIdx = buffer.indexOf(boundaryBuffer, startIdx + boundaryBuffer.length);
        if (endIdx === -1) {
            return res.status(400).json({ error: 'Invalid multipart format' });
        }

        // Extraer contenido del archivo
        let fileSection = buffer.slice(startIdx + boundaryBuffer.length, endIdx);

        // Eliminar headers de multipart y CRLF
        const doubleLineBreak = Buffer.from('\r\n\r\n');
        const lineBreakIdx = fileSection.indexOf(doubleLineBreak);
        if (lineBreakIdx === -1) {
            return res.status(400).json({ error: 'Invalid file format' });
        }

        const fileData = fileSection.slice(lineBreakIdx + doubleLineBreak.length);
        
        // Remover CRLF final
        const audioBuffer = fileData.slice(0, Math.max(0, fileData.length - 2));

        if (audioBuffer.length === 0) {
            return res.status(400).json({ error: 'Empty audio file' });
        }

        // Guardar en archivo temporal
        tempFile = path.join(tmpdir(), `audio-${Date.now()}.webm`);
        await writeFile(tempFile, audioBuffer);

        // Leer y enviar a Whisper
        const fs = await import('fs');
        const audioStream = fs.createReadStream(tempFile);

        // Construir multipart manualmente para Whisper API
        const boundary2 = String(Math.random()).substring(2);
        
        const form = [];
        form.push(`--${boundary2}`);
        form.push('Content-Disposition: form-data; name="file"; filename="audio.webm"');
        form.push('Content-Type: audio/webm');
        form.push('');
        
        const payload = Buffer.concat([
            Buffer.from(form.join('\r\n') + '\r\n'),
            audioBuffer,
            Buffer.from(`\r\n--${boundary2}\r\n`),
            Buffer.from('Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n'),
            Buffer.from(`--${boundary2}--\r\n`)
        ]);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary2}`,
                'Content-Length': payload.length
            },
            body: payload
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Whisper API error:', data);
            return res.status(response.status).json({ error: data.error?.message || 'Whisper API error' });
        }

        return res.status(200).json({ text: data.text || '' });

    } catch (error) {
        console.error('Whisper handler error:', error);
        return res.status(500).json({ error: error.message });
    } finally {
        // Limpiar archivo temporal
        if (tempFile) {
            try {
                await unlink(tempFile);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
}
