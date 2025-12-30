#!/usr/bin/env node

// Script para exportar TODOS los documentos indexados para NotebookLM
const http = require('http');
const fs = require('fs');

const SERVER_URL = 'http://localhost:3002';
const OUTPUT_FILE = 'biblioteca_completa_notebookllm.txt';

// Función para hacer peticiones HTTP
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Obtener lista de todos los documentos
async function getAllDocuments() {
  console.log('📋 Obteniendo lista de documentos...');
  
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/ai/documents?limit=1000&offset=0',
    method: 'GET'
  };
  
  try {
    const result = await makeRequest(options);
    console.log(`✅ Encontrados ${result.total} documentos indexados`);
    return result;
  } catch (error) {
    console.error('❌ Error obteniendo lista:', error.message);
    return null;
  }
}

// Obtener texto completo de un documento
async function getDocumentText(documentPath) {
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/ai/document',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const docData = JSON.stringify({ path: documentPath });
  
  try {
    const result = await makeRequest(options, docData);
    return result;
  } catch (error) {
    console.error(`❌ Error obteniendo documento ${documentPath}:`, error.message);
    return null;
  }
}

// Función principal para exportar todo
async function exportAllDocuments() {
  console.log('🚀 Iniciando exportación completa para NotebookLM...\n');
  
  // Obtener lista de documentos
  const documentsList = await getAllDocuments();
  if (!documentsList) {
    console.log('❌ No se pudo obtener la lista de documentos');
    return;
  }
  
  // Crear archivo de exportación
  let exportText = `# BIBLIOTECA COMPLETA ZOTERO - NotebookLM Export\n\n`;
  exportText += `**Fecha de exportación:** ${new Date().toISOString()}\n`;
  exportText += `**Total de documentos:** ${documentsList.total}\n`;
  exportText += `**Documentos procesados:** ${documentsList.documents.length}\n\n`;
  exportText += `---\n\n`;
  
  console.log(`📄 Procesando ${documentsList.documents.length} documentos...`);
  
  let processedCount = 0;
  let errorCount = 0;
  
  // Procesar cada documento
  for (let i = 0; i < documentsList.documents.length; i++) {
    const doc = documentsList.documents[i];
    const progress = Math.round(((i + 1) / documentsList.documents.length) * 100);
    
    process.stdout.write(`\r📖 Procesando ${i + 1}/${documentsList.documents.length} (${progress}%) - ${doc.filename}`);
    
    if (doc.indexed) {
      const docText = await getDocumentText(doc.path);
      
      if (docText && docText.text) {
        exportText += `## ${processedCount + 1}. ${doc.filename}\n\n`;
        exportText += `**Ruta:** ${doc.path}\n`;
        exportText += `**Palabras:** ${doc.word_count || 'N/A'}\n`;
        exportText += `**Indexado:** ${doc.indexed_at || 'Desconocido'}\n\n`;
        exportText += `**Contenido:**\n\n${docText.text}\n\n`;
        exportText += `${'='.repeat(80)}\n\n`;
        
        processedCount++;
      } else {
        errorCount++;
      }
    } else {
      errorCount++;
    }
    
    // Pequeña pausa para no sobrecargar el servidor
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  console.log(`\n\n✅ Exportación completada!`);
  console.log(`📄 Documentos procesados: ${processedCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  
  // Guardar archivo
  try {
    fs.writeFileSync(OUTPUT_FILE, exportText);
    console.log(`💾 Archivo guardado: ${OUTPUT_FILE}`);
    
    // Mostrar estadísticas del archivo
    const stats = fs.statSync(OUTPUT_FILE);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Tamaño del archivo: ${fileSizeMB} MB`);
    
    // Contar líneas aproximadas
    const lines = exportText.split('\n').length;
    console.log(`📄 Líneas totales: ${lines.toLocaleString()}`);
    
    console.log(`\n🎉 ¡Listo para subir a Google Drive y usar en NotebookLM!`);
    
  } catch (error) {
    console.error('❌ Error guardando archivo:', error.message);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  exportAllDocuments().catch(console.error);
}

module.exports = { exportAllDocuments };