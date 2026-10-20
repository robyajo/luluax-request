require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.PORT || 3990;
const app = express();

function getWritableDataDir(appName, defaultDataPath) {
  const isInsideAsar = __dirname.includes('.asar');
  let targetDir;
  if (isInsideAsar) {
    if (process.env.APPDATA) {
      targetDir = path.join(process.env.APPDATA, appName);
    } else if (process.platform === 'darwin') {
      targetDir = path.join(os.homedir(), 'Library', 'Application Support', appName);
    } else {
      targetDir = path.join(os.homedir(), `.${appName.toLowerCase()}`);
    }
  } else {
    targetDir = defaultDataPath;
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy initial seed files from defaultDataPath into writable dir if needed
  if (fs.existsSync(defaultDataPath)) {
    try {
      const files = fs.readdirSync(defaultDataPath);
      for (const file of files) {
        const dest = path.join(targetDir, file);
        if (!fs.existsSync(dest)) {
          const src = path.join(defaultDataPath, file);
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
          }
        }
      }
    } catch (e) {
      // ignore seed copy warnings
    }
  }
  return targetDir;
}

const DATA_DIR = getWritableDataDir('LuluaX-Request', path.join(__dirname, 'data'));

function readData(file, defaultVal = []) {
  const filePath = path.join(DATA_DIR, file);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf-8');
      return defaultVal;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
    return defaultVal;
  }
}

function writeData(file, data) {
  const filePath = path.join(DATA_DIR, file);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err.message);
    return false;
  }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// System Info API
// -------------------------------------------------------------
app.get('/api/system', (req, res) => {
  const platform = os.platform();
  const arch = os.arch();
  let platformLabel = 'Unknown';

  if (platform === 'darwin') {
    platformLabel = arch === 'arm64' ? 'macOS (Apple Silicon arm64)' : 'macOS (Intel x64)';
  } else if (platform === 'win32') {
    platformLabel = `Windows (${arch})`;
  } else {
    platformLabel = `Linux (${arch})`;
  }

  res.json({
    success: true,
    platform,
    arch,
    platformLabel,
    hostname: os.hostname(),
    uptime: os.uptime(),
    nodeVersion: process.version
  });
});

// -------------------------------------------------------------
// Local Data APIs (Collections, Environments, History, Settings)
// -------------------------------------------------------------
app.get('/api/collections', (req, res) => {
  const cols = readData('collections.json', []);
  res.json({ success: true, collections: cols });
});

app.post('/api/collections', (req, res) => {
  writeData('collections.json', req.body);
  res.json({ success: true });
});

app.get('/api/environments', (req, res) => {
  const envs = readData('environments.json', []);
  res.json({ success: true, environments: envs });
});

app.post('/api/environments', (req, res) => {
  writeData('environments.json', req.body);
  res.json({ success: true });
});

app.get('/api/history', (req, res) => {
  const history = readData('history.json', []);
  res.json({ success: true, history });
});

app.post('/api/history', (req, res) => {
  let history = readData('history.json', []);
  history.unshift(req.body);
  if (history.length > 50) history = history.slice(0, 50);
  writeData('history.json', history);
  res.json({ success: true });
});

app.delete('/api/history', (req, res) => {
  writeData('history.json', []);
  res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
  const defaultUrl = process.env.CLOUD_API_URL || 'https://www.luluax-service.duckdns.org';
  const defaultKey = process.env.CLOUD_SYNC_KEY || '';
  const settings = readData('settings.json', {
    cloudApiUrl: defaultUrl,
    cloudSyncKey: defaultKey,
    timeoutMs: 30000
  });
  if (!settings.cloudApiUrl) settings.cloudApiUrl = defaultUrl;
  if (!settings.cloudSyncKey && defaultKey) settings.cloudSyncKey = defaultKey;
  res.json({ success: true, settings });
});

