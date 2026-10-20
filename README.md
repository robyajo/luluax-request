# LuluaX-Request (API Client inspired by Requestly)

Aplikasi API Client dan HTTP Request Builder modern yang terinspirasi dari **Requestly API Client**, dilengkapi sistem **Cloud Sync terintegrasi ke Neon Serverless PostgreSQL melalui backend Hono**.

---

## 🚀 Fitur Utama

1. **HTTP Request Builder**:
   - Metode: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
   - URL Path & Dynamic Variables: Dukungan interpolasi `{{baseUrl}}`, `{{token}}`, dll.
   - Query Parameters & Headers Key-Value Table (dengan toggle on/off).
   - Request Body: JSON (dengan auto-format & validator), Form URL-Encoded, Raw text.
   - Authorization: Bearer Token, API Key (Header / Query), Basic Auth.

2. **Universal CORS Proxy Server**:
   - Dilengkapi server proxy bawaan (`server.js`) sehingga Anda dapat menembak endpoint API lokal, intranet, maupun publik tanpa terhalang browser CORS policies!

3. **Response Viewer Interaktif**:
   - Status code badges (`200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, `500 Server Error`).
   - Latensi respon waktu (`ms`) dan ukuran payload (`B / KB / MB`).
   - Pretty-printed JSON dengan syntax viewer, tampilan Headers lengkap, dan tombol *Copy Response*.

4. **Koleksi & Riwayat (Collections & History)**:
   - Pengorganisasian folder koleksi API.
   - Auto-logging riwayat pemanggilan API dengan kemampuan restore cepat ke tab aktif.

5. **Code Generator**:
   - Export request aktif langsung ke format:
     - **cURL** command
     - **JavaScript (fetch)**
     - **Node.js (axios)**
     - **Python (requests)**

6. **Cloud Sync ke Neon Postgres (via Backend Hono)**:
   - Sinkronisasi koleksi, request, dan variabel lingkungan ke database cloud **Neon PostgreSQL** lintas perangkat!

---

## 💻 Cara Menjalankan

### Di Komputer Windows:
Klik ganda file **`run.bat`** di folder `luluax-request/` atau jalankan:
```cmd
cd luluax-request
run.bat
```
Aplikasi akan membuka jendela desktop mandiri di `http://127.0.0.1:3990`.

### Di Komputer macOS (Apple Silicon M-Series & Intel):
```bash
cd luluax-request
chmod +x run-macos.sh
./run-macos.sh
```
