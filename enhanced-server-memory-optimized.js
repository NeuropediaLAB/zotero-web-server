const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { exec } = require('child_process');
const EventEmitter = require('events');

const app = express();
const PORT = process.env.PORT || 8080;

// Configurar límites de memoria Node.js
process.setMaxListeners(0);

// Manejador global para promesas no capturadas
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    console.error('Promesa:', promise);
    // No salir del proceso, solo registrar el error
});

// Event emitter para sincronización
const syncEmitter = new EventEmitter();

// Configuración de directorios
const WEB_DIR = path.join(__dirname, 'web');
const STORAGE_DIR = process.env.STORAGE_DIR || '/home/arkantu/Zotero/storage';
const BIBLIOTECA_DIR = process.env.BIBLIOTECA_DIR || '/home/arkantu/Documentos/Zotero Biblioteca';
const ZOTERO_DB = process.env.ZOTERO_DB || '/home/arkantu/Zotero/zotero.sqlite';
// WebDAV Configuration
const ZoteroWebDAVSync = require('./webdav-sync');
let webdavSync = null;

if (process.env.WEBDAV_ENABLED === 'true') {
    webdavSync = new ZoteroWebDAVSync({
        webdavUrl: process.env.WEBDAV_URL || 'https://owncloud.serviciosylaboratoriodomestico.site/remote.php/dav/files/arkantu',
        username: process.env.WEBDAV_USERNAME || 'arkantu',
        password: process.env.WEBDAV_PASSWORD || 'akelarre',
        localBibliotecaDir: BIBLIOTECA_DIR,
        localZoteroDir: path.dirname(ZOTERO_DB)
    });
    console.log('WebDAV habilitado');
} else {
    console.log('WebDAV deshabilitado');
}

const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, 'data', 'cache');
const PDF_INDEX_FILE = path.join(CACHE_DIR, 'pdf-text-index.json');

console.log('🌐 Iniciando servidor Zotero mejorado...');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Reducido de 50mb
app.use(express.static(WEB_DIR));

// Estadísticas globales
let stats = {
    totalItems: 0,
    totalPDFs: 0,
    indexedPDFs: 0,
    syncStatus: 'Iniciando...',
    lastSync: new Date(),
    isIndexing: false
};

// Índice optimizado para memoria - usar Map en lugar de objeto
let pdfTextIndex = new Map();
let indexingQueue = [];
let currentIndexing = null;
let indexingProgress = { current: 0, total: 0 };

// Cache con límite de memoria
const CACHE_LIMIT = 1000;
let cacheKeys = [];

// Cache para búsquedas recientes (mejora velocidad)
const searchCache = new Map();
const SEARCH_CACHE_LIMIT = 100;
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Función optimizada para cargar índice
function loadPDFIndex() {
    try {
        if (fs.existsSync(PDF_INDEX_FILE)) {
            console.log('📚 Cargando índice de PDFs de forma optimizada...');
            
            const data = fs.readFileSync(PDF_INDEX_FILE, 'utf8');
            const indexData = JSON.parse(data);
            
            // Convertir a Map para mejor rendimiento de memoria
            pdfTextIndex = new Map(Object.entries(indexData));
            
            console.log(`📚 Cargado índice de ${pdfTextIndex.size} PDFs`);
            
            // Forzar garbage collection si está disponible
            if (global.gc) {
                global.gc();
            }
        }
    } catch (error) {
        console.error('Error cargando índice PDF:', error);
        pdfTextIndex = new Map();
    }
}

// Función optimizada para guardar índice
function savePDFIndex() {
    try {
        const indexObj = Object.fromEntries(pdfTextIndex);
        fs.writeFileSync(PDF_INDEX_FILE, JSON.stringify(indexObj, null, 2));
        
        // Limpiar cache si está muy grande
        if (cacheKeys.length > CACHE_LIMIT) {
            console.log('🧹 Limpiando cache para liberar memoria...');
            const keysToRemove = cacheKeys.splice(0, Math.floor(CACHE_LIMIT / 2));
            keysToRemove.forEach(key => {
                if (pdfTextIndex.has(key)) {
                    pdfTextIndex.delete(key);
                }
            });
        }
        
    } catch (error) {
        console.error('Error guardando índice PDF:', error);
    }
}

// Función para continuar indexando archivos no procesados
function continueIndexing() {
    if (stats.isIndexing) {
        console.log('🔄 Indexación ya en progreso...');
        return false;
    }

    try {
        const libraryFiles = getLibraryPDFs(BIBLIOTECA_DIR, 1, 10000);
        const unindexedFiles = libraryFiles.files.filter(file => !file.indexed);
        
        if (unindexedFiles.length === 0) {
            console.log('✅ Todos los archivos están indexados');
            return false;
        }

        console.log(`🔄 Continuando indexación: ${unindexedFiles.length} archivos pendientes`);
        
        // Añadir archivos no indexados a la cola (máximo 50 por lote)
        const batchSize = Math.min(unindexedFiles.length, 50);
        for (let i = 0; i < batchSize; i++) {
            addToIndexingQueue(unindexedFiles[i].path);
        }
        
        stats.totalPDFs = libraryFiles.total;
        indexingProgress.total = stats.totalPDFs;
        
        return true;
        
    } catch (error) {
        console.error('Error continuando indexación:', error);
        return false;
    }
}

