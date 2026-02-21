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
        tempCacheDir: path.join(__dirname, "data", "cache", "pdfs"),
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

// ============================================================================
// WEBDAV-ONLY INDEXING MODULE
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

// Función para obtener lista de PDFs desde BD con info WebDAV
async function getPDFListFromDatabase(limit = 50, offset = 0) {
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
            SELECT 
                i.key as storageKey,
                ia.path,
                ia.itemID
            FROM itemAttachments ia
            JOIN items i ON ia.itemID = i.itemID
            WHERE ia.contentType = 'application/pdf'
            LIMIT ? OFFSET ?
        `;

        db.all(query, [limit, offset], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error consultando PDFs:', err);
                resolve([]);
                return;
            }

            const pdfList = rows.map(row => ({
                storageKey: row.storageKey,
                filename: path.basename(row.path),
                webdavPath: `/zotero/storage/${row.storageKey}/${path.basename(row.path)}`,
                itemID: row.itemID
            }));

            resolve(pdfList);
        });
    });
}

// Función para indexar PDFs directamente desde WebDAV
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
        
        // Obtener lista de PDFs desde BD con paths WebDAV
        const pdfList = await getPDFListFromDatabase(limit, 0);
        indexingState.total = pdfList.length;
        
        console.log(`📚 Total de PDFs a procesar: ${pdfList.length}`);

        // Procesar en lotes de 5 PDFs
        const batchSize = 5;
        for (let i = 0; i < pdfList.length; i += batchSize) {
            const batch = pdfList.slice(i, Math.min(i + batchSize, pdfList.length));
            
            await Promise.all(batch.map(async (pdfInfo) => {
                try {
                    indexingState.currentPDF = pdfInfo.filename;
                    
                    // Verificar si ya está indexado usando webdavPath como key
                    if (skipExisting && pdfTextIndex.has(pdfInfo.webdavPath)) {
                        console.log(`⏭️  Ya indexado: ${pdfInfo.filename}`);
                        indexingState.processed++;
                        return;
                    }

                    // Descargar PDF al cache temporal
                    const localPath = await webdavSync.downloadPDFToCache(pdfInfo.webdavPath);
                    
                    if (localPath && fs.existsSync(localPath)) {
                        // Indexar el PDF con OCR
                        console.log(`🔎 Extrayendo texto: ${pdfInfo.filename}`);
                        await indexPDFWithOCR(localPath, pdfInfo.webdavPath);
                        indexingState.success++;
                        console.log(`✅ Indexado: ${pdfInfo.filename}`);
                    } else {
                        indexingState.failed++;
                        indexingState.errors.push(`No se pudo descargar: ${pdfInfo.filename}`);
                        console.log(`❌ Falló: ${pdfInfo.filename}`);
                    }
                } catch (error) {
                    indexingState.failed++;
                    indexingState.errors.push(`Error ${pdfInfo.filename}: ${error.message}`);
                    console.error(`❌ Error: ${pdfInfo.filename}:`, error.message);
                }
                
                indexingState.processed++;
            }));

            // Pausa entre lotes
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Guardar índice cada 10 PDFs
            if ((i + batchSize) % 10 === 0) {
                savePDFIndex();
                console.log(`💾 Progreso: ${indexingState.processed}/${indexingState.total}`);
            }
        }

        // Guardar índice final
        savePDFIndex();
        
        // Limpiar cache viejo
        await webdavSync.cleanOldCache();

        const duration = Math.round((Date.now() - indexingState.startTime.getTime()) / 1000);
        console.log(`✅ Indexación completada en ${duration}s: ${indexingState.success} OK, ${indexingState.failed} fallos`);

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
        console.error('❌ Error indexación:', error);
        return { error: error.message };
    }
}

// Indexar PDF usando webdavPath como key
async function indexPDFWithOCR(localPath, webdavPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(localPath)) {
            reject(new Error('PDF no encontrado'));
            return;
        }

        extractPDFText(localPath, (err, text) => {
            if (err) {
                console.error(`Error extrayendo texto:`, err.message);
                reject(err);
            } else {
                // Guardar en índice usando webdavPath como key
                const truncatedText = text.substring(0, 10000);
                pdfTextIndex.set(webdavPath, truncatedText);
                cacheKeys.push(webdavPath);
                
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