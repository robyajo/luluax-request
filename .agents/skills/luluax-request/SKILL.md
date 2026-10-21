---
name: luluax-request
description: "Arsitektur dan panduan pengembangan aplikasi LuluaX-Request: API Client & HTTP Interceptor multi-platform (Windows x64/ARM64 dan macOS Apple Silicon M-Series). Meliputi Universal CORS Proxy di port 3990, HTTP Interceptor Rules (Redirect, Modify Headers, Modify Response, Delay/Throttling) khas Requestly, Mock API Server lokal (/mock/*), Environment Variables ({{baseUrl}}), Code Snippet Generator (cURL, fetch, axios, requests), dan Cloud Sync ke Hono + Neon PostgreSQL (https://www.er-service.duckdns.org). Gunakan skill ini setiap kali mengembangkan, memperbaiki bug, menambah fitur, atau memaketkan aplikasi LuluaX-Request."
---

# LuluaX-Request — Panduan Arsitektur & Pengembangan AI Agent

Skill ini memuat seluruh panduan arsitektur, struktur kode, alur kerja, konvensi, dan aturan teknis untuk mengembangkan aplikasi **LuluaX-Request** di perangkat mana pun.

---

## 1. Arsitektur & Teknologi Utama

- **Jenis Aplikasi**: Desktop Client (Electron app mandiri atau Web-App via Express).
- **Frontend**:
  - UI Engine: Vanilla JavaScript SPA tanpa dependensi framework berat, tema gelap terinspirasi Requestly (`theme-dark`).
  - File UI: `public/index.html`, `public/style.css`, `public/app.js`.
- **Backend Lokal & Proxy (`server.js`)**:
  - Server: Express pada port bawaan **3990** (dapat diubah via `PORT` di `.env`).
  - Universal CORS Proxy (`POST /api/proxy`): Menjalankan pemanggilan HTTP apapun (GET, POST, PUT, DELETE, dll.) dari server lokal Node.js sehingga browser bebas dari blokir CORS!
  - Penyimpanan Data: `AppData/Roaming/LuluaX-Request` di Windows atau `~/Library/Application Support/LuluaX-Request` di macOS (menghindari error `ENOTDIR` saat dibundel ASAR).
- **Cloud Backend**:
  - Live Domain: `https://www.er-service.duckdns.org` (Hono Serverless + Drizzle ORM + Neon PostgreSQL).
  - Skema tabel di Neon: `req_collections`, `req_items`, `req_environments`, `req_history`, `req_mocks`, `req_rules`.

---

## 2. Fitur-Fitur Khas Requestly & Cara Kerjanya

### A. HTTP Interceptor Rules (Fitur Inti Requestly)
Proxy `/api/proxy` di `server.js` otomatis memeriksa daftar aturan aktif di `data/rules.json` sebelum request diteruskan:
1. **Redirect Rule**:
   - Pola pencocokan wildcard (misal `*api.prod.com/users*`).
   - Otomatis mengalihkan URL request ke `targetUrl` (misal `http://localhost:3000/users`).
2. **Modify Headers Rule**:
   - Menambah, menimpa, atau menghapus request & response headers.
3. **Modify Response Rule (Mock Intercept)**:
   - Memotong request ke endpoint tertentu dan langsung mengembalikan payload JSON tiruan (`responseBody`) serta `statusCode` kustom tanpa memanggil server sebenarnya.
4. **Delay Request Rule (Throttling)**:
   - Menambahkan jeda waktu buatan (`delayMs`, misal 1500ms) untuk menguji kondisi jaringan lambat / 3G loading states.
- Endpoint API: `GET /api/rules`, `POST /api/rules`, `POST /api/rules/:id/toggle`, `DELETE /api/rules/:id`.

### B. Mock API Server
- Membuat endpoint mock langsung di aplikasi (contoh: `GET /mock/api/users`).
- Endpoint handler di `server.js`: `app.all('/mock/*', ...)` yang membaca `data/mocks.json`.
- Mendukung:
  - Custom Status Code (`200`, `201`, `400`, `404`, `500`).
  - Custom Delay Latency (`ms`).
  - Custom JSON Response Payload.
- Tombol *Uji di Editor* otomatis membuat tab request baru yang memanggil mock tersebut.
- Endpoint API: `GET /api/mocks`, `POST /api/mocks`, `DELETE /api/mocks/:id`.