// Función para extraer texto de PDF con control de memoria y soporte OCR mejorado v0.2
function extractPDFText(pdfPath, callback) {
    try {
        const pdfparse = require('pdf-parse');
        
        // Verificar tamaño del archivo ANTES de procesarlo
        const stats = fs.statSync(pdfPath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        // NUEVO: Detectar archivos vacíos o corruptos
        if (stats.size === 0) {
            console.log(`🚫 Archivo vacío (0 bytes), saltando: ${path.basename(pdfPath)}`);
            callback('Archivo vacío', null);
            return;
        }
        
        if (stats.size < 1024) { // Menor a 1KB, probablemente corrupto
            console.log(`🚫 Archivo muy pequeño (${stats.size} bytes), probablemente corrupto: ${path.basename(pdfPath)}`);
            callback('Archivo posiblemente corrupto', null);
            return;
        }
        
        if (fileSizeInMB > 100) {
            console.log(`⚠️ Archivo muy grande (${fileSizeInMB.toFixed(1)}MB), saltando: ${path.basename(pdfPath)}`);
            callback('Archivo demasiado grande', null);
            return;
        }
        
        // NUEVO: Verificar que sea realmente un PDF válido
        const buffer = fs.readFileSync(pdfPath);
        
        // Verificar cabecera PDF
        if (!buffer.toString('ascii', 0, 4).startsWith('%PDF')) {
            console.log(`🚫 No es un PDF válido, saltando: ${path.basename(pdfPath)}`);
            callback('Archivo no es PDF válido', null);
            return;
        }
        
        pdfparse(buffer).then(function(data) {
            try {
                // Si el texto extraído es muy corto, puede que sea un PDF de imágenes
                if (data.text.trim().length < 50) {
                    console.log(`📸 Texto muy corto (${data.text.trim().length} chars), intentando OCR para: ${path.basename(pdfPath)}`);
                    tryOCRImproved(pdfPath, callback);
                    return;
                }
                
                callback(null, data.text);
                // Forzar limpieza de memoria
                if (global.gc) {
                    global.gc();
                }
            } catch (callbackError) {
                console.log(`⚠️ Error en callback después de parse: ${path.basename(pdfPath)} - ${callbackError.message}`);
                tryOCRImproved(pdfPath, callback);
            }
        }).catch(function(error) {
            console.log(`📸 PDF parse falló (${error.message}), intentando OCR para: ${path.basename(pdfPath)}`);
            tryOCRImproved(pdfPath, callback);
        });
        
    } catch (error) {
        console.log(`📸 Error leyendo PDF (${error.message}), intentando OCR para: ${path.basename(pdfPath)}`);
        tryOCRImproved(pdfPath, callback);
    }
}

// Función mejorada para intentar OCR con tesseract v0.2
function tryOCRImproved(pdfPath, callback) {
    const { exec } = require('child_process');
    const os = require('os');
    const path = require('path');
    
    try {
        // NUEVO: Pre-validación antes de OCR
        const stats = fs.statSync(pdfPath);
        if (stats.size === 0) {
            console.log(`🚫 Saltando OCR para archivo vacío: ${path.basename(pdfPath)}`);
            callback('Archivo vacío - OCR saltado', null);
            return;
        }
        
        // Crear directorio temporal
        const tempDir = os.tmpdir();
        const baseFileName = path.basename(pdfPath, '.pdf').replace(/[^a-zA-Z0-9]/g, '_'); // Sanitizar nombre
        const tempImagePath = path.join(tempDir, `${baseFileName}_page`);
        const tempTextPath = path.join(tempDir, `${baseFileName}_ocr`);
        
        // NUEVO: Mejorar comando pdftoppm con validación de PDF
        const convertCmd = `pdftoppm -png -f 1 -l 1 -r 150 "${pdfPath}" "${tempImagePath}" 2>&1`;
        
        console.log(`🔧 Intentando conversión OCR para: ${path.basename(pdfPath)}`);
        
        exec(convertCmd, { timeout: 60000 }, (convertError, convertStdout, convertStderr) => {
            if (convertError) {
                // NUEVO: Clasificar tipos de errores
                if (convertStderr.includes('Document stream is empty')) {
                    console.log(`🚫 PDF corrupto detectado: ${path.basename(pdfPath)} - saltando OCR`);
                    callback('PDF corrupto - OCR saltado', null);
                } else if (convertStderr.includes('Syntax Error')) {
                    console.log(`🚫 Error sintaxis PDF: ${path.basename(pdfPath)} - archivo no válido`);
                    callback('PDF sintaxis inválida - OCR saltado', null);
                } else {
                    console.log(`⚠️ Error conversión OCR: ${path.basename(pdfPath)} - ${convertError.message}`);
                    callback('Error en conversión a imagen', null);
                }
                return;
            }
            
            // La imagen se guardará como tempImagePath-1.png
            const imagePath = `${tempImagePath}-1.png`;
            
            // NUEVO: Verificar que la imagen se creó correctamente
            if (!fs.existsSync(imagePath)) {
                console.log(`⚠️ No se generó imagen para OCR: ${path.basename(pdfPath)}`);
                callback('No se pudo generar imagen para OCR', null);
                return;
            }
            
            // Ejecutar tesseract OCR con configuración optimizada
            const ocrCmd = `tesseract "${imagePath}" "${tempTextPath}" -l spa+eng --dpi 150 --psm 1 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789áéíóúñüÁÉÍÓÚÑÜ.,;:()[]{}\"'-?!@#$%^&*+=<>/\\|_~ `;
            
            exec(ocrCmd, { timeout: 120000 }, (ocrError, ocrStdout, ocrStderr) => {
                try {
                    if (ocrError) {
                        console.log(`⚠️ Error en OCR Tesseract: ${path.basename(pdfPath)} - ${ocrError.message}`);
                        callback('Error en OCR Tesseract', null);
                        return;
                    }
                    
                    // Leer el texto extraído
                    const textFilePath = `${tempTextPath}.txt`;
                    if (fs.existsSync(textFilePath)) {
                        const ocrText = fs.readFileSync(textFilePath, 'utf8');
                        
                        // NUEVO: Validar calidad del texto OCR
                        if (ocrText.trim().length < 10) {
                            console.log(`⚠️ OCR produjo texto muy corto para: ${path.basename(pdfPath)} (${ocrText.length} chars)`);
                            callback('OCR texto insuficiente', null);
                        } else {
                            console.log(`✅ OCR exitoso: ${path.basename(pdfPath)} (${ocrText.length} caracteres)`);
                            callback(null, ocrText);
                        }
                        
                        // Limpiar archivos temporales
                        try {
                            fs.unlinkSync(imagePath);
                            fs.unlinkSync(textFilePath);
                        } catch (cleanupError) {
                            // Ignorar errores de limpieza
                        }
                        
                    } else {
                        console.log(`⚠️ No se pudo generar texto OCR para: ${path.basename(pdfPath)}`);
                        callback('No se pudo generar texto OCR', null);
                    }
                } catch (readError) {
                    console.log(`⚠️ Error leyendo resultado OCR: ${path.basename(pdfPath)} - ${readError.message}`);
                    callback('Error leyendo resultado OCR', null);
                }
            });
        });
        
    } catch (error) {
        console.log(`⚠️ Error en proceso OCR: ${path.basename(pdfPath)} - ${error.message}`);
        callback('Error en proceso OCR', null);
    }
}

// Procesamiento optimizado de cola de indexación
function processIndexingQueue() {
    if (currentIndexing || indexingQueue.length === 0) {
        // Si no hay archivos en cola, intentar continuar con más archivos
        if (!currentIndexing && indexingQueue.length === 0) {
            setTimeout(() => {
                const continued = continueIndexing();
                if (!continued) {
                    console.log('🏁 Indexación completada');
                }
            }, 2000);
        }
        return;
    }

    currentIndexing = indexingQueue.shift();
    stats.isIndexing = true;
    
    indexingProgress.current = stats.indexedPDFs + 1;
    console.log(`🔍 Indexando: ${path.basename(currentIndexing)} (${indexingProgress.current}/${indexingProgress.total})`);

    extractPDFText(currentIndexing, (error, text) => {
        if (error) {
            console.log(`⚠️ Sin texto: ${path.basename(currentIndexing)} (${error})`);
            
            pdfTextIndex.set(currentIndexing, {
                text: '',
                indexed: true,
                hasText: false,
                lastModified: Date.now(),
                error: error
            });
        } else {
            console.log(`✅ Indexado: ${path.basename(currentIndexing)} (${text.length} caracteres)`);
            
            // Limitar texto para ahorrar memoria
            pdfTextIndex.set(currentIndexing, {
                text: text.substring(0, 10000), // Solo los primeros 10k caracteres
                indexed: true,
                hasText: true,
                lastModified: Date.now()
            });
        }

        // Guardar cada 5 archivos
        if (pdfTextIndex.size % 5 === 0) {
            savePDFIndex();
        }
        
        stats.indexedPDFs = pdfTextIndex.size;
        
        currentIndexing = null;
        stats.isIndexing = false;
        
        // Pausa más larga para permitir garbage collection
        setTimeout(() => {
            if (global.gc && pdfTextIndex.size % 50 === 0) {
                global.gc();
            }
            processIndexingQueue();
        }, 1000);
    });
}

// Función para añadir PDFs a la cola
function addToIndexingQueue(pdfPath) {
    if (!pdfTextIndex.has(pdfPath) && !indexingQueue.includes(pdfPath)) {
        indexingQueue.push(pdfPath);
        setTimeout(processIndexingQueue, 200);
    }
}

// Función para obtener PDFs con paginación y filtrado por carpeta
function getLibraryPDFs(dir = BIBLIOTECA_DIR, page = 1, limit = 50, folderFilter = null) {
    const files = [];
    const skip = (page - 1) * limit;
    let count = 0;
    
    try {
        function scanDirectory(currentDir) {
            if (count >= skip + limit) return;
            
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
                if (count >= skip + limit) break;
                
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (item.toLowerCase().endsWith('.pdf')) {
                    let includeFile = true;
                    
                    // Si hay filtro de carpeta, verificar que el archivo esté en esa carpeta
                    if (folderFilter) {
                        const relativePath = path.relative(dir, fullPath);
                        const fileFolder = path.dirname(relativePath);
                        
                        // Normalizar las rutas para comparación
                        const normalizedFileFolder = fileFolder === '.' ? '' : fileFolder.replace(/\\/g, '/');
                        const normalizedFolderFilter = decodeURIComponent(folderFilter.replace(/\\/g, '/'));
                        
                        includeFile = normalizedFileFolder === normalizedFolderFilter;
                    }
                    
                    if (includeFile) {
                        if (count >= skip) {
                            files.push({
                                name: item,
                                path: fullPath,
                                size: stat.size,
                                modified: stat.mtime,
                                indexed: pdfTextIndex.has(fullPath),
                                hasPdf: true
                            });
                        }
                        count++;
                    }
                }
            }
        }
        
        scanDirectory(dir);
    } catch (error) {
        console.error('Error escaneando directorio:', error);
    }
    
    return {
        files,
        total: count,
        page,
        hasMore: count > skip + limit
    };
}

