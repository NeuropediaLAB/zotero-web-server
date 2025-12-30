# 🚀 Acceso Rápido - Captura de Referencias Web

## ✅ Docker Actualizado Correctamente

Tu contenedor Docker ha sido actualizado con la nueva funcionalidad de captura de referencias web.

---

## 🌐 URLs de Acceso

### Página Principal
```
http://localhost:3302
```
- Biblioteca completa de Zotero
- Búsqueda de documentos
- Visualización de PDFs
- **NUEVO**: Botón morado "AGREGAR REFERENCIA" en esquina superior derecha

### Página de Captura de Referencias ⭐ NUEVO
```
http://localhost:3302/add-reference.html
```
- Bookmarklet para captura automática
- Formulario manual
- Instrucciones completas

### API de Referencias ⭐ NUEVO
```
GET  http://localhost:3302/api/references/status
POST http://localhost:3302/api/references/add
```

---

## 🎯 Cómo Empezar (3 Pasos)

### 1. Abre la Página de Captura
```
http://localhost:3302/add-reference.html
```

### 2. Instala el Bookmarklet
- Busca el botón morado "Guardar en Zotero"
- **Arrastra** (no hagas clic) el botón a tu barra de marcadores
- Deberías ver un nuevo marcador en tu navegador

### 3. Úsalo en Cualquier Página
- Navega a una página que quieras guardar (ej: Wikipedia)
- Haz clic en el marcador "Guardar en Zotero"
- Revisa los datos detectados
- Haz clic en "Guardar"
- ¡Listo! 🎉

---

## 📱 Acceso Desde el Trabajo

Si accedes desde fuera de tu red local, reemplaza `localhost` por la IP de tu servidor:

```
http://TU_IP:3302
http://TU_IP:3302/add-reference.html
```

Ejemplo:
```
http://192.168.1.100:3302/add-reference.html
```

---

## ⚙️ Verificación del Sistema

### Verificar que el servidor está corriendo:
```bash
docker ps | grep zotero-web-server
```

### Verificar API de referencias:
```bash
curl http://localhost:3302/api/references/status
```
Deberías ver:
```json
{
  "ready": true,
  "zoteroDbAvailable": true,
  "version": "1.0.0",
  "features": ["web-capture", "bookmarklet", "manual-entry"]
}
```

### Ver logs del servidor:
```bash
docker logs zotero-web-server --tail 50
```

---

## 📊 Puertos Configurados

| Servicio | Puerto Interno | Puerto Host | URL |
|----------|---------------|-------------|-----|
| Web Server | 3002 | 3302 | http://localhost:3302 |

---

## 🔄 Reiniciar el Contenedor

Si necesitas reiniciar el servidor:

```bash
cd /home/arkantu/docker/zotero-web-server
docker compose restart zotero-server
```

---

## 📚 Documentación Completa

Toda la documentación está disponible en tu directorio:

1. **SOLUCION_CAPTURA_WEB.md** ⭐ EMPIEZA AQUÍ
   - Resumen ejecutivo (5 min)

2. **QUICK_START_WEB_CAPTURE.md**
   - Guía rápida (10 min)

3. **TUTORIAL_WEB_CAPTURE.md**
   - Tutorial detallado (20 min)

4. **CAPTURA_REFERENCIAS_WEB.md**
   - Documentación completa (30 min)

5. **INDICE_CAPTURA_WEB.md**
   - Índice navegable de toda la documentación

---

## ⚠️ Importante Recordar

### Antes de Usar el Sistema:
1. ✅ **Cierra Zotero Desktop** (muy importante)
2. ✅ Asegúrate que el servidor está corriendo
3. ✅ Ten tu barra de marcadores visible

### Al Usar el Bookmarklet:
1. ✅ La página debe estar completamente cargada
2. ✅ Revisa siempre los datos antes de guardar
3. ✅ Selecciona el tipo de documento correcto

---

## 🎉 ¡Todo Listo!

Tu sistema de captura de referencias web está **completamente funcional**.

### Próximo Paso:
1. Abre: http://localhost:3302/add-reference.html
2. Instala el bookmarklet
3. Pruébalo en Wikipedia o Google Scholar
4. ¡Disfruta! 🚀

---

## 🆘 Soporte

**Si algo no funciona:**
1. Revisa los logs: `docker logs zotero-web-server`
2. Verifica el API: `curl http://localhost:3302/api/references/status`
3. Consulta: `TUTORIAL_WEB_CAPTURE.md` sección "Solución de Problemas"

---

**Versión**: 0.3.1  
**Puerto**: 3302  
**Estado**: ✅ Operacional  
**Última actualización**: 30 de Diciembre de 2024
