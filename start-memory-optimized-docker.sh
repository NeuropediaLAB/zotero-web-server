#!/bin/sh

echo "🚀 Iniciando Servidor Zotero Web - MEMORIA OPTIMIZADA"
echo "=================================================="
echo "✨ Con optimizaciones de memoria para archivos grandes"
echo ""

# Verificar que Node.js esté instalado
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js no está instalado"
    exit 1
fi

# Configurar variables de entorno optimizadas
export NODE_ENV=production
export PORT="${PORT:-8080}"

# Detectar si estamos en Docker
if [ -f "/.dockerenv" ]; then
    # Configuración para Docker
    export BIBLIOTECA_DIR="${BIBLIOTECA_DIR:-/app/data/biblioteca}"
    export ZOTERO_DB="${ZOTERO_DB:-/app/data/zotero.sqlite}"
    export STORAGE_DIR="${STORAGE_DIR:-/app/data/storage}"
else
    # Configuración para host local
    export BIBLIOTECA_DIR="${BIBLIOTECA_DIR:-/home/arkantu/Documentos/Zotero Biblioteca}"
    export ZOTERO_DB="${ZOTERO_DB:-/home/arkantu/Zotero/zotero.sqlite}"
    export STORAGE_DIR="${STORAGE_DIR:-/home/arkantu/Zotero/storage}"
fi

export ZOTERO_API_KEY="${ZOTERO_API_KEY:-zotero-neuropedialab-memory-optimized-2024}"

# Configuración optimizada de Node.js para memoria
export NODE_OPTIONS="--max-old-space-size=4096"

echo "📋 Verificando configuración..."
if [ ! -d "$BIBLIOTECA_DIR" ]; then
    echo "⚠️  Directorio de biblioteca no encontrado: $BIBLIOTECA_DIR"
    echo "   Creando directorio vacío para desarrollo..."
    mkdir -p "$BIBLIOTECA_DIR" 2>/dev/null || true
    total_pdfs=0
else
    total_pdfs=$(find "$BIBLIOTECA_DIR" -name "*.pdf" 2>/dev/null | wc -l)
    echo "✅ Biblioteca encontrada: $total_pdfs PDFs"
fi

if [ ! -f "$ZOTERO_DB" ]; then
    echo "⚠️  Base de datos Zotero no encontrada: $ZOTERO_DB"
    echo "   El servidor funcionará sin base de datos Zotero"
else
    echo "✅ Base de datos Zotero encontrada"
fi

# Crear directorios necesarios
mkdir -p logs

echo ""
echo "🔧 Configuración optimizada:"
echo "   📁 Biblioteca: $BIBLIOTECA_DIR"
echo "   🗄️  Base de datos: $ZOTERO_DB"
echo "   🌐 Puerto: $PORT"
echo "   🧠 Memoria máxima: 4GB"
echo "   ♻️  Garbage Collection: Habilitado"
echo ""

echo "✨ Optimizaciones incluidas:"
echo "   🧠 Gestión optimizada de memoria con Maps"
echo "   ♻️  Garbage collection automático"
echo "   📄 Límite de texto por PDF: 10k caracteres"
echo "   🎯 Cache limitado a 1000 entradas"
echo "   💾 Guardado automático cada 5 archivos"
echo ""

# Detener procesos previos (solo fuera de Docker)
if [ ! -f "/.dockerenv" ]; then
    echo "🛑 Deteniendo servidores previos..."
    pkill -f "enhanced-server" 2>/dev/null || true
    pkill -f "node.*server" 2>/dev/null || true
    sleep 2
fi

echo "🚀 Iniciando servidor optimizado para memoria..."
echo ""
echo "======================================================"
echo "🌟 SERVIDOR ZOTERO WEB - MEMORIA OPTIMIZADA"
echo "======================================================"
echo ""

# Ejecutar el servidor optimizado
exec node --max-old-space-size=4096 enhanced-server-memory-optimized.js