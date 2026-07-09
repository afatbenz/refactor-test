# Pull Request — Quality Gate Checklist

> **Gunakan template ini dengan disiplin.** PR yang tidak melengkapi semua
> bagian wajib akan di-*block* oleh CI. Lihat `/assessment/02-quality-system.md`
> untuk detail cara kerja gate.

---

## 1. Spec / PRD

**Wajib:** Cantumkan link ke dokumen spesifikasi atau PRD yang menjadi acuan
perubahan ini. Jika tidak ada dokumen formal, tulis ringkasan satu paragraf
tentang *apa* yang berubah dan *kenapa*.

- [ ] Saya menyertakan link ke spec/PRD: **<link atau jelaskan kenapa tidak ada>**

```
Contoh:
  PRD: https://docs.google.com/document/d/... (ai-interview-v2)
  Atau: Tidak ada PRD formal karena ini bugfix untuk issue #42.
        Ringkasan: Button submit di form assessment tidak disable
        selama loading, menyebabkan double-submit.
```

---

## 2. Acceptance Criteria

**Wajib:** Tulis dalam format **Given / When / Then**. Minimal 1 skenario per
perubahan yang signifikan. Boleh lebih dari satu.

- [ ] Saya melampirkan acceptance criteria (Given/When/Then)

```
Given  [konteks / precondition]
When   [aksi yang dilakukan]
Then   [hasil yang diharapkan]

Contoh:
  Given  user sudah login sebagai assessor
  When   user mengklik "Invite Candidate" tanpa mengisi nama
  Then   modal tetap terbuka dan tombol "Create Link" disabled

  Given  user sudah login sebagai assessor
  When   user mengisi nama candidate lalu mengklik "Create Link"
  Then   session baru terbuat dan invite link muncul
```

---

## 3. Solution / Design Plan

**Wajib:** Jelaskan pendekatan teknis yang dipakai untuk menyelesaikan
perubahan ini. Fokus ke *bagaimana* bukan *apa*.

- [ ] Saya menyertakan ringkasan solution/design plan

```
Tulis 3-5 poin yang mencakup:
- File/komponen apa saja yang berubah
- Approach yang dipilih (dan alternatif jika ada)
- Dampak ke sistem lain (API contract change, DB migration, dll)
- Pertimbangan keamanan / performance
```

---

## 4. Tests

**Wajib:** Setiap PR harus menyertakan test yang relevan dengan perubahan.
Pilih salah satu:

- [ ] Ya, saya menambahkan test (unit / integration / e2e)
- [ ] Tidak perlu test karena: **<jelaskan alasan>**

---

## 5. Additional Context

- [ ] Perubahan ini membutuhkan migration database
- [ ] Perubahan ini membutuhkan update environment variable / config
- [ ] Perubahan ini membutuhkan update dokumentasi

---

<!-- metadata:quality-gate-v1 -->
