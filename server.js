/**
 * ClipCraft Video Generator - OPTIMIZADO
 * Versión ligera para Render.com
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json({ limit: '30mb' }));

const PORT = process.env.PORT || 3000;
const TEMP_DIR = '/tmp';

app.post('/generate', async (req, res) => {
  const { sessionId, photos, audio, duration, musicStart } = req.body;
  
  if (!photos || photos.length === 0) {
    return res.json({ success: false, error: 'Sin fotos' });
  }

  console.log(`🎬 Generando: ${photos.length} fotos, ${duration}s`);

  const sessionDir = path.join(TEMP_DIR, `clip_${Date.now()}`);
  
  try {
    fs.mkdirSync(sessionDir, { recursive: true });

    // Guardar fotos (optimizado)
    for (let i = 0; i < photos.length; i++) {
      let base64Data = photos[i];
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(path.join(sessionDir, `${i}.jpg`), buffer);
    }

    // Crear archivo de lista
    const listFile = path.join(sessionDir, 'list.txt');
    const dur = Math.floor(duration / photos.length);
    let list = '';
    for (let i = 0; i < photos.length; i++) {
      list += `file '${i}.jpg}'\nduration ${dur}\n`;
    }
    list += `file '${photos.length - 1}.jpg'`;
    fs.writeFileSync(listFile, list);

    const outputFile = path.join(sessionDir, 'out.mp4');

    // FFmpeg command simple
    let cmd = [
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-vf', 'scale=720:480',
      '-c:v', 'mpeg4',
      '-q:v', '5',
      '-r', '15',
      '-t', duration.toString(),
      '-y',
      outputFile
    ];

    // Agregar audio si existe
    if (audio && audio.length > 10) {
      try {
        let audioData = audio.includes(',') ? audio.split(',')[1] : audio;
        fs.writeFileSync(path.join(sessionDir, 'audio.mp3'), Buffer.from(audioData, 'base64'));
        cmd.push('-i', path.join(sessionDir, 'audio.mp3'), '-c:a', 'aac', '-shortest');
      } catch (e) {
        console.log('Audio error:', e.message);
      }
    }

    // Ejecutar FFmpeg
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', cmd);
      ffmpeg.stderr.on('data', (d) => process.stderr.write(d.toString()));
      ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error('FFmpeg failed')));
      ffmpeg.on('error', reject);
    });

    if (!fs.existsSync(outputFile)) throw new Error('Video no generado');

    const videoData = fs.readFileSync(outputFile);
    const base64 = videoData.toString('base64');

    // Cleanup
    fs.rmSync(sessionDir, { recursive: true });

    res.json({ success: true, videoUrl: `data:video/mp4;base64,${base64}` });

  } catch (error) {
    console.error('Error:', error.message);
    try { fs.rmSync(sessionDir, { recursive: true }); } catch {}
    res.json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => res.send('🎬 Running'));

app.listen(PORT, () => console.log(`Server: ${PORT}`));