app.post('/api/settings', (req, res) => {
  const cur = readData('settings.json', {});
  const updated = { ...cur, ...req.body };
  writeData('settings.json', updated);
  res.json({ success: true, settings: updated });
});

// -------------------------------------------------------------
// Requestly Feature 1 & 2: Mock API Server & HTTP Interceptor Rules
// -------------------------------------------------------------
app.get('/api/mocks', (req, res) => {
  const mocks = readData('mocks.json', [
    {
      id: 'mock_demo_users',
      name: 'Mock Users API',
      endpoint: '/mock/api/users',
      method: 'GET',
      statusCode: 200,
      delayMs: 300,
      responseBody: JSON.stringify([
        { id: 1, name: 'Roby Developer', role: 'Fullstack' },
        { id: 2, name: 'Jane Doe', role: 'DevOps' }
      ], null, 2),
      enabled: true
    }
  ]);
  res.json({ success: true, mocks });
});

app.post('/api/mocks', (req, res) => {
  const mocks = readData('mocks.json', []);
  const newMock = {
    id: req.body.id || `mock_${Date.now()}`,
    name: req.body.name || 'New Mock',
    endpoint: req.body.endpoint || '/mock/sample',
    method: (req.body.method || 'GET').toUpperCase(),
    statusCode: Number(req.body.statusCode || 200),
    delayMs: Number(req.body.delayMs || 0),
    responseBody: typeof req.body.responseBody === 'string' ? req.body.responseBody : '{}',
    enabled: req.body.enabled !== false,
    createdAt: Date.now()
  };
  mocks.push(newMock);
  writeData('mocks.json', mocks);
  res.json({ success: true, mock: newMock });
});

app.delete('/api/mocks/:id', (req, res) => {
  let mocks = readData('mocks.json', []);
  mocks = mocks.filter(m => m.id !== req.params.id);
  writeData('mocks.json', mocks);
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
    await new Promise(resolve => setTimeout(resolve, matched.delayMs));
  }

  res.status(matched.statusCode);
  try {
    const json = JSON.parse(matched.responseBody);
    res.json(json);
  } catch (e) {
    res.send(matched.responseBody);
  }
});

// HTTP Interceptor Rules APIs
app.get('/api/rules', (req, res) => {
  const rules = readData('rules.json', [
    {
      id: 'rule_sample_delay',
      name: 'Simulate 3G Delay',
      ruleType: 'delay',
      sourceUrlPattern: '*jsonplaceholder*',
      delayMs: 800,
      enabled: false
    }
  ]);
  res.json({ success: true, rules });
});

app.post('/api/rules', (req, res) => {
  const rules = readData('rules.json', []);
  const newRule = {
    id: req.body.id || `rule_${Date.now()}`,
    name: req.body.name || 'New Interceptor Rule',
    ruleType: req.body.ruleType || 'redirect',
    sourceUrlPattern: req.body.sourceUrlPattern || '',
    targetUrl: req.body.targetUrl || '',
    headersToModify: Array.isArray(req.body.headersToModify) ? req.body.headersToModify : [],
    statusCode: Number(req.body.statusCode || 200),
    responseBody: req.body.responseBody || '{}',
    delayMs: Number(req.body.delayMs || 0),
    enabled: req.body.enabled !== false,
    createdAt: Date.now()
  };
  rules.push(newRule);
  writeData('rules.json', rules);
  res.json({ success: true, rule: newRule });
});

app.post('/api/rules/:id/toggle', (req, res) => {
  const rules = readData('rules.json', []);
  const rule = rules.find(r => r.id === req.params.id);
  if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
  rule.enabled = !rule.enabled;
  writeData('rules.json', rules);
  res.json({ success: true, enabled: rule.enabled });
});

