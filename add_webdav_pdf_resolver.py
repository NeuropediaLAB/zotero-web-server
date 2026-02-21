lines = open('enhanced-server-memory-optimized.js', 'r').readlines()

# Buscar el endpoint resolve-pdf y reemplazarlo
new_endpoint = '''app.get('/api/resolve-pdf', async (req, res) => {
    try {
        let attachmentPath = req.query.path;
        
            return res.status(400).json({ error: 'Path parameter is required' });
        }
        
        console.log('Resolviendo ruta PDF:', attachmentPath);
        
        // Manejar formato storage:KEY/filename.pdf
        if (attachmentPath.startsWith('storage:')) {
            attachmentPath = attachmentPath.substring(8);
        }
        
        // Manejar formato attachments:KEY/filename.pdf  
        if (attachmentPath.startsWith('attachments:')) {
            attachmentPath = attachmentPath.substring(12);
        }
        
        const fileName = path.basename(attachmentPath);
        
        // Función para buscar archivo recursivamente
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
            } catch (err) {
                console.error('Error buscando archivo:', err);
            }
            return null;
        }
        
        // Buscar localmente primero
        let foundPath = findFileRecursive(BIBLIOTECA_DIR, fileName);
        
        // Si no existe localmente y WebDAV está habilitado, intentar descargar
            console.log('Archivo no encontrado localmente, intentando descargar desde WebDAV...');
            
            // Extraer storage key de la ruta
            const pathParts = attachmentPath.split('/');
            let storageKey = null;
            
            // Buscar un patrón de 8 caracteres alfanuméricos (storage key de Zotero)
            for (const part of pathParts) {
                if (/^[A-Z0-9]{8}$/.test(part)) {
                    storageKey = part;
                    break;
                }
            }
            
            if (storageKey) {
                try {
                    await webdavSync.init();
                    const remotePath = \;
                    const localDir = path.join(BIBLIOTECA_DIR, storageKey);
                    const localPath = path.join(localDir, fileName);
                    
                    console.log(\);
                    const success = await webdavSync.downloadPDF(remotePath, localPath);
                    
                    if (success) {
                        foundPath = localPath;
                        console.log('PDF descargado exitosamente desde WebDAV');
                    }
                } catch (error) {
                    console.error('Error descargando desde WebDAV:', error.message);
                }
            }
        }
        
        if (foundPath) {
            const relativePath = path.relative(BIBLIOTECA_DIR, foundPath);
            console.log('PDF encontrado:', relativePath);
            
            res.json({
                found: true,
                filename: fileName,
                relativePath: relativePath,
                webPath: \,
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
        console.error('Error resolviendo PDF:', error);
        res.status(500).json({ error: error.message });
    }
});
'''

# Buscar inicio del endpoint
start_line = None
end_line = None
for i, line in enumerate(lines):
    if "app.get('/api/resolve-pdf'" in line:
        start_line = i
        # Buscar el cierre del endpoint
        brace_count = 0
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{') - lines[j].count('}')
            if brace_count == 0 and j > i:
                end_line = j + 1
                break
        break

if start_line is not None and end_line is not None:
    # Reemplazar el endpoint
    lines[start_line:end_line] = [new_endpoint + '\n']
    
    with open('enhanced-server-memory-optimized.js', 'w') as f:
        f.writelines(lines)
    
    print(f'Endpoint reemplazado (lineas {start_line}-{end_line})')
else:
    print('No se encontró el endpoint')
