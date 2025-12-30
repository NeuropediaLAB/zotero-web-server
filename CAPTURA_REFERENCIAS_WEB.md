# 📚 Captura de Referencias Web - Guía Completa

## 🎯 Descripción

Sistema integrado para capturar referencias bibliográficas desde cualquier página web sin necesidad de instalar Zotero Standalone o Zotero Connector. Funciona directamente desde tu navegador hacia tu servidor Zotero Web.

## ✨ Características

- ✅ **No requiere extensión del navegador** - Solo un bookmarklet
- ✅ **Detección automática de metadatos** - Captura título, autores, año, DOI, abstract automáticamente
- ✅ **Formulario editable** - Revisa y modifica antes de guardar
- ✅ **Integración directa con Zotero** - Se guarda directamente en tu base de datos Zotero
- ✅ **Formulario manual alternativo** - Para cuando el bookmarklet no esté disponible
- ✅ **Soporta múltiples tipos de documentos** - Artículos, libros, tesis, blogs, etc.

## 🚀 Acceso Rápido

1. **Desde la página principal**: Haz clic en el botón morado **"AGREGAR REFERENCIA"** en la esquina superior derecha
2. **URL directa**: `http://tu-servidor:8080/add-reference.html`

## 📖 Método 1: Bookmarklet (Recomendado)

### Instalación del Bookmarklet

1. Visita la página: `http://tu-servidor:8080/add-reference.html`
2. Busca la sección "Método 1: Bookmarklet"
3. **Arrastra** el botón "Guardar en Zotero" a tu barra de marcadores
   - Chrome/Edge: Muestra la barra con `Ctrl+Shift+B` (Windows/Linux) o `Cmd+Shift+B` (Mac)
   - Firefox: Muestra la barra con `Ctrl+B`

### Uso del Bookmarklet

1. **Navega** a cualquier página web que quieras guardar (artículo científico, blog post, noticia, etc.)
2. **Haz clic** en el bookmarklet "Guardar en Zotero" en tu barra de marcadores
3. Se abrirá una **ventana emergente** con un formulario
4. El formulario estará **pre-rellenado** con los datos detectados automáticamente:
   - Título
   - Autores
   - Año
   - URL
   - DOI (si está disponible)
   - Abstract/Resumen
5. **Revisa y edita** los campos si es necesario
6. Selecciona el **tipo de documento** correcto
7. Haz clic en **"Guardar en Zotero"**
8. Verás un mensaje de confirmación y la ventana se cerrará automáticamente

### Sitios Web Compatibles

El bookmarklet detecta metadatos automáticamente de:

- **📰 Sitios de noticias** (Open Graph tags)
- **📄 Repositorios académicos** (PubMed, arXiv, IEEE, ACM, etc.)
- **📚 Google Scholar** (metadatos de citación)
- **🌐 Wikipedia** y sitios con metadatos estructurados
- **📝 Blogs** con metadatos adecuados
- **🔬 Journals científicos** (Nature, Science, Elsevier, Springer, etc.)

## ✍️ Método 2: Formulario Manual

Si no puedes usar el bookmarklet (por ejemplo, en móvil o tablet):

1. Visita: `http://tu-servidor:8080/add-reference.html`
2. Desplázate a la sección **"Método 2: Formulario Manual"**
3. Rellena manualmente los campos:
   - **Título** (obligatorio)
   - **URL** (obligatorio)
   - Autores
   - Año
   - DOI
   - Abstract
   - Tipo de documento
4. Haz clic en **"Guardar Referencia"**

## 📋 Tipos de Documentos Soportados

- 🌐 **Página Web** (webpage) - Por defecto
- 📄 **Artículo de Revista** (journalArticle)
- 📚 **Libro** (book)
- 📖 **Capítulo de Libro** (bookSection)
- 🎓 **Artículo de Conferencia** (conferencePaper)
- 🎓 **Tesis** (thesis)
- 📊 **Reporte** (report)
- ✍️ **Blog Post** (blogPost)

## 🔧 Requisitos Técnicos

### Servidor
- Zotero Web Server corriendo
- Base de datos Zotero accesible en: `/home/arkantu/Zotero/zotero.sqlite`
- **IMPORTANTE**: Zotero Standalone debe estar **cerrado** al agregar referencias

### Navegador
- Cualquier navegador moderno con JavaScript activado
- Barra de marcadores visible
- Popups permitidos para tu servidor

## 🎨 Ejemplos de Uso

### Ejemplo 1: Guardar un artículo de Wikipedia

