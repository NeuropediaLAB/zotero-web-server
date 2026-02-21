const fs = require('fs-extra');
const path = require('path');

class ZoteroWebDAVSync {
    constructor(config) {
        this.webdavUrl = config.webdavUrl;
        this.username = config.username;
        this.password = config.password;
        this.localBibliotecaDir = config.localBibliotecaDir;
        this.localZoteroDir = config.localZoteroDir;
        this.client = null;
        this.initialized = false;
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
            console.log('Base de datos sincronizada');
            return true;
        } catch (error) {
            console.error('Error sincronizando BD:', error.message);
            return false;
        }
    }
    
    async syncAllPDFs(limit = 100) {
        try {
            await this.init();
            console.log('Sincronizando PDFs desde WebDAV...');
            const pdfs = await this.listPDFs();
            console.log(`Encontrados ${pdfs.length} PDFs en WebDAV`);
            
            const toSync = pdfs.slice(0, limit);
            let downloaded = 0, skipped = 0, failed = 0;
            
            for (const pdf of toSync) {
                const relativePath = pdf.filename.replace('/zotero/storage/', '');
                const localPath = path.join(this.localBibliotecaDir, relativePath);
                
                if (await fs.pathExists(localPath)) {
                    const localStat = await fs.stat(localPath);
                    if (localStat.size === pdf.size) {
                        skipped++;
                        continue;
                    }
                }
                
                const success = await this.downloadPDF(pdf.filename, localPath);
                if (success) downloaded++;
                else failed++;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`Sincronización: ${downloaded} descargados, ${skipped} omitidos, ${failed} fallos`);
            return { success: true, total: pdfs.length, processed: toSync.length, downloaded, skipped, failed };
        } catch (error) {
            console.error('Error sincronizando PDFs:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    async listPDFs(remotePath = '/zotero/storage') {
        try {
            await this.init();
            const contents = await this.client.getDirectoryContents(remotePath, { deep: true, details: true });
            return contents.filter(item => item.type === 'file' && item.filename.toLowerCase().endsWith('.pdf'));
        } catch (error) {
            console.error('Error listando PDFs:', error.message);
            return [];
        }
    }
    
    async downloadPDF(remotePath, localPath) {
        try {
            await fs.ensureDir(path.dirname(localPath));
            const contents = await this.client.getFileContents(remotePath);
            await fs.writeFile(localPath, contents);
            return true;
        } catch (error) {
            console.error(`Error descargando ${path.basename(remotePath)}:`, error.message);
            return false;
        }
    }
    
    async testConnection() {
        try {
            await this.init();
            await this.client.getDirectoryContents('/zotero');
            console.log('Conexión WebDAV exitosa');
            return true;
        } catch (error) {
            console.error('Error conectando a WebDAV:', error.message);
            return false;
        }
    }
}

module.exports = ZoteroWebDAVSync;
