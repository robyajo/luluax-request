# Panduan & Konvensi AI Agent — LuluaX-Request

> **PERINGATAN WAJIB DIPATUHI (MANDATORY POLICY)**:  
> Seluruh AI Agent yang bekerja pada repositori ini **WAJIB MEMATUHI** seluruh aturan arsitektur, standar teknis, dan prosedur kerja yang tertera pada berkas ini serta direktori [`.agents/skills/`](file:///.agents/skills/). Pelanggaran terhadap invarian teknis (seperti penulisan berkas di dalam bundle ASAR, pembocoran istilah teknis internal pada rilis publik, atau pelanggaran port) dapat merusak kestabilan aplikasi.

---

## 1. Kepatuhan Skill Wajib (.agents/skills/)

Aplikasi ini memiliki 2 skill inti yang **wajib dipatuhi**:

1. **`luluax-request`** ([`.agents/skills/luluax-request/SKILL.md`](file:///.agents/skills/luluax-request/SKILL.md)): Panduan master arsitektur API Client, Universal CORS Proxy, HTTP Interceptor Rules khas Requestly, Mock Server lokal, Environment Variables, dan integrasi Cloud Sync.
2. **`activity-sync`** ([`.agents/skills/activity-sync/SKILL.md`](file:///.agents/skills/activity-sync/SKILL.md)): Standar pencatatan rilis dwibahasa publik dan sinkronisasi kegiatan ke portfolio API.

---

## 2. Aturan Teknis & Invarian Kritis (Wajib Dipatuhi)

Setiap modifikasi kode pada `LuluaX-Request` harus mematuhi invarian berikut:

### A. Lokasi Penyimpanan Data Writable (Mencegah Crash `ENOTDIR` di ASAR)
- Saat aplikasi dibundel sebagai executable desktop Electron (`.exe` di Windows atau `.app` di macOS), `__dirname` berada di dalam file arsip `app.asar` yang bersifat **read-only**.
- **DILARANG KERAS** memanggil `fs.writeFileSync`, `fs.mkdirSync`, atau operasi tulis lainnya langsung ke path yang berbasis `__dirname` tanpa abstraksi.
- **WAJIB** menggunakan fungsi pembantu `getWritableDataDir('LuluaX-Request', ...)` yang telah disediakan di `server.js`. Fungsi ini mengarahkan penyimpanan data ke direktori pengguna yang aman:
  - **Windows**: `%APPDATA%\LuluaX-Request`
  - **macOS**: `~/Library/Application Support/LuluaX-Request`
  - **Linux / Fallback**: `~/.luluax-request`

### B. Isolasi Port Jaringan (Port Conflict Prevention)
- Port bawaan aplikasi ini adalah **`3990`** (`PORT=3990`).
- **JANGAN PERNAH** mengubah atau menggunakan port **`3980`** (dialokasikan khusus untuk `LuluaX-Term`) atau **`4000`** (dialokasikan untuk backend Hono lokal). Ketiga aplikasi dalam LuluaX Suite harus dapat berjalan bersamaan di satu komputer tanpa benturan port.

### C. Universal CORS Proxy Transparency
- Handler proxy `/api/proxy` di `server.js` berfungsi sebagai jembatan pemanggilan HTTP apapun dari server lokal Node.js agar browser terbebas dari restriksi CORS.
- Proxy harus transparan: teruskan header `Content-Type` yang sesuai (JSON, URL-encoded, FormData/multipart), hitung durasi latency secara akurat, dan kembalikan response header serta binary/text body secara utuh.

### D. HTTP Interceptor Rules Engine (Khas Requestly)
- Proxy `/api/proxy` wajib memeriksa aturan aktif di `data/rules.json` sebelum request diteruskan:
  1. **Redirect Rule**: Pengalihan URL target menggunakan wildcard matching.
  2. **Modify Headers Rule**: Penambahan, modifikasi, atau penghapusan header request & response.
  3. **Modify Response Rule (Mock Intercept)**: Pemotongan request untuk langsung mengembalikan payload tiruan dan custom status code tanpa memanggil server asli.
  4. **Delay Request Rule (Throttling)**: Penambahan latensi buatan (`delayMs`) untuk menguji skenario jaringan lambat.

### E. Mock API Server (`/mock/*`)
- Handler `app.all('/mock/*', ...)` membaca konfigurasi dari `data/mocks.json`.
- Wajib mendukung custom status code (`200`, `201`, `400`, `404`, `500`), latency delay (`delayMs`), dan format payload JSON kustom.

### F. Line Endings Skrip Runner
- Seluruh file shell script (`run-macos.sh`, `dev-mac.sh`, `build-mac.sh`) **WAJIB** menggunakan line-ending **`LF`** (bukan `CRLF`) agar dapat dieksekusi tanpa error di macOS/Linux.

### G. Integrasi Cloud Sync & Keamanan Kunci
- Sinkronisasi cloud terhubung ke `https://www.er-service.duckdns.org` (Hono + Drizzle ORM + Neon PostgreSQL).
- Gunakan endpoint modular backend: `/api/request` untuk koleksi, item, lingkungan, dan riwayat; serta `/api/sync` untuk full snapshot.
- Kredensial dan token disimpan di `localStorage` frontend (`luluax_req_auth_token`, `luluax_sync_key`).
- **DILARANG KERAS** melakukan commit file kredensial lokal seperti `.env`, `.env.local`, atau `.ACTIVITY_PROJECT_KEYS` ke repositori Git.

---

## 3. Protokol Activity Sync & Catatan Rilis (Changelog)

Setiap selesai mengerjakan perubahan yang **dirasakan pengguna** (fitur baru, perbaikan bug, perubahan antarmuka, rilis versi, atau perubahan perilaku aplikasi), AI Agent **WAJIB** mencatat rilis dan menyinkronkannya ke portfolio sebelum menyelesaikan tugas.

### A. Alur Kerja Wajib:
1. **Tulis / Perbarui Berkas Rilis Harian**:
   - Lokasi: `releases/YYYY-MM-DD-nama-singkat.json` (maksimal 1 berkas per hari kerja, lakukan konsolidasi jika ada beberapa perubahan di hari yang sama).
   - Format: Wajib dwibahasa (`id` dan `en`), format terstruktur dengan `date`, `type`, `project: {"name": "Luluax Request"}`, `title: {id, en}`, `body: {id, en}`, dan array `items: [{type, id, en}]`.
2. **Aturan Bahasa (Citizen-Facing & Bebas Bocoran Teknis)**:
   - Bahasa wajib bernada pelayanan publik yang ramah, profesional, dan berfokus pada manfaat nyata bagi pengguna.
   - **DILARANG KERAS** menyebutkan nama library, nama paket npm, nama middleware, nama framework internal, nama database, atau nama file kode sumber.
3. **Kirim Kegiatan ke API Portfolio**:
   - Endpoint: `POST https://ajoroby.is-a.dev/api/activities`
   - Header: `Content-Type: application/json`, `X-project: <KEY>` (dibaca dari `.ACTIVITY_PROJECT_KEYS` di `.agents/skills/activity-sync/`).
   - Body: Kirim isi berkas rilis JSON apa adanya.
4. **Verifikasi**:
   - Periksa melalui `GET https://ajoroby.is-a.dev/api/activities?slug=luluax-request&limit=3` untuk memastikan entri tercatat dengan benar dan tidak terjadi duplikasi.
5. **Laporan ke Pengguna**:
   - Laporkan ID kegiatan yang dihasilkan, status verifikasi, dan tautan file rilis yang dibuat.
