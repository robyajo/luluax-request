class LuluaXRequestApp {
  constructor() {
    this.collections = [];
    this.environments = [];
    this.activeEnvId = '';
    this.history = [];
    this.settings = {};

    this.tabs = []; // { id, reqId, name, method, url, headers, params, bodyType, bodyContent, authType, authConfig }
    this.activeTabId = null;

    this.activeReqConfigTab = 'params';
    this.activeResTab = 'body';
    this.lastResponse = null;
    this.currentUser = null;
    this.authMode = 'login';
    this.serverOnline = false;
    this.rules = [];
    this.mocks = [];

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.detectSystem();
    await this.loadSettings();
    await this.checkServerAndAuth();
    await this.loadEnvironments();
    await this.loadCollections();
    await this.loadHistory();
    await this.loadRules();
    await this.loadMocks();
    this.setupAutoUpdater();
    this.startConnectionHeartbeat();
    if (this.collections.length > 0 && this.collections[0].items.length > 0) {
      this.openRequestInTab(this.collections[0].items[0]);
    } else {
      this.createNewTab();
    }
  }

  setupAutoUpdater() {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable((info) => {
      const banner = document.getElementById('update-banner');
      const msg = document.getElementById('update-banner-msg');
      banner.style.display = 'flex';
      msg.innerHTML = `🚀 Pembaruan Tersedia: <strong>v${this.escapeHtml(info.version)}</strong>!`;
      this.pendingUpdateInfo = info;
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      if (this.isManualUpdateCheck) {
        alert('LuluaX-Request Anda sudah menggunakan versi terbaru!');
        this.isManualUpdateCheck = false;
      }
    });

    window.electronAPI.onDownloadProgress((progress) => {
      const bar = document.getElementById('update-progress-bar');
      const fill = document.getElementById('update-progress-fill');
      const msg = document.getElementById('update-banner-msg');
      bar.style.display = 'block';
      fill.style.width = `${progress.percent}%`;
      msg.innerHTML = `Mengunduh: <strong>${progress.percent}%</strong> (${this.formatBytes(progress.bytesPerSecond || 0)}/s)...`;
    });

    window.electronAPI.onUpdateDownloaded((info) => {
      document.getElementById('update-banner').style.display = 'none';
      document.getElementById('update-downloaded-version').textContent = `v${info.version}`;
      document.getElementById('update-release-notes').textContent = info.releaseNotes || 'Pembaruan stabilitas dan peningkatan performa terbaru.';
      document.getElementById('modal-update-notes').classList.add('active');
    });

    window.electronAPI.onUpdateError((errMsg) => {
      console.warn('Update check error:', errMsg);
      if (this.isManualUpdateCheck) {
        alert('Pemeriksaan pembaruan: ' + errMsg);
        this.isManualUpdateCheck = false;
      }
    });
  }

  async triggerDownloadUpdate() {
    const btn = document.getElementById('btn-download-update');
    btn.disabled = true;
    btn.textContent = 'Memulai Download...';
    if (window.electronAPI) {
      await window.electronAPI.downloadUpdate();
    }
  }

  triggerRestartInstall() {
    if (window.electronAPI) {
      window.electronAPI.quitAndInstall();
    }
  }

  async manualCheckUpdate() {
    this.isManualUpdateCheck = true;
    if (window.electronAPI) {
      await window.electronAPI.checkForUpdate();
    } else {
      alert('Pemeriksaan update otomatis hanya berjalan pada aplikasi desktop Electron terpasang.');
    }
  }

  async checkServerAndAuth() {
    const serverUrl = this.settings.cloudApiUrl || 'https://www.luluax-service.duckdns.org';
    const statusPill = document.getElementById('auth-server-status');
    const statusLabel = document.getElementById('auth-server-label');

    statusPill.className = 'server-status-pill checking';
    statusLabel.textContent = `Memeriksa server cloud (${serverUrl})...`;

    try {
      const healthRes = await fetch(`${serverUrl}/api/health`, { method: 'GET', signal: AbortSignal.timeout(6000) });
      const healthData = await healthRes.json();
      if (healthData.success) {
        this.serverOnline = true;
        statusPill.className = 'server-status-pill online';
        statusLabel.textContent = `● Terhubung ke Server Cloud (${serverUrl})`;
      } else {
        throw new Error('Server unready');
      }
    } catch (e) {
      this.serverOnline = false;
      statusPill.className = 'server-status-pill offline';
      statusLabel.textContent = `▲ Tidak dapat terhubung ke server cloud. Pastikan internet & server aktif.`;
    }

    const savedToken = localStorage.getItem('luluax_req_auth_token');
    if (savedToken && this.serverOnline) {
      try {
        const meRes = await fetch(`${serverUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        const meData = await meRes.json();
        if (meData.success && meData.user) {
          this.currentUser = meData.user;
          document.getElementById('auth-overlay').style.display = 'none';
          this.renderUserProfile();
          return;
        }
      } catch (e) {
        console.warn('Session verification error:', e);
      }
    }

    document.getElementById('auth-overlay').style.display = 'flex';
  }

  switchAuthMode(mode) {
    this.authMode = mode;
    document.getElementById('auth-tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('auth-tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('group-auth-name').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('btn-auth-submit').textContent = mode === 'login' ? 'Masuk ke LuluaX' : 'Daftar Akun Baru';
    document.getElementById('auth-error-msg').style.display = 'none';
  }

  quickFillSeededUser(type) {
    this.switchAuthMode('login');
    if (type === 'roby') {
      document.getElementById('auth-email').value = 'robyfull.dev@gmail.com';
      document.getElementById('auth-password').value = 'Password@123';
    } else {
      document.getElementById('auth-email').value = 'admin@luluax.com';
      document.getElementById('auth-password').value = 'Password@123';
    }
  }

  async handleAuthSubmit() {
    const serverUrl = this.settings.cloudApiUrl || 'https://www.luluax-service.duckdns.org';
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();
    const errorBox = document.getElementById('auth-error-msg');
    const submitBtn = document.getElementById('btn-auth-submit');

    errorBox.style.display = 'none';

    if (!this.serverOnline) {
      errorBox.textContent = 'Gagal: Aplikasi harus terhubung ke internet dan server untuk autentikasi.';
      errorBox.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Memproses...';

    try {
      const endpoint = this.authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = this.authMode === 'login' ? { email, password } : { email, password, name };

      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('luluax_req_auth_token', data.token);
        this.currentUser = data.user;
        document.getElementById('auth-overlay').style.display = 'none';
        this.renderUserProfile();

        if (!this.settings.cloudSyncKey) {
          this.settings.cloudSyncKey = data.user.id || data.user.email;
          document.getElementById('cloud-sync-key').value = this.settings.cloudSyncKey;
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.settings)
          });
        }
      } else {
        errorBox.textContent = data.error || 'Autentikasi gagal. Silakan periksa kembali.';
        errorBox.style.display = 'block';
      }
    } catch (e) {
      errorBox.textContent = 'Kesalahan jaringan: ' + e.message;
      errorBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = this.authMode === 'login' ? 'Masuk ke LuluaX' : 'Daftar Akun Baru';
    }
  }

  renderUserProfile() {
    if (!this.currentUser) return;
    const card = document.getElementById('user-profile-card');
    if (card) card.style.display = 'flex';
    document.getElementById('user-display-name').textContent = this.currentUser.name || this.currentUser.email.split('@')[0];
    document.getElementById('user-display-email').textContent = this.currentUser.email;
    const initials = (this.currentUser.name || this.currentUser.email).substring(0, 1).toUpperCase();
    document.getElementById('user-avatar-initials').textContent = initials;
  }

  async logout() {
    if (!confirm('Apakah Anda yakin ingin keluar / logout?')) return;
    const serverUrl = this.settings.cloudApiUrl || 'https://www.luluax-service.duckdns.org';
    const savedToken = localStorage.getItem('luluax_req_auth_token');

    // Panggil API logout backend untuk membersihkan sesi di server
    if (savedToken) {
      try {
        await fetch(`${serverUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${savedToken}`
          }
        });
      } catch (e) {
        console.warn('Backend logout warning:', e);
      }
    }

    // Bersihkan sesi lokal
    localStorage.removeItem('luluax_req_auth_token');
    this.currentUser = null;
    document.getElementById('user-display-name').textContent = 'Belum Masuk';
    document.getElementById('user-display-email').textContent = 'Klik untuk login';
    document.getElementById('user-avatar-initials').textContent = '?';

    // Kunci kembali dan tampilkan form login
    document.getElementById('auth-overlay').style.display = 'flex';
    this.switchAuthMode('login');
  }

  startConnectionHeartbeat() {
    setInterval(() => this.checkServerConnectivity(true), 12000);

    window.addEventListener('offline', () => {
      this.serverOnline = false;
      this.showGlobalError(
        'Koneksi Internet Terputus',
        'Komputer Anda kehilangan koneksi internet. Aplikasi memerlukan koneksi aktif ke server backend untuk sinkronisasi data.',
        'OFFLINE'
      );
    });

    window.addEventListener('online', () => {
      this.checkServerConnectivity(false);
    });
  }

  async checkServerConnectivity(isBackground = false) {
    const serverUrl = this.settings.cloudApiUrl || 'https://www.luluax-service.duckdns.org';
    try {
      const res = await fetch(`${serverUrl}/api/health`, { method: 'GET', signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (res.ok && data.success) {
        this.serverOnline = true;
        const errModal = document.getElementById('modal-global-error');
        if (errModal && errModal.classList.contains('active') && this.isConnectionError) {
          errModal.classList.remove('active');
          this.isConnectionError = false;
        }
        return true;
      }
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      this.serverOnline = false;
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!isBackground) {
        this.isConnectionError = true;
        this.showGlobalError(
          'Koneksi ke Server Backend Terputus',
          `Gagal menghubungi server cloud di ${serverUrl}.\nPastikan backend aktif dan komputer terhubung ke internet.`,
          'ERR_CONNECTION_FAILED',
          `Target URL: ${serverUrl}/api/health\nTimestamp: ${new Date().toISOString()}\nUser Agent: ${navigator.userAgent}\nError Detail: ${errorMsg}`
        );
      }
      return false;
    }
  }

  showGlobalError(title, desc, statusBadge, details) {
    document.getElementById('global-error-title').textContent = title;
    document.getElementById('global-error-desc').textContent = desc;
    document.getElementById('global-error-status-badge').textContent = statusBadge || 'ERROR';

    const fullDetail = details || `Timestamp: ${new Date().toISOString()}\nError: ${desc}\nTarget Server: ${this.settings.cloudApiUrl || 'https://www.luluax-service.duckdns.org'}`;
    document.getElementById('global-error-content').textContent = fullDetail;
    this.lastGlobalErrorText = `[LuluaX-Request Error Report]\nTitle: ${title}\nStatus: ${statusBadge}\nDescription: ${desc}\n\n${fullDetail}`;

    document.getElementById('modal-global-error').classList.add('active');
  }

  copyGlobalError() {
    const textToCopy = this.lastGlobalErrorText || document.getElementById('global-error-content').textContent;
    navigator.clipboard.writeText(textToCopy);
    const btn = document.getElementById('btn-copy-global-error');
    btn.textContent = '✓ Error Berhasil Disalin!';
    setTimeout(() => btn.textContent = '📋 Salin Pesan Error', 2500);
  }

  async retryServerConnection() {
    const btn = document.getElementById('btn-retry-global-error');
    btn.disabled = true;
    btn.textContent = 'Memeriksa...';

    const ok = await this.checkServerConnectivity(false);
    btn.disabled = false;
    btn.textContent = '🔄 Hubungkan Ulang';

    if (ok) {
      document.getElementById('modal-global-error').classList.remove('active');
      this.isConnectionError = false;
      alert('✓ Berhasil terhubung kembali ke server cloud backend!');
    }
  }
  async detectSystem() {
    try {
      const res = await fetch('/api/system');
      const data = await res.json();
      if (data.success) {
        document.getElementById('sys-platform-badge').textContent = data.platformLabel;
      }
    } catch (e) {
      console.warn('System detection error:', e);
    }
  }

  bindEvents() {
    // Sidebar tabs (Collections vs History)
    document.querySelectorAll('.side-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.side-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`pane-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Request config tabs (Params, Headers, Body, Auth)
    document.querySelectorAll('.config-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.config-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.config-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`pane-${btn.dataset.tab}`).classList.add('active');
        this.activeReqConfigTab = btn.dataset.tab;
      });
    });

    // Response tabs (Body vs Headers)
    document.querySelectorAll('.res-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.res-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.res-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`res-pane-${btn.dataset.resTab}`).classList.add('active');
        this.activeResTab = btn.dataset.resTab;
      });
    });

    // Send Button
    document.getElementById('btn-send').addEventListener('click', () => this.sendRequest());

    // Save Request Button
    document.getElementById('btn-save-request').addEventListener('click', () => this.saveActiveRequest());

    // Code Generator Button
    document.getElementById('btn-code-gen').addEventListener('click', () => this.openCodeGenModal());

    // Add Param / Add Header buttons
    document.getElementById('btn-add-param').addEventListener('click', () => this.addParamRow());
    document.getElementById('btn-add-header').addEventListener('click', () => this.addHeaderRow());

    // Format JSON button
    document.getElementById('btn-format-json').addEventListener('click', () => this.formatJsonBody());

    // Copy Response button
    document.getElementById('btn-copy-response').addEventListener('click', () => {
      if (this.lastResponse && this.lastResponse.data) {
        const text = typeof this.lastResponse.data === 'object' 
          ? JSON.stringify(this.lastResponse.data, null, 2) 
          : String(this.lastResponse.data);
        navigator.clipboard.writeText(text);
        const btn = document.getElementById('btn-copy-response');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy Response', 2000);
      }
    });

    // Environment selector
    document.getElementById('env-select').addEventListener('change', (e) => {
      this.activeEnvId = e.target.value;
    });

    document.getElementById('btn-manage-envs').addEventListener('click', () => this.openEnvsModal());
    document.getElementById('btn-new-collection').addEventListener('click', () => this.promptNewCollection());

    // Clear history
    document.getElementById('btn-clear-history').addEventListener('click', async () => {
      if (confirm('Clear request history?')) {
        await fetch('/api/history', { method: 'DELETE' });
        await this.loadHistory();
      }
    });

    // Cloud modal
    document.getElementById('btn-open-cloud').addEventListener('click', () => {
      document.getElementById('modal-cloud').classList.add('active');
    });

    // Requestly Rules and Mocks buttons
    document.getElementById('btn-new-rule').addEventListener('click', () => this.openRuleModal());
    document.getElementById('btn-new-mock').addEventListener('click', () => this.openMockModal());

    document.getElementById('btn-cloud-push-modal').addEventListener('click', () => this.pushToCloud());
    document.getElementById('btn-cloud-pull-modal').addEventListener('click', () => this.pullFromCloud());

    // Auth selector change
    document.getElementById('auth-type-select').addEventListener('change', (e) => {
      this.switchAuthType(e.target.value);
    });

    // Body type radios
    document.querySelectorAll('input[name="bodyType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const hasContent = e.target.value !== 'none';
        document.getElementById('dot-body').style.display = hasContent ? 'inline-block' : 'none';
      });
    });

    // Code generator tabs
    document.querySelectorAll('.code-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.code-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderCodeSnippet(btn.dataset.lang);
      });
    });

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = document.getElementById('code-snippet-viewer').textContent;
      navigator.clipboard.writeText(code);
      const btn = document.getElementById('btn-copy-code');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
    });
  }

  // -------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------
  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        this.settings = data.settings;
        document.getElementById('cloud-backend-url').value = this.settings.cloudApiUrl || 'http://127.0.0.1:4000';
        document.getElementById('cloud-sync-key').value = this.settings.cloudSyncKey || '';
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  async loadEnvironments() {
    try {
      const res = await fetch('/api/environments');
      const data = await res.json();
      if (data.success) {
        this.environments = data.environments;
        const select = document.getElementById('env-select');
        select.innerHTML = '<option value="">No Environment</option>';
        this.environments.forEach(env => {
          const opt = document.createElement('option');
          opt.value = env.id;
          opt.textContent = env.name;
          if (env.isDefault && !this.activeEnvId) {
            opt.selected = true;
            this.activeEnvId = env.id;
          }
          select.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn('Failed to load environments:', e);
    }
  }

  async loadCollections() {
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (data.success) {
        this.collections = data.collections;
        this.renderCollectionsTree();
      }
    } catch (e) {
      console.warn('Failed to load collections:', e);
    }
  }

  async loadHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.success) {
        this.history = data.history;
        this.renderHistoryList();
      }
    } catch (e) {
      console.warn('Failed to load history:', e);
    }
  }

  // -------------------------------------------------------------
  // Request Tabs Management
  // -------------------------------------------------------------
  openRequestInTab(reqItem) {
    let tab = this.tabs.find(t => t.reqId === reqItem.id);
    if (!tab) {
      tab = {
        id: 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        reqId: reqItem.id,
        name: reqItem.name || 'Untitled Request',
        method: reqItem.method || 'GET',
        url: reqItem.url || '',
        headers: reqItem.headers || [],
        params: reqItem.params || [],
        bodyType: reqItem.bodyType || 'none',
        bodyContent: reqItem.bodyContent || '',
        authType: reqItem.authType || 'none',
        authConfig: reqItem.authConfig || {}
      };
      this.tabs.push(tab);
    }
    this.activateTab(tab.id);
    this.renderRequestTabs();
  }

  createNewTab() {
    const tab = {
      id: 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      reqId: null,
      name: 'New Request',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: [],
      params: [],
      bodyType: 'none',
      bodyContent: '',
      authType: 'none',
      authConfig: {}
    };
    this.tabs.push(tab);
    this.activateTab(tab.id);
    this.renderRequestTabs();
  }

  activateTab(tabId) {
    this.saveCurrentTabFormState();
    this.activeTabId = tabId;
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    this.renderRequestTabs();
    this.populateTabFormData(tab);
  }

  closeTab(tabId, e) {
    if (e) e.stopPropagation();
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    this.tabs.splice(index, 1);
    if (this.tabs.length === 0) {
      this.createNewTab();
    } else {
      const nextTab = this.tabs[Math.max(0, index - 1)];
      this.activateTab(nextTab.id);
    }
  }

  renderRequestTabs() {
    const container = document.getElementById('request-tabs-bar');
    container.innerHTML = '';

    this.tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = `req-tab ${tab.id === this.activeTabId ? 'active' : ''}`;
      el.innerHTML = `
        <span class="req-badge-method method-${tab.method}">${tab.method}</span>
        <span>${this.escapeHtml(tab.name)}</span>
        <button class="req-tab-close">&times;</button>
      `;
      el.addEventListener('click', () => this.activateTab(tab.id));
      el.querySelector('.req-tab-close').addEventListener('click', (ev) => this.closeTab(tab.id, ev));
      container.appendChild(el);
    });

    // "+ New" tab button
    const plusBtn = document.createElement('button');
    plusBtn.className = 'btn-icon-sm';
    plusBtn.style.padding = '0 8px';
    plusBtn.innerHTML = '+';
    plusBtn.title = 'New Request Tab';
    plusBtn.addEventListener('click', () => this.createNewTab());
    container.appendChild(plusBtn);
  }

  saveCurrentTabFormState() {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;

    tab.method = document.getElementById('req-method').value;
    tab.url = document.getElementById('req-url').value;
    tab.params = this.getParamsFromTable();
    tab.headers = this.getHeadersFromTable();
    tab.bodyType = document.querySelector('input[name="bodyType"]:checked')?.value || 'none';
    tab.bodyContent = document.getElementById('body-content').value;
    tab.authType = document.getElementById('auth-type-select').value;
  }

  populateTabFormData(tab) {
    document.getElementById('req-method').value = tab.method;
    document.getElementById('req-url').value = tab.url;

    // Params table
    this.renderParamsTable(tab.params);
    // Headers table
    this.renderHeadersTable(tab.headers);

    // Body
    const bodyRadio = document.querySelector(`input[name="bodyType"][value="${tab.bodyType || 'none'}"]`);
    if (bodyRadio) bodyRadio.checked = true;
    document.getElementById('body-content').value = tab.bodyContent || '';
    document.getElementById('dot-body').style.display = (tab.bodyType && tab.bodyType !== 'none') ? 'inline-block' : 'none';

    // Auth
    document.getElementById('auth-type-select').value = tab.authType || 'none';
    this.switchAuthType(tab.authType || 'none');
  }

  // -------------------------------------------------------------
  // Variable Interpolation ({{baseUrl}}, {{token}})
  // -------------------------------------------------------------
  resolveVariables(str) {
    if (!str) return '';
    if (!this.activeEnvId) return str;

    const env = this.environments.find(e => e.id === this.activeEnvId);
    if (!env || !Array.isArray(env.variables)) return str;

    let res = str;
    env.variables.forEach(v => {
      if (v.enabled && v.key) {
        const regex = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
        res = res.replace(regex, v.value);
      }
    });
    return res;
  }

  // -------------------------------------------------------------
  // Send Request (via local /api/proxy)
  // -------------------------------------------------------------
  async sendRequest() {
    this.saveCurrentTabFormState();
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;

    let url = this.resolveVariables(tab.url.trim());
    if (!url) {
      alert('Please enter a request URL.');
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      url = 'http://' + url;
    }

    // Attach active query params to URL
    const activeParams = tab.params.filter(p => p.enabled && p.key);
    if (activeParams.length > 0) {
      const urlObj = new URL(url);
      activeParams.forEach(p => {
        urlObj.searchParams.append(this.resolveVariables(p.key), this.resolveVariables(p.value));
      });
      url = urlObj.toString();
    }

    // Prepare headers
    const activeHeaders = {};
    tab.headers.filter(h => h.enabled && h.key).forEach(h => {
      activeHeaders[this.resolveVariables(h.key)] = this.resolveVariables(h.value);
    });

    // Auth injection
    if (tab.authType === 'bearer') {
      const token = this.resolveVariables(document.getElementById('auth-bearer-token').value.trim());
      if (token) activeHeaders['Authorization'] = `Bearer ${token}`;
    } else if (tab.authType === 'basic') {
      const user = this.resolveVariables(document.getElementById('auth-basic-user').value.trim());
      const pass = this.resolveVariables(document.getElementById('auth-basic-pass').value.trim());
      activeHeaders['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
    } else if (tab.authType === 'apikey') {
      const key = this.resolveVariables(document.getElementById('auth-apikey-key').value.trim());
      const val = this.resolveVariables(document.getElementById('auth-apikey-val').value.trim());
      const where = document.getElementById('auth-apikey-where').value;
      if (key) {
        if (where === 'header') activeHeaders[key] = val;
        else {
          const urlObj = new URL(url);
          urlObj.searchParams.append(key, val);
          url = urlObj.toString();
        }
      }
    }

    // Prepare body
    let body = null;
    if (tab.bodyType !== 'none') {
      body = this.resolveVariables(tab.bodyContent);
    }

    // UI Loading state
    const sendBtn = document.getElementById('btn-send');
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<span>Sending...</span>`;

    const statusBadge = document.getElementById('response-status-badge');
    statusBadge.className = 'badge-status status-empty';
    statusBadge.textContent = 'Sending...';

    const viewer = document.getElementById('response-viewer');
    viewer.textContent = 'Awaiting response from target server...';

    try {
      const proxyRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          method: tab.method,
          headers: activeHeaders,
          body,
          bodyType: tab.bodyType
        })
      });

      const result = await proxyRes.json();
      this.lastResponse = result;

      // Update response badges
      const status = result.status || 500;
      statusBadge.textContent = `${status} ${result.statusText || ''}`;
      if (status >= 200 && status < 300) statusBadge.className = 'badge-status status-2xx';
      else if (status >= 400 && status < 500) statusBadge.className = 'badge-status status-4xx';
      else statusBadge.className = 'badge-status status-5xx';

      document.getElementById('response-time-badge').textContent = `${result.duration || 0} ms`;
      document.getElementById('response-size-badge').textContent = this.formatBytes(result.size || 0);

      // Render Body viewer
      if (result.isJson) {
        viewer.textContent = JSON.stringify(result.data, null, 2);
      } else {
        viewer.textContent = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
      }

      // Render Response Headers
      this.renderResponseHeaders(result.headers || {});

      // Record to history
      await this.recordHistory({
        method: tab.method,
        url,
        statusCode: status,
        durationMs: result.duration || 0,
        responseSize: result.size || 0,
        executedAt: Date.now()
      });

    } catch (err) {
      statusBadge.className = 'badge-status status-5xx';
      statusBadge.textContent = 'Error';
      viewer.textContent = `Error: ${err.message}`;
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = `<span>Send</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    }
  }

  renderResponseHeaders(headers) {
    const tbody = document.getElementById('res-headers-tbody');
    tbody.innerHTML = '';
    const entries = Object.entries(headers);
    document.getElementById('res-headers-count').textContent = entries.length;

    entries.forEach(([k, v]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--cyan); font-family:var(--font-mono); font-weight:600">${this.escapeHtml(k)}</td>
        <td style="font-family:var(--font-mono)">${this.escapeHtml(v)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async recordHistory(entry) {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      await this.loadHistory();
    } catch (e) {
      console.warn('History record error:', e);
    }
  }

  // -------------------------------------------------------------
  // Tables: Params & Headers
  // -------------------------------------------------------------
  renderParamsTable(params) {
    const tbody = document.getElementById('params-tbody');
    tbody.innerHTML = '';
    document.getElementById('count-params').textContent = (params || []).filter(p => p.enabled && p.key).length;

    (params || []).forEach((p, idx) => {
      tbody.appendChild(this.createKvRow('param', p, idx));
    });
  }

  renderHeadersTable(headers) {
    const tbody = document.getElementById('headers-tbody');
    tbody.innerHTML = '';
    document.getElementById('count-headers').textContent = (headers || []).filter(h => h.enabled && h.key).length;

    (headers || []).forEach((h, idx) => {
      tbody.appendChild(this.createKvRow('header', h, idx));
    });
  }

  createKvRow(type, item, idx) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" ${item.enabled !== false ? 'checked' : ''} class="kv-enable"></td>
      <td><input type="text" class="kv-input kv-key" value="${this.escapeHtml(item.key || '')}" placeholder="Key"></td>
      <td><input type="text" class="kv-input kv-val" value="${this.escapeHtml(item.value || '')}" placeholder="Value"></td>
      <td><input type="text" class="kv-input kv-desc" value="${this.escapeHtml(item.description || '')}" placeholder="Description"></td>
      <td><button class="btn-icon-sm kv-del" title="Delete Row">&times;</button></td>
    `;
    tr.querySelector('.kv-del').addEventListener('click', () => {
      tr.remove();
      this.updateCounts();
    });
    tr.querySelector('.kv-enable').addEventListener('change', () => this.updateCounts());
    return tr;
  }

  addParamRow() {
    const tbody = document.getElementById('params-tbody');
    tbody.appendChild(this.createKvRow('param', { key: '', value: '', enabled: true }));
  }

  addHeaderRow() {
    const tbody = document.getElementById('headers-tbody');
    tbody.appendChild(this.createKvRow('header', { key: '', value: '', enabled: true }));
  }

  getParamsFromTable() {
    const rows = document.querySelectorAll('#params-tbody tr');
    const items = [];
    rows.forEach(r => {
      const key = r.querySelector('.kv-key').value.trim();
      const value = r.querySelector('.kv-val').value;
      const enabled = r.querySelector('.kv-enable').checked;
      const desc = r.querySelector('.kv-desc').value;
      if (key) items.push({ key, value, enabled, description: desc });
    });
    return items;
  }

  getHeadersFromTable() {
    const rows = document.querySelectorAll('#headers-tbody tr');
    const items = [];
    rows.forEach(r => {
      const key = r.querySelector('.kv-key').value.trim();
      const value = r.querySelector('.kv-val').value;
      const enabled = r.querySelector('.kv-enable').checked;
      const desc = r.querySelector('.kv-desc').value;
      if (key) items.push({ key, value, enabled, description: desc });
    });
    return items;
  }

  updateCounts() {
    document.getElementById('count-params').textContent = this.getParamsFromTable().filter(p => p.enabled && p.key).length;
    document.getElementById('count-headers').textContent = this.getHeadersFromTable().filter(h => h.enabled && h.key).length;
  }

  formatJsonBody() {
    const editor = document.getElementById('body-content');
    try {
      const parsed = JSON.parse(editor.value);
      editor.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
      alert('Invalid JSON: ' + e.message);
    }
  }

  switchAuthType(type) {
    document.getElementById('auth-bearer-group').style.display = type === 'bearer' ? 'block' : 'none';
    document.getElementById('auth-basic-group').style.display = type === 'basic' ? 'block' : 'none';
    document.getElementById('auth-apikey-group').style.display = type === 'apikey' ? 'block' : 'none';
  }

  // -------------------------------------------------------------
  // Collections Sidebar Tree
  // -------------------------------------------------------------
  renderCollectionsTree() {
    const tree = document.getElementById('collections-tree');
    tree.innerHTML = '';

    if (this.collections.length === 0) {
      tree.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px">No collections. Click + to create one.</div>`;
      return;
    }

    this.collections.forEach(col => {
      const colDiv = document.createElement('div');
      colDiv.className = 'col-folder';
      colDiv.innerHTML = `
        <div class="col-folder-header">
          <div style="display:flex; align-items:center; gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>${this.escapeHtml(col.name)}</span>
          </div>
          <button class="btn-icon-sm btn-add-req-to-col" title="Add Request to Collection">+</button>
        </div>
        <div class="col-items-list"></div>
      `;

      colDiv.querySelector('.btn-add-req-to-col').addEventListener('click', (e) => {
        e.stopPropagation();
        this.addRequestToCollection(col.id);
      });

      const listDiv = colDiv.querySelector('.col-items-list');
      (col.items || []).forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'req-tree-item';
        itemEl.innerHTML = `
          <div style="display:flex; align-items:center">
            <span class="req-badge-method method-${item.method}">${item.method}</span>
            <span>${this.escapeHtml(item.name)}</span>
          </div>
          <button class="btn-icon-sm btn-del-req" title="Delete">&times;</button>
        `;

        itemEl.addEventListener('click', () => this.openRequestInTab(item));
        itemEl.querySelector('.btn-del-req').addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteRequest(col.id, item.id);
        });

        listDiv.appendChild(itemEl);
      });

      tree.appendChild(colDiv);
    });
  }

  renderHistoryList() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (this.history.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px">No history recorded yet.</div>`;
      return;
    }

    this.history.forEach(h => {
      const itemEl = document.createElement('div');
      itemEl.className = 'req-tree-item';
      itemEl.innerHTML = `
        <div style="display:flex; align-items:center; overflow:hidden; gap:6px">
          <span class="req-badge-method method-${h.method}">${h.method}</span>
          <span style="font-family:var(--font-mono); font-size:11px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap">${this.escapeHtml(h.url)}</span>
        </div>
        <span class="badge-status ${h.statusCode >= 200 && h.statusCode < 300 ? 'status-2xx' : 'status-4xx'}" style="font-size:9px; padding:1px 4px">${h.statusCode}</span>
      `;

      itemEl.addEventListener('click', () => {
        this.createNewTab();
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) {
          tab.method = h.method;
          tab.url = h.url;
          this.populateTabFormData(tab);
          this.renderRequestTabs();
        }
      });

      list.appendChild(itemEl);
    });
  }

  async promptNewCollection() {
    const name = prompt('Enter new Collection name:');
    if (!name) return;
    const newCol = {
      id: 'col_' + Date.now(),
      name,
      description: '',
      items: []
    };
    this.collections.push(newCol);
    await this.persistCollections();
  }

  async addRequestToCollection(colId) {
    const name = prompt('Request name:', 'New API Request');
    if (!name) return;
    const col = this.collections.find(c => c.id === colId);
    if (!col) return;

    const newItem = {
      id: 'req_' + Date.now(),
      name,
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      headers: [],
      params: [],
      bodyType: 'none',
      bodyContent: '',
      authType: 'none',
      authConfig: {}
    };

    if (!Array.isArray(col.items)) col.items = [];
    col.items.push(newItem);
    await this.persistCollections();
    this.openRequestInTab(newItem);
  }

  async deleteRequest(colId, reqId) {
    if (!confirm('Delete this request?')) return;
    const col = this.collections.find(c => c.id === colId);
    if (!col || !Array.isArray(col.items)) return;

    col.items = col.items.filter(it => it.id !== reqId);
    await this.persistCollections();
  }

  async saveActiveRequest() {
    this.saveCurrentTabFormState();
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;

    let found = false;
    for (const col of this.collections) {
      if (Array.isArray(col.items)) {
        const item = col.items.find(it => it.id === tab.reqId);
        if (item) {
          Object.assign(item, {
            name: tab.name,
            method: tab.method,
            url: tab.url,
            headers: tab.headers,
            params: tab.params,
            bodyType: tab.bodyType,
            bodyContent: tab.bodyContent,
            authType: tab.authType
          });
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Prompt which collection to save into
      if (this.collections.length === 0) {
        await this.promptNewCollection();
      }
      if (this.collections.length > 0) {
        tab.reqId = 'req_' + Date.now();
        this.collections[0].items.push({
          id: tab.reqId,
          name: tab.name,
          method: tab.method,
          url: tab.url,
          headers: tab.headers,
          params: tab.params,
          bodyType: tab.bodyType,
          bodyContent: tab.bodyContent,
          authType: tab.authType
        });
      }
    }

    await this.persistCollections();
    alert('Request saved successfully to collection!');
  }

  async persistCollections() {
    try {
      await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.collections)
      });
      this.renderCollectionsTree();
    } catch (e) {
      console.warn('Persist error:', e);
    }
  }

  // -------------------------------------------------------------
  // Code Snippet Generator
  // -------------------------------------------------------------
  openCodeGenModal() {
    this.saveCurrentTabFormState();
    this.renderCodeSnippet('curl');
    document.getElementById('modal-code').classList.add('active');
  }

  renderCodeSnippet(lang) {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;

    const url = this.resolveVariables(tab.url);
    const method = tab.method;
    const pre = document.getElementById('code-snippet-viewer');

    if (lang === 'curl') {
      let code = `curl -X ${method} "${url}"`;
      tab.headers.filter(h => h.enabled && h.key).forEach(h => {
        code += ` \\\n  -H "${h.key}: ${h.value}"`;
      });
      if (['POST', 'PUT', 'PATCH'].includes(method) && tab.bodyContent) {
        code += ` \\\n  -d '${tab.bodyContent.replace(/'/g, "'\\''")}'`;
      }
      pre.textContent = code;
    } else if (lang === 'fetch') {
      const headersObj = {};
      tab.headers.filter(h => h.enabled && h.key).forEach(h => {
        headersObj[h.key] = h.value;
      });
      let code = `const response = await fetch("${url}", {\n`;
      code += `  method: "${method}",\n`;
      if (Object.keys(headersObj).length > 0) {
        code += `  headers: ${JSON.stringify(headersObj, null, 4)},\n`;
      }
      if (['POST', 'PUT', 'PATCH'].includes(method) && tab.bodyContent) {
        code += `  body: JSON.stringify(${tab.bodyContent})\n`;
      }
      code += `});\nconst data = await response.json();\nconsole.log(data);`;
      pre.textContent = code;
    } else if (lang === 'python') {
      let code = `import requests\n\n`;
      code += `url = "${url}"\n`;
      const headersObj = {};
      tab.headers.filter(h => h.enabled && h.key).forEach(h => {
        headersObj[h.key] = h.value;
      });
      if (Object.keys(headersObj).length > 0) {
        code += `headers = ${JSON.stringify(headersObj, null, 2)}\n`;
      }
      code += `response = requests.${method.toLowerCase()}(url${Object.keys(headersObj).length > 0 ? ', headers=headers' : ''})\n`;
      code += `print(response.json())`;
      pre.textContent = code;
    } else if (lang === 'axios') {
      let code = `const axios = require('axios');\n\n`;
      code += `const res = await axios({\n`;
      code += `  method: '${method.toLowerCase()}',\n`;
      code += `  url: '${url}',\n`;
      if (['POST', 'PUT', 'PATCH'].includes(method) && tab.bodyContent) {
        code += `  data: ${tab.bodyContent}\n`;
      }
      code += `});\nconsole.log(res.data);`;
      pre.textContent = code;
    }
  }

  // -------------------------------------------------------------
  // Cloud Sync (Neon Backend)
  // -------------------------------------------------------------
  async pushToCloud() {
    const cloudUrl = document.getElementById('cloud-backend-url').value.trim();
    const syncKey = document.getElementById('cloud-sync-key').value.trim();
    const statusBox = document.getElementById('cloud-modal-status');
    statusBox.style.display = 'block';
    statusBox.textContent = 'Pushing to Neon cloud database...';

    if (!cloudUrl || !syncKey) {
      statusBox.textContent = 'Error: Backend URL and Sync Key are required.';
      return;
    }

    try {
      const res = await fetch('/api/cloud/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudApiUrl: cloudUrl, syncKey })
      });
      const data = await res.json();
      if (data.success) {
        statusBox.textContent = '✓ Successfully saved to Neon cloud!';
        document.getElementById('sidebar-cloud-text').textContent = 'Neon Cloud Synced';
      } else {
        statusBox.textContent = '✗ ' + (data.error || 'Sync failed');
      }
    } catch (e) {
      statusBox.textContent = '✗ Network error: ' + e.message;
    }
  }

  async pullFromCloud() {
    const cloudUrl = document.getElementById('cloud-backend-url').value.trim();
    const syncKey = document.getElementById('cloud-sync-key').value.trim();
    const statusBox = document.getElementById('cloud-modal-status');
    statusBox.style.display = 'block';
    statusBox.textContent = 'Pulling from Neon cloud database...';

    if (!cloudUrl || !syncKey) {
      statusBox.textContent = 'Error: Backend URL and Sync Key are required.';
      return;
    }

    try {
      const res = await fetch('/api/cloud/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudApiUrl: cloudUrl, syncKey })
      });
      const data = await res.json();
      if (data.success) {
        statusBox.textContent = '✓ Successfully pulled from Neon cloud!';
        await this.loadCollections();
        await this.loadEnvironments();
        document.getElementById('sidebar-cloud-text').textContent = 'Neon Cloud Synced';
      } else {
        statusBox.textContent = '✗ ' + (data.error || 'Pull failed');
      }
    } catch (e) {
      statusBox.textContent = '✗ Network error: ' + e.message;
    }
  }

  // -------------------------------------------------------------
  // Requestly Signature Features: HTTP Rules & Mock Server
  // -------------------------------------------------------------
  async loadRules() {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (data.success) {
        this.rules = data.rules;
        this.renderRules();
      }
    } catch (e) {
      console.warn('Load rules error:', e);
    }
  }

  renderRules() {
    const list = document.getElementById('rules-list');
    list.innerHTML = '';
    if (this.rules.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px">Belum ada HTTP Rule. Klik "+ New Rule" untuk membuat.</div>`;
      return;
    }

    this.rules.forEach(r => {
      const el = document.createElement('div');
      el.className = 'rule-card';
      el.innerHTML = `
        <div class="rule-header">
          <div style="display:flex; align-items:center; gap:6px">
            <span class="rule-tag ${r.ruleType}">${r.ruleType.replace('_', ' ')}</span>
            <span class="rule-title">${this.escapeHtml(r.name)}</span>
          </div>
          <label class="switch-toggle">
            <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="app.toggleRule('${r.id}')">
            <span class="slider"></span>
          </label>
        </div>
        <div class="rule-detail">${this.escapeHtml(r.sourceUrlPattern)}</div>
        <div style="display:flex; justify-content:space-between; align-items:center">
          <span style="font-size:10px; color:var(--text-muted)">
            ${r.ruleType === 'redirect' ? '➔ ' + this.escapeHtml(r.targetUrl || '') : (r.ruleType === 'delay' ? `Delay: ${r.delayMs}ms` : 'Response Override')}
          </span>
          <button class="btn-icon-sm" title="Hapus Rule" onclick="app.deleteRule('${r.id}')">&times;</button>
        </div>
      `;
      list.appendChild(el);
    });
  }

  openRuleModal() {
    document.getElementById('form-rule').reset();
    document.getElementById('rule-id').value = '';
    this.switchRuleFormType('redirect');
    document.getElementById('modal-rule').classList.add('active');
  }

  switchRuleFormType(type) {
    document.getElementById('group-rule-target').style.display = type === 'redirect' ? 'block' : 'none';
    document.getElementById('group-rule-delay').style.display = type === 'delay' ? 'block' : 'none';
    document.getElementById('group-rule-response').style.display = type === 'modify_response' ? 'block' : 'none';
  }

  async saveRule() {
    const type = document.getElementById('rule-type').value;
    const payload = {
      name: document.getElementById('rule-name').value.trim(),
      ruleType: type,
      sourceUrlPattern: document.getElementById('rule-pattern').value.trim(),
      targetUrl: document.getElementById('rule-target-url').value.trim(),
      delayMs: parseInt(document.getElementById('rule-delay-ms').value, 10) || 0,
      statusCode: parseInt(document.getElementById('rule-status-code').value, 10) || 200,
      responseBody: document.getElementById('rule-response-body').value,
      enabled: true
    };

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.closeModal('modal-rule');
        await this.loadRules();
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async toggleRule(id) {
    try {
      await fetch(`/api/rules/${id}/toggle`, { method: 'POST' });
      await this.loadRules();
    } catch (e) {
      console.warn('Toggle error:', e);
    }
  }

  async deleteRule(id) {
    if (!confirm('Hapus rule ini?')) return;
    try {
      await fetch(`/api/rules/${id}`, { method: 'DELETE' });
      await this.loadRules();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async loadMocks() {
    try {
      const res = await fetch('/api/mocks');
      const data = await res.json();
      if (data.success) {
        this.mocks = data.mocks;
        this.renderMocks();
      }
    } catch (e) {
      console.warn('Load mocks error:', e);
    }
  }

  renderMocks() {
    const list = document.getElementById('mocks-list');
    list.innerHTML = '';
    if (this.mocks.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px">Belum ada Mock API Endpoint. Klik "+ New Mock" untuk membuat.</div>`;
      return;
    }

    this.mocks.forEach(m => {
      const el = document.createElement('div');
      el.className = 'mock-card';
      el.innerHTML = `
        <div class="mock-header">
          <div style="display:flex; align-items:center; gap:6px">
            <span class="req-badge-method method-${m.method}">${m.method}</span>
            <span class="mock-title">${this.escapeHtml(m.name)}</span>
          </div>
          <span class="badge-status status-2xx" style="font-size:9.5px">${m.statusCode}</span>
        </div>
        <div class="mock-detail">${this.escapeHtml(m.endpoint)}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px">
          <button class="btn-text-sm" onclick="app.testMockInActiveTab('${this.escapeJs(m.method)}', '${this.escapeJs(m.endpoint)}')">
            ▶ Uji di Editor
          </button>
          <button class="btn-icon-sm" title="Hapus Mock" onclick="app.deleteMock('${m.id}')">&times;</button>
        </div>
      `;
      list.appendChild(el);
    });
  }

  openMockModal() {
    document.getElementById('form-mock').reset();
    document.getElementById('modal-mock').classList.add('active');
  }

  async saveMock() {
    const payload = {
      name: document.getElementById('mock-name').value.trim(),
      method: document.getElementById('mock-method').value,
      endpoint: document.getElementById('mock-endpoint').value.trim(),
      statusCode: parseInt(document.getElementById('mock-status-code').value, 10) || 200,
      delayMs: parseInt(document.getElementById('mock-delay-ms').value, 10) || 0,
      responseBody: document.getElementById('mock-body').value
    };

    try {
      const res = await fetch('/api/mocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.closeModal('modal-mock');
        await this.loadMocks();
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  testMockInActiveTab(method, endpoint) {
    this.createNewTab();
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) {
      tab.method = method;
      tab.url = `http://127.0.0.1:3990${endpoint}`;
      this.populateTabFormData(tab);
      this.renderRequestTabs();
    }
  }

  async deleteMock(id) {
    if (!confirm('Hapus mock endpoint ini?')) return;
    try {
      await fetch(`/api/mocks/${id}`, { method: 'DELETE' });
      await this.loadMocks();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // -------------------------------------------------------------
  // Modals & Utilities
  // -------------------------------------------------------------
  closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  escapeJs(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

const app = new LuluaXRequestApp();
