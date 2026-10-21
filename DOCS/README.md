# Dokumentasi Resmi LuluaX-Request

Dokumentasi teknis internal aplikasi **LuluaX-Request** (API Client & HTTP Interceptor terinspirasi Requestly).

---

## 📚 Daftar Dokumen

| Dokumen | Isi Pembahasan |
| :--- | :--- |
| **[1. Arsitektur Teknis](ARCHITECTURE.md)** | Arsitektur Electron, Universal CORS Proxy di port 3990, mesin aturan HTTP Interceptor, Mock Server, dan pencegahan error `ENOTDIR`. |
| **[2. Fitur-Fitur Khas Requestly](FEATURES.md)** | Detail implementasi fitur khas Requestly: HTTP Interceptor Rules (Redirect, Modify Headers, Modify Response, Delay/Throttling), Mock API Server lokal (`/mock/*`), Request Runner, dan Code Generator. |
| **[3. Panduan Development & Build](DEVELOPMENT-AND-BUILD.md)** | Alur kerja review development portable (`dev-portable.bat`), kompilasi installer resmi (`build-installer.bat` / NSIS / DMG), dan skrip macOS Apple Silicon (`dev-mac.sh` & `build-mac.sh`). |

---

## ⚡ Panduan Cepat

- **Review saat Development (Portable)**: Jalankan `dev-portable.bat` (Windows) atau `./dev-mac.sh` (macOS).
- **Rilis Installer Resmi**: Jalankan `build-installer.bat` (Windows Setup NSIS) atau `./build-mac.sh` (macOS DMG).
- **Konfigurasi Cloud**: Cek file `.env` untuk endpoint backend (`https://www.er-service.duckdns.org`).
