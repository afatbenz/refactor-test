# Audit Kualitas Codebase — AI Interview Platform

**Tanggal:** 2026-07-10
**Auditor:** Automated code analysis
**Lingkup:** `api/` (Rails) dan `web/` (React/TypeScript)

---

## Ringkasan

| Severity | Jumlah |
|----------|--------|
| P0 (Blocker) | 3 |
| P1 (Major)   | 7 |
| P2 (Minor)   | 7 |
| P3 (Cosmetic)| 1 |
| **Total**    | **18** |

---

## P0 — Blocker

### ~~[P0-1] Migrasi database tidak ada~~ — **FALSE POSITIVE**

**Koreksi:** Folder `db/migrate/` berisi 9 file migrasi. Audit awal salah membaca karena error path. Migrasi berjalan normal.

**Resolusi:** Dihapus dari daftar temuan. Tidak perlu perbaikan.

---

### [P0-2] `SkillComparison.required_level` tidak sesuai dengan API `expected_level` — data tidak terbaca

**Detail Issue:** Service `FitGap::Engine` mengirim `expected_level`, tapi frontend menggunakan `required_level` sehingga `.required_level` menjadi `undefined`.

**Lokasi:**
- `web/src/types/index.ts:131` → `required_level: number`
- `api/app/services/fit_gap/engine.rb:61` → `expected_level: expected_level`

**Impact:** Tabel perbandingan skill di halaman Fit/Gap report kosong. Fitur fit/gap tidak berfungsi.

**Solution:** Satuin contract. Ubah frontend `SkillComparison.required_level` jadi `expected_level` atau sebaliknya. Hapus field `is_override` yang tidak pernah dikirim API.

---

### [P0-3] `speaker` type mismatch — transkrip AI salah label

**Detail Issue:** Frontend fallback speaker ke `"assessor"`, tapi backend hanya punya `"ai"` dan `"candidate"`. Semua transkrip AI labelnya "assessor".

**Lokasi:**
- `web/src/hooks/useAudioWebSocket.ts:73` → `onTranscript({ speaker: msg.speaker === "candidate" ? "candidate" : "assessor", ... })`
- `api/db/schema.rb:26` → `create_enum "speaker_type", ["ai", "candidate"]`
- `web/src/types/index.ts:70` → `speaker: "candidate" | "ai" | "assessor" | "system"`

**Impact:** Transkrip AI ditampilkan sebagai "assessor", membingungkan assessor. Filter/search by speaker bisa kacau.

**Solution:** Ganti fallback di `useAudioWebSocket.ts` ke `"ai"`. Bersihkan type definition di `types/index.ts`.

---

## P1 — Major

### [P1-1] `skill_id` number di frontend vs string di database

**Detail Issue:** `skill_id` di database adalah string (contoh: `"SK-ENG-001"`), tapi di frontend didefinisikan sebagai `number`.

**Lokasi:**
- `api/db/schema.rb:30` → `t.string "skill_id", limit: 50`
- `web/src/types/index.ts:19` → `skill_id?: number`

**Impact:** Skill lookup gagal, data corrupt saat dikirim ke API.

**Solution:** Ganti tipe di `web/src/types/index.ts` jadi `string | null`. Pastikan komponen handle format string.

---

### [P1-2] `PortfolioSkill.ai_level` — string "L3" di frontend vs integer di API

**Detail Issue:** Backend mengirim integer (1-5), tapi frontend mendefinisikan sebagai string `"L1"..."L5"`.

**Lokasi:**
- `api/db/schema.rb:115` → `t.integer "ai_level", null: false`
- `web/src/types/index.ts:93` → `ai_level: string; // "L1" | "L2" | "L3" | "L4" | "L5"`

**Impact:** Typing misleading, bug subtle sulit dideteksi.

**Solution:** Ganti tipe `PortfolioSkill.ai_level` jadi `number` di TypeScript. Gunakan fungsi konversi untuk display.

---

### [P1-3] UUID config inkonsisten — semua tabel pakai bigint

**Detail Issue:** Config `primary_key_type: :uuid` di `application.rb`, tapi semua tabel pakai `bigint`.

**Lokasi:**
- `api/config/application.rb:35` → `g.orm :active_record, primary_key_type: :uuid`
- `api/db/schema.rb` — semua primary key `bigint`

**Impact:** Migrasi baru gagal karena type mismatch.

**Solution:** Hapus setting `primary_key_type: :uuid` atau migrasi semua tabel ke UUID.

---

### [P1-4] `system_prompt` tidak bisa di-update manual via API

**Detail Issue:** `system_prompt` tidak di-permit di params controller. Hanya bisa diisi via background worker.

**Lokasi:**
- `api/app/controllers/api/v1/assessments_controller.rb:99-109`
- `api/db/schema.rb:51` → `t.text "system_prompt"`

**Impact:** Single point of failure. Admin tidak bisa memperbaiki via UI jika worker gagal.

**Solution:** Tambahkan `:system_prompt` ke `assessment_params`. Berikan textarea opsional di frontend.

---

### [P1-5] JWT token hardcoded di `.env` yang ter-commit ke git

**Detail Issue:** `web/.env` ter-commit dan berisi `VITE_DEV_TOKEN`.

**Lokasi:** `web/.env:8`

