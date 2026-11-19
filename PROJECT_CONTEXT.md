# PROJECT_CONTEXT - SIM-AMI (Sistem Informasi Manajemen Aji Muhammad Idris)

> Dokumen ini ditulis untuk akun TRAE berikutnya agar langsung bisa onboarding dan melanjutkan perubahan tanpa mempelajari dari nol.
> Terakhir diperbarui: 2026-10-17

---

## 1. Identitas Aplikasi
- Nama: **SIM-AMI / PENDAFTARAN UGD RSUD AJI MUHAMMAD IDRIS (RSUDAMI MUARA BADAK)**
- Tipe: Web SPA (Single Page Application) vanilla JS untuk pendaftaran pasien RSUD dan display antrean publik.
- Skenario utama: **Pendaftaran IGD / Poliklinik (Poli Umum) → Nurse Station (pemeriksaan awal/perawat) → Poli (periksa dokter) → Farmasi (ambil obat)**
- Skenario lain: Supervisor dashboard, Rekap pasien, Export Excel, Consent (Triase UGD + General Consent), Display antrean ruang tunggu (Nurse Station + Farmasi + Poliklinik).

---

## 2. Tech Stack
| Layer        | Teknologi                                                                 |
|--------------|---------------------------------------------------------------------------|
| Frontend UI  | **HTML Vanilla + Tailwind via CDN (JIT inline class) + Vanilla JS**      |
| Koneksi DB   | **Supabase JS Client v2 (unpkg CDN)** dengan RLS + Storage               |
| Realtime     | Supabase Realtime (antrian, pasien, poli dokter) + polling fallback      |
| Barcode      | **JsBarcode 3.11.6 (CDN)** → dicetak thermal 80mm / 90mm                 |
| Export Excel | **SheetJS / xlsx 0.18.5 (CDN)** → Rekap pasien harian / per periode      |
| Audio        | Engine suara panggilan lokal berbasis potongan MP3 (`js/queue-sound.js`) |
| Cetak        | Browser Print API (`window.print()`) + `@media print` di `assets/css/print.css` |
| Struktur data (DB) | Tabel `pasien` utama + JSONB opsional: `nurse_station_data`, `poli_service_data`, `batal_berobat_data`, `general_consent_data`, `triase_ugd_data` |

> **PENTING**: Semua logic (9000+ line) ada di **inline script `<script>` block di `index.html`**, bukan di file JS eksternal terpisah. Inline script yang besar ini **rawan syntax error fatal** jika tidak di-check.

---

## 3. File Utama Dan Tugasnya

### File Entry / Master (WAJIB BACA SEBELUM BERUBAH APA PUN)
| File                               | Isinya                                                                                                                                             |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `index.html`                       | **App utama SPA**. Berisi: Login, role routing, dashboard pendaftaran, form pasien, rekap, modal poli, barcode template, slip cetak, general consent, triase, inline script ~8250 baris. |
| `display.html`                     | **Display antrean publik ruang tunggu (NURSE_STATION / FARMASI / POLIKLINIK / ALL mode)**. Punya audio engine panggilan + rotasi kartu dokter poli. |
| `assets/css/print.css`             | Semua rule `@media print` untuk mode cetak (barcode sticker, gelang/tiket UGD, slip nurse station, general consent, triase).                      |
| `assets/js/utils.js`               | **JANGAN DIUBAH SEENAKNYA**: `computeAgeYears`, `parseLocalDateValue`, `computeDetailedAgeParts`, **`formatDetailedAge` (asli, bukan yang inline!)**, `formatDateSlash`, `formatLocalDateTime`, `escapeHtml`. |
| `assets/js/poli-dashboard.js`      | Worklist poli, flow dokter panggil pasien poli, batal filter (hanya menampilkan pasien nurse station status "selesai").                            |
| `assets/js/nurse-station-dashboard.js` | Workflow Nurse Station: panggil, lewati, selesai, **prefix nomor antrian NS umum `A-` dinormalisasi jadi `C-`**, prioritas `B-` jadi `P-`. Cachebuster `?v=20260804-ns-hotfix-1` di `<script src=...>`. |
| `assets/js/poli-doctor-settings.js`| Sumber `mergeDoctorRows()` untuk display kartu dokter poli (rotasi display NS).                                                                   |
| `assets/js/ugd-assessment.js`      | Form assessment / triase awal UGD.                                                                                                                 |
| `assets/js/perawat-dashboard.js`   | Dashboard perawat.                                                                                                                                 |
| `assets/js/dokter-dashboard.js`    | Dashboard dokter.                                                                                                                                  |
| `assets/js/queue-loket-utils.js`   | Helper antrian loket farmasi/poli (pembagian loket).                                                                                               |
| `js/queue-sound.js`                | **Audio engine panggilan antrean** untuk display (pendaftaran awal & Nurse Station dipisah openingnya). Gunakan signature anti duplikasi.         |
| `assets/sound/**`                  | Asset suara potongan MP3 (00-opening, 01-words, 02-letters, 03-numbers). Opening Nurse Station terpisah di `00-opening/Opening Nurse Station.mp3` dengan fallback ke `nada.mp3`. |

### Halaman Mesin Antrean (kiosk) & Widget SKM
| File                               | Isinya                                                                                                                                             |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `mesin-antrian.html`               | **Pemilih unit** mesin antrean (gerbang masuk). **TIDAK** memuat kartu SKM — jangan diubah tanpa diminta. Lihat §15.                                 |
| `mesin-poliklinik.html`            | Mesin antrean unit **POLIKLINIK** (kiosk, 1 layar, portrait 1080×1920). Tombol jalur pertama berlabel **UMUM**. Lihat §15.                          |
| `mesin-farmasi.html`               | Mesin antrean unit **FARMASI** (kiosk). Lihat §15.                                                                                                 |
| `assets/js/skm-widget.js`          | **Widget kartu SKM** (kode QR + tombol "Isi SKM"). Konfigurasi dari `window.SIMAMI_SKM` yang di-set inline di halaman mesin.                       |
| `assets/css/skm-widget.css`        | Style kartu SKM, termasuk varian `.skm-card--compact` (horizontal, hemat tinggi).                                                                  |