```
1. Abre: https://es.wikipedia.org/wiki/Inteligencia_artificial
2. Clic en bookmarklet "Guardar en Zotero"
3. Formulario se abre con:
   - Título: "Inteligencia artificial"
   - URL: https://es.wikipedia.org/wiki/Inteligencia_artificial
   - Abstract: (descripción de Wikipedia)
4. Cambia tipo a "Página Web"
5. Guarda
```

### Ejemplo 2: Guardar un artículo científico de PubMed

```
1. Abre: https://pubmed.ncbi.nlm.nih.gov/12345678/
2. Clic en bookmarklet
3. Formulario detecta automáticamente:
   - Título del artículo
   - Autores
   - Año de publicación
   - DOI
   - Abstract
4. Cambia tipo a "Artículo de Revista"
5. Guarda
```

### Ejemplo 3: Guardar un blog post

```
1. Abre: https://ejemplo.com/mi-post
2. Clic en bookmarklet
3. Revisa datos detectados
4. Selecciona tipo "Blog Post"
5. Añade el nombre del autor si no fue detectado
6. Guarda
```

## ❓ Solución de Problemas

### Error: "Base de datos Zotero no disponible"

**Causa**: Zotero Standalone está abierto y tiene bloqueada la base de datos.

**Solución**:
1. Cierra Zotero Standalone completamente
2. Espera 5 segundos
3. Intenta guardar de nuevo

### El bookmarklet no detecta metadatos

**Causa**: La página web no tiene metadatos estructurados.

**Solución**:
1. Usa el formulario manual
2. Copia y pega manualmente título, URL, etc.

### La ventana emergente está bloqueada

**Causa**: El navegador bloquea popups.

**Solución**:
1. Permite popups para tu servidor
2. Chrome: Clic en el icono de popup en la barra de direcciones → "Permitir siempre"
3. Firefox: Preferencias → Privacidad → Bloqueo de ventanas emergentes → Excepciones

### No puedo arrastrar el bookmarklet

**Causa**: La barra de marcadores no está visible.

**Solución**:
- **Chrome/Edge**: Presiona `Ctrl+Shift+B` (Windows) o `Cmd+Shift+B` (Mac)
- **Firefox**: Presiona `Ctrl+B` o ve a Ver → Barras de herramientas → Barra de marcadores

## 🔐 Seguridad

- ✅ Todas las solicitudes se hacen a tu propio servidor
- ✅ No se envían datos a terceros
- ✅ La base de datos de Zotero se mantiene local
- ✅ Protección contra XSS en formularios
- ✅ Validación de campos en servidor

## 🌟 Ventajas sobre Zotero Connector

| Característica | Zotero Connector | Captura Web |
|----------------|------------------|-------------|
| Requiere instalación | ❌ Sí | ✅ No |
| Funciona sin extensión | ❌ No | ✅ Sí |
| Funciona en entorno restringido | ❌ No | ✅ Sí |
| Edición antes de guardar | ⚠️ Limitada | ✅ Total |
| Captura manual | ❌ No | ✅ Sí |
| Portable | ❌ No | ✅ Sí (bookmarklet) |

## 📱 Uso en Móvil/Tablet

1. Guarda la página `add-reference.html` como **favorito/marcador**
2. Cuando encuentres algo para guardar:
   - Copia la URL
   - Abre el marcador de "Agregar Referencia"
   - Usa el formulario manual
   - Pega la URL y rellena los campos

## 🔄 Sincronización

Las referencias guardadas se añaden directamente a tu base de datos Zotero local:
- Aparecerán en Zotero Standalone la próxima vez que lo abras
- Se sincronizarán con Zotero Cloud si tienes sincronización activada
- Aparecerán inmediatamente en tu Biblioteca Web al recargar

## 📚 Recursos Adicionales

- [Documentación Zotero Web Server](./README.md)
- [API para IA](./API_FOR_AI.md)
- [Changelog](./CHANGELOG.md)

## 💡 Tips y Trucos

1. **Crea una carpeta de marcadores** llamada "Zotero" para organizar el bookmarklet
2. **Usa atajos de teclado** del navegador para acceder rápido a marcadores
3. **Revisa siempre los datos** antes de guardar, especialmente autores y año
4. **Usa el campo DOI** cuando esté disponible para mejor integración
5. **Añade abstracts completos** para mejorar búsquedas futuras

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs del servidor: `docker logs zotero-web-server`
2. Verifica que Zotero Standalone esté cerrado
3. Comprueba que la base de datos exista en la ruta configurada
4. Revisa la consola del navegador (F12) para errores JavaScript

---

**Versión**: 1.0.0  
**Última actualización**: Diciembre 2024  
**Compatibilidad**: Zotero Web Server v0.3.1+
