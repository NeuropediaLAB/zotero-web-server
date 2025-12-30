# 🚀 Quick Start - Zotero Connector

## ⚡ Inicio Rápido (5 minutos)

### Paso 1: Inicia el Servidor
```bash
npm start
# O con Docker:
docker-compose up -d
```

### Paso 2: Verifica que Funciona
Abre en tu navegador: http://localhost:8080/connector-setup.html

Verás un test automático que confirma:
- ✅ Ping exitoso
- ✅ Colecciones disponibles

### Paso 3: Configura tu Navegador

#### Opción A: Firefox Portable (Recomendado para hospitales)
1. Descarga: https://portableapps.com/apps/internet/firefox_portable
2. Extrae en USB o carpeta
3. Abre Firefox Portable
4. Instala extensión: https://www.zotero.org/download/connectors
5. Click derecho en icono Zotero → Preferences → Advanced
6. Busca: `extensions.zotero.connector.url`
7. Cambia a: `http://localhost:8080/connector/`
   (Usa tu IP si es otro equipo: `http://192.168.1.X:8080/connector/`)

#### Opción B: Bookmarklet (Cualquier navegador)
1. Abre: http://localhost:8080/connector-setup.html
2. Arrastra el botón amarillo "📚 Guardar en Zotero" a tus marcadores
3. ¡Listo! Click en el marcador para guardar cualquier página

### Paso 4: Prueba
1. Abre: https://pubmed.ncbi.nlm.nih.gov/
2. Busca cualquier término médico
3. Abre un artículo
4. **Con Connector**: Click en el icono de Zotero
5. **Con Bookmarklet**: Click en el marcador "Guardar en Zotero"
6. Verifica en http://localhost:8080 que aparece la nueva referencia

---

## 📚 Documentación Completa

- **IMPLEMENTACION_ZOTERO_CONNECTOR.md** - Resumen técnico completo
- **ZOTERO_CONNECTOR_SETUP.md** - Guía detallada de usuario
- **DIAGRAMA_FLUJO.md** - Diagramas técnicos y arquitectura
- **web/connector-setup.html** - Interfaz interactiva de configuración

---

## 🧪 Probar Endpoints Manualmente

```bash
# Test 1: Ping
curl http://localhost:8080/connector/ping

# Test 2: Guardar item de prueba
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

# Test 3: Ver colecciones
curl http://localhost:8080/connector/collections

# O ejecuta el script completo:
./test-connector.sh
```

---

## ❓ Solución Rápida de Problemas

### No conecta
```bash
# Verifica que el servidor esté corriendo
curl http://localhost:8080/connector/ping
# Debe responder: {"prefs":{"automaticSnapshots":false},"version":"1.0.0"}
```

### Referencias no aparecen
```bash
# Recarga la página
# O verifica los logs:
docker logs -f zotero-web-server
# Busca mensajes: "📚 Zotero Connector: Guardando..."
```

### Error al guardar
- Revisa permisos del archivo `zotero.sqlite`
- Comprueba que no esté bloqueado por otro proceso
- Verifica logs del servidor

---

## 🎯 Para Uso en Hospital

Si estás en un hospital con restricciones:

1. **Firefox Portable** no requiere instalación
2. La **extensión Zotero Connector** sí se puede instalar (es del navegador, no del sistema)
3. Configura la URL del servidor a tu PC local o servidor del departamento
4. Guarda Firefox Portable en USB o carpeta de red compartida

**Ejemplo de configuración hospitalaria:**
```
Usuario 1 (PC-MEDICO-01):
- Firefox Portable en: C:\PortableApps\Firefox
- Servidor corriendo en: 192.168.10.50:8080
- Connector URL: http://192.168.10.50:8080/connector/

Usuario 2 (PC-MEDICO-02):
- Firefox Portable en: D:\Apps\Firefox
- Mismo servidor: 192.168.10.50:8080
- Connector URL: http://192.168.10.50:8080/connector/

Todos comparten la misma base de datos Zotero
```

---

## 🎉 ¡Listo!

Ahora puedes:
- ✅ Guardar referencias desde PubMed
- ✅ Guardar papers desde arXiv
- ✅ Guardar artículos desde Google Scholar
- ✅ Guardar páginas web generales
- ✅ Todo sin tener Zotero Desktop instalado

**¿Preguntas?** Revisa la documentación completa en los archivos MD mencionados arriba.
