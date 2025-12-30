# Changelog

Todas las modificaciones notables a este proyecto serán documentadas en este archivo.

## [0.3.2] - 2024-12-29

### 🔗 Añadido - Compatibilidad Zotero Connector
- **Endpoints Zotero Connector**: Guarda referencias desde navegador sin Zotero Desktop
  - `GET /connector/ping` - Verificación de conexión
  - `POST /connector/saveItems` - Guardar referencias bibliográficas completas
  - `GET /connector/collections` - Listar colecciones disponibles
- **Página de configuración**: `/connector-setup.html` con guía paso a paso
- **Documentación completa**: `ZOTERO_CONNECTOR_SETUP.md` con instrucciones detalladas
- **Script de prueba**: `test-connector.sh` para verificar endpoints
- **Soporte Firefox Portable**: Instrucciones para uso sin instalación
- **Bookmarklet alternativo**: Para navegadores sin extensiones

### 📚 Características Zotero Connector
- Guarda metadatos completos (título, autores, DOI, abstract, etc.)
- Inserta directamente en base de datos SQLite de Zotero
- Compatible con PubMed, Google Scholar, arXiv, etc.
- Maneja creadores, tags y campos personalizados
- Genera keys únicos automáticamente

### 🎯 Caso de Uso
- Ideal para hospitales/instituciones con restricciones de instalación
- Permite usar Zotero Connector sin Zotero Desktop corriendo
- Firefox Portable + extensión no requiere permisos de administrador
- Bookmarklet funciona en cualquier navegador

## [0.3.1] - 2024-12-20

### 🐛 Corregido
- **Problema crítico**: Indexación bloqueada en archivo 100 - ahora continúa automáticamente
- La cola de indexación ahora se auto-reabastece con archivos pendientes
- Procesamiento interrumpido después de los primeros 100 archivos

### ✨ Añadido
- Función `continueIndexing()` para procesamiento automático continuo
- Endpoint `POST /api/sync` para sincronización manual forzada
- Auto-continuación de indexación cuando la cola está vacía
- Procesamiento en lotes de 50 archivos para mejor estabilidad

### 🔧 Modificado
- `processIndexingQueue()` intenta continuar automáticamente cuando termina
- Logging mejorado con mensajes de progreso y finalización
- Pausa de 2 segundos entre lotes para evitar sobrecarga del sistema

### 📝 Notas técnicas
- Mantiene compatibilidad completa con versión 0.3.0
- El endpoint `/api/sync` permite control manual del proceso
- Archivos se procesan en lotes para mantener rendimiento óptimo

## [0.3.0] - 2024-12-20

### ✨ Añadido
- **Persistencia de indexación**: Ahora el índice de PDFs se almacena en un volumen persistente de Docker
- Variable de entorno `CACHE_DIR` para configurar el directorio de caché
- Creación automática del directorio de caché si no existe
- Logging mejorado mostrando la ubicación del caché persistente

### 🔧 Modificado
- El archivo `pdf-text-index.json` ahora se guarda en `/app/data/cache/` en lugar del directorio raíz
- Docker Compose configurado para usar volumen persistente `zotero-data` para el caché
- Etiquetas de versión actualizadas a 0.3.0
- Descripción actualizada para reflejar la persistencia de indexación

### 🐛 Corregido
- **Problema crítico**: La indexación ya no se pierde al reiniciar el contenedor
- Los archivos de caché ahora persisten entre reinicios del servicio

### 📝 Notas técnicas
- El volumen `zotero-data` se monta en `/app/data/cache` dentro del contenedor
- Compatibilidad hacia atrás mantenida con instalaciones existentes
- El directorio de caché se crea automáticamente si no existe

## [2.0.0] - Versión anterior
- Versión con optimizaciones de memoria
- Servidor web funcional para biblioteca Zotero
- Indexación de PDFs (sin persistencia)