app.delete('/api/rules/:id', (req, res) => {
  let rules = readData('rules.json', []);
  rules = rules.filter(r => r.id !== req.params.id);
  writeData('rules.json', rules);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Universal API Proxy (With Requestly Interceptor Rules Applied!)
// -------------------------------------------------------------
app.post('/api/proxy', async (req, res) => {
  let { url, method = 'GET', headers = {}, body, bodyType } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  const startTime = Date.now();
  const rules = readData('rules.json', []);

  // Apply Active Requestly Rules
  for (const rule of rules) {
    if (!rule.enabled || !rule.sourceUrlPattern) continue;

    // Wildcard match pattern
    const patternRegex = new RegExp('^' + rule.sourceUrlPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
    if (patternRegex.test(url)) {
      // Rule 1: Delay
      if (rule.ruleType === 'delay' && rule.delayMs > 0) {
        await new Promise(r => setTimeout(r, rule.delayMs));
      }

      // Rule 2: Redirect
      if (rule.ruleType === 'redirect' && rule.targetUrl) {
        url = rule.targetUrl;
      }

      // Rule 3: Modify Headers
      if (rule.ruleType === 'modify_headers' && Array.isArray(rule.headersToModify)) {
        rule.headersToModify.forEach(h => {
          if (h.action === 'remove') delete headers[h.key];
          else headers[h.key] = h.value;
        });
      }

      // Rule 4: Modify Response (Mock Intercept)
      if (rule.ruleType === 'modify_response') {
        const duration = Date.now() - startTime;
        let parsedData = rule.responseBody;
        let isJson = false;
        try {
          parsedData = JSON.parse(rule.responseBody);
          isJson = true;
        } catch (e) {}
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

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method)) {
      if (bodyType === 'json' && body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!fetchOptions.headers['Content-Type'] && !fetchOptions.headers['content-type']) {
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
      } else if (bodyType === 'urlencoded' && body) {
        fetchOptions.body = typeof body === 'string' ? body : new URLSearchParams(body).toString();
        if (!fetchOptions.headers['Content-Type'] && !fetchOptions.headers['content-type']) {
          fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      } else if (body) {
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
      } catch (e) {
        responseData = await response.text();
      }
    } else {
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

  } catch (err) {
    const duration = Date.now() - startTime;
    res.status(502).json({
      success: false,
      error: err.message,
      duration
    });
  }
});

// -------------------------------------------------------------
// Cloud Sync Integration (Hono + Neon Backend)
// -------------------------------------------------------------
app.post('/api/cloud/sync/push', async (req, res) => {
  const { cloudApiUrl, syncKey } = req.body;
  if (!cloudApiUrl || !syncKey) {
    return res.status(400).json({ success: false, error: 'Cloud API URL and Sync Key are required' });
  }

  const collections = readData('collections.json', []);
  const environments = readData('environments.json', []);

  // Flatten items for relational database schema
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
  } catch (err) {
    res.status(500).json({ success: false, error: 'Cloud push network error: ' + err.message });
  }
});

app.post('/api/cloud/sync/pull', async (req, res) => {
  const { cloudApiUrl, syncKey } = req.body;
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

      // Group items back into collections
      const colMap = new Map();
      collections.forEach(c => colMap.set(c.id, { ...c, items: [] }));

      items.forEach(it => {
        if (it.collectionId && colMap.has(it.collectionId)) {
          colMap.get(it.collectionId).items.push(it);
        } else {
          // If no collection, put in a general collection
          let unassigned = colMap.get('unassigned');
          if (!unassigned) {
            unassigned = { id: 'unassigned', name: 'General Requests', items: [] };
            colMap.set('unassigned', unassigned);
          }
          unassigned.items.push(it);
        }
      });

      writeData('collections.json', Array.from(colMap.values()));
      if (environments.length > 0) {
        writeData('environments.json', environments);
      }
    }

    res.json({ success: true, message: 'Pulled from Neon Cloud database successfully!', timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Cloud pull network error: ' + err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`       LuluaX-Request API Client Server Running       `);
  console.log(`  Local URL: http://127.0.0.1:${PORT}                  `);
  console.log(`======================================================\n`);
});
