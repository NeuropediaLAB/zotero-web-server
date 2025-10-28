#!/bin/bash
# Script para sincronizar datos de Zotero desde máquina local hacia Raspberry Pi
# Este script debe ejecutarse en la máquina local donde están los datos de Zotero

set -e

# Rutas en la máquina local
LOCAL_BIBLIOTECA="/home/arkantu/Documentos/Zotero Biblioteca"
LOCAL_ZOTERO_DB="/home/arkantu/Zotero/zotero.sqlite"

# Rutas en la Raspberry Pi (montada en /mnt/raspberrypi5-2)
TARGET_DIR="/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data"
TARGET_BIBLIOTECA="$TARGET_DIR/biblioteca"
TARGET_DB="$TARGET_DIR/zotero.sqlite"

echo "=== Sincronización de Zotero ==="
echo "Fecha: $(date)"
echo ""

# Verificar que existan los directorios origen
if [ ! -d "$LOCAL_BIBLIOTECA" ]; then
    echo "ERROR: No se encuentra el directorio de biblioteca: $LOCAL_BIBLIOTECA"
    exit 1
fi

if [ ! -f "$LOCAL_ZOTERO_DB" ]; then
    echo "ERROR: No se encuentra la base de datos: $LOCAL_ZOTERO_DB"
    exit 1
fi

# Crear directorio destino si no existe
mkdir -p "$TARGET_BIBLIOTECA"

# Sincronizar biblioteca (solo archivos nuevos o modificados)
echo "Sincronizando biblioteca..."
# Usar rsync con opciones optimizadas para la primera sincronización
rsync -a --delete --info=progress2 "$LOCAL_BIBLIOTECA/" "$TARGET_BIBLIOTECA/"

# Copiar base de datos (sobrescribir)
echo ""
echo "Copiando base de datos..."
cp -f "$LOCAL_ZOTERO_DB" "$TARGET_DB"

# Ajustar permisos
echo ""
echo "Ajustando permisos..."
chown -R arkantu:arkantu "$TARGET_DIR"
chmod -R 755 "$TARGET_DIR"

echo ""
echo "=== Sincronización completada ==="
echo "Archivos biblioteca: $(find "$TARGET_BIBLIOTECA" -type f | wc -l)"
echo "Tamaño BD: $(du -h "$TARGET_DB" | cut -f1)"
