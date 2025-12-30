# Zotero Web Server v0.3.1

Servidor web avanzado para acceder a tu biblioteca de Zotero con indexación de texto e IA.

## 🆕 Nuevo en v0.3.1
- ✅ **Captura de Referencias Web**: Agrega referencias desde cualquier página sin instalar Zotero Connector
- 📚 **Bookmarklet Integrado**: Marcador especial para capturar referencias con un clic
- 📝 **Formulario Manual**: Opción alternativa para agregar referencias manualmente
- 🔄 **Detección Automática**: Extrae automáticamente título, autores, año, DOI y abstract
- 🎯 **Perfecto para entornos restringidos**: No requiere instalación de software adicional

## 🎯 Características Principales

### 📚 Captura de Referencias Web (¡NUEVO!)
- **Sin extensiones**: Solo un bookmarklet que arrastras a tu barra de marcadores
- **Funciona en el trabajo**: No necesitas permisos de instalación
- **Detección automática**: Captura metadatos de la página automáticamente
- **Múltiples sitios**: Compatible con journals científicos, Wikipedia, blogs, noticias, etc.
- [👉 Guía rápida de uso](./QUICK_START_WEB_CAPTURE.md) | [📖 Documentación completa](./CAPTURA_REFERENCIAS_WEB.md)

### v0.3.0
- ✅ **Persistencia de indexación**: El índice de PDFs se conserva al reiniciar el contenedor
- 💾 **Volumen persistente**: Docker Compose configurado con volumen `zotero-data` para caché
- 📁 **Caché inteligente**: Los archivos de índice se almacenan en directorio persistente

## 🚀 Inicio Rápido con Docker

### Prerrequisitos
- Docker instalado
- Zotero instalado con biblioteca configurada

### Opción 1: Con Docker Compose (Recomendado)

Si tienes docker-compose instalado:

1. **Configura las rutas en `.env`:**
   ```bash
   HOST_BIBLIOTECA_DIR=/home/arkantu/Documentos/Zotero Biblioteca
   HOST_ZOTERO_DB=/home/arkantu/Zotero/zotero.sqlite
   ```

2. **Inicia el servidor:**
   ```bash
   ./start-docker.sh
   ```

### Opción 2: Solo con Docker

Si no tienes docker-compose:

1. **Inicia el servidor:**
   ```bash
   ./start-simple.sh
   ```

### Acceso
- Abre http://localhost:8080 en tu navegador

## 🛠️ Comandos Útiles

### Con Docker Compose
```bash
./start-docker.sh          # Iniciar servidor
./stop-docker.sh           # Detener servidor
docker-compose logs -f     # Ver logs
docker-compose restart     # Reiniciar
docker-compose ps          # Ver estado
```

### Solo Docker
```bash
./start-simple.sh                    # Iniciar servidor
./stop-simple.sh                     # Detener servidor
docker logs -f zotero-web-server     # Ver logs
docker restart zotero-web-server     # Reiniciar
docker ps                            # Ver estado
```

## 🛠️ Desarrollo

### Estructura del Proyecto
```
├── enhanced-server.js               # Servidor principal con watchers
├── enhanced-server-no-watchers.js   # Servidor optimizado para Docker
├── final-clean-server.js            # Servidor alternativo
├── web/                             # Frontend de la aplicación
├── api/                             # API endpoints
├── data/                            # Datos persistentes
├── logs/                            # Logs del servidor
├── Dockerfile                       # Configuración Docker
├── docker-compose.yml               # Orquestación Docker
├── start-docker.sh                  # Script con docker-compose
├── start-simple.sh                  # Script solo Docker
└── .env                             # Variables de entorno
```

### Variables de Entorno

| Variable | Descripción | Defecto |
|----------|-------------|---------|
| `HOST_BIBLIOTECA_DIR` | Ruta a la biblioteca de Zotero | `/home/arkantu/Documentos/Zotero Biblioteca` |
| `HOST_ZOTERO_DB` | Ruta a la base de datos de Zotero | `/home/arkantu/Zotero/zotero.sqlite` |
| `ZOTERO_API_KEY` | Clave API (opcional) | `zotero-neuropedialab-docker-2024` |
| `PORT` | Puerto del servidor | `8080` |

## 📝 Características

- 🔍 **Búsqueda avanzada** en texto completo de PDFs
- 📊 **Estadísticas** de la biblioteca
- 🔄 **Sincronización** en tiempo real
- 🐳 **Docker** para fácil despliegue
- 📱 **Interfaz responsive**
- 🔒 **Acceso seguro** a archivos
- 🔗 **Zotero Connector**: Guarda referencias desde navegador sin Zotero Desktop
- 🦊 **Firefox Portable**: Compatible con navegadores portables sin instalación

## 🔗 Usar Zotero Connector

### Acceso Rápido
Visita http://localhost:8080/connector-setup.html para instrucciones completas.

### Resumen
1. **Opción A - Firefox Portable + Zotero Connector:**
   - Descarga [Firefox Portable](https://portableapps.com/apps/internet/firefox_portable)
   - Instala [Zotero Connector](https://www.zotero.org/download/connectors)
   - Configura URL: `http://localhost:8080/connector/` en preferencias avanzadas

2. **Opción B - Bookmarklet (cualquier navegador):**
   - Arrastra el botón "Guardar en Zotero" desde `/connector-setup.html`
   - Usa el marcador en cualquier página para guardar referencias

### Endpoints Disponibles
- `GET /connector/ping` - Verificación de conexión
- `POST /connector/saveItems` - Guardar referencias bibliográficas
- `GET /connector/collections` - Listar colecciones

Documentación completa: [ZOTERO_CONNECTOR_SETUP.md](ZOTERO_CONNECTOR_SETUP.md)

## 🔧 Solución de Problemas

### Error: "no such file or directory"
- Verifica que las rutas en `.env` sean correctas
- Asegúrate de que Zotero esté cerrado antes de iniciar el servidor

### Puerto ocupado
- Cambia el puerto en el script o docker-compose.yml si el 8080 está ocupado

### Permisos de archivos
- Verifica que el usuario tenga acceso de lectura a los archivos de Zotero

### Instalar docker-compose (si no lo tienes)
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker-compose-plugin

# O usando pip
pip install docker-compose
```

## 📄 Licencia

MIT License - NeuropediaLab 2025