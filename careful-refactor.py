
with open('enhanced-server-memory-optimized.js', 'r') as f:
    content = f.read()

# 1. Actualizar config WebDAV para usar tempCacheDir en lugar de localBibliotecaDir
content = content.replace(
    'localBibliotecaDir: BIBLIOTECA_DIR,',
    'tempCacheDir: path.join(__dirname, "data", "cache", "pdfs"),'
)

# 2. Actualizar webdav-sync.js con la versión refactorizada
import shutil
shutil.copy('/tmp/webdav-sync-refactored.js', 'webdav-sync.js')

# 3. Buscar y reemplazar getPDFListFromDatabase para que retorne webdavPath
old_getpdf = '''async function getPDFListFromDatabase(limit = 50, offset = 0) {
    return new Promise((resolve) => {
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

        const query = ;

        db.all(query, [limit], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error consultando PDFs:', err);
                resolve([]);
                return;
            }

            const pdfList = rows.map(row => ({
                storageKey: row.storageKey,
                filename: path.basename(row.path)
            }));

            resolve(pdfList);
        });
    });
}'''

new_getpdf = '''async function getPDFListFromDatabase(limit = 50, offset = 0) {
    return new Promise((resolve) => {
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

        const query = ;

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
                webdavPath: \,
                itemID: row.itemID
            }));

            console.log(\);
            resolve(pdfList);
        });
    });
}'''

if old_getpdf in content:
    content = content.replace(old_getpdf, new_getpdf)
    print('getPDFListFromDatabase actualizada con webdavPath')

with open('enhanced-server-memory-optimized.js', 'w') as f:
    f.write(content)

print('✅ Refactoring aplicado')
