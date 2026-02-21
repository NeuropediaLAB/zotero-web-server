const { exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const execPromise = promisify(exec);

class OCRIndexer {
    constructor(dbPath, cacheDir, webdavSync) {
        this.dbPath = dbPath;
        this.cacheDir = cacheDir;
        this.webdavSync = webdavSync;
        this.isIndexing = false;
        this.progress = { current: 0, total: 0, currentFile: '' };
        this.db = null;
        
        // Inicializar base de datos
        this.initDatabase();
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error abriendo BD de indexación:', err);
                    reject(err);
                    return;
                }
                
                // Crear tabla si no existe
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS documents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        storage_key TEXT UNIQUE NOT NULL,
                        filename TEXT NOT NULL,
                        webdav_path TEXT NOT NULL,
                        content TEXT,
                        indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        file_size INTEGER,
                        pages INTEGER
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creando tabla documents:', err);
                        reject(err);
                    } else {
                        console.log('✅ Base de datos de indexación inicializada');
                        resolve();
                    }
                });
            });
        });
    }

    async getIndexedCount() {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve(0);
                return;
            }
            
            this.db.get('SELECT COUNT(*) as count FROM documents', [], (err, row) => {
                if (err) {
                    console.error('Error contando documentos indexados:', err);
                    resolve(0);
                } else {
                    resolve(row.count || 0);
                }
            });
        });
    }

    async isDocumentIndexed(storageKey) {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve(false);
                return;
            }
            
            this.db.get('SELECT id FROM documents WHERE storage_key = ?', [storageKey], (err, row) => {
                if (err) {
                    console.error('Error verificando documento:', err);
                    resolve(false);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    async indexPDF(storageKey, filename, webdavPath) {
        try {
            console.log(`🔍 Indexando: ${filename}`);
            
            // Descargar PDF de WebDAV a cache temporal
            const localPath = path.join(this.cacheDir, 'temp', `${storageKey}.pdf`);
            await fs.ensureDir(path.dirname(localPath));
            
            const downloaded = await this.webdavSync.downloadFile(webdavPath, localPath);
            if (!downloaded) {
                console.error(`❌ No se pudo descargar: ${webdavPath}`);
                return false;
            }

            // Extraer texto con OCR usando ocrmypdf
            const textOutputPath = path.join(this.cacheDir, 'temp', `${storageKey}.txt`);
            
            try {
                // Usar pdftotext primero (más rápido)
                await execPromise(`pdftotext "${localPath}" "${textOutputPath}"`);
                
                let content = await fs.readFile(textOutputPath, 'utf8');
                
                // Si está vacío o muy corto, usar OCR
                if (content.trim().length < 100) {
                    console.log('📸 Texto insuficiente, usando OCR...');
                    const ocrOutputPath = path.join(this.cacheDir, 'temp', `${storageKey}_ocr.pdf`);
                    await execPromise(`ocrmypdf --skip-text --force-ocr -l spa+eng "${localPath}" "${ocrOutputPath}"`);
                    await execPromise(`pdftotext "${ocrOutputPath}" "${textOutputPath}"`);
                    content = await fs.readFile(textOutputPath, 'utf8');
                    await fs.remove(ocrOutputPath);
                }
                
                // Obtener información del PDF
                const stats = await fs.stat(localPath);
                const pageInfo = await execPromise(`pdfinfo "${localPath}" | grep Pages`);
                const pages = parseInt(pageInfo.stdout.match(/Pages:\s+(\d+)/)?.[1] || 0);

                // Guardar en base de datos
                await this.saveIndexedDocument(storageKey, filename, webdavPath, content, stats.size, pages);
                
                // Limpiar archivos temporales
                await fs.remove(localPath);
                await fs.remove(textOutputPath);
                
                console.log(`✅ Indexado: ${filename} (${pages} páginas)`);
                return true;
                
            } catch (ocrError) {
                console.error(`❌ Error OCR en ${filename}:`, ocrError.message);
                // Limpiar archivos temporales
                await fs.remove(localPath).catch(() => {});
                await fs.remove(textOutputPath).catch(() => {});
                return false;
            }
            
        } catch (error) {
            console.error(`❌ Error indexando ${filename}:`, error);
            return false;
        }
    }

    async saveIndexedDocument(storageKey, filename, webdavPath, content, fileSize, pages) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Base de datos no inicializada'));
                return;
            }
            
            const query = `
                INSERT OR REPLACE INTO documents 
                (storage_key, filename, webdav_path, content, file_size, pages, indexed_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `;
            
            this.db.run(query, [storageKey, filename, webdavPath, content, fileSize, pages], (err) => {
                if (err) {
                    console.error('Error guardando documento indexado:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async searchInIndexedDocuments(searchTerm) {
        return new Promise((resolve) => {
            if (!this.db || !searchTerm) {
                resolve([]);
                return;
            }
            
            const query = `
                SELECT storage_key, filename, webdav_path, 
                       substr(content, instr(lower(content), lower(?)) - 50, 200) as snippet
                FROM documents 
                WHERE lower(content) LIKE lower(?)
                LIMIT 100
            `;
            
            const searchPattern = `%${searchTerm}%`;
            
            this.db.all(query, [searchTerm, searchPattern], (err, rows) => {
                if (err) {
                    console.error('Error buscando en documentos:', err);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async startIndexing(pdfsToIndex) {
        if (this.isIndexing) {
            console.log('⚠️ Ya hay una indexación en curso');
            return false;
        }

        this.isIndexing = true;
        this.progress = { current: 0, total: pdfsToIndex.length, currentFile: '' };
        
        console.log(`🚀 Iniciando indexación de ${pdfsToIndex.length} PDFs desde WebDAV`);

        // Procesar en lotes pequeños para no saturar
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < pdfsToIndex.length; i += BATCH_SIZE) {
            const batch = pdfsToIndex.slice(i, Math.min(i + BATCH_SIZE, pdfsToIndex.length));
            
            await Promise.all(batch.map(async (pdf) => {
                this.progress.currentFile = pdf.filename;
                const success = await this.indexPDF(pdf.storageKey, pdf.filename, pdf.webdavPath);
                if (success) {
                    this.progress.current++;
                }
            }));
        }

        this.isIndexing = false;
        this.progress = { current: 0, total: 0, currentFile: '' };
        console.log('✅ Indexación completada');
        
        return true;
    }

    getProgress() {
        return {
            isIndexing: this.isIndexing,
            ...this.progress,
            percentage: this.progress.total > 0 
                ? Math.round((this.progress.current / this.progress.total) * 100) 
                : 0
        };
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) console.error('Error cerrando BD:', err);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = OCRIndexer;