---

## 4. Role Dan Hak Akses

Role disimpan di localStorage / kolom role Supabase. UI render module hanya untuk role aktif (bukan show/hide sederhana).

| Role ID                           | Menu / Akses Utama                                                                                                 |
|-----------------------------------|---------------------------------------------------------------------------------------------------------------------|
| `admin_pendaftaran` / `admin_igd` | Dashboard pendaftaran utama (Form Pasien + Antrian + Semua tombol cetak), **Batal Berobat**, Rekap, Export Excel.  |
| `petugas_nurse_station`           | Dashboard Nurse Station saja. **BELUM ADA** akses Batal Berobat (hanya melihat efek filter).                        |
| `petugas_poli`                    | Dashboard Poli saja (worklist per poli/dokter, diagnosa, status pemeriksaan). **BELUM ADA** akses Batal Berobat.   |
| supervisor / RM / Rekam Medik     | Supervisor dashboard + lihat rekap + export.                                                                       |

> Catatan penting (status 2026-08-07): **Fitur Batal Berobat hanya untuk admin pendaftaran / admin IGD**. Nurse Station dan Poli BELUM diizinkan (hanya bisa melihat antrean batal sebagai filter "sudah batal").

---

## 5. Nomor Antrian (Konvensi & Normalisasi)

### A. Antrian Pendaftaran Awal / Poli
- `A-1, A-2, ...` : Umum (Poliklinik / Farmasi)
- `P-1, P-2, ...` : Prioritas
- `B-*` lama → otomatis dinormalisasi menjadi `P-*` (prioritas)

### B. Nomor Antrian **Nurse Station** - PERLU DIPERHATIKAN KHUSUS
Karena pasien umum Nurse Station ingin prefix berbeda dari poli:
- **`A-*` dari pendaftaran → secara otomatis ditampilkan & dicetak sebagai `C-*` hanya di jalur Nurse Station** (cetak slip, dashboard NS, display NS suara dan UI).
- `P-*` tetap `P-*` (Prioritas)
- Normalisasi nomor ini TIDAK merubah kolom `no_antrian` di DB (tetap A-1), hanya tampilan/display/slip/suara saja yang ganti ke `C-1`.
- Fungsi normalisasi:
  - `normalizeNsQueueNo(raw)` di `nurse-station-dashboard.js`
  - `normalizeNsPrintQueueNo(raw)` di `index.html` (cetak slip NS)
  - `normalizeNurseStationQueueNo(raw)` di `index.html` (build payload cetak) + display.html helper.

### C. Farmasi
- Loket Farmasi 1 (FARMASI_1) dan Farmasi 2 (FARMASI_2), pakai nomor antrian dari unit FARMASI.

---

## 6. Cetak (Print System) - Konvensi Penting

- Semua template cetak ada di section "Container" tersembunyi di `index.html` (antara sticker / ns ticket / ugd ticket / wristband / consent).
- Semua cetak lewat `window.print()`, dikendalikan dengan cara:
  1. `setPrintPageSize('80mm 60mm')` → inject `@page { size: ... }` inline style.
  2. `document.body.setAttribute('data-print-mode', 'ugd-ticket')` → print.css akan `display:none` seluruh body kecuali container yang cocok.
  3. `window.setTimeout(() => window.print(), 30)` setelah populate template.
  4. Event listener `afterprint` reset mode cetak supaya UI kembali normal.

**Mode cetak yang ada saat ini (didefinisikan di `print.css`):**

| Mode `data-print-mode` | Template ID                      | Ukuran    | Digunakan untuk                                                                               |
|------------------------|----------------------------------|-----------|-----------------------------------------------------------------------------------------------|
| `barcode`              | `#stickerContainer`              | 80×50 mm  | Stiker barcode pasien (No RM, nama, tanggal lahir, umur, dll.)                                |
| `wristband`            | `#wristbandContainer`            | 90×25 mm  | Gelang identitas (saat ini jarang dipakai karena user minta ganti jadi Tiket UGD untuk UGD).   |
| `ugd-ticket`           | `#ugdTicketContainer`            | 80×60 mm  | **Tiket UGD** (sesuai foto struk user: RSUDAMI MUARA BADAK, UGD BESAR, nama, umur/JK/tgl lahir, No RM / No Reg / UGD, opsional **No BPJS** di bawah jika ada). |
| `nurse-station-ticket` | `#nurseStationTicketContainer`   | 80×60 mm  | Slip antrean Nurse Station (prefix `C-` untuk umum / `P-` prioritas, poli tujuan).             |
| `general-consent`      | `#generalConsentModal`           | A4        | Lembar general consent (print modal saja).                                                    |
| `triase-ugd`           | `#triageUgdModal`                | A4        | Lembar triase UGD.                                                                            |

**CATATAN KHUSUS TIKET UGD**: User meminta tombol **"Cetak Gelang" di panel pendaftaran** ganti fungsi jadi **"Cetak Tiket UGD"** **hanya untuk unit UGD**. Saat user pilih unit POLIKLINIK/FARMASI, tombol ini otomatis disable. Jika user pilih unit UGD → handler `triggerPatientPrint('wristband')` malah di-**cabang internal**:
- Jika `unit === 'UGD'`: pakai `ugd-ticket` mode (tiket struk)
- Jika unit lain: pakai `wristband` mode (gelang 90×25, jarang dipakai)

---

## 7. Sistem Suara Panggilan Display (Display Antrean)

**File kunci**: `js/queue-sound.js` + `display.html` inline script.

### Prinsip isolasi suara (FIX 2026-08-07)
Sebelumnya suara panggilan Farmasi bisa keluar di display Poliklinik dan sebaliknya karena:
1. `announceNewCalls` selalu memproses kedua unit tanpa cek `selectedUnit` mode display.
2. State `lastAnnounced` shared tanpa prefix, sehingga saat pindah mode atau interval fallback berjalan ada "nyangkut" yang bunyi beberapa menit kemudian.