// Función para obtener entradas de Zotero sin PDF
function getZoteroEntriesWithoutPDF(limit = 100) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve([]);
            return;
        }
        
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo DB Zotero:', err);
                resolve([]);
                return;
            }
        });
        
        const query = `
            SELECT 
                i.itemID,
                i.dateAdded,
                i.dateModified,
                COALESCE(iv_title.value, 'Sin título') as title,
                COALESCE(iv_date.value, '') as year,
                COALESCE(iv_url.value, '') as url,
                it.typeName as type,
                GROUP_CONCAT(COALESCE(c.firstName || ' ' || c.lastName, ''), ', ') as authors
            FROM items i
            LEFT JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
            LEFT JOIN itemData id_title ON i.itemID = id_title.itemID 
                AND id_title.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'title')
            LEFT JOIN itemDataValues iv_title ON id_title.valueID = iv_title.valueID
            LEFT JOIN itemData id_date ON i.itemID = id_date.itemID 
                AND id_date.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'date')
            LEFT JOIN itemDataValues iv_date ON id_date.valueID = iv_date.valueID
            LEFT JOIN itemData id_url ON i.itemID = id_url.itemID 
                AND id_url.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'url')
            LEFT JOIN itemDataValues iv_url ON id_url.valueID = iv_url.valueID
            LEFT JOIN itemCreators ic ON i.itemID = ic.itemID
            LEFT JOIN creators c ON ic.creatorID = c.creatorID
            WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
                AND it.typeName NOT IN ('attachment', 'note', 'annotation')
                AND it.typeName IS NOT NULL
                AND i.itemID NOT IN (
                    SELECT parentItemID FROM itemAttachments 
                    WHERE contentType = 'application/pdf' 
                    AND parentItemID IS NOT NULL
                )
            GROUP BY i.itemID
            ORDER BY i.dateAdded DESC
            LIMIT ?
        `;
        
        db.all(query, [limit], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error consultando DB:', err);
                resolve([]);
                return;
            }
            
            resolve(rows || []);
        });
    });
}

// Función para obtener todas las entradas de Zotero (con y sin PDF)
function getAllZoteroEntries(limit = 1000) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve([]);
            return;
        }
        
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo DB Zotero:', err);
                resolve([]);
                return;
            }
        });
        
        const query = `
            SELECT 
                i.itemID,
                i.dateAdded,
                i.dateModified,
                COALESCE(iv_title.value, 'Sin título') as title,
                COALESCE(iv_date.value, '') as year,
                COALESCE(iv_url.value, '') as url,
                it.typeName as type,
                GROUP_CONCAT(COALESCE(c.firstName || ' ' || c.lastName, ''), ', ') as authors,
                ia.path as attachmentPath
            FROM items i
            LEFT JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
            LEFT JOIN itemData id_title ON i.itemID = id_title.itemID 
                AND id_title.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'title')
            LEFT JOIN itemDataValues iv_title ON id_title.valueID = iv_title.valueID
            LEFT JOIN itemData id_date ON i.itemID = id_date.itemID 
                AND id_date.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'date')
            LEFT JOIN itemDataValues iv_date ON id_date.valueID = iv_date.valueID
            LEFT JOIN itemData id_url ON i.itemID = id_url.itemID 
                AND id_url.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'url')
            LEFT JOIN itemDataValues iv_url ON id_url.valueID = iv_url.valueID
            LEFT JOIN itemCreators ic ON i.itemID = ic.itemID
            LEFT JOIN creators c ON ic.creatorID = c.creatorID
            LEFT JOIN itemAttachments ia ON i.itemID = ia.parentItemID 
                AND ia.contentType = 'application/pdf'
            WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
                AND it.typeName NOT IN ('attachment', 'note', 'annotation')
                AND it.typeName IS NOT NULL
            GROUP BY i.itemID
            ORDER BY i.dateAdded DESC
            LIMIT ?
        `;
        
        db.all(query, [limit], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error consultando DB:', err);
                resolve([]);
                return;
            }
            
            // Procesar resultados para añadir flag hasPdf
            const entries = (rows || []).map(row => ({
                ...row,
                hasPdf: row.attachmentPath ? true : false
            }));
            
            resolve(entries);
        });
    });
}

// Búsqueda híbrida optimizada: contenido indexado + nombres de archivo
function searchInPDFs(query, limit = 50) {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const results = [];
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    // Precompilar expresiones regulares para mejor rendimiento
    const termPatterns = searchTerms.map(term => {
        // Escapar caracteres especiales de regex
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'gi');
    });
    
    // 1. Buscar en contenido indexado (optimizado con early exit)
    const contentResults = [];
    const maxContentResults = Math.min(limit * 2, 100); // Limitar búsqueda en contenido
    
    for (let [filePath, data] of pdfTextIndex) {
        if (contentResults.length >= maxContentResults) break;
        
        if (data.text && data.hasText) {
            const textLower = data.text.toLowerCase();
            
            // Búsqueda rápida con includes antes de regex
            const hasAnyTerm = searchTerms.some(term => textLower.includes(term));
            if (!hasAnyTerm) continue;
            
            // Calcular score solo si tiene algún término
            let score = 0;
            for (let pattern of termPatterns) {
                const matches = textLower.match(pattern);
                if (matches) score += matches.length;
            }

            if (score > 0) {
                const snippet = extractSnippet(data.text, searchTerms[0], 200); // 200 palabras
                contentResults.push({
                    file: path.basename(filePath),
                    path: filePath,
                    name: path.basename(filePath),
                    score: score + 10, // Bonus por contenido indexado
                    preview: snippet,
                    context: snippet,
                    snippet: snippet,
                    source: 'content',
                    indexed: true
                });
            }
        }
    }

    // 2. Buscar en nombres de archivo (optimizado con Set para duplicados)
    const addedPaths = new Set(contentResults.map(r => r.path));
    const filenameResults = [];
    
    try {
        const allPdfs = getLibraryPDFs(BIBLIOTECA_DIR, 1, limit * 2);
        
        for (let file of allPdfs.files) {
            if (filenameResults.length >= limit) break;
            if (addedPaths.has(file.path)) continue;
            
            const fileName = path.basename(file.name).toLowerCase();
            const fileNameNoExt = fileName.replace('.pdf', '');
            
            // Búsqueda rápida con includes
            const hasAnyTerm = searchTerms.some(term => fileNameNoExt.includes(term));
            if (!hasAnyTerm) continue;
            
            // Calcular score si tiene algún término
            let score = 0;
            for (let pattern of termPatterns) {
                const matches = fileNameNoExt.match(pattern);
                if (matches) score += matches.length * 5; // Peso para nombres de archivo
            }

            if (score > 0) {
                filenameResults.push({
                    file: file.name,
                    path: file.path,
                    name: file.name,
                    score,
                    preview: `Encontrado en nombre de archivo: "${file.name}"`,
                    snippet: `Encontrado en nombre de archivo: "${file.name}"`,
                    context: `Encontrado en nombre de archivo: "${file.name}"`,
                    source: 'filename',
                    indexed: pdfTextIndex.has(file.path)
                });
            }
        }
    } catch (error) {
        console.error('Error buscando en nombres de archivo:', error);
    }

    // Combinar y ordenar resultados por score
    return [...contentResults, ...filenameResults]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// Función para extraer snippet
