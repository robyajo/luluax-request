"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const PORT = parseInt(process.env.PORT || '3990', 10);
const app = (0, express_1.default)();
function getWritableDataDir(appName, defaultDataPath) {
    const isInsideAsar = __dirname.includes('.asar');
    let targetDir;
    if (isInsideAsar) {
        if (process.env.APPDATA) {
            targetDir = path_1.default.join(process.env.APPDATA, appName);
        }
        else if (process.platform === 'darwin') {
            targetDir = path_1.default.join(os_1.default.homedir(), 'Library', 'Application Support', appName);
        }
        else {
            targetDir = path_1.default.join(os_1.default.homedir(), `.${appName.toLowerCase()}`);
        }
    }
    else {
        targetDir = defaultDataPath;
    }
    if (!fs_1.default.existsSync(targetDir)) {
        fs_1.default.mkdirSync(targetDir, { recursive: true });
    }
    if (fs_1.default.existsSync(defaultDataPath)) {
        try {
            const files = fs_1.default.readdirSync(defaultDataPath);
            for (const file of files) {
                const dest = path_1.default.join(targetDir, file);
                if (!fs_1.default.existsSync(dest)) {
                    const src = path_1.default.join(defaultDataPath, file);
                    if (fs_1.default.statSync(src).isFile()) {
                        fs_1.default.copyFileSync(src, dest);
                    }
                }
            }
        }
        catch {
            // ignore seed read warnings
        }
    }
    return targetDir;
}
const PROJECT_ROOT = __dirname.includes('dist-electron') ? path_1.default.join(__dirname, '..') : __dirname;
const DATA_DIR = getWritableDataDir('LuluaX-Request', path_1.default.join(PROJECT_ROOT, 'data'));
function readData(file, defaultVal) {
    const filePath = path_1.default.join(DATA_DIR, file);
    try {
        if (!fs_1.default.existsSync(filePath)) {
            fs_1.default.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf-8');
            return defaultVal;
        }
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error reading ${file}:`, errorMsg);
        return defaultVal;
    }
}
function writeData(file, data) {
    const filePath = path_1.default.join(DATA_DIR, file);
    try {
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error writing ${file}:`, errorMsg);
        return false;
    }
}
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(express_1.default.static(path_1.default.join(PROJECT_ROOT, 'public')));
// -------------------------------------------------------------
// System Info API
// -------------------------------------------------------------
app.get('/api/system', (_req, res) => {
    const platform = os_1.default.platform();
    const arch = os_1.default.arch();
    let platformLabel = 'Unknown';
    if (platform === 'darwin') {
        platformLabel = arch === 'arm64' ? 'macOS (Apple Silicon arm64)' : 'macOS (Intel x64)';
    }
    else if (platform === 'win32') {
        platformLabel = `Windows (${arch})`;
    }
    else {
        platformLabel = `Linux (${arch})`;
    }
    let appVersion = '1.0.3';
    try {
        const pkgPath = path_1.default.join(PROJECT_ROOT, 'package.json');
        if (fs_1.default.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, 'utf-8'));
            if (pkg.version)
                appVersion = pkg.version;
        }
    }
    catch { }
    res.json({
        success: true,
        platform,
        arch,
        platformLabel,
        appVersion,
        hostname: os_1.default.hostname(),
        uptime: os_1.default.uptime(),
        nodeVersion: process.version
    });
});
// -------------------------------------------------------------
// Per-Account Registry Manager (registry-<accountId>.json)
// -------------------------------------------------------------
function getRegistryFilePath(accountId) {
    const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path_1.default.join(DATA_DIR, `registry-${safeId}.json`);
}
function loadAccountRegistry(accountId) {
    const regPath = getRegistryFilePath(accountId);
    if (fs_1.default.existsSync(regPath)) {
        try {
            return JSON.parse(fs_1.default.readFileSync(regPath, 'utf-8'));
        }
        catch { }
    }
    return {
        accountId,
        version: 1,
        updatedAt: Date.now(),
        collections: readData('collections.json', []),
        environments: readData('environments.json', []),
        rules: readData('rules.json', []),
        mocks: readData('mocks.json', []),
        settings: readData('settings.json', {})
    };
}
function saveAccountRegistry(registry) {
    const regPath = getRegistryFilePath(registry.accountId);
    try {
        fs_1.default.writeFileSync(regPath, JSON.stringify(registry, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('Error saving request account registry:', err);
    }
}
function syncActiveRegistry(accountId = 'default-user') {
    const registry = {
        accountId,
        version: 1,
        updatedAt: Date.now(),
        collections: readData('collections.json', []),
        environments: readData('environments.json', []),
        rules: readData('rules.json', []),
        mocks: readData('mocks.json', []),
        settings: readData('settings.json', {})
    };
    saveAccountRegistry(registry);
}
app.get('/api/registry', (req, res) => {
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : 'default-user';
    const registry = loadAccountRegistry(accountId);
    res.json({ success: true, registry });
});
app.post('/api/registry/activate', (req, res) => {
    const reqBody = req.body;
    const accountId = (reqBody && typeof reqBody === 'object' && 'accountId' in reqBody && typeof reqBody.accountId === 'string')
        ? reqBody.accountId
        : 'default-user';
    const registry = loadAccountRegistry(accountId);
    if (Array.isArray(registry.collections))
        writeData('collections.json', registry.collections);
    if (Array.isArray(registry.environments))
        writeData('environments.json', registry.environments);
    if (Array.isArray(registry.rules))
        writeData('rules.json', registry.rules);
    if (Array.isArray(registry.mocks))
        writeData('mocks.json', registry.mocks);
    if (registry.settings && typeof registry.settings === 'object')
        writeData('settings.json', registry.settings);
    res.json({ success: true, message: `Active workspace switched to account ${accountId}`, registry });
});
// -------------------------------------------------------------
// Local Data APIs
// -------------------------------------------------------------
app.get('/api/collections', (_req, res) => {
    const cols = readData('collections.json', []);
    res.json({ success: true, collections: cols });
});
app.post('/api/collections', (req, res) => {
    writeData('collections.json', req.body);
    syncActiveRegistry();
    res.json({ success: true });
});
app.get('/api/environments', (_req, res) => {
    const envs = readData('environments.json', []);
    res.json({ success: true, environments: envs });
});
app.post('/api/environments', (req, res) => {
    writeData('environments.json', req.body);
    syncActiveRegistry();
    res.json({ success: true });
});
app.get('/api/history', (_req, res) => {
    const history = readData('history.json', []);
    res.json({ success: true, history });
});
app.post('/api/history', (req, res) => {
    let history = readData('history.json', []);
    history.unshift(req.body);
    if (history.length > 50)
        history = history.slice(0, 50);
    writeData('history.json', history);
    res.json({ success: true });
});
app.delete('/api/history', (_req, res) => {
    writeData('history.json', []);
    res.json({ success: true });
});
app.get('/api/settings', (_req, res) => {
    const defaultUrl = process.env.CLOUD_API_URL || 'https://www.er-service.duckdns.org';
    const defaultKey = process.env.CLOUD_SYNC_KEY || '';
    const settings = readData('settings.json', {
        cloudApiUrl: defaultUrl,
        cloudSyncKey: defaultKey,
        timeoutMs: 30000
    });
    if (!settings.cloudApiUrl)
        settings.cloudApiUrl = defaultUrl;
    if (!settings.cloudSyncKey && defaultKey)
        settings.cloudSyncKey = defaultKey;
    res.json({ success: true, settings });
});
app.post('/api/settings', (req, res) => {
    const cur = readData('settings.json', {});
    const updated = { ...cur, ...req.body };
    writeData('settings.json', updated);
    syncActiveRegistry();
    res.json({ success: true, settings: updated });
});
// -------------------------------------------------------------
// Requestly Features: Mock Server & HTTP Rules
// -------------------------------------------------------------
app.get('/api/mocks', (_req, res) => {
    const mocks = readData('mocks.json', []);
    res.json({ success: true, mocks });
});
app.post('/api/mocks', (req, res) => {
    const mocks = readData('mocks.json', []);
    const body = req.body;
    const newMock = {
        id: body.id || `mock_${Date.now()}`,
        name: body.name || 'New Mock',
        endpoint: body.endpoint || '/mock/sample',
        method: (body.method || 'GET').toUpperCase(),
        statusCode: Number(body.statusCode || 200),
        delayMs: Number(body.delayMs || 0),
        responseBody: typeof body.responseBody === 'string' ? body.responseBody : '{}',
        enabled: body.enabled !== false,
        createdAt: Date.now()
    };
    mocks.push(newMock);
    writeData('mocks.json', mocks);
    syncActiveRegistry();
    res.json({ success: true, mock: newMock });
});
app.delete('/api/mocks/:id', (req, res) => {
    let mocks = readData('mocks.json', []);
    mocks = mocks.filter(m => m.id !== req.params.id);
    writeData('mocks.json', mocks);
    syncActiveRegistry();
    res.json({ success: true });
});
// Live Mock Endpoint Handler
app.all('/mock/*', async (req, res) => {
    const mocks = readData('mocks.json', []);
    const cleanPath = req.path.replace(/\/+$/, '');
    const matched = mocks.find(m => m.enabled && m.endpoint.replace(/\/+$/, '') === cleanPath && m.method === req.method);
    if (!matched) {
        return res.status(404).json({ error: 'Mock endpoint not found or inactive', path: req.path, method: req.method });
    }
    if (matched.delayMs > 0) {
        const { promise, resolve } = Promise.withResolvers();
        setTimeout(resolve, matched.delayMs);
        await promise;
    }
    res.status(matched.statusCode);
    try {
        const json = JSON.parse(matched.responseBody);
        res.json(json);
    }
    catch {
        res.send(matched.responseBody);
    }
});
// HTTP Interceptor Rules APIs
app.get('/api/rules', (_req, res) => {
    const rules = readData('rules.json', []);
    res.json({ success: true, rules });
});
app.post('/api/rules', (req, res) => {
    const rules = readData('rules.json', []);
    const body = req.body;
    const newRule = {
        id: body.id || `rule_${Date.now()}`,
        name: body.name || 'New Interceptor Rule',
        ruleType: body.ruleType || 'redirect',
        sourceUrlPattern: body.sourceUrlPattern || '',
        targetUrl: body.targetUrl || '',
        headersToModify: Array.isArray(body.headersToModify) ? body.headersToModify : [],
        statusCode: Number(body.statusCode || 200),
        responseBody: body.responseBody || '{}',
        delayMs: Number(body.delayMs || 0),
        enabled: body.enabled !== false,
        createdAt: Date.now()
    };
    rules.push(newRule);
    writeData('rules.json', rules);
    syncActiveRegistry();
    res.json({ success: true, rule: newRule });
});
app.post('/api/rules/:id/toggle', (req, res) => {
    const rules = readData('rules.json', []);
    const rule = rules.find(r => r.id === req.params.id);
    if (!rule)
        return res.status(404).json({ success: false, error: 'Rule not found' });
    rule.enabled = !rule.enabled;
    writeData('rules.json', rules);
    syncActiveRegistry();
    res.json({ success: true, enabled: rule.enabled });
});
app.delete('/api/rules/:id', (req, res) => {
    let rules = readData('rules.json', []);
    rules = rules.filter(r => r.id !== req.params.id);
    writeData('rules.json', rules);
    syncActiveRegistry();
    res.json({ success: true });
});
app.post('/api/proxy', async (req, res) => {
    const reqData = req.body;
    let url = reqData.url;
    const method = reqData.method || 'GET';
    const headers = reqData.headers || {};
    const body = reqData.body;
    const bodyType = reqData.bodyType;
    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }
    const startTime = Date.now();
    const rules = readData('rules.json', []);
    for (const rule of rules) {
        if (!rule.enabled || !rule.sourceUrlPattern)
            continue;
        const patternRegex = new RegExp('^' + rule.sourceUrlPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
        if (patternRegex.test(url)) {
            if (rule.ruleType === 'delay' && rule.delayMs && rule.delayMs > 0) {
                const { promise, resolve } = Promise.withResolvers();
                setTimeout(resolve, rule.delayMs);
                await promise;
            }
            if (rule.ruleType === 'redirect' && rule.targetUrl) {
                url = rule.targetUrl;
            }
            if (rule.ruleType === 'modify_headers' && Array.isArray(rule.headersToModify)) {
                rule.headersToModify.forEach(h => {
                    if (h.action === 'remove')
                        delete headers[h.key];
                    else
                        headers[h.key] = h.value;
                });
            }
            if (rule.ruleType === 'modify_response') {
                const duration = Date.now() - startTime;
                let parsedData = rule.responseBody;
                let isJson = false;
                try {
                    parsedData = JSON.parse(rule.responseBody || '{}');
                    isJson = true;
                }
                catch { }
                return res.json({
                    success: true,
                    status: rule.statusCode || 200,
                    statusText: 'Intercepted by Requestly Rule',
                    headers: { 'x-intercepted-by': 'LuluaX-Request Rule: ' + rule.name },
                    data: parsedData,
                    isJson,
                    size: Buffer.byteLength(String(rule.responseBody || '')),
                    duration
                });
            }
        }
    }
    try {
        const fetchOptions = {
            method: method.toUpperCase(),
            headers: { ...headers },
            redirect: 'follow'
        };
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method || '')) {
            if (bodyType === 'json' && body) {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
                const headerRec = fetchOptions.headers;
                if (!headerRec['Content-Type'] && !headerRec['content-type']) {
                    headerRec['Content-Type'] = 'application/json';
                }
            }
            else if (bodyType === 'urlencoded' && body) {
                fetchOptions.body = typeof body === 'string' ? body : new URLSearchParams(body).toString();
                const headerRec = fetchOptions.headers;
                if (!headerRec['Content-Type'] && !headerRec['content-type']) {
                    headerRec['Content-Type'] = 'application/x-www-form-urlencoded';
                }
            }
            else if (body && typeof body === 'string') {
                fetchOptions.body = body;
            }
        }
        const response = await fetch(url, fetchOptions);
        const duration = Date.now() - startTime;
        const responseHeaders = {};
        response.headers.forEach((val, key) => {
            responseHeaders[key] = val;
        });
        const contentType = response.headers.get('content-type') || '';
        let responseData = '';
        let isJson = false;
        if (contentType.includes('application/json')) {
            try {
                responseData = await response.json();
                isJson = true;
            }
            catch {
                responseData = await response.text();
            }
        }
        else {
            responseData = await response.text();
        }
        const byteSize = Buffer.byteLength(typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData));
        res.json({
            success: true,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data: responseData,
            isJson,
            size: byteSize,
            duration
        });
    }
    catch (err) {
        const duration = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(502).json({
            success: false,
            error: errorMsg,
            duration
        });
    }
});
app.post('/api/cloud/sync/push', async (req, res) => {
    const body = req.body;
    const cloudApiUrl = body.cloudApiUrl;
    const syncKey = body.syncKey;
    if (!cloudApiUrl || !syncKey) {
        return res.status(400).json({ success: false, error: 'Cloud API URL and Sync Key are required' });
    }
    const collections = readData('collections.json', []);
    const environments = readData('environments.json', []);
    const items = [];
    collections.forEach(col => {
        if (Array.isArray(col.items)) {
            col.items.forEach(it => {
                items.push({ ...it, collectionId: col.id });
            });
        }
    });
    try {
        const targetUrl = cloudApiUrl.replace(/\/+$/, '') + '/api/request/sync/push';
        const resp = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${syncKey}`
            },
            body: JSON.stringify({
                collections: collections.map(c => ({ id: c.id, name: c.name, description: c.description })),
                items,
                environments
            })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            return res.status(resp.status).json({ success: false, error: data.error || 'Cloud sync failed' });
        }
        res.json({ success: true, message: 'LuluaX-Request data saved to Neon Cloud!', timestamp: Date.now() });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: 'Cloud push network error: ' + errorMsg });
    }
});
app.post('/api/cloud/sync/pull', async (req, res) => {
    const body = req.body;
    const cloudApiUrl = body.cloudApiUrl;
    const syncKey = body.syncKey;
    if (!cloudApiUrl || !syncKey) {
        return res.status(400).json({ success: false, error: 'Cloud API URL and Sync Key are required' });
    }
    try {
        const targetUrl = cloudApiUrl.replace(/\/+$/, '') + '/api/request/sync/pull';
        const resp = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${syncKey}`
            }
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            return res.status(resp.status).json({ success: false, error: data.error || 'Cloud pull failed' });
        }
        if (data.data) {
            const { collections = [], items = [], environments = [] } = data.data;
            const colMap = new Map();
            collections.forEach(c => colMap.set(c.id, { ...c, items: [] }));
            items.forEach(it => {
                if (it.collectionId && colMap.has(it.collectionId)) {
                    colMap.get(it.collectionId)?.items.push(it);
                }
                else {
                    let unassigned = colMap.get('unassigned');
                    if (!unassigned) {
                        unassigned = { id: 'unassigned', name: 'General Requests', items: [] };
                        colMap.set('unassigned', unassigned);
                    }
                    unassigned.items.push(it);
                }
            });
            writeData('collections.json', Array.from(colMap.values()));
            if (environments.length > 0)
                writeData('environments.json', environments);
            syncActiveRegistry(syncKey);
        }
        res.json({ success: true, message: 'Pulled from Neon Cloud database successfully!', timestamp: Date.now() });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: 'Cloud pull network error: ' + errorMsg });
    }
});
app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n======================================================`);
    console.log(`       LuluaX-Request API Client Server Running       `);
    console.log(`  Local URL: http://127.0.0.1:${PORT}                  `);
    console.log(`======================================================\n`);
});
