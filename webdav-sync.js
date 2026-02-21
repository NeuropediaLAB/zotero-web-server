const fs = require('fs-extra');
const path = require('path');

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
            const contents = await this.client.getDirectoryContents('/zotero/storage', { 
                deep: true, 
                details: true 
            });
            
            const pdfs = contents.filter(item => 
                item.type === 'file' && 
                item.filename.toLowerCase().endsWith('.pdf')
            );
            
            console.log(`📚 Encontrados ${pdfs.length} PDFs en WebDAV`);
            return pdfs;
        } catch (error) {
            console.error('Error listando PDFs:', error.message);
            return [];
        }
    }
    
    async downloadPDFToCache(remotePath) {
        try {
            await this.init();
            
            // Crear path local temporal basado en la estructura WebDAV
            const relativePath = remotePath.replace('/zotero/storage/', '');
            const localPath = path.join(this.tempCacheDir, relativePath);
            
            // Verificar si ya existe en cache
            if (await fs.pathExists(localPath)) {
                const stats = await fs.stat(localPath);
                // Si tiene menos de 1 hora, usar cache
                if ((Date.now() - stats.mtimeMs) < 3600000) {
                    console.log(`📦 Usando cache: ${path.basename(localPath)}`);
                    return localPath;
                }
            }
            
            // Descargar desde WebDAV
            console.log(`⬇️  Descargando: ${remotePath}`);
            await fs.ensureDir(path.dirname(localPath));
            const contents = await this.client.getFileContents(remotePath);
            await fs.writeFile(localPath, contents);
            console.log(`✅ Descargado: ${path.basename(localPath)}`);
            
            return localPath;
        } catch (error) {
            console.error(`Error descargando ${remotePath}:`, error.message);
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
            const exists = await this.client.exists(remotePath);
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