function extractSnippet(text, term, words = 200) {
    const termIndex = text.toLowerCase().indexOf(term.toLowerCase());
    if (termIndex === -1) {
        // Si no se encuentra el término, devolver las primeras palabras
        const wordsArray = text.split(/\s+/).slice(0, words);
        return wordsArray.join(' ') + (text.split(/\s+/).length > words ? '...' : '');
    }
    
    // Encontrar el inicio y fin basado en palabras
    const wordsArray = text.split(/\s+/);
    const textBeforeTerm = text.substring(0, termIndex);
    const wordsBefore = textBeforeTerm.split(/\s+/).length;
    
    // Tomar 'words/2' palabras antes y después del término
    const halfWords = Math.floor(words / 2);
    const startWordIndex = Math.max(0, wordsBefore - halfWords);
    const endWordIndex = Math.min(wordsArray.length, wordsBefore + halfWords);
    
    const snippet = wordsArray.slice(startWordIndex, endWordIndex).join(' ');
    const prefix = startWordIndex > 0 ? '...' : '';
    const suffix = endWordIndex < wordsArray.length ? '...' : '';
    
    return prefix + snippet + suffix;
}

// Función para construir árbol de carpetas
function buildFolderTree(dir, baseDir = dir, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];
    
    try {
        const items = fs.readdirSync(dir);
        const folders = [];
        
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            try {
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory() && !item.startsWith('.')) {
                    const relativePath = path.relative(baseDir, itemPath);
                    const pdfCount = countPDFsInDirectory(itemPath);
                    
                    const folderNode = {
                        name: item,
                        path: relativePath,
                        type: 'folder',
                        pdfCount: pdfCount,
                        children: buildFolderTree(itemPath, baseDir, maxDepth, currentDepth + 1)
                    };
                    
                    folders.push(folderNode);
                }
            } catch (itemError) {
                // Ignorar archivos/carpetas con problemas de permisos
            }
        });
        
        return folders.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error(`Error leyendo directorio ${dir}:`, error);
        return [];
    }
}

// Función para contar PDFs en un directorio recursivamente
function countPDFsInDirectory(dir, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return 0;
    
    try {
        const items = fs.readdirSync(dir);
        let count = 0;
        
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            try {
                const stat = fs.statSync(itemPath);
                if (stat.isFile() && item.toLowerCase().endsWith('.pdf')) {
                    count++;
                } else if (stat.isDirectory() && !item.startsWith('.')) {
                    count += countPDFsInDirectory(itemPath, maxDepth, currentDepth + 1);
                }
            } catch (itemError) {
                // Ignorar archivos con problemas de permisos
            }
        });
        
        return count;
    } catch (error) {
        return 0;
    }
}

// ============================================================================
// WEBDAV OCR INDEXING MODULE
// ============================================================================

let indexingState = {
    isIndexing: false,
    currentPDF: null,
    processed: 0,
    total: 0,
    success: 0,
    failed: 0,
    startTime: null,
    errors: []
};

async function indexPDFsFromWebDAV(limit = 50, skipExisting = true) {
    if (indexingState.isIndexing) {
        return { error: 'Ya hay una indexación en curso' };
    }

    if (!webdavSync) {
        return { error: 'WebDAV no está habilitado' };
    }

    indexingState.isIndexing = true;
    indexingState.processed = 0;
    indexingState.success = 0;
    indexingState.failed = 0;
    indexingState.startTime = new Date();
    indexingState.errors = [];

    console.log(`🔍 Iniciando indexación OCR de ${limit} PDFs desde WebDAV...`);

    try {
        await webdavSync.init();
        
        // Obtener lista de PDFs desde BD
        const pdfList = await getPDFListFromDatabase(limit);
        indexingState.total = pdfList.length;
        
        console.log(`�� Total de PDFs a procesar: ${pdfList.length}`);

        // Procesar en lotes pequeños para no saturar memoria
        const batchSize = 5;
        for (let i = 0; i < pdfList.length; i += batchSize) {
            const batch = pdfList.slice(i, Math.min(i + batchSize, pdfList.length));
            
            await Promise.all(batch.map(async (pdfInfo) => {
                try {
                    indexingState.currentPDF = pdfInfo.filename;
                    
                    // Verificar si ya está indexado usando webdavPath
                    if (skipExisting && pdfTextIndex.has(pdfInfo.webdavPath)) {
                        console.log(`⏭️  Ya indexado: ${pdfInfo.filename}`);
                        indexingState.processed++;
                        return;
                    }

                    // Descargar PDF a cache temporal
                    console.log(`⬇️  Descargando: ${pdfInfo.filename}`);
                    const localPath = await webdavSync.downloadPDFToCache(pdfInfo.webdavPath);
                    
                    if (localPath && fs.existsSync(localPath)) {
                        // Indexar con webdavPath como key
                        console.log(`🔎 Extrayendo texto: ${pdfInfo.filename}`);
                        await indexPDFWithOCR(localPath, pdfInfo.webdavPath);
                        indexingState.success++;
                        console.log(`✅ Indexado: ${pdfInfo.filename}`);
                    } else {
                        indexingState.failed++;
                        indexingState.errors.push(`No se pudo descargar: ${pdfInfo.filename}`);
                        console.log(`❌ Falló descarga: ${pdfInfo.filename}`);
                    }
                } catch (error) {
                    indexingState.failed++;
                    indexingState.errors.push(`Error ${pdfInfo.filename}: ${error.message}`);
                    console.error(`❌ Error indexando ${pdfInfo.filename}:`, error.message);
                }
                
                indexingState.processed++;
            }));

            // Pausa entre lotes
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Guardar índice periódicamente
            if (i % 10 === 0) {
                savePDFIndex();
                console.log(`💾 Progreso guardado: ${indexingState.processed}/${indexingState.total}`);
            }
        }

        // Guardar índice final
        savePDFIndex();

        const duration = Math.round((Date.now() - indexingState.startTime.getTime()) / 1000);
        console.log(`✅ Indexación completada en ${duration}s: ${indexingState.success} exitosos, ${indexingState.failed} fallidos`);

        indexingState.isIndexing = false;
        return {
            success: true,
            processed: indexingState.processed,
            successful: indexingState.success,
            failed: indexingState.failed,
            duration: duration
        };

    } catch (error) {
        indexingState.isIndexing = false;
        console.error('❌ Error en indexación WebDAV:', error);
        return { error: error.message };
    }
}

async function getPDFListFromDatabase(limit = 50) {
    return new Promise((resolve) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve([]);
            return;
        }

        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo BD:', err);
                resolve([]);
                return;
            }
        });

        const query = `
            SELECT i.key as storageKey, ia.path
            FROM itemAttachments ia
            JOIN items i ON ia.itemID = i.itemID
            WHERE ia.contentType = 'application/pdf'
            LIMIT ?
        `;

        db.all(query, [limit], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error consultando PDFs:', err);
                resolve([]);
                return;
            }

            const pdfList = rows.map(row => ({
                webdavPath: `/zotero/storage/${row.storageKey}/${path.basename(row.path)}`,
                storageKey: row.storageKey,
                filename: path.basename(row.path)
            }));

            console.log(`Encontrados ${pdfList.length} PDFs en BD`);
            resolve(pdfList);
        });
    });
}


async function indexPDFWithOCR(pdfPath, webdavPath = null) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(pdfPath)) {
            reject(new Error('PDF no encontrado'));
            return;
        }

        // Usar la función existente extractPDFText que incluye OCR
        extractPDFText(pdfPath, (err, text) => {
            if (err) {
                console.error(`Error extrayendo texto de ${path.basename(pdfPath)}:`, err.message);
                reject(err);
            } else {
                // Guardar en el índice (limitar a 10k caracteres)
                const truncatedText = text.substring(0, 10000);
                pdfTextIndex.set(pdfPath, truncatedText);
                cacheKeys.push(pdfPath);
                
                // Limpiar cache si está muy grande
                if (cacheKeys.length > CACHE_LIMIT) {
                    const keysToRemove = cacheKeys.splice(0, Math.floor(CACHE_LIMIT / 2));
                    keysToRemove.forEach(key => {
                        if (pdfTextIndex.has(key)) {
                            pdfTextIndex.delete(key);
                        }
                    });
                }
                
                resolve();
            }
        });
    });
}

