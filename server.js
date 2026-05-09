/**
 * ClipCraft Video Generator
 * Servidor para generar videos con FFmpeg
 * 
 * Deploy en: https://glitch.com o https://replit.com
 * Estos servicios ya tienen FFmpeg instalado
 */

const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const TEMP_DIR = os.tmpdir();

// Configurar FFmpeg
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

app.post('/generate', async (req, res) => {
  const { sessionId, photos, audio, duration, musicStart } = req.body;
  
  if (!photos || photos.length === 0) {
    return res.json({ success: false, error: 'Sin fotos' });
  }

  console.log(`🎬 Generando video: ${photos.length} fotos, ${duration}s`);

  try {
    const sessionDir = path.join(TEMP_DIR, `clip_${Date.now()}`);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Descargar fotos
    const photoPaths = [];
    for (let i = 0; i < photos.length; i++) {
      const photoPath = path.join(sessionDir, `p${i}.jpg`);
      const photoData = Buffer.from(photos[i].replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(photoPath, photoData);
      photoPaths.push(photoPath);
    }

    // Crear video con slideshow de fotos
    const outputPath = path.join(sessionDir, 'output.mp4');
    const photoDuration = duration / photos.length;

    // Build FFmpeg command
    let command = ffmpeg();
    
    // Agregar fotos como input
    for (const photoPath of photoPaths) {
      command = command.input(photoPath).loop(photoDuration);
    }
    
    // Agregar transición y escala
    command = command
      .complexFilter([
        `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2`,
        `fade=t=in:st=0:d=1,fade=t=out:st=${duration-1}:d=1`
      ])
      .outputOptions([
        `-t ${duration}`,
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast'
      ]);

    // Agregar audio si existe
    if (audio) {
      const audioData = Buffer.from(audio.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
      const audioPath = path.join(sessionDir, 'audio.mp3');
      fs.writeFileSync(audioPath, audioData);
      
      command = command
        .input(audioPath)
        .outputOptions([
          '-c:a aac',
          '-shortest',
          `-ss ${musicStart || 0}`
        ]);
    }

    await new Promise((resolve, reject) => {
      command.on('end', resolve).on('error', reject).save(outputPath);
    });

    // Leer video generado
    const videoBuffer = fs.readFileSync(outputPath);
    const videoBase64 = videoBuffer.toString('base64');

    // Limpiar
    fs.rmSync(sessionDir, { recursive: true, force: true });

    res.json({
      success: true,
      videoUrl: `data:video/mp4;base64,${videoBase64}`
    });

  } catch (error) {
    console.error('Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('🎬 ClipCraft Video Generator running!');
});

app.listen(PORT, () => {
  console.log(`🎬 Server running on port ${PORT}`);
});