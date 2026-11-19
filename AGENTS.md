# Aturan Agent — SIM-AMI (Pendaftaran UGD)

## Wajib: laporan file yang diubah

Setiap selesai mengerjakan perubahan, **tutup jawaban** dengan blok seperti ini:

```
**File yang diubah**
- `mesin-antrian.html` (diubah) — login versi baru, dashboard & modal dikembalikan ke desain lama.
- `assets/js/skm-widget.js` (diubah) — renderer kartu generik.
- `PROJECT_CONTEXT.md` (diubah) — §15I diperbarui.
```

Aturan:
- **Selalu tulis path lengkap dari root repo, termasuk nama foldernya** — jangan hanya nama file. Contoh: `assets/js/skm-widget.js`, `assets/css/skm-widget.css`, `mesin-antrian.html`.
- Urutkan per file, path relatif dari root repo.
- Status: `baru` atau `diubah`. (Untuk file yang dihapus: tulis `dihapus`.)
- Sertakan file yang ikut berubah karena efek samping (mis. naikkan cache-buster `?v=` di halaman lain).
- Kalau tidak ada file yang berubah: tulis `Tidak ada file diubah.`
- **User push ke GitHub manual.** Agent tidak menjalankan `git add`, `git commit`, `git push`, atau membuat PR.

## Konteks proyek

Baca `PROJECT_CONTEXT.md` sebelum mengubah kode (terutama §13 Prinsip Perubahan Kode dan §15 Mesin Antrean).
