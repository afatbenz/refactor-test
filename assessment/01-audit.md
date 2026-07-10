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

### [P0-1] Migrasi database tidak ada — `db:migrate` tidak bisa jalan

**Detail Issue:** Folder `db/migrate/` kosong — nggak ada satu pun file migrasi. Yang ada cuma `db/schema.rb` hasil dump dari versi `2026_05_05_000002`. Padahal README nyuruh `rails db:migrate`, dan itu bakal gagal karena Rails butuh file migrasi buat jalan.

**Impact:** Developer baru atau siapapun yang clone repo ini nggak bakal bisa setup database mereka lewat `db:migrate`. Workaround-nya pake `rails db:schema:load`, tapi itu destructive — data existing di database lokal bakal kehapus. Ini blocker buat onboarding dan development.

**Solution:** Commit file migrasi yang sesuai sama schema yang ada. Alternatifnya, update README biar pake `rails db:schema:load` dan pastiin semua orang ngerti konsekuensinya. Jangan ada setengah-setengah antara migration-based dan schema-based approach.

---

### [P0-2] `SkillComparison.required_level` nggak cocok sama API `expected_level` — data nggak kebaca

**Detail Issue:** Service `FitGap::Engine` ngirim data pake key `expected_level`, tapi frontend define `SkillComparison` dengan field `required_level`. Jadi pas data sampe di frontend, `.required_level` bakal `undefined` terus karena key-nya beda.

**Lokasi:**
- `web/src/types/index.ts:131` → `required_level: number`
- `api/app/services/fit_gap/engine.rb:61` → `expected_level: expected_level`

**Impact:** Tabel perbandingan skill di halaman Fit/Gap report nggak bakal nampilin angka required level dengan benar — kolomnya kosong. Ini fitur inti yang dipake assessor buat liat kesenjangan skill candidate, jadi kalo rusak, fitur fit/gap report practically useless.

**Solution:** Satuin contract-nya. Opsi paling clean: ubah frontend `SkillComparison.required_level` jadi `expected_level` biar match sama API, atau sebaliknya. Jangan lupa juga hapus field `is_override` yang ada di TypeScript tapi nggak pernah dikirim API.

---

### [P0-3] `speaker` type mismatch — transkrip AI salah label

**Detail Issue:** Waktu WebSocket handler nerima pesen dari backend, kalo `msg.speaker` bukan `"candidate"`, dia asumsinya `"assessor"`. Padahal backend cuma punya dua speaker type: `"ai"` sama `"candidate"`. Hasilnya, semua transkrip yang diucapin AI bakal keluar label "assessor" di frontend.

**Lokasi:**
- `web/src/hooks/useAudioWebSocket.ts:73` → `onTranscript({ speaker: msg.speaker === "candidate" ? "candidate" : "assessor", ... })`
- `api/db/schema.rb:26` → `create_enum "speaker_type", ["ai", "candidate"]`
- `web/src/types/index.ts:70` → `speaker: "candidate" | "ai" | "assessor" | "system"`

**Impact:** Semua transcript dari AI (yang sebenernya `speaker: "ai"`) bakal ditampilin sebagai "assessor". Buat assessor yang lagi review transcript, ini confusing — mereka kira ada campur tangan manusia padahal nggak. Plus kalo nanti ada fitur filter atau search by speaker, hasilnya bakal kacau.

**Solution:** Ganti fallback di `useAudioWebSocket.ts` dari `"assessor"` ke `"ai"`. Sederhana: `msg.speaker === "candidate" ? "candidate" : "ai"`. Sembari itu, rapihin type definition di `types/index.ts` dan hapus `"assessor"` dan `"system"` dari union kalo emang nggak dipake.

---

## P1 — Major

### [P1-1] `skill_id` number di frontend vs string di database

**Detail Issue:** Kolom `skill_id` di database didefinisikan sebagai `string(50)` dan data seed-nya pake format kayak `"SK-ENG-001"`. Tapi di TypeScript frontend didefinisikan sebagai `number`. Jadi kalo ada kode yang ngirim `skill_id` tanpa konversi explicit, value-nya bakal ilang atau jadi `NaN`.

**Lokasi:**
- `api/db/schema.rb:30` → `t.string "skill_id", limit: 50`
- `web/src/types/index.ts:19` → `skill_id?: number`

