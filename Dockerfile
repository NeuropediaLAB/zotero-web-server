# Dockerfile para Servidor Zotero Web - NeuropediaLab 2025
# Versión con soporte completo para OCR
FROM node:18-alpine

# Información del contenedor
LABEL maintainer="NeuropediaLab"
LABEL description="Servidor web para acceso y búsqueda en biblioteca Zotero con indexación de texto completo y OCR"
LABEL version="2.1"

# Instalar herramientas necesarias para OCR
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-spa \
    tesseract-ocr-data-eng \
    poppler-utils \
    imagemagick \
    ghostscript

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S zotero -u 1001 -G nodejs

# Crear directorios de trabajo
WORKDIR /app

# Copiar archivos de configuración primero (para cache de Docker)
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Copiar y dar permisos al script de inicio
RUN chmod +x start-memory-optimized-docker.sh

# Crear directorios necesarios y establecer permisos
RUN mkdir -p logs web data data/biblioteca data/storage data/cache && \
    chown -R zotero:nodejs /app

# Cambiar al usuario no-root
USER zotero

# Exponer puerto
EXPOSE 3002

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3002
ENV BIBLIOTECA_DIR=/app/data/biblioteca
ENV STORAGE_DIR=/app/data/zotero/storage
ENV ZOTERO_DB=/app/data/zotero/zotero.sqlite

# Usar el script de inicio optimizado para memoria
CMD ["./start-memory-optimized-docker.sh"]