function getIndexingStatus() {
    const status = {
        ...indexingState,
        estimatedTimeRemaining: null
    };
    
    if (indexingState.isIndexing && indexingState.processed > 0) {
        const elapsed = Date.now() - indexingState.startTime.getTime();
        const avgTimePerPDF = elapsed / indexingState.processed;
        const remaining = indexingState.total - indexingState.processed;
        status.estimatedTimeRemaining = Math.round((avgTimePerPDF * remaining) / 1000);
    }
    
    return status;
}


// API Routes


// WebDAV Basic Endpoints
app.post('/api/webdav/sync-database', async (req, res) => {
    try {
        const result = await webdavSync.syncDatabase();
        res.json(result ? { success: true, message: 'DB sincronizada' } : { error: 'Error sync DB' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/webdav/sync-pdfs', async (req, res) => {
    try {
        const limit = parseInt(req.body.limit) || 100;
        const result = await webdavSync.syncAllPDFs(limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/webdav/status', async (req, res) => {
    try {
        const connected = await webdavSync.testConnection();
        res.json({ enabled: true, connected: connected });
    } catch (error) {
        res.json({ enabled: true, connected: false, error: error.message });
    }
});



// Endpoint para iniciar indexación de PDFs desde WebDAV
app.post('/api/webdav/index-pdfs', async (req, res) => {
    try {
        if (!webdavSync) {
            return res.status(503).json({ error: 'WebDAV no habilitado' });
        }

        const limit = parseInt(req.body.limit) || 50;
        const skipExisting = req.body.skipExisting !== false;

        console.log('Iniciando indexación WebDAV:', { limit, skipExisting });

        // Iniciar indexación en background
        indexPDFsFromWebDAV(limit, skipExisting).then(result => {
            console.log('Indexación finalizada:', result);
        }).catch(error => {
            console.error('Error en indexación:', error);
        });

        res.json({
            success: true,
            message: 'Indexación iniciada',
            status: getIndexingStatus()
        });
    } catch (error) {
        console.error('Error iniciando indexación:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para obtener estado de indexación
app.get('/api/webdav/indexing-status', (req, res) => {
    try {
        const status = getIndexingStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para detener indexación
app.post('/api/webdav/stop-indexing', (req, res) => {
    try {
        if (indexingState.isIndexing) {
            indexingState.isIndexing = false;
            res.json({ success: true, message: 'Indexación detenida' });
        } else {
            res.json({ success: false, message: 'No hay indexación en curso' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Cache para estadísticas con timestamp
let statsCache = {
    data: null,
    timestamp: 0,
    ttl: 10000 // Cache válido por 10 segundos
};

app.get('/api/stats', async (req, res) => {
    try {
        const now = Date.now();
        
        // Si el cache es válido, usarlo
        if (statsCache.data && (now - statsCache.timestamp) < statsCache.ttl) {
            return res.json(statsCache.data);
        }
        
        // Actualizar conteo de PDFs desde BD
        try {
            const dbCount = await countPDFsFromDatabase();
            stats.totalPDFs = dbCount;
        } catch (error) {
            console.error('Error actualizando conteo de PDFs:', error);
            // Mantener el valor anterior si hay error
        }
        
        // Actualizar estadísticas
        stats.indexedPDFs = pdfTextIndex.size;
        stats.syncStatus = stats.isIndexing ? 'Indexando...' : 'Listo';
        
        // Solo actualizar lastSync cuando realmente se actualizaron las estadísticas
        if (!stats.lastSync || (now - new Date(stats.lastSync).getTime()) > 5000) {
            stats.lastSync = new Date();
        }
        
        const currentStats = {
            ...stats,
            memoryUsage: process.memoryUsage()
        };
        
        // Actualizar cache
        statsCache.data = currentStats;
        statsCache.timestamp = now;
        
        res.json(currentStats);
    } catch (error) {
        console.error('Error en /api/stats:', error);
        // Enviar stats básicos en caso de error
        res.json({
            ...stats,
            indexedPDFs: pdfTextIndex.size,
            lastSync: stats.lastSync || new Date(),
            syncStatus: 'Error',
            memoryUsage: process.memoryUsage()
        });
    }
});

// Endpoint para obtener estructura de carpetas
app.get('/api/folder-tree', (req, res) => {
    try {
        console.log('📁 Generando árbol de carpetas...');
        const folderTree = buildFolderTree(BIBLIOTECA_DIR);
        res.json({
            root: {
                name: 'Biblioteca',
                path: '',
                type: 'folder',
                pdfCount: countPDFsInDirectory(BIBLIOTECA_DIR),
                children: folderTree
            }
        });
    } catch (error) {
        console.error('Error generando árbol de carpetas:', error);
        res.status(500).json({ error: 'Error generando árbol de carpetas' });
    }
});

// Endpoint para búsqueda de texto en PDFs
app.get('/api/search-text', (req, res) => {
    try {
        // Aceptar tanto 'q' como 'query' para compatibilidad
        const query = req.query.q || req.query.query;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        
        if (!query) {
            return res.json({ results: [], total: 0 });
        }

        const results = searchInPDFs(query, limit);
        res.json({ 
            results, 
            total: results.length,
            query,
            limited: results.length === limit
        });
    } catch (error) {
        console.error('Error en búsqueda de texto:', error);
        res.status(500).json({ error: 'Error en búsqueda de texto' });
    }
});

app.get('/api/search', (req, res) => {
    try {
        const query = req.query.q;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        
        if (!query) {
            return res.json({ results: [], total: 0 });
        }

        // Crear clave de cache
        const cacheKey = `${query.toLowerCase()}_${limit}`;
        
        // Verificar cache
        if (searchCache.has(cacheKey)) {
            const cached = searchCache.get(cacheKey);
            // Verificar TTL
            if (Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
                console.log('🎯 Búsqueda desde cache:', query);
                return res.json(cached.data);
            } else {
                searchCache.delete(cacheKey);
            }
        }

        const results = searchInPDFs(query, limit);
        const response = { 
            results, 
            total: results.length,
            query,
            limited: results.length === limit,
            cached: false
        };
        
        // Guardar en cache
        searchCache.set(cacheKey, {
            data: { ...response, cached: true },
            timestamp: Date.now()
        });
        
        // Limpiar cache viejo si es muy grande
        if (searchCache.size > SEARCH_CACHE_LIMIT) {
            const oldestKey = searchCache.keys().next().value;
            searchCache.delete(oldestKey);
        }
        
        res.json(response);
    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

// API para IA (ChatGPT/GPT Actions) - Búsqueda semántica con contexto completo
app.post('/api/ai/search', (req, res) => {
    try {
        const { query, max_results = 10, include_full_text = false } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                error: 'Query parameter is required',
                usage: 'POST /api/ai/search with body: { "query": "your search term", "max_results": 10, "include_full_text": false }'
            });
        }

        const results = searchInPDFs(query, max_results);
        
        // Enriquecer resultados para IA
        const enrichedResults = results.map(result => {
            const baseResult = {
                title: result.name || result.file,
                relevance_score: result.score,
                context: result.context || result.snippet || result.preview,
                source_type: result.source,
                is_indexed: result.indexed || false,
                file_path: result.path
            };
            
            // Si se solicita texto completo y está indexado, incluirlo
            if (include_full_text && result.indexed && pdfTextIndex.has(result.path)) {
                const fullData = pdfTextIndex.get(result.path);
                baseResult.full_text = fullData.text;
            }
            
            return baseResult;
        });
        
        res.json({
            query: query,
            total_results: enrichedResults.length,
            results: enrichedResults,
            metadata: {
                timestamp: new Date().toISOString(),
                total_indexed_documents: pdfTextIndex.size,
                search_type: 'semantic'
            }
        });
    } catch (error) {
        console.error('Error en API de IA:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// API para IA - Obtener documento completo por ruta
app.post('/api/ai/document', (req, res) => {
    try {
        const { path: docPath } = req.body;
        
        if (!docPath) {
            return res.status(400).json({ 
                error: 'Path parameter is required',
                usage: 'POST /api/ai/document with body: { "path": "/path/to/document.pdf" }'
            });
        }

        if (!pdfTextIndex.has(docPath)) {
            return res.status(404).json({ 
                error: 'Document not found or not indexed',
                path: docPath 
            });
        }
        
        const docData = pdfTextIndex.get(docPath);
        
        res.json({
            path: docPath,
            filename: path.basename(docPath),
            indexed_at: docData.indexedAt || 'unknown',
            text: docData.text,
            has_text: docData.hasText || false,
            word_count: docData.text ? docData.text.split(/\s+/).length : 0
        });
    } catch (error) {
        console.error('Error obteniendo documento:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// API para IA - Listar documentos indexados
app.get('/api/ai/documents', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
        const offset = parseInt(req.query.offset) || 0;
        
        const allDocs = Array.from(pdfTextIndex.entries())
            .map(([path, data]) => ({
                path: path,
                filename: path.split('/').pop(),
                indexed: data.hasText || false,
                indexed_at: data.indexedAt || 'unknown',
                word_count: data.text ? data.text.split(/\s+/).length : 0
            }))
            .slice(offset, offset + limit);
        
        res.json({
            total: pdfTextIndex.size,
            offset: offset,
            limit: limit,
            documents: allDocs
        });
    } catch (error) {
        console.error('Error listando documentos:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

app.get('/api/pdfs', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const folder = req.query.folder;
        
        const result = getLibraryPDFs(BIBLIOTECA_DIR, page, limit, folder);
        res.json(result);
    } catch (error) {
        console.error('Error listando PDFs:', error);
        res.status(500).json({ error: 'Error listando PDFs' });
    }
});

// Endpoint para resolver ruta de PDF desde Zotero attachment path
app.get('/api/resolve-pdf', async (req, res) => {
    try {
        let attachmentPath = req.query.path;
        
        if (!attachmentPath) {
            return res.status(400).json({ error: 'Path parameter is required' });
        }
        
        console.log('Resolviendo PDF:', attachmentPath);
        
        // Limpiar prefijo storage: si existe
        if (attachmentPath.startsWith("storage:")) {
            attachmentPath = attachmentPath.substring(8);
        }

        const fileName = path.basename(attachmentPath);
        let storageKey = null;
        
        // Si es ruta absoluta, buscar storage key en BD
        if (attachmentPath.startsWith('/') || attachmentPath.includes('Biblioteca')) {
            if (fs.existsSync(ZOTERO_DB)) {
                try {
                    const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY);
                    
                    await new Promise((resolve) => {
                        db.get('SELECT i.key FROM itemAttachments ia JOIN items i ON ia.itemID = i.itemID WHERE ia.path = ?', 
                            [attachmentPath], (err, row) => {
                            if (!err && row && row.key) {
                                storageKey = row.key;
                            }
                            db.close();
                            resolve();
                        });
                    });
                } catch (error) {
                    console.error('Error BD:', error);
                }
            }
        } else {
            // Extraer storage key de formato storage:KEY/file o storage:filename.pdf
            
            // Buscar KEY en el path (formato KEY/file.pdf)
            const pathParts = attachmentPath.split('/');
            for (const part of pathParts) {
                if (/^[A-Z0-9]{8}$/.test(part)) {
                    storageKey = part;
                    break;
                }
            }
            
            // Si no hay KEY, buscar por filename en BD
            if (!storageKey && fs.existsSync(ZOTERO_DB)) {
                try {
                    const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY);
                    const searchFilename = path.basename(attachmentPath);
                    
                    await new Promise((resolve) => {
                        db.get('SELECT i.key FROM itemAttachments ia JOIN items i ON ia.itemID = i.itemID WHERE ia.path LIKE ? OR ia.path = ?', 
                            ['%' + searchFilename, 'storage:' + searchFilename], (err, row) => {
                            if (!err && row && row.key) {
                                storageKey = row.key;
                            }
                            db.close();
                            resolve();
                        });
                    });
                } catch (error) {
                    console.error('Error BD:', error);
                }
            }
        }

        
        if (!storageKey) {
            console.log('No se pudo determinar storage key');
            return res.status(404).json({
                found: false,
                filename: fileName,
                message: 'Storage key no encontrado'
            });
        }
        
        console.log('Storage key:', storageKey);
        
        if (!webdavSync) {
            return res.status(503).json({ error: 'WebDAV no habilitado' });
        }
        
        // Construir path WebDAV
        const webdavPath = `/zotero/storage/${storageKey}/${fileName}`;
        
        // Verificar si existe en WebDAV
        const exists = await webdavSync.fileExists(webdavPath);
        
        if (!exists) {
            console.log('PDF no existe en WebDAV:', webdavPath);
            return res.status(404).json({
                found: false,
                filename: fileName,
                webdavPath: webdavPath,
                message: 'PDF no encontrado en WebDAV'
            });
        }
        
        // Descargar al cache temporal
        const localPath = await webdavSync.downloadPDFToCache(webdavPath);
        
        if (localPath) {
            const relativePath = path.relative(webdavSync.tempCacheDir, localPath);
            console.log('PDF disponible:', webdavPath);
            
            res.json({
                found: true,
                filename: fileName,
                storageKey: storageKey,
                webdavPath: webdavPath,
                cachePath: `/cache/${relativePath}`,
                fullPath: localPath
            });
        } else {
            console.log('Error descargando PDF');
            res.status(500).json({
                found: false,
                filename: fileName,
                message: 'Error descargando desde WebDAV'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// Endpoint para servir PDFs desde cache temporal
app.get('/cache/*', (req, res) => {
    try {
        const requestedPath = req.params[0];
        const cachePath = path.join(webdavSync.tempCacheDir, requestedPath);
        
        // Verificar que el archivo existe y está dentro del cache
        if (!cachePath.startsWith(webdavSync.tempCacheDir)) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        if (!fs.existsSync(cachePath)) {
            return res.status(404).json({ error: 'Archivo no encontrado en cache' });
        }
        
        console.log('Sirviendo desde cache:', requestedPath);
        res.sendFile(cachePath);
    } catch (error) {
        console.error('Error sirviendo archivo:', error);
        res.status(500).json({ error: error.message });
    }
});




// Ruta para servir archivos PDF
app.get('/pdf/:filename(*)', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(BIBLIOTECA_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error sirviendo PDF:', error);
        res.status(500).json({ error: 'Error sirviendo archivo' });
    }
});

// Ruta alternativa /biblioteca/ para servir archivos PDF
app.get('/biblioteca/:filename(*)', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(BIBLIOTECA_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error sirviendo PDF:', error);
        res.status(500).json({ error: 'Error sirviendo archivo' });
    }
});

// Endpoint para sincronización manual de archivos
app.post('/api/sync', (req, res) => {
    try {
        console.log('🔄 Iniciando sincronización manual...');
        
        if (stats.isIndexing) {
            return res.status(409).json({ 
                error: 'Indexación ya en progreso',
                isIndexing: true,
                progress: indexingProgress
            });
        }

        const continued = continueIndexing();
        
        if (continued) {
            res.json({ 
                success: true,
                message: 'Sincronización iniciada',
                isIndexing: stats.isIndexing,
                progress: indexingProgress,
                totalPDFs: stats.totalPDFs,
                indexedPDFs: stats.indexedPDFs
            });
        } else {
            res.json({
                success: true,
                message: 'Todos los archivos ya están indexados',
                isIndexing: false,
                totalPDFs: stats.totalPDFs,
                indexedPDFs: stats.indexedPDFs
            });
        }
        
    } catch (error) {
        console.error('Error en sincronización:', error);
        res.status(500).json({ error: 'Error iniciando sincronización' });
    }
});

// Endpoint para obtener entradas de Zotero sin PDF
app.get('/api/zotero/no-pdf', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const entries = await getZoteroEntriesWithoutPDF(limit);
        res.json({ 
            entries,
            total: entries.length
        });
    } catch (error) {
        console.error('Error obteniendo entradas sin PDF:', error);
        res.status(500).json({ error: 'Error obteniendo entradas sin PDF' });
    }
});

// Función para obtener el árbol de colecciones
function getCollectionsTree() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve([]);
            return;
        }
        
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo DB Zotero:', err);
                resolve([]);
                return;
            }
        });
        
        const query = `
            SELECT 
                collectionID,
                collectionName,
                parentCollectionID
            FROM collections
            WHERE collectionID NOT IN (SELECT collectionID FROM deletedCollections)
            ORDER BY collectionName
        `;
        
        db.all(query, [], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error consultando colecciones:', err);
                resolve([]);
                return;
            }
            
            // Construir árbol de colecciones
            const collectionsMap = new Map();
            const rootCollections = [];
            
            // Primera pasada: crear todos los nodos
            rows.forEach(row => {
                collectionsMap.set(row.collectionID, {
                    id: row.collectionID,
                    name: row.collectionName,
                    parentId: row.parentCollectionID,
                    children: []
                });
            });
            
            // Segunda pasada: construir jerarquía
            rows.forEach(row => {
                const collection = collectionsMap.get(row.collectionID);
                if (row.parentCollectionID && collectionsMap.has(row.parentCollectionID)) {
                    collectionsMap.get(row.parentCollectionID).children.push(collection);
                } else {
                    rootCollections.push(collection);
                }
            });
            
            resolve(rootCollections);
        });
    });
}

// Función para obtener items de una colección (incluyendo subcolecciones)
function getCollectionItems(collectionId, includeSubcollections = true) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve([]);
            return;
        }
        
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo DB Zotero:', err);
                resolve([]);
                return;
            }
        });
        
        // Primero obtener IDs de colección (incluyendo subcolecciones si es necesario)
        let collectionIds = [collectionId];
        
        if (includeSubcollections) {
            const getSubcollections = (parentId) => {
                return new Promise((res) => {
                    db.all(
                        'SELECT collectionID FROM collections WHERE parentCollectionID = ?',
                        [parentId],
                        (err, rows) => {
                            if (err || !rows) {
                                res([]);
                                return;
                            }
                            res(rows.map(r => r.collectionID));
                        }
                    );
                });
            };
            
            const getAllSubcollections = async (parentId) => {
                const direct = await getSubcollections(parentId);
                let all = [...direct];
                for (const id of direct) {
                    const subs = await getAllSubcollections(id);
                    all = all.concat(subs);
                }
                return all;
            };
            
            getAllSubcollections(collectionId).then(subIds => {
                collectionIds = collectionIds.concat(subIds);
                fetchItems();
            });
        } else {
            fetchItems();
        }
        
        async function fetchItems() {
            const placeholders = collectionIds.map(() => '?').join(',');
            const query = `
                SELECT 
                    i.itemID,
                    i.dateAdded,
                    i.dateModified,
                    COALESCE(iv_title.value, 'Sin título') as title,
                    COALESCE(iv_date.value, '') as year,
                    it.typeName as type,
                    GROUP_CONCAT(COALESCE(c.firstName || ' ' || c.lastName, ''), ', ') as authors,
                    ia.path as attachmentPath,
                    ci.collectionID
                FROM collectionItems ci
                JOIN items i ON ci.itemID = i.itemID
                LEFT JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
                LEFT JOIN itemData id_title ON i.itemID = id_title.itemID 
                    AND id_title.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'title')
                LEFT JOIN itemDataValues iv_title ON id_title.valueID = iv_title.valueID
                LEFT JOIN itemData id_date ON i.itemID = id_date.itemID 
                    AND id_date.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'date')
                LEFT JOIN itemDataValues iv_date ON id_date.valueID = iv_date.valueID
                LEFT JOIN itemCreators ic ON i.itemID = ic.itemID
                LEFT JOIN creators c ON ic.creatorID = c.creatorID
                LEFT JOIN itemAttachments ia ON i.itemID = ia.parentItemID 
                    AND ia.contentType = 'application/pdf'
                WHERE ci.collectionID IN (${placeholders})
                    AND i.itemID NOT IN (SELECT itemID FROM deletedItems)
                    AND it.typeName NOT IN ('attachment', 'note', 'annotation')
                    AND it.typeName IS NOT NULL
                GROUP BY i.itemID
                ORDER BY COALESCE(iv_title.value, 'Sin título')
            `;
            
            db.all(query, collectionIds, async (err, rows) => {
                db.close();
                
                if (err) {
                    console.error('Error consultando items de colección:', err);
                    resolve([]);
                    return;
                }
                
                // Primero normalizar paths
                const normalizedItems = (rows || []).map(row => {
                    // Normalizar attachmentPath a formato storage:filename.pdf
                    let normalizedPath = null;
                    if (row.attachmentPath) {
                        // Si es ruta completa local, extraer solo el filename
                        if (row.attachmentPath.startsWith('/')) {
                            const filename = row.attachmentPath.split('/').pop();
                            normalizedPath = 'storage:' + filename;
                        } 
                        // Si ya tiene formato storage:, mantenerlo
                        else if (row.attachmentPath.startsWith('storage:')) {
                            normalizedPath = row.attachmentPath;
                        }
                        // Cualquier otro caso, agregar storage:
                        else {
                            normalizedPath = 'storage:' + row.attachmentPath;
                        }
                    }
                    
                    return {
                        ...row,
                        attachmentPath: normalizedPath,
                        hasPdf: normalizedPath ? true : false,
                        pdfPath: normalizedPath
                    };
                });
                
                // Verificar disponibilidad en WebDAV para cada PDF (solo los primeros 100 por performance)
                const itemsWithAvailability = await Promise.all(normalizedItems.map(async (item) => {
                    if (item.hasPdf && item.key) {
                        try {
                            const available = await webdavSync.fileExists('/zotero/storage/' + item.key);
                            return {
                                ...item,
                                pdfAvailable: available,
                                pdfStatus: available ? 'available' : 'not_synced'
                            };
                        } catch (err) {
                            return {
                                ...item,
                                pdfAvailable: false,
                                pdfStatus: 'error'
                            };
                        }
                    }
                    return {
                        ...item,
                        pdfAvailable: false,
                        pdfStatus: 'no_pdf'
                    };
                }));
                
                resolve(itemsWithAvailability);
            });
        }
    });
}

// Endpoint para obtener árbol de colecciones
app.get('/api/zotero/collections', async (req, res) => {
    try {
        const collections = await getCollectionsTree();
        res.json({ 
            collections,
            total: collections.length
        });
    } catch (error) {
        console.error('Error obteniendo colecciones:', error);
        res.status(500).json({ error: 'Error obteniendo colecciones' });
    }
});

// Endpoint para buscar colecciones por nombre o por contenido de items
app.get('/api/zotero/collections/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        if (!query || query.trim().length < 2) {
            res.json({ collections: [], total: 0 });
            return;
        }
        
        const searchTerm = query.toLowerCase();
        
        // Buscar colecciones que coincidan por nombre o que contengan items con ese título
        const matchingCollections = await searchCollectionsByNameOrContent(searchTerm);
        
        res.json({ 
            collections: matchingCollections,
            total: matchingCollections.length,
            query: query
        });
    } catch (error) {
        console.error('Error buscando colecciones:', error);
        res.status(500).json({ error: 'Error buscando colecciones' });
    }
});

// Función para buscar colecciones por nombre o contenido
function searchCollectionsByNameOrContent(searchTerm) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve([]);
            return;
        }
        
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo DB Zotero:', err);
                resolve([]);
                return;
            }
        });
        
        const query = `
            SELECT DISTINCT
                c.collectionID,
                c.collectionName,
                c.parentCollectionID,
                COUNT(DISTINCT i.itemID) as itemCount
            FROM collections c
            LEFT JOIN collectionItems ci ON c.collectionID = ci.collectionID
            LEFT JOIN items i ON ci.itemID = i.itemID
            LEFT JOIN itemData id_title ON i.itemID = id_title.itemID 
                AND id_title.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'title')
            LEFT JOIN itemDataValues iv_title ON id_title.valueID = iv_title.valueID
            WHERE c.collectionID NOT IN (SELECT collectionID FROM deletedCollections)
                AND (
                    LOWER(c.collectionName) LIKE '%' || ? || '%'
                    OR LOWER(COALESCE(iv_title.value, '')) LIKE '%' || ? || '%'
                )
            GROUP BY c.collectionID
            ORDER BY 
                CASE WHEN LOWER(c.collectionName) LIKE '%' || ? || '%' THEN 0 ELSE 1 END,
                itemCount DESC,
                c.collectionName
            LIMIT 50
        `;
        
        db.all(query, [searchTerm, searchTerm, searchTerm], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error buscando colecciones:', err);
                resolve([]);
                return;
            }
            
            const results = (rows || []).map(row => ({
                id: row.collectionID,
                name: row.collectionName,
                parentId: row.parentCollectionID,
                itemCount: row.itemCount,
                matchType: row.collectionName.toLowerCase().includes(searchTerm) ? 'name' : 'content'
            }));
            
            resolve(results);
        });
    });
}

