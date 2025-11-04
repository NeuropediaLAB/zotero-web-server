# API para IA (ChatGPT/GPT Actions)

Esta API permite que sistemas de IA como ChatGPT busquen y accedan al contenido indexado de la biblioteca Zotero.

## Base URL

```
http://localhost:3002
```

## Endpoints

### 1. Búsqueda Semántica

**Endpoint:** `POST /api/ai/search`

**Descripción:** Busca documentos relevantes por término y devuelve contexto enriquecido.

**Request Body:**
```json
{
  "query": "término de búsqueda",
  "max_results": 10,
  "include_full_text": false
}
```

**Parámetros:**
- `query` (string, requerido): Término o frase a buscar
- `max_results` (integer, opcional): Número máximo de resultados (default: 10, max: 100)
- `include_full_text` (boolean, opcional): Incluir texto completo del documento (default: false)

**Response:**
```json
{
  "query": "neural networks",
  "total_results": 5,
  "results": [
    {
      "title": "Deep Learning Fundamentals.pdf",
      "relevance_score": 15,
      "context": "...extracto de 200 palabras con el término en contexto...",
      "source_type": "content",
      "is_indexed": true,
      "file_path": "/app/data/biblioteca/Deep Learning Fundamentals.pdf",
      "full_text": "texto completo si include_full_text=true"
    }
  ],
  "metadata": {
    "timestamp": "2024-11-04T17:30:00.000Z",
    "total_indexed_documents": 5007,
    "search_type": "semantic"
  }
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3002/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query": "neural networks", "max_results": 5}'
```

---

### 2. Obtener Documento Completo

**Endpoint:** `POST /api/ai/document`

**Descripción:** Obtiene el texto completo indexado de un documento específico.

**Request Body:**
```json
{
  "path": "/app/data/biblioteca/documento.pdf"
}
```

**Parámetros:**
- `path` (string, requerido): Ruta completa del documento

**Response:**
```json
{
  "path": "/app/data/biblioteca/documento.pdf",
  "filename": "documento.pdf",
  "indexed_at": "2024-11-04T12:00:00.000Z",
  "text": "Texto completo del documento indexado...",
  "has_text": true,
  "word_count": 5420
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3002/api/ai/document \
  -H "Content-Type: application/json" \
  -d '{"path": "/app/data/biblioteca/documento.pdf"}'
```

---

### 3. Listar Documentos Indexados

**Endpoint:** `GET /api/ai/documents`

**Descripción:** Lista todos los documentos indexados con paginación.

**Query Parameters:**
- `limit` (integer, opcional): Documentos por página (default: 100, max: 1000)
- `offset` (integer, opcional): Offset para paginación (default: 0)

**Response:**
```json
{
  "total": 5007,
  "offset": 0,
  "limit": 100,
  "documents": [
    {
      "path": "/app/data/biblioteca/doc1.pdf",
      "filename": "doc1.pdf",
      "indexed": true,
      "indexed_at": "2024-11-04T12:00:00.000Z",
      "word_count": 3500
    }
  ]
}
```

**Ejemplo cURL:**
```bash
curl "http://localhost:3002/api/ai/documents?limit=50&offset=0"
```

---

## Configuración en ChatGPT (GPT Actions)

### Schema OpenAPI para GPT Actions

```yaml
openapi: 3.0.0
info:
  title: Zotero Library API
  description: API para buscar y acceder a documentos indexados de biblioteca Zotero
  version: 1.0.0
servers:
  - url: http://localhost:3002
    description: Servidor local

paths:
  /api/ai/search:
    post:
      summary: Buscar documentos
      operationId: searchDocuments
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - query
              properties:
                query:
                  type: string
                  description: Término de búsqueda
                max_results:
                  type: integer
                  default: 10
                  description: Número máximo de resultados
                include_full_text:
                  type: boolean
                  default: false
                  description: Incluir texto completo
      responses:
        '200':
          description: Resultados de búsqueda
          content:
            application/json:
              schema:
                type: object
                properties:
                  query:
                    type: string
                  total_results:
                    type: integer
                  results:
                    type: array
                    items:
                      type: object
                      properties:
                        title:
                          type: string
                        relevance_score:
                          type: number
                        context:
                          type: string
                        is_indexed:
                          type: boolean
                        file_path:
                          type: string

  /api/ai/document:
    post:
      summary: Obtener documento completo
      operationId: getDocument
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - path
              properties:
                path:
                  type: string
                  description: Ruta del documento
      responses:
        '200':
          description: Documento encontrado
        '404':
          description: Documento no encontrado

  /api/ai/documents:
    get:
      summary: Listar documentos indexados
      operationId: listDocuments
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Lista de documentos
```

---

## Ejemplo de Uso en ChatGPT

Una vez configurada la GPT Action, puedes hacer preguntas como:

- "Busca información sobre redes neuronales en mi biblioteca"
- "¿Qué documentos tengo sobre aprendizaje profundo?"
- "Dame un resumen del artículo sobre transformers"
- "Busca papers relacionados con attention mechanisms"

ChatGPT usará la API para buscar en tu biblioteca indexada y proporcionar respuestas basadas en tus documentos.

---

## Notas de Seguridad

⚠️ **IMPORTANTE:** Esta API está diseñada para uso local. Para exposición pública:

1. Agregar autenticación (API Key, OAuth, etc.)
2. Implementar rate limiting
3. Usar HTTPS
4. Validar y sanitizar inputs
5. Configurar CORS apropiadamente

---

## Estadísticas y Monitoreo

**Endpoint de estadísticas:** `GET /api/stats`

Devuelve información sobre el estado del sistema, documentos indexados, etc.

---

## Soporte

Para más información, consulta la documentación principal o los logs del servidor.
