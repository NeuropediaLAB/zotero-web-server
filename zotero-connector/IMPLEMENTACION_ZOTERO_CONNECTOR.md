# Resumen: Implementación de Zotero Connector para Base de Datos Web

## 📋 Problema Resuelto

En tu hospital no puedes:
- Instalar plugins/extensiones en Chrome
- Tener Zotero Desktop corriendo constantemente
- Usar Zotero Connector de forma tradicional

## ✅ Solución Implementada

Hemos agregado **endpoints compatibles con Zotero Connector** que permiten guardar referencias bibliográficas directamente en tu base de datos SQLite de Zotero, **sin necesidad de tener Zotero Desktop corriendo**.

## 🎯 Archivos Creados/Modificados

### 1. **enhanced-server-memory-optimized.js** (Modificado)
Agregados 3 endpoints principales:
```javascript
GET  /connector/ping          // Verificación de conexión
POST /connector/saveItems     // Guardar referencias
GET  /connector/collections   // Listar colecciones
```

**Funciones auxiliares agregadas:**
- `generateZoteroKey()` - Genera keys únicos de 8 caracteres
- `getItemTypeID()` - Obtiene ID de tipo de documento
- `getFieldID()` - Obtiene ID de campos bibliográficos
- `getCreatorTypeID()` - Obtiene ID de tipo de creador

### 2. **ZOTERO_CONNECTOR_SETUP.md** (Nuevo)
Documentación completa con:
- Instrucciones paso a paso
- Dos opciones de uso (Firefox Portable + Bookmarklet)
- Troubleshooting
- Casos de uso

### 3. **web/connector-setup.html** (Nuevo)
Página web interactiva con:
- Guía visual paso a paso
- Test de conexión automático
- Bookmarklet arrastratable
- Diseño responsive y atractivo

### 4. **test-connector.sh** (Nuevo)
Script Bash para probar los endpoints:
- Test de ping
- Test de guardar item
- Test de obtener colecciones

### 5. **README.md** (Modificado)
- Agregada sección "Usar Zotero Connector"
- Actualizado listado de características
- Enlace a documentación completa

### 6. **CHANGELOG.md** (Modificado)
- Documentada versión 0.3.2
- Listadas todas las nuevas características

## 🚀 Cómo Usar

### Opción A: Firefox Portable + Zotero Connector

1. **Descarga Firefox Portable** (sin instalación)
   - https://portableapps.com/apps/internet/firefox_portable
   - Extrae en USB o carpeta local

2. **Instala Zotero Connector en Firefox**
   - https://www.zotero.org/download/connectors
   - Instala extensión de Firefox

3. **Configura URL del servidor**
   - Click derecho en icono Zotero Connector → Preferences → Advanced
   - Busca: `extensions.zotero.connector.url`
   - Cambia a: `http://TU_IP:8080/connector/`
   - Ejemplo: `http://192.168.1.100:8080/connector/`

4. **¡Listo!**
   - Navega a PubMed, Google Scholar, etc.
   - Click en icono de Zotero Connector
   - La referencia se guarda automáticamente

### Opción B: Bookmarklet (Cualquier navegador)

1. Abre: http://localhost:8080/connector-setup.html
2. Arrastra el botón "Guardar en Zotero" a tus marcadores
3. En cualquier página web, click en el marcador para guardar

## 🔍 Datos que se Guardan

El sistema guarda metadatos completos:
- ✅ Título
- ✅ Autores (nombre, apellido, tipo)
- ✅ Abstract/Resumen
- ✅ DOI, PMID, URL
- ✅ Revista/Editorial
- ✅ Volumen, número, páginas
- ✅ Fecha de publicación
- ✅ Fecha de acceso
- ✅ Tags/Etiquetas
- ✅ Idioma, ISSN, editorial, lugar

## 🧪 Probar la Implementación

### Método 1: Interfaz Web
```bash
# 1. Inicia el servidor
npm start

# 2. Abre en navegador
http://localhost:8080/connector-setup.html

# 3. Click en "Probar Conexión"
# Debe mostrar: ✅ Ping exitoso, ✅ Colecciones disponibles
```

### Método 2: Script de Prueba
```bash
# Ejecuta el script de prueba
./test-connector.sh

# O con una IP específica
./test-connector.sh http://192.168.1.100:8080
```

