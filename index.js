/**
 * ClipCraft Video Server
 * Genera videos con FFmpeg desde fotos + música
 * 
 * Deploy: https://render.com (gratis)
 * Requiere: FFmpeg instalado en el servidor
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const TEMP_DIR = '/tmp/clipcraft';

// Asegurar directorio temporal
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Descargar archivo desde URL
async function downloadFile(url, destPath) {
  console.log(`Descargando: ${url}`);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  
  const fileStream = fs.createWriteStream(destPath);
  
  return new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', () => {
      fileStream.close();
      console.log(`Descargado: ${destPath}`);
      resolve();
    });
  });
}

// Generar video con FFmpeg
async function generateVideo(sessionId, photos, audio, duration, musicStart) {
  const sessionDir = path.join(TEMP_DIR, sessionId);
  
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  console.log(`Generando video para sesión: ${sessionId}`);
  console.log(`Fotos: ${photos.length}, Duración: ${duration}s`);

  // 1. Descargar fotos
  const photoPaths = [];
  for (let i = 0; i < photos.length; i++) {
    const photoPath = path.join(sessionDir, `photo_${i}.jpg`);
    await downloadFile(photos[i], photoPath);
    photoPaths.push(photoPath);
  }

  // 2. Descargar audio si existe
  let audioPath = null;
  if (audio) {
    audioPath = path.join(sessionDir, 'audio.mp3');
    await downloadFile(audio, audioPath);
  }

  // 3. Crear lista de fotos para FFmpeg
  const listFile = path.join(sessionDir, 'photos.txt');
  const photoDuration = duration / photos.length;
  
  let listContent = '';
  for (const photoPath of photoPaths) {
    listContent += `file '${photoPath}'\n`;
    listContent += `duration ${photoDuration}\n`;
  }
  // Agregar la última foto otra vez para el frame final
  listContent += `file '${photoPaths[photoPaths.length - 1]}'\n`;
  
  fs.writeFileSync(listFile, listContent);

  // 4. Generar video
  const outputPath = path.join(sessionDir, `output_${sessionId}.mp4`);
  
  return new Promise((resolve, reject) => {
    let ffmpegArgs;
    
    if (audioPath) {
      // Con audio
      ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-i', audioPath,
        '-ss', musicStart.toString(),
        '-t', duration.toString(),
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=1,fade=t=out:st=' + (duration - 1) + ':d=1',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-shortest',
        '-y',
        outputPath
      ];
    } else {
      // Sin audio
      ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=1,fade=t=out:st=' + (duration - 1) + ':d=1',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-t', duration.toString(),
        '-y',
        outputPath
      ];
    }

    console.log('Ejecutando FFmpeg...');
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    ffmpeg.stdout.on('data', (data) => {
      console.log('FFmpeg:', data.toString());
    });
    
    ffmpeg.stderr.on('data', (data) => {
      console.log('FFmpeg:', data.toString());
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Video generado: ${outputPath}`);
        
        // Leer el video y devolver como base64 o URL
        const videoBuffer = fs.readFileSync(outputPath);
        const videoBase64 = videoBuffer.toString('base64');
        
        // Limpiar archivos temporales
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (e) {}
        
        resolve({
          success: true,
          videoBase64: `data:video/mp4;base64,${videoBase64}`
        });
      } else {
        reject(new Error(`FFmpeg falló con código ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

// Endpoint principal
app.post('/generate', async (req, res) => {
  try {
    const { sessionId, photos, audio, duration, musicStart } = req.body;
    
    if (!sessionId || !photos || photos.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan datos requeridos' 
      });
    }

    console.log(`Nueva solicitud de video: ${sessionId}`);
    
    const result = await generateVideo(sessionId, photos, audio, duration || 15, musicStart || 0);
    
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🎬 ClipCraft Video Server listening on port ${PORT}`);
  console.log(`FFmpeg disponible: ${process.platform}`);
});