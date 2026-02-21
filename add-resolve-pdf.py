import re

with open('enhanced-server-memory-optimized.js', 'r') as f:
    lines = f.readlines()

# Buscar app.get('/api/resolve-pdf' y reemplazarlo
resolve_pdf_code = '''app.get('/api/resolve-pdf', async (req, res) => {
    try {
        let attachmentPath = req.query.path;
        
            return res.status(400).json({ error: 'Path parameter is required' });
        }
        
        console.log('Resolviendo PDF:', attachmentPath);
        
        const fileName = path.basename(attachmentPath);
        let storageKey = null;
        
        // Si es ruta absoluta, buscar storage key en la BD
        if (attachmentPath.startsWith('/') || attachmentPath.includes('Biblioteca')) {
            if (fs.existsSync(ZOTERO_DB)) {
                try {
                    const db = await openDatabaseWithRetry(ZOTERO_DB);
                    const query = 'SELECT i.key FROM itemAttachments ia JOIN items i ON ia.itemID = i.itemID WHERE ia.path = ?';
                    
                    await new Promise((resolve, reject) => {
                        db.get(query, [attachmentPath], (err, row) => {
                                storageKey = row.key;
                            }
                            db.close();
                            resolve();
                        });
                    });
                } catch (error) {
                    console.error('Error buscando en BD:', error);
                }
            }
        } else {
            // Extraer storage key de formato storage:KEY/file
            if (attachmentPath.startsWith('storage:')) {
                attachmentPath = attachmentPath.substring(8);
            }
            if (attachmentPath.startsWith('attachments:')) {
                attachmentPath = attachmentPath.substring(12);
            }
            
            const pathParts = attachmentPath.split('/');
            for (const part of pathParts) {
                if (/^[A-Z0-9]{8}$/.test(part)) {
                    storageKey = part;
                    break;
                }
            }
        }
        
        console.log('Storage key:', storageKey, 'Filename:', fileName);
        
        function findFileRecursive(dir, targetFile) {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) {
                        const found = findFileRecursive(fullPath, targetFile);
                        if (found) return found;
                    } else if (item === targetFile) {
                        return fullPath;
                    }
                }
            } catch (err) {}
            return null;
        }
        
        let foundPath = findFileRecursive(BIBLIOTECA_DIR, fileName);
        
            console.log('Descargando desde WebDAV...');
            
            try {
                await webdavSync.init();
                const remotePath = '/zotero/storage/' + storageKey + '/' + fileName;
                const localDir = path.join(BIBLIOTECA_DIR, storageKey);
                const localPath = path.join(localDir, fileName);
                
                console.log('WebDAV path:', remotePath);
                const success = await webdavSync.downloadPDF(remotePath, localPath);
                
                if (success) {
                    foundPath = localPath;
                    console.log('PDF descargado OK');
                }
            } catch (error) {
                console.error('Error WebDAV:', error.message);
            }
        }
        
        if (foundPath) {
            const relativePath = path.relative(BIBLIOTECA_DIR, foundPath);
            console.log('PDF encontrado:', relativePath);
            
            res.json({
                found: true,
                filename: fileName,
                relativePath: relativePath,
                webPath: '/biblioteca/' + relativePath,
                fullPath: foundPath
            });
        } else {
            console.log('PDF no encontrado:', fileName);
            res.status(404).json({
                found: false,
                filename: fileName,
                message: 'PDF no encontrado'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
'''

# Buscar y reemplazar el endpoint existente
start_line = None
end_line = None
brace_count = 0
for i, line in enumerate(lines):
    if "app.get('/api/resolve-pdf'" in line:
        start_line = i
        brace_count = 0
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{') - lines[j].count('}')
            if brace_count == 0 and j > i:
                end_line = j + 1
                break
        break

if start_line is not None and end_line is not None:
    lines[start_line:end_line] = [resolve_pdf_code + '\n\n']
    print(f'Endpoint reemplazado (líneas {start_line+1}-{end_line})')
else:
    print('Endpoint no encontrado')

with open('enhanced-server-memory-optimized.js', 'w') as f:
    f.writelines(lines)
