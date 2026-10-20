import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import type {
  CollectionItem,
  EnvironmentItem,
  HistoryItem,
  MockItem,
  RuleItem,
  SettingsData
} from './types.js';

const PORT: number = parseInt(process.env.PORT || '3990', 10);
const app = express();

function getWritableDataDir(appName: string, defaultDataPath: string): string {
  const isInsideAsar = __dirname.includes('.asar');
  let targetDir: string;
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
    } catch {
      // ignore seed read warnings
    }
  }
  return targetDir;
}

const PROJECT_ROOT = __dirname.includes('dist-electron') ? path.join(__dirname, '..') : __dirname;
const DATA_DIR = getWritableDataDir('LuluaX-Request', path.join(PROJECT_ROOT, 'data'));

function readData<T>(file: string, defaultVal: T): T {
  const filePath = path.join(DATA_DIR, file);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf-8');
      return defaultVal;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Error reading ${file}:`, errorMsg);
    return defaultVal;
  }
}

function writeData<T>(file: string, data: T): boolean {
  const filePath = path.join(DATA_DIR, file);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Error writing ${file}:`, errorMsg);
    return false;
  }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(PROJECT_ROOT, 'public')));

// -------------------------------------------------------------
// System Info API
// -------------------------------------------------------------
app.get('/api/system', (_req: Request, res: Response) => {
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
// Local Data APIs
// -------------------------------------------------------------
app.get('/api/collections', (_req: Request, res: Response) => {
  const cols = readData<CollectionItem[]>('collections.json', []);
  res.json({ success: true, collections: cols });
});

app.post('/api/collections', (req: Request, res: Response) => {
  writeData('collections.json', req.body);
  res.json({ success: true });
});

app.get('/api/environments', (_req: Request, res: Response) => {
  const envs = readData<EnvironmentItem[]>('environments.json', []);
  res.json({ success: true, environments: envs });
});

app.post('/api/environments', (req: Request, res: Response) => {
  writeData('environments.json', req.body);
  res.json({ success: true });
});

app.get('/api/history', (_req: Request, res: Response) => {
  const history = readData<HistoryItem[]>('history.json', []);
  res.json({ success: true, history });
});

app.post('/api/history', (req: Request, res: Response) => {
  let history = readData<HistoryItem[]>('history.json', []);
  history.unshift(req.body as HistoryItem);
  if (history.length > 50) history = history.slice(0, 50);
  writeData('history.json', history);
  res.json({ success: true });
});

app.delete('/api/history', (_req: Request, res: Response) => {
  writeData('history.json', []);
  res.json({ success: true });
});

app.get('/api/settings', (_req: Request, res: Response) => {
  const defaultUrl = process.env.CLOUD_API_URL || 'https://www.luluax-service.duckdns.org';
  const defaultKey = process.env.CLOUD_SYNC_KEY || '';
  const settings = readData<SettingsData>('settings.json', {
    cloudApiUrl: defaultUrl,
    cloudSyncKey: defaultKey,
    timeoutMs: 30000
  });
  if (!settings.cloudApiUrl) settings.cloudApiUrl = defaultUrl;
  if (!settings.cloudSyncKey && defaultKey) settings.cloudSyncKey = defaultKey;
  res.json({ success: true, settings });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const cur = readData<SettingsData>('settings.json', {});
  const updated = { ...cur, ...(req.body as SettingsData) };
  writeData('settings.json', updated);
  res.json({ success: true, settings: updated });
});

// -------------------------------------------------------------
// Requestly Features: Mock Server & HTTP Rules
// -------------------------------------------------------------
app.get('/api/mocks', (_req: Request, res: Response) => {
  const mocks = readData<MockItem[]>('mocks.json', []);
  res.json({ success: true, mocks });
});

app.post('/api/mocks', (req: Request, res: Response) => {
  const mocks = readData<MockItem[]>('mocks.json', []);
  const body = req.body as Partial<MockItem>;
  const newMock: MockItem = {
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
  res.json({ success: true, mock: newMock });
});

app.delete('/api/mocks/:id', (req: Request, res: Response) => {
  let mocks = readData<MockItem[]>('mocks.json', []);
  mocks = mocks.filter(m => m.id !== req.params.id);
  writeData('mocks.json', mocks);
  res.json({ success: true });
});

// Live Mock Endpoint Handler
app.all('/mock/*', async (req: Request, res: Response) => {
  const mocks = readData<MockItem[]>('mocks.json', []);
  const cleanPath = req.path.replace(/\/+$/, '');
  const matched = mocks.find(m => m.enabled && m.endpoint.replace(/\/+$/, '') === cleanPath && m.method === req.method);

  if (!matched) {
    return res.status(404).json({ error: 'Mock endpoint not found or inactive', path: req.path, method: req.method });
  }

  if (matched.delayMs > 0) {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, matched.delayMs);
    await promise;
  }

  res.status(matched.statusCode);
  try {
    const json: unknown = JSON.parse(matched.responseBody);
    res.json(json);
  } catch {
    res.send(matched.responseBody);
  }
});

// HTTP Interceptor Rules APIs
app.get('/api/rules', (_req: Request, res: Response) => {
  const rules = readData<RuleItem[]>('rules.json', []);
  res.json({ success: true, rules });
});

app.post('/api/rules', (req: Request, res: Response) => {
  const rules = readData<RuleItem[]>('rules.json', []);
  const body = req.body as Partial<RuleItem>;
  const newRule: RuleItem = {
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
  res.json({ success: true, rule: newRule });
});

app.post('/api/rules/:id/toggle', (req: Request, res: Response) => {
  const rules = readData<RuleItem[]>('rules.json', []);
  const rule = rules.find(r => r.id === req.params.id);
  if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
  rule.enabled = !rule.enabled;
  writeData('rules.json', rules);
  res.json({ success: true, enabled: rule.enabled });
});

app.delete('/api/rules/:id', (req: Request, res: Response) => {
  let rules = readData<RuleItem[]>('rules.json', []);
  rules = rules.filter(r => r.id !== req.params.id);
  writeData('rules.json', rules);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Universal API Proxy
// -------------------------------------------------------------
interface ProxyRequestBody {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  bodyType?: string;
}

app.post('/api/proxy', async (req: Request, res: Response) => {
  const reqData: ProxyRequestBody = req.body;
  let url = reqData.url;
  const method = reqData.method || 'GET';
  const headers: Record<string, string> = reqData.headers || {};
  const body = reqData.body;
  const bodyType = reqData.bodyType;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  const startTime = Date.now();
  const rules = readData<RuleItem[]>('rules.json', []);

  for (const rule of rules) {
    if (!rule.enabled || !rule.sourceUrlPattern) continue;

    const patternRegex = new RegExp('^' + rule.sourceUrlPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
    if (patternRegex.test(url)) {
      if (rule.ruleType === 'delay' && rule.delayMs && rule.delayMs > 0) {
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, rule.delayMs);
        await promise;
      }

      if (rule.ruleType === 'redirect' && rule.targetUrl) {
        url = rule.targetUrl;
      }

      if (rule.ruleType === 'modify_headers' && Array.isArray(rule.headersToModify)) {
        rule.headersToModify.forEach(h => {
          if (h.action === 'remove') delete headers[h.key];
          else headers[h.key] = h.value;
        });
      }

      if (rule.ruleType === 'modify_response') {
        const duration = Date.now() - startTime;
        let parsedData: unknown = rule.responseBody;
        let isJson = false;
        try {
          parsedData = JSON.parse(rule.responseBody || '{}');
          isJson = true;
        } catch {}
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
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: { ...headers },
      redirect: 'follow'
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method || '')) {
      if (bodyType === 'json' && body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        const headerRec = fetchOptions.headers as Record<string, string>;
        if (!headerRec['Content-Type'] && !headerRec['content-type']) {
          headerRec['Content-Type'] = 'application/json';
        }
      } else if (bodyType === 'urlencoded' && body) {
        fetchOptions.body = typeof body === 'string' ? body : new URLSearchParams(body as Record<string, string>).toString();
        const headerRec = fetchOptions.headers as Record<string, string>;
        if (!headerRec['Content-Type'] && !headerRec['content-type']) {
          headerRec['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      } else if (body && typeof body === 'string') {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    const contentType = response.headers.get('content-type') || '';
    let responseData: unknown = '';
    let isJson = false;

    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
        isJson = true;
      } catch {
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

  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      success: false,
      error: errorMsg,
      duration
    });
  }
});

// -------------------------------------------------------------
// Cloud Sync Integration
// -------------------------------------------------------------
interface CloudSyncRequestPayload {
  cloudApiUrl?: string;
  syncKey?: string;
}

app.post('/api/cloud/sync/push', async (req: Request, res: Response) => {
  const body: CloudSyncRequestPayload = req.body;
  const cloudApiUrl = body.cloudApiUrl;
  const syncKey = body.syncKey;

  if (!cloudApiUrl || !syncKey) {
    return res.status(400).json({ success: false, error: 'Cloud API URL and Sync Key are required' });
  }

  const collections = readData<CollectionItem[]>('collections.json', []);
  const environments = readData<EnvironmentItem[]>('environments.json', []);

  const items: unknown[] = [];
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

    const data = await resp.json() as { success?: boolean; error?: string };
    if (!resp.ok || !data.success) {
      return res.status(resp.status).json({ success: false, error: data.error || 'Cloud sync failed' });
    }

    res.json({ success: true, message: 'LuluaX-Request data saved to Neon Cloud!', timestamp: Date.now() });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: 'Cloud push network error: ' + errorMsg });
  }
});

interface CloudPullData {
  collections?: CollectionItem[];
  items?: Array<{ id: string; name: string; collectionId?: string; method: string; url: string }>;
  environments?: EnvironmentItem[];
}

app.post('/api/cloud/sync/pull', async (req: Request, res: Response) => {
  const body: CloudSyncRequestPayload = req.body;
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

    const data = await resp.json() as { success?: boolean; error?: string; data?: CloudPullData };
    if (!resp.ok || !data.success) {
      return res.status(resp.status).json({ success: false, error: data.error || 'Cloud pull failed' });
    }

    if (data.data) {
      const { collections = [], items = [], environments = [] } = data.data;
      const colMap = new Map<string, CollectionItem>();
      collections.forEach(c => colMap.set(c.id, { ...c, items: [] }));

      items.forEach(it => {
        if (it.collectionId && colMap.has(it.collectionId)) {
          colMap.get(it.collectionId)?.items.push(it as unknown as CollectionItem['items'][0]);
        } else {
          let unassigned = colMap.get('unassigned');
          if (!unassigned) {
            unassigned = { id: 'unassigned', name: 'General Requests', items: [] };
            colMap.set('unassigned', unassigned);
          }
          unassigned.items.push(it as unknown as CollectionItem['items'][0]);
        }
      });

      writeData('collections.json', Array.from(colMap.values()));
      if (environments.length > 0) writeData('environments.json', environments);
    }

    res.json({ success: true, message: 'Pulled from Neon Cloud database successfully!', timestamp: Date.now() });
  } catch (err: unknown) {
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
