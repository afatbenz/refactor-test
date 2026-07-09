# Quality Gate System — Dokumentasi

**File terkait:**
- `.github/PULL_REQUEST_TEMPLATE.md` — template PR yang harus dipake
- `.github/workflows/quality-gate.yml` — GitHub Actions workflow yang nge-enforce
- `assessment/01-audit.md` — temuan audit yang jadi dasar kenapa gate ini perlu

---

## 1. Apa yang di-enforce?

Quality gate ini memastikan setiap Pull Request menyertakan **tiga komponen
wajib** sebelum bisa di-merge:

| Gate | Yang dicek | Kenapa penting |
|------|-----------|----------------|
| **Spec / PRD** | Ada link ke dokumen acuan atau penjelasan kenapa perubahan dilakukan | Dari audit (P0-2, P0-3, P1-1, P1-2) kita lihat banyak mismatch API-FE karena nggak ada spec yang nyambung. PRD jadi acuan biar frontend dan backend ngembang bareng contract yang sama. |
| **Acceptance Criteria** | Minimal 1 skenario Given/When/Then | Mencegah ambiguity. Kalo acceptance criteria ditulis jelas, tester dan reviewer punya pegangan yang sama buat nentuin "done." |
| **Solution / Design Plan** | Approach teknis, file apa yang berubah, trade-off | Mencegah asal coding. Engineer dipaksa mikir dulu sebelum nulis kode. Juga bantu reviewer ngerti konteks lebih cepet. |
| **Tests** | Checklist konfirmasi test, plus deteksi otomatis file test | Bekal dari audit: project ini **nol test**. Gate ini memaksa setiap PR mulai nambahin test. |

Selain itu, CI secara otomatis ngecek apakah ada **file test** yang berubah
di PR. Kalo nggak ada dan author juga nggak explicitly skip, PR bakal di-block.

---

## 2. Cara Kerja Gate (step by step)

```
Developer bikin PR
       │
       ▼
Nulis deskripsi pake template (.github/PULL_REQUEST_TEMPLATE.md)
       │
       ▼
PR di-open / di-edit / di-sync
       │
       ▼
GitHub Actions trigger: .github/workflows/quality-gate.yml
       │
       ├── Step 1: Checkout repo
       │
       ├── Step 2: Baca PR body, validasi 4 gate:
       │   ├── GATE 1: Ada section Spec/PRD + link
       │   ├── GATE 2: Ada section AC dengan format Given/When/Then
       │   ├── GATE 3: Ada section Solution/Design Plan
       │   └── GATE 4: Checklist test tercentang (Ya / Tidak perlu)
       │
       ├── Step 3: Deteksi file test di PR diff
       │   ├── Cari *.spec.*, *.test.*, *_spec.rb, __tests__/
       │   └── Kalo nggak ada dan nggak explicit skip → fail
       │
       └── Output:
           ├── ✅ Semua lolos → PR bisa di-merge
           └── ❌ Ada yang fail → PR di-block, error message di check
```

### Detil validasi per gate

**GATE 1 — Spec/PRD:**
- Cari keyword `Spec / PRD` atau `PRD` atau `spec` di body
- Cari URL (`https://...`) atau reference issue (`#123`)
- Fail kalo nggak ketemu keduanya

**GATE 2 — Acceptance Criteria:**
- Cari pola `Given` + `When` + `Then` (case-insensitive)
- Minimal 1 skenario lengkap
- Fail kalo salah satu keyword nggak ada

**GATE 3 — Solution/Design Plan:**
- Cari keyword `Solution / Design` atau `Design Plan` atau `approach`/`pendekatan`
- Cek checklist "saya menyertakan" tercentang
- Fail kalo section atau checklist nggak ada

**GATE 4 — Tests:**
- Cek apakah "Ya, saya menambahkan test" atau "Tidak perlu test" tercentang
- Fail kalo nggak ada yang dicentang

**GATE-TEST (otomatis):**
- Scan semua file yang berubah di PR
- Cocokkin sama pola: `_spec.rb`, `.spec.ts`, `.test.ts`, `.test.tsx`, `__tests__/`
- Kalo ada perubahan file test → lolos
- Kalo nggak ada dan PR body nggak explicit skip → fail

---

## 3. Cara Extend / Modifikasi Gate

### 3.1. Nambah gate validasi baru

Ada dua layer yang bisa ditambah:

