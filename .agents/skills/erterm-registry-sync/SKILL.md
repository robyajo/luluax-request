---
name: erterm-registry-sync
description: "Aturan arsitektur penyimpanan data per akun (registry-<accountId>.json) dan sinkronisasi multi-device ke cloud backend PostgreSQL untuk ekosistem ErTerm & LuluaX."
---

# LuluaX Registry & Cloud Sync Architecture

Dokumen ini memuat kontrak teknis wajib bagi seluruh agen AI yang bekerja di ekosistem LuluaX (LuluaX-Term, LuluaX-Request, dan Backend).

---

## 1. Prinsip Utama Penyimpanan Data Pengguna

1. **Per-Account Scoped Registry**:
   - Setiap pengguna memiliki snapshot data terisolasi yang disimpan di berkas:
     `%APPDATA%/LuluaX-Term/registry-<accountId>.json` atau `%APPDATA%/LuluaX-Request/registry-<accountId>.json` (Windows)
     `~/Library/Application Support/...` (macOS).
   - Berkas ini memuat seluruh status workspace pengguna: koleksi, request, environment, rules, mocks, dan pengaturan personal.

2. **Multi-Device Parity (Cloud Synchronization)**:
   - Setiap kali pengguna melakukan perubahan, perubahan tersebut disimpan secara lokal dan disinkronkan secara asinkron (debounced) ke backend database PostgreSQL Neon di `https://www.er-service.duckdns.org`.
   - Saat pengguna login di perangkat baru (misal laptop lain atau komputer kantor), aplikasi otomatis memanggil `GET /api/request/registry` atau `/api/cloud/sync/pull` untuk mengunduh snapshot akun tersebut sehingga seluruh request dan koleksi tampil 100% identik.

---

## 2. Struktur Skema Request Account Registry (`registry-<accountId>.json`)

```typescript
export interface RequestAccountRegistry {
  accountId: string;          // ID unik akun pengguna (misal email atau UUID)
  email?: string;             // Alamat email pengguna
  version: number;            // Versi skema registry (dimulai dari 1)
  updatedAt: number;          // Timestamp epoch milidetik perubahan terakhir
  collections: CollectionItem[];
  environments: EnvironmentItem[];
  rules: RuleItem[];
  mocks: MockItem[];
  settings: SettingsData;
}
```

---

## 3. Pemetaan Database Backend (`backend/src/db/schema/request.ts`)

| Tabel PostgreSQL | Mewakili Bagian Registry | Kolom Utama |
|---|---|---|
| `req_collections` | `registry.collections` | `id, user_id, name, description, order` |
| `req_items` | `registry.items` | `id, user_id, collection_id, name, method, url, headers, params, body_type, body_content, auth_type, auth_config` |
| `req_environments` | `registry.environments` | `id, user_id, name, variables, is_default` |
| `req_rules` | `registry.rules` | `id, user_id, name, rule_type, source_url_pattern, target_url, headers_to_modify, status_code, response_body, delay_ms, enabled` |
| `req_mocks` | `registry.mocks` | `id, user_id, name, endpoint, method, status_code, delay_ms, response_body, enabled` |

---

## 4. Prosedur Wajib Agen AI Saat Menambahkan Fitur Baru

Jika di masa mendatang agen AI menambahkan fitur baru (misalnya: *Identity Credentials*, *Script Packages*, *MOSH Settings*, atau *Host Chaining Configurations*):

1. **Perbarui `types.ts`**:
   Tambahkan tipe data baru ke dalam `types.ts` dan masukkan array/propertinya ke interface `RequestAccountRegistry` atau `AccountRegistry`.
2. **Perbarui `server.ts`**:
   - Perbarui fungsi `loadAccountRegistry()`, `saveAccountRegistry()`, dan `syncActiveRegistry()` untuk menyertakan properti baru.
   - Perbarui endpoint `/api/cloud/sync/push` dan `/api/cloud/sync/pull` untuk menyertakan payload entitas baru.
3. **Perbarui Schema Database Backend**:
   - Tambahkan tabel atau kolom baru di `backend/src/db/schema/`.
   - Tambahkan logika upsert/query di endpoint `/api/request/registry` atau `/api/terminal/registry` pada backend.
4. **Perbarui UI & Sinkronisasi Real-Time**:
   - Pastikan setiap aksi simpan/ubah di UI memicu `this.triggerDebouncedSync()`.
5. **Wajib Perbarui `CHANGELOG.md`**:
   - Setiap kali agen AI melakukan perubahan kode, perbaikan bug, penambahan fitur, atau rilis, AI WAJIB memperbarui berkas `CHANGELOG.md` pada aplikasi yang terdampak (`luluax-term/CHANGELOG.md`, `luluax-request/CHANGELOG.md`, atau `backend/CHANGELOG.md`) menggunakan format standar Keep a Changelog.
6. **Verifikasi Kompilasi & Lakukan Activity-Sync**:
   - Jalankan `npm run build` di `luluax-term/` dan `luluax-request/`, serta `npx tsc --noEmit` di `backend/`.
   - Wajib eksekusi `activity-sync` ke API portfolio (`https://ajoroby.is-a.dev/api/activities`).
