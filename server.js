/**
 * ClipCraft Video Generator
 * Servidor para generar videos con FFmpeg
 */

const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const PORT = process.env.PORT || 3000;
const TEMP_DIR = os.tmpdir();

// Configurar FFmpeg
try {
  ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
} catch (e) {
  console.log('FFmpeg path already set');
}

app.post('/generate', async (req, res) => {
  const { sessionId, photos, audio, duration, musicStart } = req.body;
  
  if (!photos || photos.length === 0) {
    return res.json({ success: false, error: 'Sin fotos' });
  }

  console.log(`🎬 Generando video: ${photos.length} fotos, ${duration}s`);

  try {
    const sessionDir = path.join(TEMP_DIR, `clip_${Date.now()}`);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Guardar fotos desde base64
    const photoPaths = [];
    for (let i = 0; i < photos.length; i++) {
      const photoPath = path.join(sessionDir, `p${i}.jpg`);
      // Remover el prefijo data:image si existe
      let base64Data = photos[i];
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      const photoData = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(photoPath, photoData);
      photoPaths.push(photoPath);
      console.log(`Foto ${i+1} guardada`);
    }

    // Crear lista de archivos para FFmpeg
    const listPath = path.join(sessionDir, 'list.txt');
    let listContent = '';
    const photoDuration = Math.floor(duration / photos.length);
    
    for (let i = 0; i < photos.length; i++) {
      listContent += `file 'p${i}.jpg'\n`;
      listContent += `duration ${photoDuration}\n`;
    }
    // Repetir la última imagen para el frame final
    listContent += `file 'p${photos.length - 1}.jpg'\n`;
    
    fs.writeFileSync(listPath, listContent);

    const outputPath = path.join(sessionDir, 'output.mp4');

    // Build FFmpeg command usando el archivo de lista
    let command = ffmpeg()
      .input(listPath)
      .inputFormat('concat')
      .inputFPS(1)
      .videoFilters([
        'scale=1280:720:force_original_aspect_ratio=decrease',
        'pad=1280:720:(ow-iw)/2:(oh-ih)/2'
      ])
      .outputOptions([
        `-t ${duration}`,
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset ultrafast',
        '-movflags +faststart'
      ]);

    // Agregar audio si existe
    if (audio && audio !== 'null') {
      try {
        const audioPath = path.join(sessionDir, 'audio.mp3');
        let audioDataStr = audio;
        if (audioDataStr.includes(',')) {
          audioDataStr = audioDataStr.split(',')[1];
        }
        const audioData = Buffer.from(audioDataStr, 'base64');
        fs.writeFileSync(audioPath, audioData);
        
        command = command
          .input(audioPath)
          .inputOptions(['-ss 0'])
          .outputOptions([
            '-c:a aac',
            '-b:a 128k',
            '-shortest'
          ]);
        console.log('Audio agregado');
      } catch (audioErr) {
        console.log('Error con audio:', audioErr.message);
      }
    }

    console.log('Ejecutando FFmpeg...');
    
    await new Promise((resolve, reject) => {
      command.on('progress', (progress) => {
        console.log(`Procesando: ${Math.round(progress.percent || 0)}%`);
      });
      command.on('end', () => {
        console.log('FFmpeg terminó');
        resolve();
      });
      command.on('error', (err) => {
        console.log('FFmpeg error:', err.message);
        reject(err);
      });
      command.save(outputPath);
    });

    // Verificar que el archivo existe
    if (!fs.existsSync(outputPath)) {
      throw new Error('El video no se generó');
    }

    // Leer video generado
    const videoBuffer = fs.readFileSync(outputPath);
    const videoBase64 = videoBuffer.toString('base64');

    // Limpiar
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (cleanupErr) {}

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