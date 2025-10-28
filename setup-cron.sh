#!/bin/bash
# Script para configurar la sincronización automática de Zotero

SCRIPT_DIR="/home/arkantu/docker/zotero-web-server"
CRON_JOB="0 */6 * * * cd $SCRIPT_DIR && ./sync-zotero-data.sh >> $SCRIPT_DIR/sync-cron.log 2>&1"

echo "Configurando sincronización automática de Zotero..."

# Verificar si ya existe el cron job
if crontab -l 2>/dev/null | grep -q "sync-zotero-data.sh"; then
    echo "El cron job ya existe. Para actualizarlo, primero elimínalo con: crontab -e"
else
    # Agregar el cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job agregado: Sincronización cada 6 horas"
fi

echo ""
echo "Para verificar: crontab -l"
echo "Para editar: crontab -e"
