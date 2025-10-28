#!/bin/bash
# Script para diagnosticar el problema de PDFs faltantes en Zotero Web Server

echo "═══════════════════════════════════════════════════════════"
echo "  Diagnóstico de PDFs en Zotero Web Server"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "1. Conteo de PDFs en diferentes ubicaciones:"
echo "──────────────────────────────────────────────────────────"

# En data/biblioteca (montado en el contenedor)
PDFS_BIBLIOTECA=$(find /mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/biblioteca -type f -name "*.pdf" 2>/dev/null | wc -l)
echo "   data/biblioteca (actual): $PDFS_BIBLIOTECA PDFs"

# En /home/arkantu/Documentos/Zotero Biblioteca (ubicación por defecto)
PDFS_DOC=$(find "/mnt/raspberrypi5-2/home/arkantu/Documentos/Zotero Biblioteca" -type f -name "*.pdf" 2>/dev/null | wc -l)
echo "   Documentos/Zotero Biblioteca: $PDFS_DOC PDFs"

# En /home/arkantu/Zotero/storage (ubicación estándar de Zotero)
if [ -d "/mnt/raspberrypi5-2/home/arkantu/Zotero/storage" ]; then
    PDFS_STORAGE=$(find "/mnt/raspberrypi5-2/home/arkantu/Zotero/storage" -type f -name "*.pdf" 2>/dev/null | wc -l)
    echo "   Zotero/storage: $PDFS_STORAGE PDFs"
else
    echo "   Zotero/storage: No existe"
fi

# Buscar otras ubicaciones de Zotero
echo ""
echo "2. Búsqueda de directorios storage de Zotero:"
echo "──────────────────────────────────────────────────────────"
find /mnt/raspberrypi5-2/home/arkantu -name "storage" -type d 2>/dev/null | while read dir; do
    pdf_count=$(find "$dir" -type f -name "*.pdf" 2>/dev/null | wc -l)
    if [ $pdf_count -gt 0 ]; then
        echo "   $dir: $pdf_count PDFs"
        du -sh "$dir"
    fi
done

echo ""
echo "3. Tamaño de directorios:"
echo "──────────────────────────────────────────────────────────"
du -sh /mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/biblioteca 2>/dev/null
du -sh "/mnt/raspberrypi5-2/home/arkantu/Documentos/Zotero Biblioteca" 2>/dev/null
if [ -d "/mnt/raspberrypi5-2/home/arkantu/Zotero/storage" ]; then
    du -sh "/mnt/raspberrypi5-2/home/arkantu/Zotero/storage" 2>/dev/null
fi

echo ""
echo "4. Estado de la base de datos:"
echo "──────────────────────────────────────────────────────────"
DB_PATH="/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/zotero.sqlite"
if [ -f "$DB_PATH" ]; then
    echo "   Base de datos: $(ls -lh $DB_PATH | awk '{print $5}')"
    echo "   Última modificación: $(stat -c %y $DB_PATH | cut -d'.' -f1)"
else
    echo "   Base de datos: No encontrada"
fi

echo ""
echo "5. Logs de sincronización:"
echo "──────────────────────────────────────────────────────────"
if [ -f "/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/sync.log" ]; then
    echo "   Últimas líneas del log:"
    tail -5 "/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/sync.log" | sed 's/^/   /'
else
    echo "   No se encontró sync.log"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Diagnóstico completado"
echo "═══════════════════════════════════════════════════════════"
