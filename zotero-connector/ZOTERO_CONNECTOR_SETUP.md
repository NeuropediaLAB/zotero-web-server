# Configuración de Zotero Connector para Base de Datos Web

## Problema
En hospitales con restricciones, no puedes instalar extensiones de navegador ni tener Zotero desktop corriendo, lo que impide usar Zotero Connector.

## Solución
Hemos implementado endpoints compatibles con el protocolo de Zotero Connector que permiten guardar referencias bibliográficas directamente en tu base de datos SQLite de Zotero a través de tu servidor web.

## Endpoints Implementados

### 1. Verificación de Conexión
**Endpoint:** `GET /connector/ping`
- Responde al "ping" de Zotero Connector
- Confirma que el servidor está disponible

### 2. Guardar Referencias
**Endpoint:** `POST /connector/saveItems`
- Recibe datos bibliográficos desde Zotero Connector
- Los guarda directamente en la base de datos SQLite de Zotero
- Formato compatible con el protocolo de Zotero

### 3. Obtener Colecciones
**Endpoint:** `GET /connector/collections`
- Lista las colecciones disponibles para organizar las referencias

## Uso con Firefox Portable (Sin Instalación)

### Paso 1: Descargar Firefox Portable
1. Descarga Firefox Portable desde: https://portableapps.com/apps/internet/firefox_portable
2. No requiere instalación, se ejecuta desde USB o carpeta local
3. Extrae en una carpeta accesible (ej: `C:\Firefox_Portable`)

### Paso 2: Instalar Zotero Connector en Firefox Portable
1. Abre Firefox Portable
2. Ve a: https://www.zotero.org/download/connectors
3. Instala la extensión de Firefox (sí se pueden instalar extensiones en portable)

### Paso 3: Configurar Zotero Connector
1. Click derecho en el icono de Zotero Connector → "Preferences"
2. En "Advanced" → "Advanced Settings"
3. Buscar preferencia: `extensions.zotero.connector.url`
4. Cambiar valor de `http://localhost:23119/` a tu servidor:
   ```
   http://TU_IP:8080/connector/
   ```
   Ejemplo: `http://192.168.1.100:8080/connector/`

### Paso 4: Verificar Configuración
1. El icono de Zotero Connector debería mostrar estado conectado
2. Navega a cualquier página con metadatos bibliográficos (PubMed, Google Scholar, etc.)
3. Click en el icono de Zotero Connector
4. La referencia se guardará automáticamente en tu base de datos

## Configuración del Servidor

Asegúrate de que tu servidor esté accesible en la red:

```bash
# Iniciar el servidor
npm start

# O con Docker
docker-compose up -d
```

El servidor escuchará en el puerto 8080 por defecto.

## Cómo Funciona

1. **Detección de Referencias**: Zotero Connector detecta metadatos en páginas web
2. **Envío al Servidor**: En lugar de enviar a Zotero desktop (puerto 23119), envía a tu servidor web
3. **Guardado en BD**: El servidor recibe los datos y los inserta directamente en `zotero.sqlite`
4. **Sincronización**: Los cambios aparecen inmediatamente en tu interfaz web

## Datos que se Guardan

Zotero Connector envía metadatos completos incluyendo:
- Título
- Autores
- Fecha de publicación
- Abstract/Resumen
- DOI, PMID, URL
- Tipo de documento (artículo, libro, tesis, etc.)
- Revista/Editorial
- Volumen, número, páginas
- Tags/Etiquetas

## Limitaciones

1. **Adjuntos**: Los PDFs no se descargan automáticamente (requiere modificación adicional)
2. **Sincronización Zotero**: No sincroniza con servidores de Zotero.org
3. **Colecciones**: Debes seleccionar colección manualmente o se guarda en biblioteca principal

## Solución Alternativa: Marcadores (Bookmarklet)

Si no puedes usar Firefox Portable, también puedes usar un bookmarklet en cualquier navegador:

```javascript
javascript:(function(){
  const title = document.title;
  const url = window.location.href;
  const selection = window.getSelection().toString();
  
  fetch('http://TU_IP:8080/connector/saveItems', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      items: [{
        itemType: 'webpage',
        title: title,
        url: url,
        abstractNote: selection,
        accessDate: new Date().toISOString()
      }]
    })
  }).then(r => r.json()).then(d => alert('Guardado: ' + title));
})();
```

Guarda esto como marcador y click cuando quieras guardar una página.

## Verificar que Funciona

1. Abre tu interfaz web: `http://localhost:8080`
2. Busca la nueva referencia en la lista
3. Verifica que todos los metadatos se guardaron correctamente

## Troubleshooting

### Connector no conecta
- Verifica que el servidor esté corriendo: `curl http://localhost:8080/connector/ping`
- Revisa firewall/permisos de red
- Comprueba la URL configurada en Connector

### Referencias no aparecen
- Revisa logs del servidor: `docker logs zotero-web-server`
- Verifica permisos de escritura en `zotero.sqlite`
- Comprueba que la base de datos no esté bloqueada

### Error al guardar
- Algunos sitios tienen metadatos incompletos
- Revisa console del navegador (F12) para errores de CORS
- Asegúrate de que CORS esté habilitado en el servidor

## Próximas Mejoras

- [ ] Descarga automática de PDFs
- [ ] Selector de colección en popup
- [ ] Sincronización bidireccional con Zotero.org
- [ ] Importación masiva desde archivos BibTeX/RIS
- [ ] Extensión Chrome personalizada (si logras permisos)

## Soporte

Para más información o problemas, revisa los logs del servidor o contacta al administrador del sistema.