**Solusi diterapkan**:
- `selectedUnit` mempengaruhi filter announcement:
  - Mode `FARMASI` → hanya announce loket Farmasi 1 / 2.
  - Mode `POLIKLINIK` → hanya announce loket A / B / C.
  - Mode `NURSE_STATION` → hanya announce `ns_status === 'dipanggil'`.
  - Mode `ALL` → announce SEMUA (digunakan untuk display gabungan jika perlu).
- `lastAnnounced` diberi **prefix key per mode aktif** (`FARMASI:FARMASI:1`, `POLIKLINIK:POLIKLINIK:A`, `ALL:FARMASI:1`, `NURSE_STATION:NURSE_STATION:CURRENT`). Jangan hapus prefix ini!

### Kalimat Panggilan Nurse Station
Format suara final yang disepakati user:

```
Opening Nurse Station.mp3 →
"Nomor Antrian" →
"Umum"/"Prioritas" →
Huruf prefix (C / P).mp3 →
Angka (1, 2, ...).mp3 →
"Menuju Meja Pemeriksaan.mp3"
```

Contoh:
- `C-1` umum: *"Nomor Antrian Umum C 1 Menuju Meja Pemeriksaan"*
- `P-3` prioritas: *"Nomor Antrian Prioritas P 3 Menuju Meja Pemeriksaan"*

### Opening Dipisah
- Pendaftaran awal / umum: `00-opening/nada.mp3`
- Nurse Station: `00-opening/Opening Nurse Station.mp3` (fallback jika tidak ada ke `OPENING NURSE.mp3` lalu ke `nada.mp3`). Jangan hardcode satu nama file saja!

---

## 8. Display Nurse Station Split Layout (FIX 2026-08-07)

User request "antrian dan dokter poli 50:50", dokter poli terlihat jelas dari jauh. Layout final di `display.html`:
- **50% kiri (Fokus)**: Informasi Dokter Poli (header **sticky** "Informasi Dokter Poli" BESAR, slide 1 kartu fokus dokter poli + indikator dot, mini cards lain di bawahnya).
- **50% kanan**: Antrian Nurse Station (kartu "Sedang Dipanggil" besar + daftar menunggu).

### Bug klasik display dokter yang sering muncul:
- **Rotasi dokter hanya "kedip" di satu poli, tidak berpindah-pindah**: Penyebab = setiap refresh antrean baru (yang tidak merubah daftar dokter) malah me-reset `nurseDoctorRotationIndex = 0`. **Solusi (JANGAN DIHAPUS)**: bandingkan *signature dokter* sebelum reset. Jika signature sama → lanjutkan index timer lama tanpa reset (cari `renderNurseDoctorCards` + `nurseDoctorRotationSignature`).
- **Warna prioritas berubah biru saat "Sedang Dipanggil" (padahal menunggu orange)**: Solusi = helper `applyCurrentNsPriorityStyleIfNeeded(queueNo)` yang detect prefix `P-` lalu add class `priority-card`, `priority-number`, `priority-chip` secara eksplisit ke kartu fokus NS. Jangan hanya andalkan default style biru pada current card.
- **Suara panggilan delay/beban**: Solusi = announce dijalankan SEBELUM render dokter, rotasi dokter tanpa `animation/gradient` berat, background flat (bukan `bg-gradient` biru/cyan). **JANGAN KEMBALIKAN `backdrop-blur`, `shadow-2xl`, atau animasi pulse ke kartu dokter/fokus**. User sudah konfirmasi ini sumber delay suara.

---

## 9. Daftar Bug Kritis & Fix Penting (JANGAN TERULANG!)

Pahami ini karena akun baru sering tidak tahu dan bikin kesalahan berulang:

### Bug #1 - Inline script `index.html` crash → halaman blank putih hanya header
- **Penyebab klasik**: Syntax error pada inline script `<script>` besar di baris 1255-9511 (mis. penulisan `a || b ?? c` tanpa tanda kurung, missing bracket / kurung, comma object salah).
- **Ciri**: Halaman dibuka cuma header SIM-AMI, selebihnya putih, tidak ada login, console browser muncul `SyntaxError: ...` di line yang mendekati area terakhir diubah.
- **CARA DETECT SEBELUM PUSH (WAJIB!)**:

  Jalankan via PowerShell di project root:
  ```powershell
  $html = Get-Content "index.html" -Raw -Encoding UTF8
  $start = $html.IndexOf('<script>', $html.IndexOf('poli-doctor-settings.js'))
  $end = $html.LastIndexOf('</script>')
  $script = $html.Substring($start + 8, $end - $start - 8)
  [System.IO.File]::WriteAllText("_tmp_check.js", $script, [System.Text.UTF8Encoding]::new($false))
  node --check _tmp_check.js   # exit 0 = aman, exit 1 = syntax error, lihat line!
  Remove-Item _tmp_check.js -Force
  ```
  Kalau `exit 1`, **JANGAN PUSH**, perbaiki dulu error line yang ditampilkan.

### Bug #2 - Gabungan `||` dan `??` tanpa kurung (syntax error fatal)
Contoh SALAH → payload: `payload._tanggal_lahir_raw || payload.umur ?? ''` (menyebabkan `SyntaxError: missing ) after argument list`).

Cara BENAR: bungkus salah satu dengan kurung:
```js
// Aman
(payload._tanggal_lahir_raw || payload.umur) ?? ''
// atau
payload._tanggal_lahir_raw ?? payload.umur ?? ''
```

### Bug #3 - Infinite Recursion `formatDetailedAge` vs `formatDetailedAgeSafe`
Ini bug yang membuat **save pasien error "Maximum call stack size exceeded" + umur tidak otomatis menghitung dari tanggal lahir**.

JANGAN PERNAH mendeklarasikan lagi `function formatDetailedAge(...)` di INLINE SCRIPT `index.html` yang bodynya cuma manggil balik `formatDetailedAgeSafe`. Karena:
- `utils.js` sudah punya `formatDetailedAge` ASLI yang benar (menggunakan `computeDetailedAgeParts`).
- Jika inline script mendeklarasikan `function formatDetailedAge` lagi (hoisted!), ia akan menimpa scope lokal, dan `formatDetailedAgeSafe` manggil balik → recursion → stack overflow.