**Impact:** B7 taxonomy ID-nya semua string (contoh: `"SK-ENG-001"`, `"SK-SOFT-003"`). Kalo frontend iseng make `Number(skillId)` atau ngebandingin pake `===`, hasilnya selalu salah. Ini bisa nyebabin skill lookup gagal di frontend, skill nggak ketemu di mapping, atau data corrupt pas dikirim balik ke API.

**Solution:** Ganti tipe di `web/src/types/index.ts` dari `number` jadi `string | null`. Pastiin juga komponen-komponen yang make `skill_id` buat lookup atau filter udah handle format string dengan bener.

---

### [P1-2] `PortfolioSkill.ai_level` — string literal "L3" di frontend vs integer di API

**Detail Issue:** Backend nyimpen `ai_level` sebagai integer (1-5) dan nge-return angka mentah di response JSON. Tapi TypeScript-nya bilang `ai_level` itu string dengan nilai `"L1" | "L2" | "L3" | "L4" | "L5"`. Kalo ada komponen yang make `.ai_level` langsung sebagai index atau number comparison, bakal dapet `undefined`.

**Lokasi:**
- `api/db/schema.rb:115` → `t.integer "ai_level", null: false`
- `web/src/types/index.ts:93` → `ai_level: string; // "L1" | "L2" | "L3" | "L4" | "L5"`

**Impact:** Ada fungsi `parseLevel()` di `constants.ts` yang bisa handle konversi string↔number — jadi mungkin di beberapa tempat udah bener. Tapi typing-nya sendiri misleading. Kalo ada developer baru yang nulis kode akses `skill.ai_level` langsung, mereka kira dapat string padahal dapat number. Bug-bug begini subtle dan susah kedetek di code review.

**Solution:** Ganti tipe `PortfolioSkill.ai_level` jadi `number` di TypeScript. Kalo perlu label "L3" buat display, konversi bisa pake fungsi yang udah ada (`LEVEL_LABELS[ai_level]`). Ini cara yang lebih jujur sama data yang sebenernya dikirim API.

---

### [P1-3] UUID config inkonsisten — semua tabel pake bigint

**Detail Issue:** Di `config/application.rb` ada setting `primary_key_type: :uuid` buat generator model. Tapi semua tabel yang udah ada di database pake `bigint` (BIGSERIAL) buat primary key-nya. Artinya kalo ada yang generate migration baru pake `rails generate model`, itu otomatis bakal pake UUID — beda sama tabel-tabel existing.

**Lokasi:**
- `api/config/application.rb:35` → `g.orm :active_record, primary_key_type: :uuid`
- `api/db/schema.rb` — semua primary key pake `bigint`

**Impact:** Migrasi baru yang digenerate bakal nyoba bikin foreign key pake UUID, sementara tabel yang di-reference pake bigint. Ini pas migrasi pasti fail gara-gara type mismatch. Developer yang nggak sadar setting ini bakal pusing setengah hari debugging error migration.

**Solution:** Hapus setting `primary_key_type: :uuid` dari `application.rb` kalo emang mau konsisten pake bigint. Atau kalo emang mau pindah ke UUID, butuh migration terpisah yang mindahin semua primary/foreign key — tapi itu PR besar sendiri.

---

### [P1-4] `system_prompt` nggak bisa di-update manual via API

**Detail Issue:** Kolom `system_prompt` di tabel assessments ada di database, tapi nggak di-permit di params controller. Jadi satu-satunya cara buat ngisi atau ngubah `system_prompt` ya lewat background worker (`SystemPromptGeneratorWorker`). Kalo workernya gagal (misal Gemini timeout atau error), nggak ada fallback.

**Lokasi:**
- `api/app/controllers/api/v1/assessments_controller.rb:99-109` — `assessment_params` nggak include `:system_prompt`
- `api/db/schema.rb:51` → `t.text "system_prompt"` (nullable)

**Impact:** Single point of failure. Kalo Gemini lagi down atau ada bug di compiler prompt, admin nggak bisa benerin lewat UI. Satu-satunya jalan ya lewat `rails console`, yang artinya butuh akses server langsung — dan ini nggak feasible buat non-technical admin.

**Solution:** Tambahin `:system_prompt` ke `assessment_params`. Di frontend bisa dikasih textarea opsional (atau advanced section) buat override prompt. Kalo khawatir salah input, cukup tambahin validasi di model — misal `allow_nil` dan warning klien kalo lagi auto-generated.

