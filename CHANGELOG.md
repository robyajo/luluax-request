# Changelog — LuluaX-Request

Semua perubahan penting pada proyek **LuluaX-Request** didokumentasikan di berkas ini.
Format ini berbasis pada [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini mematuhi [Semantic Versioning](https://semver.org/lang/id/).

## [1.0.3] - 2026-10-22

### Added
- **Per-Account Scoped Registry (`registry-<accountId>.json`)**: Penyimpanan data pengguna (koleksi, request, environment, rules, mocks, settings) secara terisolasi per akun di disk lokal.
- **Multi-Device Cloud Synchronization**: Integrasi endpoint `/api/registry` dan `/api/registry/sync` untuk memastikan workspace tampil identik saat login di perangkat lain.
- **Installed Version Display & Top-Right Update Badge**: Penampil versi terpasang dinamis di bilah atas dan lencana animasi pembaruan di kanan atas saat rilis baru tersedia di GitHub Releases.
- **Debounced Auto-Sync**: Sinkronisasi latar belakang otomatis saat melakukan perubahan koleksi, request, rules, atau mocks.

## [1.0.2] - 2026-10-21

### Added
- Integrasi auto-updater otomatis ke GitHub Releases.
- Pemasangan pembaruan in-place tanpa perlu uninstall manual.

## [1.0.0] - 2026-10-20

### Added
- Rilis perdana LuluaX-Request: Klien API desktop (terinspirasi dari Requestly & Postman), Mock API Server terintegrasi, HTTP Interceptor Rules (redirect, header modify), Environment Manager, dan sinkronisasi cloud backend.