**Aturan tetap aman**:
- Hanya ada SATU `formatDetailedAge`: yang ada di `assets/js/utils.js` (global `window.formatDetailedAge`).
- Di inline script `index.html`:
  - JIKA perlu pakai → selalu panggil **`window.formatDetailedAge(...)`** (eksplisit global, hindari risk ter-shadow).
  - JANGAN deklarasikan ulang `function formatDetailedAge` di inline script apapun alasannya!

### Bug #4 - Suara panggilan antar unit "nyasar" / tertunda
Lihat §7 isolasi suara → JANGAN hapus `announcementKeyPrefix()` / filter unit di `announceNewCalls` / `announceNewNurseStationCalls`.

### Bug #5 - Display Nurse Station rotasi dokter tidak berpindah
Lihat §8 → signature comparison JANGAN dihapus.

### Bug #6 - Form pendaftaran terkunci setelah prioritas selesai (harus refresh baru bisa input)
Penyebab: setelah jalur `Next Prioritas` / `Lewati Antrean` selesai, sync lock form dengan antrian aktif tidak jalan. Solusi: setelah panggil `loadQueueControls()` SELALU panggil `await syncRegistrationLockWithCurrentQueue()` di flow itu. JANGAN lupa baris ini saat menambah tombol kontrol antrian baru.

### Bug #7 - Akun Nurse Station blank putih (FIX 2026-08-04)
- Solusi: script module NS diberi **cache-buster suffix version** `?v=...` (saat ini `nurse-station-dashboard.js?v=20260804-ns-hotfix-1`) + lazy init + kartu merah error panel jika module tidak termuat.
- Jika kamu update file `nurse-station-dashboard.js` dimanapun → **NAIKKAN VERSI CACHE BUSTER** di `<script src=...>` dalam `index.html` agar browser client tidak pakai JS lama. Begitu juga untuk file JS lain yang clientnya cache parah.

### Bug #8 - Tombol "Isi SKM" memindahkan halaman mesin (FIX 2026-10-17)
- **Penyebab**: `window.open(url, '_blank', 'noopener')` mengembalikan `null` **walau popup berhasil dibuka**. Akibatnya pengecekan `if (win)` gagal dan fallback `window.location.href = url` ikut jalan → halaman mesin ikut pindah.
- **Solusi (JANGAN DIUBAH)**: di `assets/js/skm-widget.js` → `openSurvey()` pakai `var win = window.open(url, '_blank');` lalu `win.opener = null;` (setara `noopener`, tapi tetap tahu popup berhasil).
- Detail fitur SKM ada di §15.

---

## 10. Optimasi Supabase Egress (Sudah Dijalankan 2026-08-06)
User complaint egress 50%+ cepat naik. Sudah diterapkan:

1. **Select kolom spesifik (bukan `select('*')`) di rekap + export**: helper `r_getSelectFields()` daftar kolom yang dibutuhkan saja + push JSONB batal/ns/poli hanya jika kolom tersedia. Ini titik terbesar penghematan.
2. **Realtime handler conditional refresh**: event realtime `antrian` hanya refresh module sesuai view aktif. Event `pasien` refresh NS/Poli/Rekap conditional (tidak semua module reload sekaligus).
3. **Debounce rekap**: setidaknya 1500ms sebelum rerender.
4. **Polling fallback dinaikkan**: 15s → 30s untuk admin. Display antrean pakai 5s scheduler dengan minimal 2.5s antar load untuk menghindari spam.
5. **Display non-NS query**: `select()` cuma kolom yang dipakai render.

JANGAN kembalikan `select('*')` di query rekap/export, dan JANGAN buat realtime handler memanggil `refreshAllModules()` sembarangan!

---

## 11. Pekerjaan Pending / Next Task Yang Sudah Disepakati Tapi Belum Dieksekusi

Berikut daftar backlog yang user sudah tanya/setujui, silahkan lanjut jika user menanyakan lagi:

### [TINGGI] ICD-10 Offline Searchable (Poli Diagnosa) — Opsi 1 (Offline JSON)
- User sudah konfirmasi **ambil file ICD-10 dari SatuSehat Indonesia** (total sekitar ~10k-14k kode ICD-10, tergantung level). Aman secara teknis: tidak ada data sensitif, tidak kirim ke luar, hanya lazy load JSON + debounce search + limit 50 hasil.
- Target: di dashboard poli (`assets/js/poli-dashboard.js` → form diagnosa) yang tadinya `<textarea>`, ganti jadi component **searchable** (suggest dropdown + kode + deskripsi, jika user ketik manual yang tidak match → tampilkan warning "tidak standar, tetap simpan?").
- Belum dikerjakan karena user baru konfirmasi "aman?", lalu ada bug lain prioritas. Langkah awal tunggu user upload file ICD-10 (tanyakan formatnya: JSON / CSV / XLSX, ukuran, level detail).

### [SEDANG] Akses Batal Berobat untuk akun Nurse Station dan akun Poli
- Saat ini (status 2026-08-07): Hanya `admin_pendaftaran` dan `admin_igd` yang bisa. User pernah tanya statusnya.
- Rencana: tambahkan tombol "Batal Berobat" di dashboard NS dan dashboard Poli, tapi **dengan konfirmasi nama petugas + catatan wajib**, dan update `batal_berobat_data` JSONB (sumber record sama). User BELUM memutuskan final apakah mau diizinkan full — konfirmasi dulu sebelum implementasi.

### [SEDANG] Optimasi Egress Lanjutan (opsional jika kembali mendekati 100%)
Candidate: pagination cursor rekap (tidak load ribuan row per page sekaligus), lazy load daftar dokter poli, cache stat ringkas di localStorage 30 detik.

---

## 12. Cara Menjalankan Lokal & Debug

Tidak ada build step, tidak ada npm. Ini vanilla SPA.

1. **Cara serve (opsional, tapi disarankan karena path absolute & `file://` bisa beda origin dengan Supabase)**:
   - Gunakan server favorit: Python `http.server`, atau `npx http-server . -p 8000`.
   - Buka `http://localhost:8000/` (jangan `file://` jika storage / realtime / redirect Supabase bermasalah).
