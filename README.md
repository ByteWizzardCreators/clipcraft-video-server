# 🎬 ClipCraft Video Server

Servidor para generar videos con FFmpeg. Se conecta con la app ClipCraft.

## 🚀 Deploy en Render.com (Gratis)

1. **Crear cuenta en [render.com](https://render.com)**

2. **Crear un nuevo Web Service**:
   - Connect tu repositorio GitHub
   - Selecciona este proyecto
   - Root directory: `server`
   - Build command: (vacío)
   - Start command: `node index.js`

3. **Instalar FFmpeg** (requerido):
   - En Render, crear un "Background Worker" con este comando:
   ```
   #!/bin/bash
   sudo apt-get update
   sudo apt-get install -y ffmpeg
   ```

   O mejor, usar un Dockerfile:

4. **Crear Dockerfile** en `/server`:
   ```dockerfile
   FROM node:18-alpine
   
   RUN apk add --no-cache ffmpeg
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   
   EXPOSE 3000
   CMD ["node", "index.js"]
   ```

5. **Obtener la URL** del servicio deployado
   - Ejemplo: `https://clipcraft-video-server.onrender.com`

6. **Actualizar la app**:
   - Editar `src/screens/EditorScreen.js`
   - Cambiar `VIDEO_SERVER_URL` por tu URL

## 🔧 Desarrollo local

```bash
cd server
npm install
# Instalar FFmpeg en tu sistema:
# Ubuntu: sudo apt install ffmpeg
# Mac: brew install ffmpeg
# Windows: descargar de ffmpeg.org
node index.js
```

## 📝 Notas

- El servidor requiere FFmpeg instalado
- Los videos se generan en memoria y se limpian después
- Tiempo de generación: ~30-60 segundos por video
- El tier gratuito de Render tiene limitaciones de tiempo

## ⚠️ Importante

El servidor debe tener **FFmpeg instalado**. Render no lo tiene por defecto, así que necesitás usar un Dockerfile o un servicio como Railway que permita instalar paquetes.