// Endpoint para obtener items de una colección específica
app.get('/api/zotero/collections/:id/items', async (req, res) => {
    try {
        const collectionId = parseInt(req.params.id);
        const includeSubcollections = req.query.includeSubcollections !== 'false';
        const items = await getCollectionItems(collectionId, includeSubcollections);
        res.json({ 
            items,
            total: items.length,
            withPdf: items.filter(i => i.hasPdf).length
        });
    } catch (error) {
        console.error('Error obteniendo items de colección:', error);
        res.status(500).json({ error: 'Error obteniendo items de colección' });
    }
});

// Endpoint para obtener todas las entradas de Zotero
app.get('/api/zotero/entries', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 1000, 5000);
        const entries = await getAllZoteroEntries(limit);
        res.json({ 
            entries,
            total: entries.length,
            withPdf: entries.filter(e => e.hasPdf).length,
            withoutPdf: entries.filter(e => !e.hasPdf).length
        });
    } catch (error) {
        console.error('Error obteniendo entradas de Zotero:', error);
        res.status(500).json({ error: 'Error obteniendo entradas de Zotero' });
    }
});

// Inicialización del servidor
async function countPDFsFromDatabase() {
    return new Promise((resolve) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve(0);
            return;
        }

        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo BD para contar:', err);
                resolve(0);
                return;
            }
        });

        const query = "SELECT COUNT(*) as count FROM itemAttachments WHERE contentType = 'application/pdf'";

        db.get(query, [], (err, row) => {
            db.close();
            if (err) {
                console.error('Error contando PDFs:', err);
                resolve(0);
            } else {
                resolve(row.count || 0);
            }
        });
    });
}