2. **Halaman yang bisa dibuka**:
   - `index.html` → app utama (login, dashboard, rekap, dll.)
   - `display.html?unit=NURSE_STATION` → display antrean ruang tunggu (mode unit lain: `FARMASI`, `POLIKLINIK`, atau tanpa parameter untuk mode `ALL`).
   - `mesin-antrian.html` → pemilih unit **mesin antrean** kiosk (lihat §15). Butuh sesi akun mesin; kalau tidak ada, halaman unit akan redirect ke sini.
   - `mesin-poliklinik.html` / `mesin-farmasi.html` → mesin antrean per unit. **Hanya bisa ter-render kalau login akun mesin** — lihat peringatan pengujian di §15A.
3. **Debug cepat syntax inline script index.html**: lihat §9 Bug #1 — jalankan snippet PowerShell node --check, WAJIB lakukan sebelum commit apapun yang menyentuh inline script `<script>`.

---

## 13. Prinsip Perubahan Kode (Style Guide Untuk Next Agent)

1. **JANGAN deklarasikan ulang function global yang sudah ada di `assets/js/*.js` di inline script `index.html`**. Biasakan panggil `window.namaFungsi(...)` untuk hindari scope shadow → recursion.
2. **Inline script index.html sangat besar**: jika kamu menambah object/array literal, SELALU cek koma + bracket. Setelah selesai edit apapun → jalankan `node --check _tmp_check.js` seperti di §9.
3. **Cache-buster suffix untuk file JS eksternal**: setiap ubah `nurse-station-dashboard.js`, `poli-dashboard.js`, dll. → naikkan suffix version di tag `<script src="...?v=...">` agar client tidak cache JS lama.
4. **Nomor antrian Nurse Station**: ingat rule `A-` → `C-` untuk tampilan saja (display, cetak, suara). Database tetap `A-`, JANGAN update kolom `no_antrian` jadi `C-` di DB.
5. **Mode print**: selalu gunakan `data-print-mode` + `@page size` di `print.css`. Jangan buat cara print baru yang diluar pola ini (sudah stabil).
6. **Realtime dan egress**: Jangan sembarang `select('*')`. Jangan sembarang `refreshAll()` di realtime handler. Gunakan signature skip-render jika data sama.
7. **File suara Nurse Station**: gunakan fallback multi filename, jangan hardcode satu nama. User ganti-ganti nama file saat push MP3.
8. **WAJIB sebut file yang diubah**: setiap selesai kerja, tutup jawaban dengan blok `**File yang diubah**` berisi path + status (`baru`/`diubah`) + 1 baris ringkasan. Sebut juga file lain yang ikut berubah karena efek samping (mis. cache-buster). Kalau tidak ada, tulis "Tidak ada file diubah". User push ke GitHub **manual** — agent tidak `git add/commit/push`. Detail: `AGENTS.md`.

---

## 14. File Yang Paling Sering Diubah / Disentuh

Biasanya 90% request user jatuh ke file ini, urut dari yang paling sering:
1. `index.html` (inline script 8rb+ baris + template cetak + UI form)
2. `display.html` (display antrean, suara, layout dokter)
3. `assets/js/nurse-station-dashboard.js` (flow Nurse Station)
4. `assets/js/poli-dashboard.js` (flow poli)
5. `assets/css/print.css` (sesuaian cetak thermal / A4)
6. `assets/js/poli-doctor-settings.js` (data dokter poli)
7. `js/queue-sound.js` (voice call / opening)
8. `assets/sound/**` (file MP3)
9. `mesin-poliklinik.html` / `mesin-farmasi.html` / `mesin-antrian.html` (mesin antrean kiosk — lihat §15)
10. `assets/js/skm-widget.js` + `assets/css/skm-widget.css` (kartu SKM di mesin poliklinik/farmasi)
11. `assets/js/link-qr-popup.js` + `assets/css/link-qr-popup.css` (popup QR SKM/Pengaduan di mesin-antrian)

---

## 15. Mesin Antrean (Kiosk) & Survei Kepuasan Masyarakat (SKM)

*(Ditambahkan 2026-10-17; diperbarui 2026-10-19, 2026-10-21 & 2026-11-19 — perapian tata letak kiosk (§15F), popup tautan QR (§15G), kartu Pengaduan & Saran (§15H), dan redesign UI `mesin-antrian.html` (§15I))*

### A. Halaman mesin antrean
Tiga halaman kiosk, semuanya **portrait 1080×1920**, **layar sentuh**, dan wajib **muat dalam 1 layar tanpa scroll** (termasuk tombol utama "Ambil Nomor"):

| Halaman | Peran |
|---|---|
| `mesin-antrian.html` | **Halaman "Pilih Unit Tujuan Pasien"**: 2 tombol antrean (FARMASI/POLIKLINIK) + 2 tombol tautan (SKM/Pengaduan). Tidak ada kartu SKM inline — pakai **popup QR** (§15G). |
| `mesin-poliklinik.html` | Mesin antrean unit **POLIKLINIK**. Tombol jalur pertama berlabel **UMUM** (`data-jalur="UMUM"`), bukan "POLIKLINIK". |
| `mesin-farmasi.html` | Mesin antrean unit **FARMASI**. |

Sama seperti `index.html` dan `display.html`, tiap halaman mesin punya `SUPABASE_URL` + `SUPABASE_ANON_KEY` sendiri.

**Guard sesi mesin (JANGAN DIHAPUS)**: tiap halaman mesin memanggil `ensureMachineSession()` saat load. Kalau sesi Supabase yang aktif bukan akun mesin (`MACHINE_EMAIL = 'mesin@rsudami.com'`, `MACHINE_UID = '6244cd8b-155d-44d3-897c-1676c2494a4d'`), halaman **me-redirect ke `mesin-antrian.html`**.

