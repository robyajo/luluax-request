# Arsitektur Teknis LuluaX-Request

Dokumen ini menjelaskan rancangan arsitektur internal aplikasi **LuluaX-Request**, alur proxy universal, evaluasi aturan interceptor, dan mock API server lokal.

---

## 1. Diagram Alur Sistem

```
+-------------------------------------------------------------+
|                      Jendela Aplikasi                       |
|           (Electron BrowserWindow / Chrome App Mode)        |
|                                                             |
|   +-----------------------------------------------------+   |
|   |         Antarmuka SPA (Vanilla JS + Code Viewer)    |   |
|   |   • API Request Builder  • HTTP Interceptor Rules   |   |
|   |   • Mock API Server      • Execution History        |   |
|   |   • Environments & Vars  • Code Generator           |   |
|   +--------------------------┬--------------------------+   |
|                              │                              |
+------------------------------┼------------------------------+
                               │ (REST API & Proxy http://127.0.0.1:3990)
                               ▼
+-------------------------------------------------------------+
|             Local Companion Server & Proxy (server.js)      |
|                                                             |
|   +-----------------------------------------------------+   |
|   |        HTTP Interceptor Rules Engine                |   |
|   |  1. Check Delay Rule (Throttling)                   |   |
|   |  2. Check Redirect Rule (URL Rewrite)               |   |
|   |  3. Check Modify Headers (Header Injection)         |   |
|   |  4. Check Modify Response (Mock Intercept)          |   |
|   +--------------------------┬--------------------------+   |
|                              │                              |
|               +--------------┴--------------+               |
|               ▼                             ▼               |
|       Local Mock Engine             Universal Fetch         |
|      (app.all('/mock/*'))         (External Target Server)  |
+-------------------------------------------------------------+
```

---

## 2. Alur Kerja Universal CORS Proxy

Browser web memblokir request JavaScript ke domain eksternal yang tidak memiliki header CORS `Access-Control-Allow-Origin`.
1. LuluaX-Request mengeksekusi request melalui endpoint lokal `POST /api/proxy`.
2. Di dalam proxy:
   - Server membaca daftar aturan aktif di `data/rules.json`.
   - Pola URL dicocokkan menggunakan regex wildcard (`*`).
   - Jika aturan **Delay** aktif, server melakukan jeda buatan (`delayMs`).
   - Jika aturan **Redirect** aktif, URL request digantikan dengan `targetUrl`.
   - Jika aturan **Modify Headers** aktif, header request/response dimanipulasi.
   - Jika aturan **Modify Response** aktif, server langsung mengembalikan payload tiruan tanpa menghubungi server tujuan asli.
3. Jika request dilanjutkan, server Node.js memanggil `fetch()` secara native (bebas CORS) dan mengembalikan status code, response headers, byte size, duration (ms), dan body ke UI.

---

## 3. Pencegahan Fatal Error `ENOTDIR` di Paket ASAR

- Mirip dengan LuluaX-Term, LuluaX-Request dikompilasi menjadi paket Electron ASAR (`app.asar`) yang bersifat *read-only*.
- Fungsi `getWritableDataDir('LuluaX-Request', defaultDataPath)` digunakan untuk mengalihkan penyimpanan file JSON aktif (`collections.json`, `environments.json`, `history.json`, `settings.json`, `mocks.json`, `rules.json`) ke:
  - **Windows**: `%APPDATA%\LuluaX-Request` (`C:\Users\<user>\AppData\Roaming\LuluaX-Request`)
  - **macOS**: `~/Library/Application Support/LuluaX-Request`
- Template bawaan disalin saat peluncuran pertama kali.