async function countPDFsFromDatabase() {
    return new Promise((resolve) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve(0);
            return;
        }

        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo BD para contar:', err);
                resolve(0);
                return;
            }
        });

        const query = "SELECT COUNT(*) as count FROM itemAttachments WHERE contentType = 'application/pdf'";

        db.get(query, [], (err, row) => {
            db.close();
            if (err) {
                console.error('Error contando PDFs:', err);
                resolve(0);
            } else {
                resolve(row.count || 0);
            }
        });
    });
}


async function countPDFsFromDatabase() {
    return new Promise((resolve) => {
        if (!fs.existsSync(ZOTERO_DB)) {
            resolve(0);
            return;
        }

        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo BD para contar:', err);
                resolve(0);
                return;
            }
        });

        const query = "SELECT COUNT(*) as count FROM itemAttachments WHERE contentType = 'application/pdf'";

        db.get(query, [], (err, row) => {
            db.close();
            if (err) {
                console.error('Error contando PDFs:', err);
                resolve(0);
            } else {
                resolve(row.count || 0);
            }
        });
    });
}


async function initServer() {
    console.log('🚀 Inicializando servidor...');
    
    // Crear directorio de caché si no existe
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        console.log(`📁 Creado directorio de caché: ${CACHE_DIR}`);
    }
    
    loadPDFIndex();
    console.log(`📚 Cargado índice de ${pdfTextIndex.size} PDFs`);
    
    try {
        const libraryFiles = getLibraryPDFs(BIBLIOTECA_DIR, 1, 10000);
        const dbCount = await countPDFsFromDatabase();
        stats.totalPDFs = dbCount;
        stats.indexedPDFs = pdfTextIndex.size;
        
        console.log(`📊 PDFs en BD: ${stats.totalPDFs}, indexados localmente: ${stats.indexedPDFs}`);
        
        // Añadir solo los primeros 100 archivos no indexados para evitar sobrecarga
        let addedToQueue = 0;
        libraryFiles.files.forEach(file => {
            if (!file.indexed && addedToQueue < 100) {
                addToIndexingQueue(file.path);
                addedToQueue++;
            }
        });
        
        indexingProgress.total = stats.totalPDFs;
        console.log(`⚠️ Procesando en lotes de 100 archivos. Para continuar la indexación, usa POST /api/sync o espera a que se procese automáticamente.`);
        
    } catch (error) {
        console.error('Error inicializando:', error);
    }
    
    stats.syncStatus = 'Listo';
    stats.lastSync = new Date();
}

