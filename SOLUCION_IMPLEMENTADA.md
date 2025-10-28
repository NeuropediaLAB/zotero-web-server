# Solución Implementada - Sincronización Zotero Web Server
**Fecha:** 27 de octubre de 2025

## Problema Identificado

1. **Sincronización incompleta:** Solo 489 de 6,389 archivos sincronizados (2.1GB de 11GB)
2. **Cron job no funcionaba:** El script no existía en la ruta esperada por el cron
3. **Permisos incorrectos:** Muchos directorios tenían permisos 700 en lugar de 755, impidiendo que el contenedor Docker los leyera

## Acciones Realizadas (en tu máquina local)

### ✅ 1. Script de Sincronización Copiado
```bash
cp /mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/sync-zotero-data.sh \
   /home/arkantu/docker/zotero-web-server/
chmod +x /home/arkantu/docker/zotero-web-server/sync-zotero-data.sh
```

### ✅ 2. Permisos Corregidos
Todos los directorios de la biblioteca ahora tienen permisos 755 (legibles por el contenedor Docker):
```bash
chmod -R 755 /mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/biblioteca/
```

### ✅ 3. Sincronización en Progreso
La sincronización completa está ejecutándose actualmente. Progreso:
- Origen: 6,389 archivos (11GB)
- Sincronizando hacia: `/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/`

### ✅ 4. Cron Job Verificado
El cron job está configurado y ahora funcionará correctamente:
```
0 */6 * * * cd /home/arkantu/docker/zotero-web-server && ./sync-zotero-data.sh >> /home/arkantu/docker/zotero-web-server/sync-cron.log 2>&1
```

## Acciones Pendientes (en la Raspberry Pi)

### 📋 1. Verificar que la sincronización completó
Una vez que la sincronización termine, verifica desde la Raspberry Pi:
```bash
# Conectarse a la Raspberry Pi (SSH u otro método)
ssh arkantu@raspberrypi5

# Verificar número de archivos (debe ser 6389)
find /home/arkantu/docker/zotero-web-server/data/biblioteca -type f | wc -l

# Verificar tamaño (debe ser ~11GB)
du -sh /home/arkantu/docker/zotero-web-server/data/biblioteca

# Verificar base de datos
ls -lh /home/arkantu/docker/zotero-web-server/data/zotero.sqlite
```

### 📋 2. Reiniciar el contenedor Docker
```bash
cd /home/arkantu/docker/zotero-web-server

# Detener el contenedor si está ejecutándose
docker-compose down

# Iniciar el contenedor
docker-compose up -d

# Verificar que está corriendo
docker-compose ps

# Ver los logs (deben desaparecer los errores EACCES)
docker-compose logs -f
```

### 📋 3. Probar el servidor
Accede al servidor desde un navegador:
```
http://IP_RASPBERRY:8080
```

Verifica que:
- El servidor responde
- No hay errores EACCES en los logs
- Puedes navegar por todas las carpetas
- Puedes abrir los PDFs

### 📋 4. Monitorear el cron job
```bash
# Ver el crontab actual
crontab -l

# Monitorear el log del cron (esperar a la próxima ejecución)
tail -f /home/arkantu/docker/zotero-web-server/sync-cron.log
```

## Horarios de Sincronización Automática

El cron ejecutará la sincronización cada 6 horas:
- **00:00** - Medianoche
- **06:00** - Madrugada
- **12:00** - Mediodía
- **18:00** - Tarde

## Archivos de Log

- **Sincronización manual actual:** `/home/arkantu/docker/zotero-web-server/sync-manual-*.log`
- **Sincronizaciones automáticas (cron):** `/home/arkantu/docker/zotero-web-server/sync-cron.log`
- **Logs del contenedor Docker:** `/home/arkantu/docker/zotero-web-server/logs/`

## Verificación de Errores Resueltos

Los siguientes errores de permisos deben haber desaparecido:
```
❌ EACCES: permission denied, scandir '/app/data/biblioteca/Neurotecnología - IA'
❌ EACCES: permission denied, scandir '/app/data/biblioteca/Pediatria General'
❌ EACCES: permission denied, scandir '/app/data/biblioteca/Proyecto Doctorado'
❌ EACCES: permission denied, scandir '/app/data/biblioteca/TFM aizea'
```

Estos errores ocurrían porque los directorios tenían permisos `drwx------` (700). Ahora todos tienen `drwxr-xr-x` (755).

## Solución de Problemas

### Si la sincronización parece detenida
```bash
# Ver procesos de rsync
ps aux | grep rsync

# Ver progreso del último log
tail -f /home/arkantu/docker/zotero-web-server/sync-manual-*.log
```

### Si el contenedor sigue mostrando errores EACCES
```bash
# Verificar permisos de un directorio problemático
ls -ld /home/arkantu/docker/zotero-web-server/data/biblioteca/"Pediatria General"

# Si tiene permisos 700, corregir manualmente:
chmod -R 755 /home/arkantu/docker/zotero-web-server/data/biblioteca/

# Reiniciar contenedor
docker-compose restart
```

### Si el cron no ejecuta la sincronización
```bash
# Verificar que el script existe
ls -la /home/arkantu/docker/zotero-web-server/sync-zotero-data.sh

# Verificar que es ejecutable
chmod +x /home/arkantu/docker/zotero-web-server/sync-zotero-data.sh

# Probar ejecución manual
cd /home/arkantu/docker/zotero-web-server
./sync-zotero-data.sh
```

## Resumen

**Estado actual:**
- ✅ Script de sincronización en ubicación correcta
- ✅ Permisos de directorios corregidos (755)
- ✅ Cron job configurado y funcionará correctamente
- 🔄 Sincronización en progreso (esperar a que complete)
- ⏳ Contenedor Docker debe reiniciarse en la Raspberry Pi

**Próximo paso crítico:**
Una vez que la sincronización complete (puedes verificar que el proceso rsync ya no esté ejecutándose), debes conectarte a la Raspberry Pi y ejecutar:
```bash
cd /home/arkantu/docker/zotero-web-server
docker-compose restart
```

Esto aplicará los cambios y el servidor debería funcionar sin errores de permisos.
