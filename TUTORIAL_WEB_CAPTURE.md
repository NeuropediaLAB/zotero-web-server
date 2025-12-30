# 🎓 Tutorial Paso a Paso: Captura de Referencias Web

## 📋 Tabla de Contenidos
1. [Preparación Inicial](#preparación-inicial)
2. [Instalar el Bookmarklet](#instalar-el-bookmarklet)
3. [Usar el Bookmarklet](#usar-el-bookmarklet)
4. [Usar el Formulario Manual](#usar-el-formulario-manual)
5. [Verificar Referencias Guardadas](#verificar-referencias-guardadas)
6. [Solución de Problemas](#solución-de-problemas)

---

## 1️⃣ Preparación Inicial

### Antes de empezar, asegúrate de:

✅ **Servidor corriendo**
```bash
# Verifica que el servidor esté activo
docker ps | grep zotero-web-server
# O si usas directamente Node.js:
# ps aux | grep enhanced-server
```

✅ **Zotero Desktop cerrado** (importante)
```bash
# En Linux:
pkill zotero

# Verifica que no esté corriendo:
ps aux | grep zotero
```

✅ **Navegador con barra de marcadores visible**
- **Chrome/Edge**: Presiona `Ctrl + Shift + B`
- **Firefox**: Presiona `Ctrl + B`
- **Safari**: Presiona `Cmd + Shift + B`

---

## 2️⃣ Instalar el Bookmarklet

### Paso 1: Acceder a la página de captura

```
URL: http://localhost:8080/add-reference.html
```

O desde la página principal:
```
1. Abre: http://localhost:8080
2. Haz clic en el botón morado "AGREGAR REFERENCIA"
```

### Paso 2: Localizar el bookmarklet

Busca la sección que dice:
```
┌─────────────────────────────────────────────┐
│  Método 1: Bookmarklet (Recomendado)        │
│                                              │
│  Arrastra este botón a tu barra de          │
│  marcadores:                                 │
│                                              │
│    [🔖 Guardar en Zotero]  ← ARRASTRA ESTO  │
└─────────────────────────────────────────────┘
```

### Paso 3: Arrastrar el bookmarklet

**Importante**: NO hagas clic, ARRASTRA el botón

```
┌──────────────────────────────┐
│  Barra de Marcadores         │  ← Aquí va el bookmarklet
├──────────────────────────────┤
│ [Google] [YouTube] [...]     │
└──────────────────────────────┘
           ↑
           │
    Arrastra aquí
```

**Acción**:
1. Haz clic y mantén presionado sobre el botón "Guardar en Zotero"
2. Arrastra hacia la barra de marcadores
3. Suelta el botón del ratón
4. Deberías ver un nuevo marcador llamado "Guardar en Zotero"

### Paso 4: Verificar instalación

Tu barra de marcadores debería verse así:
```
[Google] [YouTube] [Guardar en Zotero] [Otros marcadores...]
                    ↑
                Este es tu bookmarklet
```

---

## 3️⃣ Usar el Bookmarklet

### Ejemplo Práctico: Guardar un artículo de Wikipedia

#### Paso 1: Navega a una página

```
Ejemplo: https://es.wikipedia.org/wiki/Inteligencia_artificial
```

#### Paso 2: Haz clic en el bookmarklet

```
┌──────────────────────────────────────────┐
│ [Google] [Guardar en Zotero] ← CLIC AQUÍ│
└──────────────────────────────────────────┘
```

#### Paso 3: Se abre una ventana popup

```
┌─────────────────────────────────────────┐
│ 📚 Guardar Referencia en Zotero         │
├─────────────────────────────────────────┤
│                                          │
│ Título *                                 │
│ [Inteligencia artificial            ]   │
│                                          │
│ Autores                                  │
│ [                                    ]   │
│                                          │
│ Año                                      │
│ [2024]                                   │
│                                          │
│ URL *                                    │
│ [https://es.wikipedia.org/wiki/IA    ]   │
│                                          │
│ Abstract                                 │
│ [Descripción automática...           ]   │
│                                          │
│ Tipo de Documento                        │
│ [Página Web ▼]                           │
│                                          │
│ [💾 Guardar en Zotero] [Cancelar]       │
└─────────────────────────────────────────┘
```

#### Paso 4: Revisar y editar datos

**Campos detectados automáticamente**:
- ✅ Título: Inteligencia artificial
- ✅ URL: https://es.wikipedia.org/wiki/Inteligencia_artificial
- ✅ Abstract: (descripción de Wikipedia)
- ⚠️ Autores: (puede estar vacío, editar si es necesario)
- ⚠️ Año: (año actual por defecto)

**Edita** cualquier campo que necesites cambiar.

#### Paso 5: Guardar

```
Haz clic en: [💾 Guardar en Zotero]
```

#### Paso 6: Confirmación

Verás un mensaje:
```
┌─────────────────────────────────────────┐
│ ✅ Referencia guardada correctamente    │
│    en Zotero                             │
└─────────────────────────────────────────┘
```

La ventana se cerrará automáticamente después de 2 segundos.

---

## 4️⃣ Usar el Formulario Manual

### Cuándo usar el formulario manual:
- ⚠️ El bookmarklet no funciona en la página
- 📱 Estás en un dispositivo móvil/tablet
- 🔒 Los popups están bloqueados
- ✍️ Prefieres copiar/pegar manualmente

### Paso 1: Acceder al formulario

```
URL: http://localhost:8080/add-reference.html
```

Desplázate hasta la sección:
```
┌─────────────────────────────────────────┐
│ Método 2: Formulario Manual              │
└─────────────────────────────────────────┘
```

### Paso 2: Rellenar campos manualmente

```
Título *: [Tu título aquí]
Autores: [Autor1, Autor2, ...]
Año: [2024]
URL *: [https://ejemplo.com]
DOI: [10.1234/ejemplo]
Abstract: [Resumen del documento...]
Tipo: [Página Web ▼]
```

**Campos obligatorios** marcados con asterisco (*):
- Título
- URL

### Paso 3: Guardar

```
[💾 Guardar Referencia]
```

### Paso 4: Ver confirmación

```
┌─────────────────────────────────────────┐
│ ✅ Referencia "Tu título" guardada      │
│    correctamente en Zotero               │
└─────────────────────────────────────────┘
```

El formulario se limpia automáticamente para la próxima referencia.

---

## 5️⃣ Verificar Referencias Guardadas

### Opción 1: En la Web

```
1. Vuelve a: http://localhost:8080
2. Haz clic en pestaña "Base de Datos"
3. Navega por las colecciones
4. Busca tu referencia recién agregada
```

### Opción 2: En Zotero Desktop

```
1. Abre Zotero Desktop
2. Ve a "Mi Biblioteca"
3. Ordena por "Fecha de Adición"
4. Tu nueva referencia debe aparecer arriba
```

### Opción 3: Mediante API

```bash
curl http://localhost:8080/api/zotero/entries?limit=10
```

---

## 6️⃣ Solución de Problemas

### Problema: "Base de datos Zotero no disponible"

**Causa**: Zotero Desktop está abierto y bloquea la base de datos.

**Solución**:
```bash
# Cerrar Zotero Desktop
pkill zotero

# Esperar 5 segundos
sleep 5

# Intentar guardar de nuevo
```

---

### Problema: "No puedo arrastrar el bookmarklet"

**Causa**: La barra de marcadores no está visible.

**Solución**:
```
Chrome/Edge:   Ctrl + Shift + B
Firefox:       Ctrl + B
Safari:        Cmd + Shift + B
```

---

### Problema: "La ventana popup no se abre"

**Causa**: El navegador está bloqueando popups.

**Solución para Chrome**:
```
1. Busca el icono 🚫 en la barra de direcciones
2. Haz clic en él
3. Selecciona "Permitir siempre popups de este sitio"
4. Recarga la página
5. Intenta de nuevo el bookmarklet
```

**Solución para Firefox**:
```
1. Preferencias → Privacidad y seguridad
2. Bloqueo de ventanas emergentes
3. Excepciones...
4. Agrega tu servidor: http://localhost:8080
5. Permitir → Guardar cambios
```

---

### Problema: "El bookmarklet no detecta datos"

**Causa**: La página no tiene metadatos estructurados.

**Solución**:
```
Usa el formulario manual:
1. Copia la URL de la página
2. Ve a: http://localhost:8080/add-reference.html
3. Desplázate a "Método 2: Formulario Manual"
4. Pega la URL
5. Rellena manualmente el resto de campos
6. Guarda
```

---

### Problema: "Error al guardar"

**Diagnóstico**:
```bash
# Ver logs del servidor
docker logs zotero-web-server --tail 50

# O si usas Node.js directamente:
# journalctl -u zotero-web-server -n 50
```

**Causas comunes**:
1. Base de datos bloqueada (cierra Zotero)
2. Campos obligatorios vacíos (título o URL)
3. Servidor no está corriendo
4. Ruta de base de datos incorrecta

---

## 📊 Flujo Visual Completo

```
INICIO
  │
  ├─→ [Opción 1: Bookmarklet]
  │    │
  │    ├─→ 1. Instalar bookmarklet
  │    │   └─→ Arrastrar a barra de marcadores
  │    │
  │    ├─→ 2. Navegar a página interesante
  │    │
  │    ├─→ 3. Clic en bookmarklet
  │    │   └─→ Se abre popup con formulario
  │    │
  │    ├─→ 4. Revisar datos detectados
  │    │   └─→ Editar si es necesario
  │    │
  │    ├─→ 5. Guardar
  │    │   └─→ POST /api/references/add
  │    │
  │    └─→ 6. Confirmación
  │        └─→ Popup se cierra
  │
  └─→ [Opción 2: Manual]
       │
       ├─→ 1. Abrir formulario manual
       │
       ├─→ 2. Rellenar campos
       │
       ├─→ 3. Guardar
       │   └─→ POST /api/references/add
       │
       └─→ 4. Confirmación
           └─→ Formulario se limpia
```

---

## 🎯 Casos de Uso Paso a Paso

### Caso 1: Artículo Científico de PubMed

```
1. Buscar artículo en: https://pubmed.ncbi.nlm.nih.gov/
2. Abrir artículo de interés
3. Clic en bookmarklet "Guardar en Zotero"
4. Verificar que detectó:
   ✓ Título del artículo
   ✓ Autores (múltiples)
   ✓ Año de publicación
   ✓ DOI
   ✓ Abstract
5. Cambiar tipo a "Artículo de Revista"
6. Guardar
```

### Caso 2: Página de Wikipedia

```
1. Navegar a artículo de Wikipedia
2. Clic en bookmarklet
3. Revisar datos:
   ✓ Título (detectado)
   ✓ URL (detectado)
   ✗ Autores (vacío, normal en Wikipedia)
4. Dejar tipo como "Página Web"
5. Guardar
```

### Caso 3: Blog Post

```
1. Leer blog post interesante
2. Clic en bookmarklet
3. Verificar:
   ✓ Título
   ✓ Autor (si está en metadatos)
   ✓ Fecha
   ✓ URL
4. Cambiar tipo a "Blog Post"
5. Si no detectó autor, agregarlo manualmente
6. Guardar
```

---

## 🏆 Mejores Prácticas

### ✅ DO (Hacer)

1. **Cerrar Zotero Desktop** antes de usar el sistema
2. **Revisar siempre los datos** antes de guardar
3. **Seleccionar el tipo correcto** de documento
4. **Usar el formulario manual** como fallback
5. **Verificar** que se guardó correctamente

### ❌ DON'T (No hacer)

1. **No usar con Zotero abierto** - causará errores
2. **No omitir campos importantes** - título y URL son obligatorios
3. **No asumir que todo se detecta** - revisar siempre
4. **No hacer clic en el bookmarklet** al instalarlo - arrastrarlo
5. **No ignorar mensajes de error** - leer y actuar en consecuencia

---

## 📝 Checklist de Uso

Antes de usar el sistema:
- [ ] Servidor está corriendo
- [ ] Zotero Desktop está cerrado
- [ ] Barra de marcadores visible
- [ ] Bookmarklet instalado

Al usar el bookmarklet:
- [ ] Página cargada completamente
- [ ] Clic en bookmarklet
- [ ] Popup se abre correctamente
- [ ] Datos se rellenan automáticamente
- [ ] Revisar todos los campos
- [ ] Seleccionar tipo correcto
- [ ] Clic en "Guardar"
- [ ] Ver mensaje de confirmación

Después de guardar:
- [ ] Verificar en biblioteca web
- [ ] Confirmar aparición en Zotero Desktop
- [ ] Comprobar que datos son correctos

---

**¿Tienes dudas?** Consulta la [documentación completa](./CAPTURA_REFERENCIAS_WEB.md)
