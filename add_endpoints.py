lines = open('enhanced-server-memory-optimized.js', 'r').readlines()

# Encontrar // API Routes
for i, line in enumerate(lines):
    if '// API Routes' in line:
        # Insertar endpoints después
        endpoints = [
            '\n',
            'app.post("/api/webdav/sync-database", async (req, res) => {\n',
            '    try {\n',
            '        if (!webdavSync) return res.status(503).json({ error: "WebDAV no habilitado" });\n',
            '        const result = await webdavSync.syncDatabase();\n',
            '        res.json(result ? { success: true, message: "DB sincronizada" } : { error: "Error sync DB" });\n',
            '    } catch (error) {\n',
            '        res.status(500).json({ error: error.message });\n',
            '    }\n',
            '});\n',
            '\n',
            'app.post("/api/webdav/sync-pdfs", async (req, res) => {\n',
            '    try {\n',
            '        if (!webdavSync) return res.status(503).json({ error: "WebDAV no habilitado" });\n',
            '        const limit = parseInt(req.body.limit) || 100;\n',
            '        const result = await webdavSync.syncAllPDFs(limit);\n',
            '        res.json(result);\n',
            '    } catch (error) {\n',
            '        res.status(500).json({ error: error.message });\n',
            '    }\n',
            '});\n',
            '\n',
            'app.get("/api/webdav/status", async (req, res) => {\n',
            '    try {\n',
            '        if (!webdavSync) return res.json({ enabled: false, connected: false });\n',
            '        const connected = await webdavSync.testConnection();\n',
            '        res.json({ enabled: true, connected: connected });\n',
            '    } catch (error) {\n',
            '        res.json({ enabled: true, connected: false, error: error.message });\n',
            '    }\n',
            '});\n',
            '\n'
        ]
        for j, endpoint_line in enumerate(endpoints):
            lines.insert(i + 1 + j, endpoint_line)
        break

open('enhanced-server-memory-optimized.js', 'w').writelines(lines)
print('Endpoints added')