**Layer 1 — Validasi PR body** (di `quality-gate.yml` step `check_body`):

Tambah block baru di script dengan pola:

```javascript
// ── Gate 5: Contoh baru ─────────────────────────────────────────
console.log("=== GATE 5: Nama Gate ===");
const myCheck = /some-regex/i.test(body);
if (!myCheck) {
  errors.push("GATE-5: Pesan error yang jelas.");
}
```

**Layer 2 — Validasi kode otomatis** (step baru di workflow):

Tambah step terpisah di YAML:

```yaml
- name: Custom validation
  run: |
    # Contoh: cek apakah ada perubahan migration tanpa spec
    if git diff --name-only origin/main...HEAD | grep -q "db/migrate"; then
      if ! git diff --name-only origin/main...HEAD | grep -q "spec/models"; then
        echo "❌ Ada migration tapi nggak ada model spec."
        exit 1
      fi
    fi
    echo "✓ Custom validation lolos."
```

### 3.2. Ganti threshold / behavior

Semua konstanta ada di script step `check_body` dan `check_tests`:

- **Pola file test**: edit `testPattern` regex di step `check_tests`
- **GATE 2 — ketat/longgar**: kalo mau minimal 2 skenario, ubah cek `hasGivenWhenThen`
- **GATE 1 — link wajib**: hapus fallback issue reference

### 3.3. Skip gate untuk PR tertentu (emergency)

Ada beberapa cara:

**A. Di PR description** — centang "Tidak perlu test" di bagian 4 dan kasih
alasan yang jelas. Ini cuma skip gate test, bukan gate lain.

**B. Label GitHub** — tambahin conditional di workflow:

```yaml
- name: Skip gate untuk hotfix
  if: contains(github.event.pull_request.labels.*.name, 'hotfix')
  run: echo "Hotfix — skip quality gate" && exit 0
```

**C. `[skip ci]` di commit message** — ini GitHub Actions native. Tapi nggak
disaranein karena skip semua check termasuk yang kritikal.

### 3.4. Testing gate secara lokal

Developer bisa ngecek PR body mereka sebelum push pake script sederhana:

**Simulasi dengan bash (Linux/Mac/Git Bash):**

```bash
#!/usr/bin/env bash
# Simulasi quality gate lokal
# Simpan PR body ke file, lalu:
#   cat pr-body.md | ./scripts/check-quality-gate.sh

body=$(cat)

echo "=== GATE 1: Spec/PRD ==="
if echo "$body" | grep -qiE "spec.*prd|prd|https?://"; then
  echo "  ✓ OK"
else
  echo "  ✗ MISSING: Link ke PRD atau reference issue"
fi

echo "=== GATE 2: Acceptance Criteria ==="
if echo "$body" | grep -qi "Given" && echo "$body" | grep -qi "When" && echo "$body" | grep -qi "Then"; then
  echo "  ✓ OK"
else
  echo "  ✗ MISSING: Format Given/When/Then"
fi

echo "=== GATE 3: Solution/Design Plan ==="
if echo "$body" | grep -qiE "solution.*design|design.*plan|approach"; then
  echo "  ✓ OK"
else
  echo "  ✗ MISSING: Solution/Design Plan"
fi

echo "=== GATE 4: Tests ==="
if echo "$body" | grep -qiE '\- \[x\] .*(ya|tidak perlu)'; then
  echo "  ✓ OK"
else
  echo "  ✗ MISSING: Checklist test belum dicentang"
fi
```

---

## 4. Contract Tests — Automated Validation

**Gate ini hanya kuat kalo PR body diisi dengan jujur.** Nggak ada AI yang
nge-verify apakah link PRD beneran relevan atau acceptance criteria
beneran cover perubahan. Ini tanggung jawab reviewer dan budaya tim.

**Untuk fase transisi** (proyek yang belum punya test sama sekali), gate test
bisa di-set ke `warning` dulu (tidak blocking) sampai coverage minimal
tercapai. Caranya: ganti `core.setFailed()` jadi `core.warning()` sementara.

**Trigger di branch:** Workflow ini cuma jalan buat PR ke `main` dan
`develop`. Kalo ada branch lain yang perlu di-protect, tambahin ke list.

---

## 5. Referensi

- [GitHub Docs — Required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks)
- [`actions/github-script`](https://github.com/actions/github-script)
- [PR template documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