// Iniciar servidor
initServer().then(() => {

// Endpoint para verificar disponibilidad de PDFs en WebDAV
app.get('/api/webdav/availability', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        
        // Obtener sample de PDFs de la BD
        const pdfs = await new Promise((resolve) => {
            if (!fs.existsSync(ZOTERO_DB)) {
                resolve([]);
                return;
            }
            
            const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY);
            db.all(
                'SELECT i.key, ia.path FROM itemAttachments ia JOIN items i ON ia.itemID = i.itemID WHERE ia.contentType = ? LIMIT ?',
                ['application/pdf', limit],
                (err, rows) => {
                    db.close();
                    resolve(err ? [] : rows);
                }
            );
        });
        
        let available = 0;
        let notAvailable = 0;
        
        // Verificar cada uno en WebDAV
        for (const pdf of pdfs) {
            if (pdf.key) {
                const exists = await webdavSync.fileExists('/zotero/storage/' + pdf.key);
                if (exists) {
                    available++;
                } else {
                    notAvailable++;
                }
            }
        }
        
        res.json({
            checked: pdfs.length,
            available,
            notAvailable,
            availabilityPercent: pdfs.length > 0 ? Math.round((available / pdfs.length) * 100) : 0
        });
        
    } catch (error) {
        console.error('Error verificando disponibilidad:', error);
        res.status(500).json({ error: error.message });
    }
});
    app.listen(PORT, () => {
        console.log(`🌟 Servidor iniciado en http://localhost:${PORT}`);
        console.log(`📁 Biblioteca: ${BIBLIOTECA_DIR}`);
        console.log(`🗄️ Storage: ${STORAGE_DIR}`);
        console.log(`💾 Caché persistente: ${CACHE_DIR}`);
        console.log(`📊 Sistema estadísticas: REST API + Polling manual`);
    });
}).catch((error) => {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
});

// Guardar índice periódicamente
setInterval(savePDFIndex, 5 * 60 * 1000);

// Manejo de cierre graceful
process.on('SIGTERM', () => {
    console.log('💾 Guardando índice antes de cerrar...');
    savePDFIndex();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('💾 Guardando índice antes de cerrar...');
    savePDFIndex();
    process.exit(0);
});