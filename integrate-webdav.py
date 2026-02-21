import re

# Leer archivo
with open('enhanced-server-memory-optimized.js', 'r') as f:
    content = f.read()

# 1. Añadir WebDAV config después de ZOTERO_DB
webdav_config = '''
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
'''

# Insertar después de ZOTERO_DB
pattern = r"(const ZOTERO_DB = process\.env\.ZOTERO_DB \|\| '[^']+';)"
content = re.sub(pattern, r'\1' + webdav_config, content)

# 2. Leer módulos
with open('/tmp/webdav-indexer-complete.js', 'r') as f:
    indexer_module = f.read()

with open('/tmp/webdav-indexing-endpoints.js', 'r') as f:
    endpoints = f.read()

# 3. Añadir endpoints WebDAV básicos
basic_endpoints = '''
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

'''

# 4. Insertar antes de // API Routes
api_routes_marker = '// API Routes'
if api_routes_marker in content:
    content = content.replace(api_routes_marker, indexer_module + '\n\n' + api_routes_marker)
    content = content.replace(api_routes_marker, api_routes_marker + '\n\n' + basic_endpoints + '\n' + endpoints)

# Guardar
with open('enhanced-server-memory-optimized.js', 'w') as f:
    f.write(content)

print('✅ Integración completada')