**Impact:** Buruk hygiene. Resiko credential terekspos di git history.

**Solution:** Tambahkan `.env` ke `.gitignore`, hapus dari tracking dengan `git rm --cached .env`.

---

### [P1-6] Endpoint `audio_complete` bisa force-end session tanpa verifikasi

**Detail Issue:** Endpoint public bisa di-trigger siapa saja dengan invite token, tanpa cek coverage.

**Lokasi:** `api/app/controllers/api/v1/sessions_controller.rb:112-122`

**Impact:** Attacker bisa mengakhiri session orang lain jika token bocor.

**Solution:** Gunakan signed token atau validasi coverage sebelum end.

---

### [P1-7] Response endpoint coverage tidak pakai envelope `data` — inkonsisten

**Detail Issue:** Sebagian endpoint pakai `{ data: ... }`, tapi `sessions#coverage` return flat object.

**Lokasi:**
- `api/app/controllers/api/v1/sessions_controller.rb:99-102`
- `web/src/services/api.ts:24`
- `web/src/services/sessions.ts:32`

**Impact:** Fragile, mudah rusak jika ada perubahan.

**Solution:** Pilih satu format response standar untuk semua endpoint.

---

## P2 — Minor

### [P2-1] Login endpoint hardcode hanya untuk role 'admin'

**Detail Issue:** Hanya user dengan role `'admin'` yang bisa login, meskipun model punya role `'user'`.

**Lokasi:** `api/app/controllers/api/v1/authentication_controller.rb:17`

**Impact:** Limitasi tidak terdokumentasi.

**Solution:** Hapus role `'user'` dari model atau hapus check hardcode.

---

### [P2-2] Seeds pakai raw SQL dengan interpolasi string

**Detail Issue:** `seeds.rb` menggunakan raw SQL dengan interpolasi dan `CREATE TABLE IF NOT EXISTS`.

**Lokasi:** `api/db/seeds.rb:39-78`

**Impact:** Risiko developer mengikuti pattern buruk. Seed bisa modifikasi schema.

**Solution:** Refactor pakai ActiveRecord model. Gunakan `find_or_create_by!`.

---

### [P2-3] CORS terbuka lebar — `ALLOWED_ORIGINS: "*"`

**Detail Issue:** Sample config mengizinkan akses dari mana saja.

**Lokasi:** `api/config/application.yml.sample:27`

**Impact:** Risiko keamanan jika terbawa ke production.

**Solution:** Beri komentar di sample config. Set specific origin di production.

---

### [P2-4] Eager load `:session` yang tidak perlu di `MapInjector`

**Detail Issue:** `@session.coverage_maps.includes(:session)` — eager load tidak berguna.

**Lokasi:** `api/app/services/coverage/map_injector.rb:22`

**Impact:** Overhead query tidak perlu.

**Solution:** Hapus `includes(:session)`.

---

### [P2-5] Audio ring buffer tidak thread-safe

**Detail Issue:** `AudioRingBuffer` tidak thread-safe, tapi aman karena EventMachine single-threaded.

**Lokasi:** `api/app/lib/audio_ring_buffer.rb`

**Impact:** Technical debt jika arsitektur berubah.

**Solution:** Tambahkan `# frozen_string_literal: true` atau `Mutex` guard.

---

### [P2-6] EventMachine jalan di thread terpisah — potensi masalah koneksi database

**Detail Issue:** EM callback di thread berbeda, akses ActiveRecord di luar connection pool.

**Lokasi:** `api/config/initializers/eventmachine.rb:5-12`

**Impact:** Risiko koneksi leak atau thread safety issue.

**Solution:** Gunakan `ActiveRecord::Base.connection_pool.with_connection` atau pindah ke `anycable`.

---

### [P2-7] `ALLOWED_ORIGINS` required — app crash jika tidak di-set

**Detail Issue:** `ENV.fetch('ALLOWED_ORIGINS')` tanpa default.

**Lokasi:** `api/config/initializers/cors.rb:5`

**Impact:** UX buruk untuk developer baru.

**Solution:** Tambahkan default `'http://localhost:5173'`.

---

### [P2-8] Halaman signup hanya pajangan — endpoint backend tidak ada

**Detail Issue:** Frontend punya halaman signup, tapi backend tidak punya route.

**Lokasi:**
- `web/src/services/auth.ts:17`
- `web/src/pages/auth/SignupPage.tsx`
- `api/config/routes.rb`

**Impact:** User submit form tapi dapat 404.

**Solution:** Tambahkan route & controller atau disable halaman signup.

---

## P3 — Cosmetic

### [P3-1] Level anchor optional di TypeScript tapi required di backend

**Detail Issue:** Frontend definisikan `l1_anchor` sampai `l5_anchor` sebagai optional, tapi backend validasi required.

**Lokasi:**
- `web/src/types/index.ts:26-30`
- `api/app/models/assessment_skill.rb:6`

**Impact:** Typing tidak jujur, berpotensi bug.

**Solution:** Ganti type definition di frontend jadi required.

---

## Ringkasan Pola Masalah

1. **Type mismatch API ↔ Frontend (4 temuan)**
2. **Security & access control (3 temuan)**
3. **Infrastructure & DevOps (3 temuan)**
4. **Error handling & validation (3 temuan)**
5. **Code quality & performance (2 temuan)**
