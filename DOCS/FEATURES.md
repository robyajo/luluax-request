# Fitur Khas Requestly pada LuluaX-Request

Dokumen ini memuat detail spesifikasi dan alur operasional fitur-fitur khas **Requestly** yang telah diimplementasikan pada **LuluaX-Request**.

---

## 1. HTTP Interceptor Rules Engine

Fitur utama Requestly adalah memanipulasi request jaringan HTTP secara transparan:

### A. Tipe Aturan yang Didukung:
1. **Redirect Rule**:
   - Memotong request yang cocok dengan pola URL tertentu dan mengalihkannya ke target URL lain.
   - *Contoh Kasus*: Mengalihkan script JavaScript atau endpoint API production ke server lokal pengembang (`http://localhost:3000/api`).
2. **Modify Headers Rule**:
   - Menambah, mengubah, atau menghapus request & response headers.
   - *Contoh Kasus*: Menyuntikkan token otorisasi pengujian (`Authorization: Bearer mock-token`) ke semua request ke domain tertentu secara otomatis.
3. **Modify Response Rule (Mock Intercept)**:
   - Mengintersepsi request dan langsung mengembalikan payload JSON tiruan serta status code yang ditentukan tanpa menghubungi server asli.
   - *Contoh Kasus*: Menguji penanganan error `500 Server Error` atau menguji skema respons API baru sebelum dirilis di backend.
4. **Delay Request Rule (Network Throttling)**:
   - Menambahkan latensi buatan (misal `2000ms`) sebelum request dikirimkan.
   - *Contoh Kasus*: Mensimulasikan koneksi jaringan lambat 3G/Edge untuk memverifikasi skeleton loader dan state loading di antarmuka web.

### B. Endpoint API Terkait:
- `GET /api/rules` — Membaca daftar aturan tersimpan
- `POST /api/rules` — Membuat aturan interceptor baru
- `POST /api/rules/:id/toggle` — Mengaktifkan/menonaktifkan aturan secara instan
- `DELETE /api/rules/:id` — Menghapus aturan

---

## 2. Mock API Server Lokal

Memungkinkan pengembang membuat dan men-deploy endpoint API tiruan langsung di dalam aplikasi lokal tanpa memerlukan server eksternal:

### A. Fitur Mock Server:
- **Custom Endpoint Path**: Mendukung pembuatan path kustom (misal `/mock/api/users` atau `/mock/api/products`).
- **Custom Status Code**: Mendukung pengembalian HTTP Status Code `200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, `500 Server Error`.
- **Latency Delay Simulation**: Menambahkan jeda waktu simulasi pemrosesan server dalam milidetik (`delayMs`).
- **Mock JSON Payload Editor**: Editor teks untuk mengisi data JSON tiruan yang akan dikembalikan.
- **Tombol Uji di Editor**: Langsung membuka tab request baru di editor utama untuk menguji endpoint mock tersebut.

### B. Endpoint API Terkait:
- `GET /api/mocks` — Daftar mock endpoint
- `POST /api/mocks` — Menyimpan endpoint mock baru
- `DELETE /api/mocks/:id` — Menghapus endpoint mock
- `ALL /mock/*` — Handler yang mengeksekusi dan mengembalikan respons tiruan

---

## 3. HTTP Request Builder

- **Metode**: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
- **Query Params & Headers**: Tabel Key-Value interaktif dengan checkbox untuk mengaktifkan/menonaktifkan baris parameter.
- **Request Body**: Mendukung mode `None`, `JSON` (dengan format/beautify otomatis), `Form URL-Encoded`, dan `Raw Text`.
- **Authorization**: `Bearer Token`, `API Key` (Header atau Query parameter), dan `Basic Auth`.
- **Resolusi Variabel**: Sintaks `{{variableName}}` otomatis digantikan dengan nilai dari Environment yang aktif.
- **Code Generator**: Ekspor instan ke **cURL**, **JavaScript (fetch)**, **Node.js (axios)**, dan **Python (requests)**.