---

### [P1-5] JWT token hardcoded di `.env` yang ter-commit ke git

**Detail Issue:** File `web/.env` — yang harusnya masuk `.gitignore` — malah ikut ter-commit. Di dalemnya ada `VITE_DEV_TOKEN` yang isinya JWT token lengkap.

**Lokasi:** `web/.env:8`

**Impact:** Token ini udah expired (cek `exp` claim-nya sekitar Juni 2026), jadi mungkin nggak berbahaya buat sekarang. Tapi masalahnya bukan soal token ini valid atau nggak — ini tentang hygiene. `.env` yang ter-commit artinya developer lain bisa aja commit credential beneran tanpa sadar. Plus kalo ada secret lain yang masuk, itu udah terekspos permanen di git history.

**Solution:** Tambahin `.env` ke `.gitignore`, terus hapus dari tracking pake `git rm --cached .env`. Guidenya: pake `.env.example` sebagai template (udah ada), developer tinggal `cp .env.example .env` dan isi sendiri.

---

### [P1-6] Endpoint `audio_complete` bisa force-end session tanpa verifikasi

**Detail Issue:** Endpoint `POST /sessions/:token/audio_complete` — yang sifatnya public (tanpa JWT) — bisa di-trigger sama siapa aja yang punya invite token buat force-end session. Nggak ada pengecekan apakah coverage emang udah complete. Kode malah sengaja bypass coverage check karena ada race condition problem (H1 fix).

**Lokasi:** `api/app/controllers/api/v1/sessions_controller.rb:112-122`

**Impact:** Ini compromise antara security sama reliability. Race condition-nya real: WebSocket detect all_covered, kirim sinyal, dan client ngeresponse dengan HTTP call. Tapi di celah kecil itu ada window dimana session bisa ke-double-end. Solusinya: hapus coverage check. Tapi ini juga artinya kalo token invite bocor, attacker bisa seenaknya end session orang.

**Solution:** Redesign flow-nya. Alternatif: pake signed token yang dibuat backend pas ngirim `preparing_to_end`. Jadi endpoint `audio_complete` cuma nerima request kalo ada signed token valid — bukan raw invite token. Atau kalo mau simpler: validasi coverage minimal sekali di backend sebelum end.

---

### [P1-7] Response endpoint coverage nggak pake envelope `data` — inkonsisten sama endpoint lain

**Detail Issue:** Sebagian endpoint di API pake format `{ data: ..., meta: ... }` (dari `paginated_response`), tapi endpoint `sessions#coverage` langsung return `{ skills: [...], discovered: [...], updated_at: "..." }` tanpa envelope. Di frontend, interceptor Axius punya logic yang nge-unwrap response kalo ada key `data` — untuk response coverage, ini nggak terjadi. Sejauh ini beruntung aja soal typing cocok, tapi ini fragile.

**Lokasi:**
- `api/app/controllers/api/v1/sessions_controller.rb:99-102` — render flat object
- `web/src/services/api.ts:24` — interceptor unwrap `data`
- `web/src/services/sessions.ts:32` — `api.get<CoverageMap>`

**Impact:** Ini mungkin berfungsi sekarang, tapi kalo suatu saat ada yang nambahin key `data` di response (misal buat konsistensi), interceptor bakal nge-unwrap dan struktur response jadi salah. Bug kayak gini susah di-debug karena kelihatannya baik-baik aja.

**Solution:** Pilih satu format response yang standar buat semua endpoint. Kalo mau konsisten dengan pattern pagination, bungkus response coverage pake envelope juga. Atau kalo mau flat, hapus logic unwrap di interceptor. Yang penting semua endpoint pake format yang sama.

---

## P2 — Minor

### [P2-1] Login endpoint hardcode cuma buat role 'admin'

**Detail Issue:** Di `AuthenticationController`, setelah user ditemukan dan password valid, ada check tambahan: `user.role == 'admin'`. Kalo rolenya `'user'`, ditolak. Padahal di model `User`, roles yang valid adalah `['admin', 'user']`.

**Lokasi:** `api/app/controllers/api/v1/authentication_controller.rb:17`

