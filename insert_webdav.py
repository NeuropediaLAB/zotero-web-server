lines = open('enhanced-server-memory-optimized.js', 'r').readlines()

# Encontrar línea de ZOTERO_DB
for i, line in enumerate(lines):
    if "const ZOTERO_DB = process.env.ZOTERO_DB" in line:
        # Insertar después de esta línea
        lines.insert(i + 1, "\nconst ZoteroWebDAVSync = require('./webdav-sync');\n")
        lines.insert(i + 2, "let webdavSync = null;\n\n")
        lines.insert(i + 3, "if (process.env.WEBDAV_ENABLED === 'true') {\n")
        lines.insert(i + 4, "    webdavSync = new ZoteroWebDAVSync({\n")
        lines.insert(i + 5, "        webdavUrl: process.env.WEBDAV_URL || 'https://owncloud.serviciosylaboratoriodomestico.site/remote.php/dav/files/arkantu',\n")
        lines.insert(i + 6, "        username: process.env.WEBDAV_USERNAME || 'arkantu',\n")
        lines.insert(i + 7, "        password: process.env.WEBDAV_PASSWORD || 'akelarre',\n")
        lines.insert(i + 8, "        localBibliotecaDir: BIBLIOTECA_DIR,\n")
        lines.insert(i + 9, "        localZoteroDir: path.dirname(ZOTERO_DB)\n")
        lines.insert(i + 10, "    });\n")
        lines.insert(i + 11, "    console.log('WebDAV habilitado');\n")
        lines.insert(i + 12, "} else {\n")
        lines.insert(i + 13, "    console.log('WebDAV deshabilitado');\n")
        lines.insert(i + 14, "}\n")
        break

open('enhanced-server-memory-optimized.js', 'w').writelines(lines)
print('Config added')