### C. Request Builder & Variabel Lingkungan
- Metode: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
- Interpolasi variabel dinamis dengan sintaks `{{variableName}}` (contoh: `{{backendUrl}}/api/health`) yang diresolusi berdasarkan environment aktif.
- Code Generator: Ekspor instan ke format **cURL**, **JavaScript (fetch)**, **Node.js (axios)**, dan **Python (requests)**.

### D. Autentikasi Pengguna & Guard Screen
- Sebelum aplikasi dapat digunakan, layar terkunci oleh `#auth-overlay` yang mewajibkan login/register ke backend cloud (`https://www.er-service.duckdns.org`).
- Akun bawaan (Seeded di Neon Postgres):
  - **Developer**: `robyfull.dev@gmail.com` | `Password@123`
  - **Admin**: `admin@luluax.com` | `Password@123`
- Token disimpan di `localStorage.getItem('luluax_req_auth_token')`.

---

## 3. Struktur Direktori Proyek

```
luluax-request/
├── .env                       # PORT=3990, CLOUD_API_URL, CLOUD_SYNC_KEY
├── .env.example               # Template environment
├── .gitignore                 # Mengabaikan node_modules, dist, .env
├── server.js                  # Express backend, Universal CORS Proxy, Mock Engine, Rules Engine
├── electron-main.js           # Electron wrapper native desktop window
├── package.json               # Dependensi & skrip runner
├── dev-mac.sh                 # [macOS] Development launcher
├── build-mac.sh               # [macOS] Installer builder (.dmg & .app)
├── dev-win.bat                # [Windows] Development launcher
├── build-win.bat              # [Windows] Executable builder (.exe)
├── data/                      # File template/seed awal (collections, environments, history, settings, mocks, rules)
├── public/                    # Frontend SPA
│   ├── index.html             # Antarmuka Requestly (Requests, Rules, Mocks, History)
│   ├── style.css              # Tema gelap, Rules cards, Mock cards, Code viewer
│   └── app.js                 # Controller logika Request builder, Proxy, Rules, Mocks, Auth
└── dist/                      # Folder output build executable (.exe / .dmg)
```

---

## 4. Perintah Operasional

### A. Di macOS (Apple Silicon M1/M2/M3/M4 & Intel):
```bash
# Jalankan mode development
cd luluax-request
chmod +x dev-mac.sh
./dev-mac.sh
# Atau: npm run dev:mac

# Build installer native (.dmg & .app)
chmod +x build-mac.sh
./build-mac.sh              # Default: arm64
./build-mac.sh --x64        # Untuk Intel
# Atau: npm run build:mac
```

### B. Di Windows:
```cmd
cd luluax-request
:: Jalankan mode development
dev-win.bat
:: Atau: npm run dev:win

:: Build executable Windows (.exe portable & win-unpacked)
build-win.bat
:: Atau: npm run build:win
```

---

## 5. Aturan Penting Saat Mengedit Kode (Troubleshooting & Invariants)

1. **JANGAN PERNAH MENULIS KE `__dirname` DI DALAM ASAR (Mencegah `ENOTDIR`)**:
   Saat dibundel Electron `.exe`, `__dirname` berada di dalam file arsip `app.asar` yang bersifat *read-only*. Gunakan selalu fungsi `getWritableDataDir('LuluaX-Request', ...)` yang mengarahkan penulisan data ke `%APPDATA%\LuluaX-Request` di Windows atau `~/Library/Application Support/LuluaX-Request` di macOS.
2. **CORS Proxy Transparency**:
   Selalu pastikan proxy di `/api/proxy` meneruskan header `Content-Type` yang sesuai (JSON, URL-encoded, multipart) dan menghitung durasi request secara akurat.
3. **Port Conflict Avoidance**:
   `luluax-request` menggunakan port bawaan **3990**, berbeda dari `luluax-term` (**3980**) dan backend lokal (**4000**), sehingga ketiganya dapat berjalan bersamaan tanpa benturan port.
4. **Line Endings Script Unix**:
   Seluruh file `.sh` (`dev-mac.sh`, `build-mac.sh`, `run-macos.sh`) wajib menggunakan line-ending **`LF`** (bukan `CRLF`).