**Impact:** Ini limitasi yang nggak didokumentasi. Model `User` punya role `user`, tapi begitu login ya ditolak mentah-mentah. Mungkin ini sengaja karena emang cuma admin yang make web app, tapi kalo nanti ada use case buat candidate atau assessor lain yang login via web, bakal ribet.

**Solution:** Kalo role `user` emang nggak boleh login, hapus aja dari daftar role di model biar nggak membingungkan. Kalo suatu saat perlu diaktifkan, hapus check hardcode-nya dan ganti pake policy berdasarkan action.

---

### [P2-2] Seeds pake raw SQL dengan interpolasi string

**Detail Issue:** File `seeds.rb` make `<<~SQL` langsung dengan string interpolation buat INSERT. Data emang hardcoded, tapi kalo contoh kode kayak gini, ada resiko developer lain ngikutin pattern yang sama tanpa sadar pas nambah seed data baru.

**Lokasi:** `api/db/seeds.rb:39-78`

**Impact:** Ini masalah seeding sih, nggak production risk. Yang agak merisaukan itu seeds.rb juga bikin tabel `CREATE TABLE IF NOT EXISTS` — artinya seed bisa modifikasi schema di luar migrasi. Kalo ada perubahan kolom di schema, tapi lupa update seeds, error aneh bisa muncul.

**Solution:** Refactor pake ActiveRecord model (`Organization.create!`) daripada raw SQL. Buat operasi idempotent bisa pake `find_or_create_by!`. Kalo emang harus pake raw SQL (misal karena tabel di `public` schema), parameterize query-nya.

---

### [P2-3] CORS kebuka lebar — `ALLOWED_ORIGINS: "*"`

**Detail Issue:** Sample config nyetel `ALLOWED_ORIGINS: "*"`, dan kode `cors.rb` split value itu jadi daftar. Hasilnya `origins ["*"]` yang artinya access dari mana aja dibolehin.

**Lokasi:** `api/config/application.yml.sample:27`

**Impact:** Di development sih nggak masalah — malah praktis. Tapi kalo config ini kebawa ke production tanpa diubah, itu celah keamanan. Origin mana pun bisa make API ini dari browser. Untuk internal tool, sebaiknya di-restrict.

**Solution:** Di sample config, kasih komentar jelas kalo `"*"` cuma buat development. Di production, set specific origin. Bisa juga pake environment-specific config.

---

### [P2-4] Eager load `:session` yang nggak perlu di `MapInjector`

**Detail Issue:** Kode `@session.coverage_maps.includes(:session)` — ini eager load relasi `session` buat tiap coverage_map. Masalahnya, `@session` udah ada sebagai parent object. Jadi ini query nggak berguna.

**Lokasi:** `api/app/services/coverage/map_injector.rb:22`

**Impact:** Overhead minimal — tapi di service yang dipanggil tiap candidate turn dengan target eksekusi < 50ms, setiap query nggak perlu itu berarti. Apalagi kalo session-nya punya banyak coverage_map, overhead-nya linear.

**Solution:** Ganti jadi `@session.coverage_maps` aja tanpa `includes(:session)`. Simpler, lebih cepet, dan intent-nya lebih jelas.

---

### [P2-5] Audio ring buffer nggak thread-safe

**Detail Issue:** `AudioRingBuffer` secara eksplisit bilang "NOT thread-safe" di komentar. Buat sekarang sih aman karena make EventMachine reactor yang single-threaded. Tapi kalo ada plans buat pindah ke approach lain, ini bakal jadi problem.

**Lokasi:** `api/app/lib/audio_ring_buffer.rb`

**Impact:** Ini lebih ke technical debt. Begitu ada perubahan arsitektur (misal pindah ke websocket gem yang multi-thread atau pake Ruby fibers), buffer ini bisa kena race condition dan ngirim data corrupt ke Gemini.

**Solution:** Kalo emang nggak ada rencana pindah dari EM, cukup tambahin `# frozen_string_literal: true` biar jelas. Kalo mau jaga-jaga, tambahin `Mutex` guard di method `push` dan `since`.

---

### [P2-6] EventMachine jalan di thread terpisah — potensi masalah koneksi database

**Detail Issue:** EM di-start pake `Thread.new` karena Puma nggak otomatis nge-run EM. Artinya callback EM (yang handle WebSocket) jalan di thread beda dari Rails. Akses ActiveRecord dari dalam EM callback jadi di thread yang nggak dikenal connection pool.

