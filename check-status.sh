#!/bin/bash
# Script para verificar el estado de la sincronización y el servidor Zotero

echo "=== Estado de Zotero Web Server ==="
echo ""

# Verificar sincronización
echo "📁 Sincronización de datos:"
SOURCE_FILES=$(find "/home/arkantu/Documentos/Zotero Biblioteca" -type f 2>/dev/null | wc -l)
SOURCE_SIZE=$(du -sh "/home/arkantu/Documentos/Zotero Biblioteca" 2>/dev/null | cut -f1)
TARGET_FILES=$(find "/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/biblioteca" -type f 2>/dev/null | wc -l)
TARGET_SIZE=$(du -sh "/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/biblioteca" 2>/dev/null | cut -f1)

echo "  Origen:  $SOURCE_FILES archivos ($SOURCE_SIZE)"
echo "  Destino: $TARGET_FILES archivos ($TARGET_SIZE)"

if [ "$SOURCE_FILES" -eq "$TARGET_FILES" ]; then
    echo "  ✅ Sincronización completa"
else
    PERCENT=$((TARGET_FILES * 100 / SOURCE_FILES))
    echo "  ⏳ En progreso: $PERCENT%"
fi

# Verificar base de datos
echo ""
echo "💾 Base de datos:"
if [ -f "/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/zotero.sqlite" ]; then
    DB_SIZE=$(du -h "/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/zotero.sqlite" | cut -f1)
    echo "  ✅ zotero.sqlite presente ($DB_SIZE)"
else
    echo "  ❌ zotero.sqlite NO encontrada"
fi

# Verificar contenedor Docker
echo ""
echo "🐳 Contenedor Docker:"
CONTAINER_STATUS=$(ssh raspberrypi5 "docker ps -a --filter name=zotero-web-server --format '{{.Status}}'" 2>/dev/null || echo "No disponible")
if echo "$CONTAINER_STATUS" | grep -q "Up"; then
    echo "  ✅ Contenedor ejecutándose"
    echo "  Estado: $CONTAINER_STATUS"
else
    echo "  ⚠️  Contenedor no está corriendo"
    echo "  Estado: $CONTAINER_STATUS"
fi

# Verificar proceso de sincronización
echo ""
echo "🔄 Proceso de sincronización:"
if ps aux | grep -q "[s]ync-zotero-data.sh"; then
    echo "  ⏳ Sincronización en progreso"
    if [ -f "/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/sync.log" ]; then
        echo "  Ver progreso: tail -f sync.log"
    fi
else
    echo "  ✅ No hay sincronización activa"
fi

echo ""
echo "=== Comandos útiles ==="
echo "  Sincronizar ahora:     ./sync-zotero-data.sh"
echo "  Ver logs sync:         tail -f sync.log"
echo "  Reiniciar contenedor:  ssh raspberrypi5 'cd docker/zotero-web-server && docker-compose restart'"
echo "  Ver logs contenedor:   ssh raspberrypi5 'cd docker/zotero-web-server && docker-compose logs -f'"
