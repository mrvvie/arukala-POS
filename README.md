# Arukala Dashboard — Phase 4A (backend + tampilan dasar)

Isi paket:
- `apps-script/`  : backend Google Apps Script (salin ke project Apps Script)
- `frontend/`     : aplikasi (upload ke GitHub Pages)
- `tests/`        : skrip pengujian otomatis (tidak perlu dipakai untuk operasional)

## A. Pasang backend (akun Google khusus cafe)
1. Buka https://script.google.com → **Proyek baru**. Beri nama "Arukala Backend".
2. Hapus isi `Code.gs` bawaan. Buat file skrip (tombol +) dengan nama yang sama seperti di `apps-script/`:
   Config, Utils, Auth, Setup, Sales, Expenses, Admin, Api. Tempel isi masing-masing file.
3. Pengaturan Proyek (ikon roda gigi) → centang **"Tampilkan file manifes appsscript.json"**. Buka file itu dan ganti isinya dengan `appsscript.json` dari paket.
4. Pilih fungsi **setup** di bagian atas → **Jalankan**. Setujui izin (jika muncul "Google belum memverifikasi aplikasi ini": Lanjutan → Buka Arukala Backend).
5. Buka **Eksekusi / Log eksekusi**. Di sana tampil alamat spreadsheet dan **PIN sementara 4 pengguna (hanya tampil sekali, catat!)**.
6. **Terapkan → Deployment baru → jenis: Aplikasi web.** Jalankan sebagai: **Saya**. Yang memiliki akses: **Siapa saja**. Salin URL yang berakhiran `/exec`.
   Setiap kali kode backend diubah, buat **versi deployment baru** (Terapkan → Kelola deployment → Edit → Versi baru).
7. Jangan bagikan spreadsheet database ke siapa pun.

## B. Pasang tampilan (GitHub Pages)
1. Buka `frontend/config.js`, isi `API_URL` dengan URL `/exec` tadi.
2. Buat repositori GitHub baru (publik, agar Pages gratis), upload seluruh isi folder `frontend/`.
3. Settings → Pages → Deploy from a branch → `main` / root. Tunggu beberapa menit; alamatnya `https://USERNAME.github.io/NAMA-REPO/`.
4. Jangan menaruh data bisnis atau Spreadsheet ID di repositori. Alamat API boleh terlihat; keamanan ada di login PIN.

## B2. Cek iPad Air 1 lebih dulu (sangat disarankan)
Setelah folder `frontend/` ada di GitHub Pages, buka di Safari iPad:
`https://USERNAME.github.io/NAMA-REPO/cek-ipad.html`
Halaman ini memeriksa sendiri kemampuan iPad (JavaScript, penyimpanan, CSS, service worker) dan, jika `API_URL` sudah diisi, kecepatan koneksi ke backend. Jika ada baris **GAGAL**, kirim tangkapan layarnya kepada pengembang sebelum lanjut. Halaman ini juga bisa dibuka sebelum backend dipasang.

## C. Pasang di iPad/HP
Safari → Bagikan → **Tambah ke Layar Utama**. Untuk tablet kasir: Pengaturan → Aksesibilitas → **Akses Terpandu** agar layar terkunci di aplikasi Arukala.

## D. Uji pertama
1. Login `reza` dengan PIN sementara → buat PIN baru. Ulangi untuk ina, aldo, zidan.
2. Buat 1 order multi-item, 1 pengeluaran Operasional, 1 pengeluaran Aset. Cek Riwayat dan sheet `Sales_Orders`, `Sales_Items`, `Expenses`.
3. Matikan Wi-Fi: tombol simpan harus nonaktif.

## Batasan tahap ini (jujur)
- Belum ada: dashboard, laporan, kas, closing, antrean offline, foto struk, cetak ke printer thermal.
- "Cetak struk" memakai dialog cetak iOS (AirPrint). Printer DP58 Bluetooth/USB belum didukung langsung.
- Diuji otomatis di Chromium dan simulasi Apps Script. Belum diuji di Safari 12 (iPad Air 1) dan Google Sheets sungguhan.
- Jika semua owner terkunci: jalankan `emergencyResetPin` dari editor Apps Script.