**Lokasi:** `api/config/initializers/eventmachine.rb:5-12`

**Impact:** Selama ini mungkin berfungsi karena connection pool bisa handle, tapi kalo ada spike koneksi WebSocket, bisa terjadi koneksi leak atau thread safety issue di ActiveRecord. Ini masalah yang subtle — munculnya kapan-kapan, bukan tiap saat.

**Solution:** Pastiin semua akses database dari dalam EM callback make `ActiveRecord::Base.connection_pool.with_connection`. Alternatif: pindah WebSocket approach ke `anycable` atau solution lain yang lebih modern dan native compatible sama Puma.

---

### [P2-7] `ALLOWED_ORIGINS` required — app crash kalo nggak di-set

**Detail Issue:** Di `cors.rb`, `ENV.fetch('ALLOWED_ORIGINS')` tanpa default value. Kalo env var ini nggak ada, Rails nggak bakal start sama sekali.

**Lokasi:** `api/config/initializers/cors.rb:5`

**Impact:** Developer yang lupa set `ALLOWED_ORIGINS` bakal liat app mereka crash dengan `KeyError` yang confusing pas startup. UX yang jelek buat developer baru.

**Solution:** `ENV.fetch('ALLOWED_ORIGINS', 'http://localhost:5173')` — dengan default value yang masuk akal buat development. Production bisa override sesuai kebutuhan.

---

### [P2-8] Halaman signup cuma pajangan — endpoint backend nggak ada

**Detail Issue:** Frontend punya `SignupPage` yang lengkap (form buat email, password, role selection), dan `authApi.signup()` yang panggil `POST /signup`. Tapi di backend nggak ada route buat itu.

**Lokasi:**
- `web/src/services/auth.ts:17` → `api.post("/signup", data)`
- `web/src/pages/auth/SignupPage.tsx` — halaman signup
- `api/config/routes.rb` — nggak ada route signup

**Impact:** User bisa buka halaman signup, isi form, submit — tapi dapet 404. Fitur ini setengah jadi. Yang lebih bahaya: kalo ada user yang beneran butuh signup (misal assessor baru), mereka nggak bisa daftar sendiri dan harus manual via admin.

**Solution:** Putuskan dulu: signup bakal di-handle di sini atau di eksternal? Kalo di sini: tambah route dan controller action buat signup (create user, return JWT). Kalo di eksternal: disable SignupPage atau redirect ke external auth provider.

---

## P3 — Cosmetic

### [P3-1] Level anchor optional di TypeScript tapi required di backend

**Detail Issue:** Di frontend, `l1_anchor` sampe `l5_anchor` di definisikan sebagai optional (`?: string`). Tapi di backend, ada `validates :l1_anchor, :l2_anchor, ..., presence: true`. Jadi kalo ada skenario di mana form nggak ngirim salah satu anchor, API bakal return 422.

**Lokasi:**
- `web/src/types/index.ts:26-30` → field anchor optional
- `api/app/models/assessment_skill.rb:6` → validasi anchor required

**Impact:** Sampai sekarang mungkin belum kena masalah karena `CustomSkillForm.tsx` selalu render semua textarea anchor. Tapi typing-nya nggak jujur — ngasih kesan anchor boleh kosong, padahal backend nolak. Berpotensi jadi bug kalo ada yang refactor form.

**Solution:** Sederhana: ganti type definition di frontend dari optional jadi required. Kalo emang ada alesan mereka boleh kosong, backend validasinya juga harus diubah.

---

## Ringkasan Pola Masalah

1. **Type mismatch API ↔ Frontend (4 temuan)**: `skill_id`, `ai_level`, `required_level`/`expected_level`, `speaker`. Frontend dan backend nggak sinkron dalam kontrak data. Ini yang paling kritis karena langsung berdampak ke correctness data.

2. **Security & access control (3 temuan)**: `audio_complete` tanpa verifikasi, CORS permisif, JWT hardcoded di git.

3. **Infrastructure & DevOps (3 temuan)**: Migrasi nggak ada, UUID vs bigint inkonsisten, EM di thread terpisah.

4. **Error handling & validation (3 temuan)**: `system_prompt` nggak bisa manual override, login hardcode role admin, level anchor optional di FE tapi required di BE.

5. **Code quality & performance (2 temuan)**: Eager load nggak perlu di MapInjector, AudioRingBuffer not thread-safe.