### Método 3: Manual con cURL
```bash
# Test ping
curl http://localhost:8080/connector/ping

# Test guardar item
curl -X POST http://localhost:8080/connector/saveItems \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "itemType": "journalArticle",
      "title": "Test Article",
      "creators": [{"firstName": "John", "lastName": "Doe", "creatorType": "author"}],
      "date": "2024"
    }]
  }'
```

## 🎓 Ejemplo de Uso Real

### Guardar artículo de PubMed

1. Abre: https://pubmed.ncbi.nlm.nih.gov/
2. Busca: "neural networks"
3. Abre cualquier artículo
4. Click en icono Zotero Connector (debe aparecer como artículo de revista)
5. Click para guardar
6. La referencia aparece inmediatamente en tu biblioteca web

## 📊 Arquitectura Técnica

```
┌─────────────────┐
│  Navegador Web  │ (Firefox Portable)
│ Zotero Connector│
└────────┬────────┘
         │ HTTP POST /connector/saveItems
         ▼
┌─────────────────┐
│  Node.js Server │
│  Express.js     │
└────────┬────────┘
         │ SQLite INSERT
         ▼
┌─────────────────┐
│ zotero.sqlite   │
│  Base de Datos  │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Interfaz Web   │
│  (index.html)   │
└─────────────────┘
```

## 🔧 Funciones Técnicas Implementadas

### 1. Inserción en Base de Datos
El endpoint procesa cada item y realiza:
1. Genera key único (8 caracteres aleatorios)
2. Inserta en tabla `items` (con typeID, fechas, key)
3. Inserta campos en `itemData` y `itemDataValues`
4. Procesa creadores → `creators` + `itemCreators`
5. Procesa tags → `tags` + `itemTags`
6. Maneja colecciones si se especifican

### 2. Mapeo de Campos
```javascript
fieldMappings = {
  title → title
  abstractNote → abstractNote
  url → url
  DOI → DOI
  publicationTitle → publicationTitle
  volume, issue, pages → volume, issue, pages
  date, accessDate → date, accessDate
  // ... más campos
}
```

### 3. Manejo de Errores
- Validación de items recibidos
- Transacciones seguras en base de datos
- Logs detallados de cada operación
- Respuestas JSON con estado de cada item

## ⚠️ Limitaciones Actuales

1. **PDFs adjuntos**: No se descargan automáticamente (futura mejora)
2. **Sincronización Zotero.org**: No sincroniza con servidores de Zotero
3. **Colecciones**: Se guarda en biblioteca principal (se puede agregar selector)

## 🔮 Mejoras Futuras Sugeridas

- [ ] Descarga automática de PDFs desde DOI
- [ ] Selector de colección en popup
- [ ] Sincronización bidireccional con Zotero.org
- [ ] Importación masiva desde BibTeX/RIS
- [ ] Detección de duplicados antes de guardar
- [ ] Extensión Chrome personalizada (si se obtienen permisos)

## 📞 Soporte

### Logs del servidor
```bash
# Si usas npm
npm start

# Si usas Docker
docker logs -f zotero-web-server
```

### Verificar base de datos
```bash
sqlite3 /path/to/zotero.sqlite "SELECT * FROM items ORDER BY dateAdded DESC LIMIT 5;"
```

### Troubleshooting común

**Problema:** Connector no conecta
- ✅ Verifica que el servidor esté corriendo
- ✅ Revisa la URL en preferencias de Connector
- ✅ Comprueba firewall/permisos de red

**Problema:** Referencias no aparecen
- ✅ Recarga la página (F5)
- ✅ Verifica permisos de escritura en zotero.sqlite
- ✅ Revisa logs del servidor

**Problema:** Error al guardar
- ✅ Algunos sitios tienen metadatos incompletos
- ✅ Revisa console del navegador (F12)
- ✅ Verifica que CORS esté habilitado

## 🎉 Conclusión

Ahora tienes un sistema completo para agregar referencias bibliográficas desde cualquier navegador, incluso sin Zotero Desktop instalado. Esto es ideal para entornos con restricciones como hospitales, donde no se pueden instalar aplicaciones pero sí usar navegadores portables.

La solución es:
- ✅ **Portable**: Firefox Portable no requiere instalación
- ✅ **Directa**: Guarda directo en tu base de datos
- ✅ **Compatible**: Funciona con todos los sitios que Zotero Connector soporta
- ✅ **Sin dependencias**: No necesitas Zotero Desktop corriendo
- ✅ **Inmediata**: Las referencias aparecen al instante en la web

¡Disfruta tu nueva funcionalidad! 🚀
