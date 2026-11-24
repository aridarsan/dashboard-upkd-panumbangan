# Dashboard Pelayanan UPKD – PKM Panumbangan

Dashboard statis (HTML + JS, tanpa build) untuk data pelayanan UPKD per desa.

## Menjalankan
```bash
python3 -m http.server 8765
```
Lalu buka http://localhost:8765. Bisa juga di-hosting di layanan static hosting mana pun (GitHub Pages, Netlify, dll.) — cukup unggah `index.html` dan `data.js`.

## Fitur
- Tab kategori: **Ringkasan**, **Penduduk**, **SPM**, **PMT**, **Pelayanan UPKD**
- Filter desa (chip di atas, atau klik batang grafik / baris tabel / peringkat)
- Grafik per desa + garis rata-rata, peringkat desa, tabel lengkap dengan total
- Perbandingan SPM s.d. Oktober vs s.d. November
- Export CSV sesuai tab & filter aktif, dan cetak / simpan PDF

## Data realtime (Google Sheets)
Dashboard mengambil data dari Google Sheets yang dipublikasikan sebagai CSV (link diatur di `live.js`, variabel `SHEET_CSV_URL`).
- Dimuat saat halaman dibuka, lalu otomatis tiap 5 menit (`REFRESH_MINUTES`) dan saat tab browser dibuka kembali.
- Tombol status di kanan atas: **Live · jam** = berhasil; klik untuk muat ulang sekarang. **Offline · data cadangan** = gagal memuat, dashboard memakai `data.js`.
- Google men-cache CSV yang dipublikasikan, jadi perubahan di Sheets biasanya baru muncul 1–5 menit kemudian.
- Susunan kolom & baris di Sheets harus tetap sama dengan format Excel (2 baris header, baris desa bernomor, baris "DATA SPM SD ...").

## Memperbarui data cadangan (data.js)
Saat ada file Excel baru (format kolom sama):
```bash
pip install openpyxl
python3 scripts/convert_excel.py "path/ke/Data Pelayanan UPKD terbaru.xlsx"
```
Script ini menulis ulang `data.js`. Kolom persentase (D/S, N/D, Angka Bebas Jentik) ditampilkan sebagai rata-rata antar desa, bukan dijumlah.
