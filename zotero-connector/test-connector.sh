#!/bin/bash

# Script para probar los endpoints de Zotero Connector

SERVER_URL="${1:-http://localhost:8080}"

echo "🧪 Probando endpoints de Zotero Connector en: $SERVER_URL"
echo ""

# Test 1: Ping endpoint
echo "1️⃣  Test: GET /connector/ping"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$SERVER_URL/connector/ping")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Ping exitoso"
    echo "   Respuesta: $BODY"
else
    echo "❌ Ping falló (HTTP $HTTP_CODE)"
    echo "   Respuesta: $BODY"
fi
echo ""

# Test 2: Guardar item de prueba
echo "2️⃣  Test: POST /connector/saveItems"
TEST_ITEM='{
  "items": [
    {
      "itemType": "journalArticle",
      "title": "Test Article from Connector",
      "creators": [
        {
          "firstName": "John",
          "lastName": "Doe",
          "creatorType": "author"
        }
      ],
      "abstractNote": "This is a test article saved via Zotero Connector endpoint",
      "publicationTitle": "Test Journal",
      "volume": "1",
      "issue": "2",
      "pages": "10-20",
      "date": "2024",
      "DOI": "10.1234/test.2024",
      "url": "https://example.com/test",
      "accessDate": "2024-12-29",
      "tags": ["test", "zotero-connector"]
    }
  ]
}'

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "$SERVER_URL/connector/saveItems" \
  -H "Content-Type: application/json" \
  -d "$TEST_ITEM")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Item guardado exitosamente"
    echo "   Respuesta: $BODY"
else
    echo "❌ Error guardando item (HTTP $HTTP_CODE)"
    echo "   Respuesta: $BODY"
fi
echo ""

# Test 3: Obtener colecciones
echo "3️⃣  Test: GET /connector/collections"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$SERVER_URL/connector/collections")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Colecciones obtenidas"
    echo "   Respuesta (primeros 200 chars): ${BODY:0:200}..."
else
    echo "❌ Error obteniendo colecciones (HTTP $HTTP_CODE)"
    echo "   Respuesta: $BODY"
fi
echo ""

echo "✨ Pruebas completadas"
echo ""
echo "📝 Configuración para Firefox:"
echo "   1. Instala Zotero Connector en Firefox"
echo "   2. Click derecho en icono → Preferences → Advanced"
echo "   3. Cambiar 'extensions.zotero.connector.url' a: $SERVER_URL/connector/"
echo ""
