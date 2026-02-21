
with open('enhanced-server-memory-optimized.js', 'r') as f:
    lines = f.readlines()

# 1. Modificar la config de WebDAV para incluir tempCacheDir
for i, line in enumerate(lines):
    if 'localBibliotecaDir: BIBLIOTECA_DIR,' in line:
        lines[i] = line.replace(
            'localBibliotecaDir: BIBLIOTECA_DIR,',
            'tempCacheDir: path.join(__dirname, "data", "cache", "pdfs"),'
        )
        break

# 2. Buscar y eliminar funciones de filesystem local que no necesitamos
# getLibraryPDFs, countPDFsInDirectory, etc - pero mantener las necesarias

# 3. Reemplazar módulo de indexación
start = None
end = None
for i, line in enumerate(lines):
    if '// WEBDAV INDEXING MODULE' in line or '// WEBDAV OCR INDEXING MODULE' in line:
        start = i
        # Buscar hasta async function initServer
        for j in range(i, len(lines)):
            if 'async function initServer' in lines[j]:
                end = j
                break
        break

if start is not None and end is not None:
    # Leer nuevo módulo
    indexer = open('/tmp/webdav-only-indexer.js', 'r').read()
    lines[start:end] = [indexer + '\n\n']
    print(f'Módulo indexación reemplazado (líneas {start+1}-{end})')

# 4. Reemplazar resolve-pdf endpoint
start = None
end = None
for i, line in enumerate(lines):
    if "app.get('/api/resolve-pdf'" in line:
        start = i
        brace_count = 0
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{') - lines[j].count('}')
            if brace_count == 0 and j > i:
                end = j + 1
                break
        break

if start is not None and end is not None:
    resolve_pdf = open('/tmp/resolve-pdf-webdav-only.js', 'r').read()
    lines[start:end] = [resolve_pdf + '\n\n']
    print(f'Resolve-PDF reemplazado (líneas {start+1}-{end})')

# 5. Añadir endpoint de cache después de resolve-pdf
cache_endpoint = open('/tmp/cache-endpoint.js', 'r').read()
if start is not None:
    lines.insert(start + 1, cache_endpoint + '\n')
    print('Cache endpoint añadido')

# 6. Modificar initServer para no usar getLibraryPDFs
for i, line in enumerate(lines):
    if 'const libraryFiles = getLibraryPDFs(BIBLIOTECA_DIR' in line:
        # Comentar esta línea y las siguientes que usan libraryFiles
        for j in range(i, min(i + 15, len(lines))):
            if 'libraryFiles.files.forEach' in lines[j]:
                # Comentar todo el forEach
                for k in range(j, min(j + 10, len(lines))):
                    lines[k] = '        // ' + lines[k].lstrip()
                    if '});' in lines[k]:
                        break
                break
        lines[i] = '        // const libraryFiles = getLibraryPDFs(BIBLIOTECA_DIR, 1, 10000);\n'
        print(f'getLibraryPDFs comentado en línea {i+1}')
        break

with open('enhanced-server-memory-optimized.js', 'w') as f:
    f.writelines(lines)

print('✅ Refactorización completada')
