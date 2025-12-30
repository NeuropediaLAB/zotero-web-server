#!/usr/bin/env node

// Script para exportar documentos indexados para NotebookLM
const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3002';

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

// Exportar documentos por búsqueda
async function exportBySearch(query, outputFile) {
  console.log(`Buscando: "${query}"`);
  
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/ai/search',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const searchData = JSON.stringify({
    query: query,
    include_full_text: true,
    max_results: 50
  });
  
  try {
    const result = await makeRequest(options, searchData);
    
    if (result.results && result.results.length > 0) {
      let exportText = `# Documentos sobre: ${query}\n\n`;
      exportText += `Encontrados: ${result.total_results} documentos\n\n`;
      
      result.results.forEach((doc, index) => {
        exportText += `## ${index + 1}. ${doc.title}\n\n`;
        exportText += `**Relevancia:** ${doc.relevance_score}\n\n`;
        exportText += `**Ruta:** ${doc.file_path}\n\n`;
        
        if (doc.full_text) {
          exportText += `**Contenido:**\n${doc.full_text}\n\n`;
        } else {
          exportText += `**Contexto:** ${doc.context}\n\n`;
        }
        
        exportText += `---\n\n`;
      });
      
      fs.writeFileSync(outputFile, exportText);
      console.log(`✅ Exportado a: ${outputFile}`);
      console.log(`📄 ${result.results.length} documentos exportados`);
    } else {
      console.log('❌ No se encontraron documentos');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Exportar documento específico
async function exportDocument(documentPath, outputFile) {
  console.log(`Exportando: ${documentPath}`);
  
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
    
    if (result.text) {
      let exportText = `# ${result.filename}\n\n`;
      exportText += `**Ruta:** ${result.path}\n\n`;
      exportText += `**Indexado:** ${result.indexed_at}\n\n`;
      exportText += `**Palabras:** ${result.word_count}\n\n`;
      exportText += `---\n\n${result.text}`;
      
      fs.writeFileSync(outputFile, exportText);
      console.log(`✅ Documento exportado a: ${outputFile}`);
    } else {
      console.log('❌ No se pudo obtener el texto del documento');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Uso del script
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
Uso:
  node export_for_notebookllm.js search "término de búsqueda" output.txt
  node export_for_notebookllm.js document "/ruta/del/archivo.pdf" output.txt

Ejemplos:
  node export_for_notebookllm.js search "machine learning" ml_docs.txt
  node export_for_notebookllm.js search "neural networks" nn_research.txt
  node export_for_notebookllm.js document "/app/data/biblioteca/paper.pdf" paper.txt
  `);
  process.exit(1);
}

const mode = args[0];
const query = args[1];
const output = args[2];

if (mode === 'search') {
  exportBySearch(query, output);
} else if (mode === 'document') {
  exportDocument(query, output);
} else {
  console.error('Modo inválido. Use "search" o "document"');
  process.exit(1);
}