> **PENTING untuk pengujian**: karena guard ini, membuka halaman mesin di Chrome headless (tanpa login) **selalu berakhir di `mesin-antrian.html`** — `--dump-dom` akan men-dump halaman yang salah. Saat menguji, netralkan dulu baris `window.location.href = 'mesin-antrian.html';` **di salinan uji** (jangan file asli).

### B. Tata letak "1 layar" (anti-scroll)
- Rantai tinggi: `<html class="h-full">` + `<body class="h-full overflow-hidden">`. **JANGAN** pakai `h-screen`/`100vh` — pernah bikin scrollbar hantu.
- Grid utama `grid-cols-12`: kolom kiri `col-span-4`, kolom kanan `col-span-8`. **Breakpoint `xl:` sudah dihapus.** Bug lama: `grid-cols-1 xl:grid-cols-12` kolaps jadi 1 kolom di lebar 1080px (karena `xl` = 1280px) → halaman jadi ~1700px dan wajib scroll.
- Kolom kiri: **`flex flex-col gap-4`**, tiap kartu (Alur Pengambilan / SKM / Informasi) diberi **`flex-1 min-h-0`** + **`flex flex-col justify-center`** → 3 kartu terbagi rata mengisi tinggi (542 / 556 / 542 px di 1080×1920) dan isinya dipusatkan. **`overflow-y-auto` dan `space-y-4` sudah dihapus** pada kedua halaman mesin. ⚠️ Kalau kelak isinya bertambah, jangan balikin ke `space-y-4` tanpa `flex-1` — ukur lagi `scrollHeight == clientHeight`.

### C. Kartu SKM (Survei Kepuasan Masyarakat)
Kartu diletakkan di **kolom kiri**, di antara kartu "Alur Pengambilan" dan "Informasi". Isinya **kode QR + tombol "Isi SKM"**, keduanya menuju tautan form SKM pemerintah yang sama. **Tidak ada form yang dibangun ulang** — hanya tautan/QR ke aplikasi SKM milik Diskominfo Kukar.

Konfigurasi dibaca `skm-widget.js` dari `window.SIMAMI_SKM` yang di-set **inline di halaman mesin**:
```html
<script>
    window.SIMAMI_SKM = {
        perangkatDaerah: 151,   // RSUD Aji Muhammad Idris (WAJIB angka, bukan kode string)
        layout: 'stack'         // 'stack' = vertikal, QR 204px (YANG DIPAKAI)
                                // 'compact' = horizontal, QR 126px — JANGAN dipakai di kiosk portrait,
                                // kolom kiri sudah lega sejak perapian 2026-10-19 (lihat §15F)
    };
</script>
```

URL SKM yang dihasilkan `buildUrl()`:
```
https://survei.kukarkab.go.id/isi-survei/layanan?perangkat_daerah=151
```

Fakta yang sudah diverifikasi (2026-10-17):
1. `perangkat_daerah` **wajib ID numerik**. Kalau diisi kode string (`1.02.0.00.0.00.04.0000`), server diam-diam jatuh ke `id=1` (SKPD lain).
2. Parameter `&layanan=%5B{id}%5D` **TIDAK berfungsi** (semua layanan tetap tampil). Sudah **dihapus** dari kode; jangan ditambahkan lagi — hanya memperpanjang URL dan memadatkan QR.
3. Tautan mendarat di halaman **"List Pelayanan"** (5 kartu: UGD, Poliklinik, Laboratorium, Kefarmasian, Rawat Inap). Pasien **harus menekan kartu layanannya**, lalu muncul modal "Isi Survei" (Nama, No. HP, Jenis Kelamin, Usia, Pendidikan, Pekerjaan) → tombol **"Lanjutkan"**. Jadi hasil scan **tidak** langsung ke kuisioner.
4. Form SKM **tidak bisa** di-iframe/overlay (`X-Frame-Options: SAMEORIGIN`) → tombol membuka **tab baru** (`window.open`).
5. Pustaka QR: `qrcodejs@1.0.0` dari `https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js` (global `QRCode`). **JANGAN pakai `qrcode@1.5.3`** — path CDN-nya 404.
6. qrcodejs membuat `<canvas>` (di-`display:none`) **dan** `<img>` yang tampil. Yang terlihat adalah `<img>`-nya — kalau mengukur QR, ukur `img`, bukan canvas.

### D. Bug yang pernah terjadi di widget SKM (JANGAN TERULANG)
- **Tombol "Isi SKM" malah memindahkan halaman mesin.** Penyebab: `window.open(url, '_blank', 'noopener')` mengembalikan `null` walau popup berhasil, sehingga fallback `window.location.href` ikut jalan. Solusi: `var win = window.open(url, '_blank'); win.opener = null;`
- **Isi tombol mengambang jadi pulau kecil di tengah tombol raksasa** (kosong 578–694 px di atas/bawah) → solusi: pembungkus `.relative` diberi `flex min-h-0 flex-1 flex-col justify-between` lalu isi disebar jadi **3 zona** (lihat §15F).
- **Wajib scroll di kiosk** → lihat §15B (breakpoint `xl:`).

### E. Cache-buster
- `skm-widget.js` di kedua halaman mesin: saat ini `?v=20261017-skm-url`. Setiap mengubahnya → **naikkan versinya** di kedua halaman (lihat §13 poin 3).

### F. Perapian tata letak kiosk (2026-10-19)

**Keluhan asli**: tombol **UMUM/PRIORITAS** di `mesin-poliklinik.html` "terlalu memanjang ke bawah", dan kolom kiri terasa kosong (~594 px konten di area 1518 px).

| Halaman | Yang diubah |
|---|---|
| `mesin-poliklinik.html` | Grid tombol **`grid-cols-2` → `grid-cols-1`** (ditumpuk vertikal). Ikon `h-14` → **`h-20`**, label `text-2xl/3xl` → **`text-5xl/6xl`**, keterangan → `text-lg`. |
| `mesin-farmasi.html` | Tombol `#btnAmbilNomor` (tinggi 1545 px) dulu isinya cuma **156 px**, kosong **694 px atas + 694 px bawah** → kini isi memenuhi 1479 px. Ikon `h-16` → **`h-28`**, label → **`text-5xl/6xl`**. `id` & handler JS **tidak diubah**. |
| Keduanya | Isi tiap tombol disusun **3 zona**: (ikon + badge "Touch Here") di atas → label besar di tengah → keterangan di bawah, memakai `justify-between` pada pembungkus `.relative` yang diberi `flex min-h-0 flex-1 flex-col justify-between gap-4`. |
| Keduanya | Kolom kiri jadi flex terbagi rata (lihat §15B). |
| Keduanya | `SIMAMI_SKM.layout` `'compact'` → **`'stack'`** (QR 126 px → 204 px). |

