# 🚀 Quick Start: Captura de Referencias Web

## ¿Qué es esto?

Una solución completa para agregar referencias bibliográficas a Zotero **desde el trabajo** sin necesidad de instalar nada. Funciona con un simple bookmarklet (marcador especial) que puedes usar en cualquier navegador.

## 🎯 Problema que resuelve

- ❌ No puedes instalar Zotero Standalone en tu trabajo
- ❌ No puedes instalar Zotero Connector (extensión del navegador)
- ✅ Pero SÍ puedes usar tu Zotero Web Server
- ✅ Y SÍ puedes agregar marcadores en tu navegador

## ⚡ Inicio Rápido (3 pasos)

### 1. Instala el Bookmarklet

```
1. Abre: http://tu-servidor:8080/add-reference.html
2. Arrastra el botón "Guardar en Zotero" a tu barra de marcadores
3. ¡Listo!
```

### 2. Usa el Bookmarklet

```
1. Navega a cualquier página que quieras guardar
2. Haz clic en el bookmarklet "Guardar en Zotero"
3. Revisa los datos en el formulario que se abre
4. Haz clic en "Guardar en Zotero"
```

### 3. Verifica en tu Biblioteca

```
1. Recarga tu biblioteca web
2. La nueva referencia aparecerá inmediatamente
3. También aparecerá en Zotero Standalone cuando lo abras
```

## 📱 Acceso Directo

Desde la página principal de tu biblioteca, haz clic en el botón morado **"AGREGAR REFERENCIA"** en la esquina superior derecha.

## 🎬 Ejemplo de Uso

**Escenario**: Encuentras un artículo interesante en Wikipedia en el trabajo

```
Antes:
❌ Copiar título, URL en un archivo de texto
❌ Acordarte de agregarlo cuando llegues a casa
❌ Buscar de nuevo el artículo

Ahora:
✅ Clic en bookmarklet
✅ Revisar datos (2 segundos)
✅ Guardar
✅ ¡Ya está en tu Zotero!
```

## 🌟 Características Principales

### Detección Automática
El bookmarklet detecta automáticamente de la página:
- 📝 Título
- 👤 Autores
- 📅 Año
- 🔗 URL
- 🆔 DOI (si está disponible)
- 📄 Abstract/Resumen

### Funciona en Múltiples Sitios
- 📰 Sitios de noticias
- 🔬 Journals científicos (PubMed, IEEE, Nature, etc.)
- 📚 Google Scholar
- 🌐 Wikipedia
- ✍️ Blogs
- 📖 Y cualquier sitio con metadatos básicos

### Sin Instalaciones
- No requiere permisos de administrador
- No requiere instalar extensiones
- Solo un marcador del navegador
- Funciona en cualquier ordenador donde uses tu navegador

## ⚠️ Importante

1. **Cierra Zotero Standalone** cuando vayas a agregar referencias desde la web
   - La base de datos no puede estar bloqueada
   - Ábrelo después para ver las nuevas referencias

2. **Permite popups** para tu servidor
   - El bookmarklet abre una ventana pequeña
   - Configura tu navegador para permitir popups de tu dominio

## 🔧 Solución de Problemas Comunes

### "Base de datos Zotero no disponible"
```
Solución: Cierra Zotero Standalone y espera 5 segundos
```

### La ventana no se abre
```
Solución: Permite popups para tu servidor
Chrome: Icono en barra de direcciones → Permitir siempre
```

### No detecta los metadatos
```
Solución: Usa el formulario manual en la misma página
```

## 💻 Alternativa: Formulario Manual

Si el bookmarklet no funciona o estás en móvil:

1. Visita: `http://tu-servidor:8080/add-reference.html`
2. Usa el "Método 2: Formulario Manual"
3. Rellena los campos manualmente
4. Guarda

## 📚 Documentación Completa

Para más detalles, consulta: [CAPTURA_REFERENCIAS_WEB.md](./CAPTURA_REFERENCIAS_WEB.md)

## 🎓 Casos de Uso Reales

### En el Trabajo
```
✅ Leer artículos durante la pausa
✅ Guardar referencias de proyectos
✅ Organizar fuentes para informes
✅ Recopilar documentación técnica
```

### Investigación
```
✅ Guardar artículos científicos rápidamente
✅ Capturar fuentes mientras lees
✅ Organizar bibliografía sobre la marcha
✅ No perder referencias importantes
```

### Estudio
```
✅ Guardar material de clase
✅ Organizar fuentes para trabajos
✅ Recopilar recursos educativos
✅ Crear biblioteca personal
```

## 🚀 Próximos Pasos

1. **Instala el bookmarklet ahora**: [/add-reference.html](http://localhost:8080/add-reference.html)
2. **Pruébalo**: Guarda esta página como referencia
3. **Úsalo regularmente**: Conviértelo en un hábito
4. **Explora**: Revisa tu biblioteca web regularmente

---

**¿Necesitas ayuda?** Consulta la [documentación completa](./CAPTURA_REFERENCIAS_WEB.md) o los logs del servidor.
