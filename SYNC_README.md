# Configuración de Zotero Web Server

## Problema identificado
El contenedor Docker estaba configurado para montar directorios desde `/home/arkantu/` de la Raspberry Pi, pero los datos de Zotero están en otra máquina. Los directorios montados estaban vacíos, por lo que el servidor no encontraba archivos ni PDFs.

## Solución implementada

### 1. Sincronización de datos
Se creó un directorio local `./data/` en el servidor que contiene:
- `./data/biblioteca/` - Copia de la biblioteca de Zotero con todos los PDFs
- `./data/zotero.sqlite` - Copia de la base de datos de Zotero

### 2. Scripts de sincronización

#### `sync-zotero-data.sh`
Script para sincronizar datos desde la máquina local hacia la Raspberry Pi:
```bash
./sync-zotero-data.sh
```

Este script:
- Copia la biblioteca completa desde `/home/arkantu/Documentos/Zotero Biblioteca/`
- Copia la base de datos desde `/home/arkantu/Zotero/zotero.sqlite`
- Hacia `/mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server/data/`

#### `setup-cron.sh`
Configura un cron job para sincronización automática cada 6 horas:
```bash
./setup-cron.sh
```

### 3. Docker Compose actualizado
Se modificó `docker-compose.yml` para usar las rutas locales:
```yaml
volumes:
  - "./data/biblioteca:/app/data/biblioteca:ro"
  - "./data/zotero.sqlite:/app/data/zotero.sqlite:ro"
  - "zotero-data:/app/data/cache"
  - "./logs:/app/logs"
```

## Uso

### Primera sincronización (en la máquina con los datos)
```bash
cd /mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server
./sync-zotero-data.sh
```

Esta sincronización inicial puede tardar varios minutos dependiendo del tamaño de la biblioteca.

### Reiniciar el contenedor (en la Raspberry Pi)
Una vez completada la sincronización:
```bash
docker-compose down
docker-compose up -d
```

### Verificar que funciona
```bash
# Ver logs del contenedor
docker-compose logs -f

# Verificar archivos sincronizados
ls -lh data/
du -sh data/biblioteca/
```

### Configurar sincronización automática (opcional)
En la máquina con los datos de Zotero:
```bash
cd /mnt/raspberrypi5-2/home/arkantu/docker/zotero-web-server
./setup-cron.sh
```

Esto configurará una sincronización automática cada 6 horas.

## Verificación de datos

```bash
# Número de archivos en la biblioteca
find ./data/biblioteca -type f | wc -l

# Tamaño de la base de datos
ls -lh ./data/zotero.sqlite

# Estado de la sincronización
tail -f sync.log
```

## Notas importantes

1. **Permisos**: Los archivos sincronizados deben ser legibles por el usuario `arkantu` (UID del contenedor)
2. **Espacio**: Asegúrate de tener suficiente espacio en la Raspberry Pi para la biblioteca completa
3. **Red**: La sincronización se hace a través del montaje NFS, por lo que la velocidad depende de la red
4. **Actualizaciones**: Ejecuta `./sync-zotero-data.sh` manualmente cuando hagas cambios importantes en Zotero, o espera a la sincronización automática

## Troubleshooting

### El contenedor no encuentra archivos
```bash
# Verificar que los archivos están sincronizados
ls -la ./data/biblioteca/ | head -20
ls -la ./data/zotero.sqlite

# Verificar montajes del contenedor
docker exec zotero-web-server ls -la /app/data/
```

### La sincronización es muy lenta
```bash
# Ver progreso de rsync
tail -f sync.log

# Cancelar sincronización si es necesario
pkill -f sync-zotero-data.sh
```

### Errores de permisos
```bash
# Ajustar permisos
chown -R arkantu:arkantu ./data/
chmod -R 755 ./data/
```