**Hasil verifikasi di viewport persis 1080×1920** (paksa lewat `--window-size=1102,2074`; chrome headless memakan 22 × 154 px, jadi `--window-size=1080,1920` cuma menghasilkan viewport **1058 × 1766**):

| Ukuran | Nilai |
|---|---|
| `scrollHeight - clientHeight` (document) | **0** — tanpa scroll |
| `overElements` (elemen melewati viewport) | **0** |
| Kartu kolom kiri | 542 / 556 / 542 px, `overflow = 0` |
| Tombol poliklinik | 597 × 764 px, celah zona **273 + 273 px** |
| Tombol farmasi | 597 × 1545 px, celah zona **609 + 609 px** |
| QR (box / `img`) | 204 px / 178 px — `jsQR` dekode benar di 1×–4× |

**Acuan celah zona**: 273 px (poliklinik) terasa pas; 609 px (farmasi) masih sangat lega karena tombolnya setinggi 1545 px dan hanya satu aksi. Kalau user minta lebih rapat → **batasi tinggi `#btnAmbilNomor` ~800 px lalu pusatkan** di panel (selisih jadi ±273 px), **jangan** dibongkar pola 3-zonanya.

⚠️ Jangan mengubah `mesin-antrian.html` (pemilih unit) saat menyentuh area ini.

### G. Popup Tautan QR di halaman Pilih Unit (2026-10-21)

*(Menggantikan catatan lama "`mesin-antrian.html` TIDAK BOLEH diubah" — halaman ini kini boleh diubah, tapi jangan hapus guard login `ensureMachineAccount()`.)*

`mesin-antrian.html` kini punya **4 tombol** dalam 2 grup yang dipisah label "Bukan Pengambilan Nomor Antrean":

| Grup | Tombol | Aksi |
|---|---|---|
| Atas (antrean) | FARMASI, POLIKLINIK | `window.location.href` ke halaman mesin unit |
| Bawah (tautan) | SURVEY KEPUASAN (SKM), PENGADUAN & SARAN | membuka **popup QR** di tengah layar |

Popup dikendalikan **`assets/js/link-qr-popup.js`** + **`assets/css/link-qr-popup.css`** (generik, dipakai ulang oleh kedua jenis tautan):
- Tombol pemicu cukup diberi `data-link-popup="skm"` / `"pengaduan"`.
- Isi popup: judul, **QR 240 px native (tampil ±255 px)**, tombol "Buka ..." (tab baru), tombol TUTUP, catatan.
- Tutup via tombol, klik area luar, atau tombol `Esc`.
- URL di-set inline di halaman lewat `window.SIMAMI_LINK_POPUP`:
  - SKM: `https://survei.kukarkab.go.id/isi-survei/layanan?perangkat_daerah=151`
  - Pengaduan: `https://bit.ly/kanalpengaduanresmiRSUDAMI`

**Cara debug popup** (dipakai saat verifikasi):
- QR dibuat `qrcodejs`, yang membuat `<canvas>` (`display:none`) lalu **menukarnya jadi `<img>` lewat `onload` asinkron**. Saat mengukur, **jangan busy-wait** (main thread terblokir → `onload` tak jalan → `img` terbaca 0×0). Pakai `setTimeout` ≥ 300 ms.
- CSS memakai pola `.skm-qr` yang terbukti: kontainer 284 px + `padding: 12px`, lalu `img/canvas { width:100% !important }`.

**Verifikasi 2026-10-21 (viewport 1080×1920):**

| Ukuran | Nilai |
|---|---|
| `scrollHeight - clientHeight` | **0** — tanpa scroll |
| `overElements` | **0** |
| 4 tombol | FARMASI/POLIKLINIK 473 × 222 px; SKM/Pengaduan 473 × 106 px |
| Kartu popup | 706 × 758 px, terpusat (`y = 595`), `overflow = 0` |
| QR popup | box 278 px, `img` 255 px (natural 240) |
| Dekode `jsQR` | SKM & Pengaduan → **URL benar** |

> Peringatan: `layout` grup tombol memakai `flex-1` + `md:grid-cols-2`. Kartu "Alur Pengambilan" & "Informasi" **dihapus** dari halaman ini (keputusan 2026-10-21) agar 4 tombol muat 1 layar. `#machineSessionLabel` sudah dihapus dari header; JS-nya dibuat null-safe — **jangan** hilangkan pengecekan `if (machineSessionLabel)`.

### H. Kartu Pengaduan & Saran di halaman mesin unit (2026-11-19)

Kartu **"Informasi"** di kolom kiri `mesin-poliklinik.html` dan `mesin-farmasi.html` **dihapus**, diganti **kartu Pengaduan & Saran** berformat sama dengan kartu SKM, letaknya tepat di bawah SKM:

```html
<div id="pengaduanWidget" class="flex flex-1 min-h-0 flex-col justify-center"></div>
```
```js
window.SIMAMI_PENGADUAN = { mountId: 'pengaduanWidget' };   // sisanya pakai default di skm-widget.js
```

