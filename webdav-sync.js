const fs = require('fs-extra');
const path = require('path');
const unzipper = require('unzipper');

class ZoteroWebDAVSync {
    constructor(config) {
        this.webdavUrl = config.webdavUrl;
        this.username = config.username;
        this.password = config.password;
        this.tempCacheDir = config.tempCacheDir || '/tmp/zotero-cache';
        this.localZoteroDir = config.localZoteroDir;
        this.client = null;
        this.initialized = false;
        
        // Crear directorio temporal
        fs.ensureDirSync(this.tempCacheDir);
    }
    
    async init() {
        if (!this.initialized) {
            const { createClient } = await import('webdav');
            this.client = createClient(this.webdavUrl, {
                username: this.username,
                password: this.password
            });
            this.initialized = true;
            console.log('Cliente WebDAV inicializado');
        }
    }
    
    async syncDatabase() {
        try {
            await this.init();
            console.log('Sincronizando base de datos desde WebDAV...');
            const remotePath = '/zotero/zotero.sqlite';
            const localPath = path.join(this.localZoteroDir, 'zotero.sqlite');
            await fs.ensureDir(this.localZoteroDir);
            const contents = await this.client.getFileContents(remotePath);
            await fs.writeFile(localPath, contents);
            const stats = await fs.stat(localPath);
            console.log(`Base de datos sincronizada: ${Math.round(stats.size / 1024 / 1024)} MB`);
            return true;
        } catch (error) {
            console.error('Error sincronizando BD:', error.message);
            return false;
        }
    }
    
    async listAllPDFs() {
        try {
            await this.init();
            
            // Listar archivos ZIP en /zotero (Zotero empaqueta cada storage folder en un ZIP)
            const response = await this.client.getDirectoryContents('/zotero', { 
                deep: false, 
                details: true 
            });
            
            // getDirectoryContents retorna un objeto con .data
            const contents = Array.isArray(response) ? response : response.data;
            
            const zipFiles = contents.filter(item => 
                item.type === 'file' && 
                item.filename.toLowerCase().endsWith('.zip')
            );
            
            console.log(`📦 Encontrados ${zipFiles.length} archivos ZIP en WebDAV`);
            
            // Mapear ZIPs a storage keys
            const storageKeys = zipFiles.map(zip => ({
                storageKey: path.basename(zip.filename, '.zip'),
                remotePath: zip.filename,
                size: zip.size
            }));
            
            console.log(`📚 ${storageKeys.length} storage keys disponibles en WebDAV`);
            return storageKeys;
        } catch (error) {
            console.error('Error listando ZIPs:', error.message);
            return [];
        }
    }
    
    async downloadPDFToCache(remotePath) {
        try {
            await this.init();
            
            // Extraer el storage key del remotePath
            // remotePath puede ser: /zotero/storage/ABCD1234/filename.pdf
            let storageKey, filename;
            
            if (remotePath.startsWith('/zotero/storage/')) {
                const parts = remotePath.replace('/zotero/storage/', '').split('/');
                storageKey = parts[0];
                filename = parts.slice(1).join('/');
            } else {
                console.error(`Formato de ruta no soportado: ${remotePath}`);
                return null;
            }
            
            // Cache path para el storage key
            const cacheDir = path.join(this.tempCacheDir, storageKey);
            const cachedPdfPath = path.join(cacheDir, filename);
            
            // Verificar si ya existe en cache
            if (await fs.pathExists(cachedPdfPath)) {
                const stats = await fs.stat(cachedPdfPath);
                // Si tiene menos de 1 hora, usar cache
                if ((Date.now() - stats.mtimeMs) < 3600000) {
                    console.log(`📦 Usando cache: ${filename}`);
                    return cachedPdfPath;
                }
            }
            
            // Descargar ZIP desde WebDAV
            const zipPath = `/zotero/${storageKey}.zip`;
            console.log(`⬇️  Descargando ZIP: ${zipPath}`);
            
            const zipBuffer = await this.client.getFileContents(zipPath);
            
            // Extraer el ZIP
            console.log(`📂 Extrayendo ZIP para storage key: ${storageKey}`);
            await fs.ensureDir(cacheDir);
            
            const directory = await unzipper.Open.buffer(zipBuffer);
            
            // Extraer todos los archivos del ZIP
            for (const file of directory.files) {
                if (file.type === 'File') {
                    const fileBuffer = await file.buffer();
                    const extractedPath = path.join(cacheDir, file.path);
                    await fs.ensureDir(path.dirname(extractedPath));
                    await fs.writeFile(extractedPath, fileBuffer);
                    console.log(`✅ Extraído: ${file.path}`);
                }
            }
            
            // Verificar si el PDF buscado existe
            if (await fs.pathExists(cachedPdfPath)) {
                console.log(`✅ PDF encontrado: ${filename}`);
                return cachedPdfPath;
            }
            
            console.log(`⚠️ PDF no encontrado en ZIP: ${filename}`);
            return null;
            
        } catch (error) {
            console.error(`Error descargando/extrayendo ${remotePath}:`, error.message);
            return null;
        }
    }
    
    async getFileStream(remotePath) {
        try {
            await this.init();
            const stream = this.client.createReadStream(remotePath);
            return stream;
        } catch (error) {
            console.error(`Error obteniendo stream: ${remotePath}`, error.message);
            return null;
        }
    }
    
    async fileExists(remotePath) {
        try {
            await this.init();
            
            // Extraer storage key del remotePath
            let storageKey;
            if (remotePath.startsWith('/zotero/storage/')) {
                storageKey = remotePath.replace('/zotero/storage/', '').split('/')[0];
            } else if (remotePath.includes('/')) {
                // Formato: ABCD1234/filename.pdf
                storageKey = remotePath.split('/')[0];
            } else {
                return false;
            }
            
            // Verificar si existe el ZIP para ese storage key
            const zipPath = `/zotero/${storageKey}.zip`;
            const exists = await this.client.exists(zipPath);
            return exists;
        } catch (error) {
            return false;
        }
    }
    
    async storageKeyExists(storageKey) {
        try {
            await this.init();
            const zipPath = `/zotero/${storageKey}.zip`;
            const exists = await this.client.exists(zipPath);
            return exists;
        } catch (error) {
            return false;
        }
    }
    
    async downloadFile(remotePath, localPath) {
        try {
            await this.init();
            console.log(`⬇️  Descargando: ${remotePath} -> ${localPath}`);
            await fs.ensureDir(path.dirname(localPath));
            const contents = await this.client.getFileContents(remotePath);
            await fs.writeFile(localPath, contents);
            console.log(`✅ Descargado: ${path.basename(localPath)}`);
            return true;
        } catch (error) {
            console.error(`Error descargando ${remotePath}:`, error.message);
            return false;
        }
    }
    
    async testConnection() {
        try {
            await this.init();
            await this.client.getDirectoryContents('/zotero');
            return true;
        } catch (error) {
            console.error('Error conectando a WebDAV:', error.message);
            return false;
        }
    }
    
    // Limpiar cache viejo (archivos > 24h)
    async cleanOldCache() {
        try {
            const files = await fs.readdir(this.tempCacheDir, { recursive: true });
            const now = Date.now();
            let cleaned = 0;
            
            for (const file of files) {
                const filePath = path.join(this.tempCacheDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile() && (now - stats.mtimeMs) > 86400000) {
                    await fs.unlink(filePath);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 Limpiados ${cleaned} archivos antiguos del cache`);
            }
        } catch (error) {
            console.error('Error limpiando cache:', error.message);
        }
    }
}

module.exports = ZoteroWebDAVSync;