- `assets/js/skm-widget.js` kini **renderer kartu tautan generik**: `renderCard`/`render()` menerima objek kartu, jadi satu halaman bisa memuat dua kartu. Dua config: `window.SIMAMI_SKM` (tetap seperti dulu) dan `window.SIMAMI_PENGADUAN` (default: URL `https://bit.ly/kanalpengaduanresmiRSUDAMI`, judul "Pengaduan & Saran", tombol "Buka Kanal Pengaduan", tanpa badge ikon).
- Selector internal memakai **class** (`.skm-qr`, `.skm-btn`), bukan `id`, agar dua kartu tidak saling tabrak. Jangan kembalikan ke `#skmQrBox` / `#skmOpenBtn`.
- Teks kartu sengaja faktual dan tanpa emoji; jangan diisi kalimat basi ("kami menghargai masukan Anda") atau klaim tanpa dasar (mis. "anonim").
- CSS baru hanya 2 aturan: `.skm-note--link` (URL tidak di-uppercase) dan `.skm-card--btn-sm` (label tombol 3 kata tetap 1 baris). `mountId` kartu pengaduan tidak ditulis `id` unik per halaman — cukup satu per halaman.

**Warna per kartu (2026-11-19)** — pakai CSS variable di `.skm-card`, bukan duplikasi aturan:

| Kartu | Class varian | Aksen / border / latar / judul |
|---|---|---|
| SKM | `.skm-card--skm` | `#7c3aed` / `#ddd6fe` / `#faf5ff` / `#6d28d9` |
| Pengaduan | `.skm-card--pengaduan` (default) | `#b45309` / `#fde68a` / `#fffbeb` / `#b45309` |

- **JANGAN disamakan warnanya.** SKM = ungu, Pengaduan = amber (selaras tombol SKM/Pengaduan di `mesin-antrian.html`).
- Tombol **solid** (tanpa gradient), shadow tipis; ikon bintang & emoji 📱 sudah dihapus. Kontras teks putih: SKM 5.7:1, Pengaduan 5.02:1.
- Teks SKM: judul "Survei Kepuasan Masyarakat (SKM)", tombol "Buka Formulir SKM", catatan `survei.kukarkab.go.id`.
- Cache-buster: `skm-widget.js` & `skm-widget.css` = `?v=20261119-skm-ungu` di kedua halaman. Naikkan lagi bila file diubah.

**Verifikasi 2026-11-19** (chrome headless, viewport 1080×1976, guard mesin dinetralkan di salinan uji):

| Ukuran | Nilai |
|---|---|
| `scrollHeight - clientHeight` | **0** (poliklinik & farmasi) |
| `overElements` / `maxBottom` | **0** / 1976 |
| Kartu SKM & Pengaduan | 311 × 570 px, `overflow = 0` |
| QR (`img` / native) | 178 px / 200 px — `jsQR` dekode **URL benar** (SKM & bit.ly) |
| Tombol | tinggi 66 px, label 1 baris; klik → `window.open` 2 URL, halaman kiosk **tidak** berpindah |

⚠️ Jangan tulis ulang file HTML ini lewat PowerShell `Get-Content`/`Set-Content` 5.1 — encoding ANSI merusak emoji & karakter `•` (kejadian 2026-11-19). Pakai editor UTF-8 tanpa BOM.

### I. `mesin-antrian.html` — login baru, tampilan setelah login DIKEMBALIKAN ke desain lama (2026-11-19)

Halaman ini sempat dirombak total (netral/putih). **Pemilik proyek menolak versi netral** karena warna identitas hilang dan tampak "full putih/aneh". Kondisi final:

| Bagian | Status |
|---|---|
| `#machineAuthScreen` (login) | **Versi baru**: panel kiri solid `#065f46` (brand + "Mesin antrean" + 1 kalimat), kanan kartu putih berisi form. Tanpa "Enterprise Login", tanpa 3 kartu fitur, tombol "Masuk". |
| `#machineDashboard` (pemilih unit) | **Versi lama persis**: header gradient emerald→biru, kartu FARMASI gradient hijau & POLIKLINIK gradient biru dengan emoji 🏥/🩺 + badge "Touch Here", strip "Pengisian Survey dan Pengaduan", kartu SKM ungu & Pengaduan oranye bergradien. |
| `#jenisModal` / `#poliModal` | **Versi lama persis**: header gradient, opsi gradient + emoji 🛡️/👤/🧒/🫀/🩺, tombol BATAL/KEMBALI. |
| Latar body | **Versi lama**: 2 `radial-gradient` hijau/biru + `linear-gradient` `#ecfeff→#eff6ff→#f8fafc`. |

**Aturan:**
- **Jangan** merapikan/menghapus gradient, emoji, atau badge "Touch Here" di dashboard & modal tanpa permintaan eksplisit dari pemilik. Itu keputusan desain final, bukan sisa kode.
- Blok `<style>` di `<body>` kini hanya berisi `.kiosk-focus` (dipakai tombol login). Class `.kiosk-icon/.kiosk-unit/.kiosk-secondary/.kiosk-choice/-grid` sudah dihapus — jangan dihidupkan lagi.
- Semua hook JS utuh: `data-unit`, `data-link-popup`, `#machineLoginForm/#machineEmail/#machinePassword/#machineLoginBtn/#machineAuthMessage/#machineLogoutBtn`, `#machineAuthScreen/#machineDashboard`, `#jenisModal/#poliModal/#modalUnitTitle/#modalJenisTitle/#closeJenisModal/#backToJenisModal`, `.unit-btn/.jenis-btn/.poli-btn`, guard `MACHINE_EMAIL/MACHINE_UID`. Modal backdrop tetap **anak pertama** root modal (click-close bergantung urutan itu).
- `.jenis-btn/.poli-btn` mengganti `innerHTML` jadi "Memproses…" lalu memulihkan markup tersimpan — aman untuk anak SVG.
- Halaman unit (`mesin-poliklinik.html`, `mesin-farmasi.html`) **tidak disentuh** oleh perubahan ini.

**Verifikasi 2026-11-19** (Chrome headless):

| Viewport | scroll | over | Login card | Unit tile | QR popup |
|---|---|---|---|---|---|
| 1080 × 1976 (kiosk) | 0 | 0 | 768 × 427 | 473 × 1472 | 706 × 758 |
| 1366 × 768 (desktop) | 0 | 0 | 768 × 427 | 605 × 264 | 706 × 597 |

Tidak ada error console; modal jenis 672 × 538 terbuka normal. Popup `#linkQrPopup` tetap memakai `assets/css/link-qr-popup.css` (tidak diubah).

---

End of document. Good luck, akun TRAE berikutnya!
