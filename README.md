# SALING BANTU — Ringankan Beban, Tebarkan Kebaikan

Aplikasi web platform gotong royong digital yang menghubungkan mereka yang membutuhkan
bantuan dengan individu, komunitas, lembaga, dan volunteer yang ingin membantu.

Dibangun dengan **HTML5 + CSS3 + JavaScript murni** (tanpa framework) dan siap
terhubung ke **Supabase** (PostgreSQL + Auth + Storage + Row Level Security).

---

## 1. Cara Menjalankan (Mode Demo — tanpa server, tanpa database)

Aplikasi langsung jalan dalam **Mode Demo** (data tersimpan di `localStorage` browser).
Cocok untuk demo ke klien / belajar:

1. Ekstrak folder `saling-bantu`.
2. Buka `index.html` di browser (disarankan via server lokal agar rapi):
   - Python: `python3 -m http.server 8080` lalu buka `http://localhost:8080`
   - VS Code: klik kanan `index.html` → *Open with Live Server*
3. Masuk dengan akun demo (tersedia tombolnya di halaman Masuk):
   - **Admin** — `admin@salingbantu.id` / `demo1234`
   - **Penerima bantuan** — `ratna@demo.id` / `demo1234`
   - **Donatur** — `budi@demo.id` / `demo1234`
   - **Volunteer** — `nadia@demo.id` / `demo1234`

> Mode Demo hanya untuk pengembangan/presentasi. Untuk produksi WAJIB hubungkan Supabase.

## 2. Koneksi ke Supabase (Mode Produksi)

1. Buat proyek baru di [https://supabase.com](https://supabase.com) → **New project**.
2. Buka **SQL Editor** → *New query* → salin seluruh isi `sql/supabase_schema.sql` → **Run**.
   Skrip ini membuat: 16 tabel, tipe enum, trigger notifikasi & audit, kebijakan RLS,
   view transparansi, storage bucket, dan data awal (6 kategori bantuan, dsb).
3. Ambil kredensial: **Project Settings → API** → salin *Project URL* dan *anon public key*.
4. Buka `js/config.js`, isi:
   ```js
   SUPABASE_URL: "https://xxxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi....",
   ```
5. (Disarankan untuk uji cepat) Project Settings → Authentication → Providers → Email:
   matikan **Confirm email**.
6. Daftar akun lewat aplikasi, lalu jadikan admin:
   ```sql
   update public.profiles
   set role = 'admin', is_verified = true
   where id = (select id from auth.users where email = 'emailkamu@mail.com');
   ```

### Keamanan (WAJIB dibaca)
- Hanya `anon public key` yang boleh ada di frontend. **JANGAN PERNAH** menaruh
  `service_role key` di `js/config.js` atau file frontend mana pun.
- Seluruh proteksi data ditegakkan sisi database lewat **RLS** (lihat bagian kebijakan
  di `sql/supabase_schema.sql`): pengguna tidak bisa mengubah status verifikasi
  pengajuannya sendiri, hanya admin yang bisa; log audit tidak bisa diubah pengguna.
- Data pribadi penerima (alamat lengkap, rekening, dokumen identitas) tidak pernah
  ditampilkan publik — hanya lewat view tersamar di halaman Transparansi.

## 3. Struktur Folder

```
saling-bantu/
├── index.html              Beranda (8 bagian: hero, statistik, bantuan,
│                           kategori, cerita, ZISWAF, CTA)
├── ziswaf.html             Modul ZISWAF publik (rekap, papan kebaikan,
│                           penyaluran, form salurkan ZISWAF)
├── masuk.html              Login
├── daftar.html             Registrasi (penerima / donatur / volunteer)
├── cari-bantuan.html       Cari & filter pengajuan (kategori + lokasi)
├── ajukan-bantuan.html     Formulir pengajuan bantuan + timeline status
├── ingin-membantu.html     Beri bantuan (5 jenis), jadi volunteer, komunitas
├── donasi-cepat.html       Jalur Cepat Berdonasi TANPA akun (nama + WA,
│                           pilih program, kirim bukti transfer via WhatsApp)
├── cerita-kebaikan.html    Cerita kebaikan + kirim cerita
├── transparansi.html       Laporan dana publik + privasi penerima
├── tentang.html            Tentang kami (5 tujuan, 5 nilai)
├── dashboard.html          Dashboard pengguna (9 menu, termasuk ZISWAF Saya)
├── admin.html              Panel admin (10 menu: Statistik, Realtime,
│                           Pengguna, Pengajuan, Donasi, Modul ZISWAF,
│                           Konten, Isi Website, Laporan, Pengaturan)
├── css/style.css           Design system (hijau, biru, putih, oranye)
├── js/config.js            Kredensial Supabase (isi di sini)
├── js/core.js              Util, ikon SVG, metadata (kategori/status/jenis/
│                           ZISWAF: jenis, kelompok, mustahik, program)
├── js/konten.js            CMS "Isi Website" (definisi & penerapan teks)
├── js/laporan.js           Laporan PDF bulanan + ekspor Excel (.xlsx asli,
│                           murni JavaScript tanpa CDN/library)
├── js/store.js             Lapisan data: DemoBackend + SupabaseBackend
├── js/main.js              Header, footer, auth state, notifikasi lonceng
├── js/beranda.js …         Logika per halaman (termasuk ziswaf.js)
├── sql/supabase_schema.sql Skema database lengkap (BAGIAN 1–20, jalankan
│                           di SQL Editor)
├── sql/update_*.sql        Pembaruan utk database lama: CMS+realtime,
│                           fix login, fix trigger, admin program,
│                           ZISWAF (+ fix kode bentrok),
│                           dana terkumpul otomatis,
│                           hapus data + realtime semua halaman,
│                           donasi cepat tanpa akun (donatur tamu + WA)
└── README.md               Panduan ini
```

## 4. Alur Utama Aplikasi

1. **Penerima** mendaftar → mengajukan bantuan (kategori, sub-kategori, foto/dokumen,
   lokasi) → status `Menunggu Verifikasi`.
2. **Admin** memverifikasi: `Dalam Proses Verifikasi → Terverifikasi → Dipublikasikan`
   (atau `Ditolak` dengan alasan). Setiap perubahan tercatat di `verification_logs`
   dan memicu notifikasi.
3. **Donatur/volunteer** menemukan pengajuan via Cari Bantuan → memberi bantuan
   (finansial / barang / tenaga / keahlian / jaringan) → menerima kuitansi digital.
   **Tanpa akun?** Lewat **Donasi Cepat** (`donasi-cepat.html`) cukup nama + nomor
   WhatsApp → pilih program & nominal → transfer → kirim bukti via WhatsApp admin.
4. Admin mengonfirmasi donasi → dana terkumpul naik → target tercapai memicu
   notifikasi → penyaluran dicatat (bukti distribusi) → laporan akhir dipublikasikan
   di halaman **Transparansi**.
5. Semua notifikasi (8 jenis + penolakan) muncul di lonceng & dashboard.

## 5. Hosting

Aplikasi ini statis — bisa di-hosting gratis di Netlify / Vercel / GitHub Pages /
Cloudflare Pages. Cukup unggah folder ini (tanpa folder `sql/` jika tidak ingin
terbaca publik), lalu isi `js/config.js` dengan kredensial Supabase Anda.

---

## 6. Catatan Pembaruan (v1.1)

Hasil uji menyeluruh seluruh halaman & alur (login, pengajuan, verifikasi admin,
donasi, kuitansi, notifikasi, dashboard, transparansi) pada 8 November 2026:

1. **Perbaikan — tombol "BANTU SEKARANG"** (`js/membantu.js`): sebelumnya, saat
   pengguna diarahkan dari kartu pengajuan dengan parameter `?request=ID`, ringkasan
   pengajuan tertimpa placeholder dan variabel pengajuan terpilih kosong sehingga
   tombol *Kirim Niat Baik Saya* menolak dengan pesan "Pilih pengajuan terlebih
   dahulu". Kini ringkasan langsung terisi dan donasi bisa dikirim begitu halaman
   terbuka.
2. **Perbaikan — tombol aksi pada "Pengajuan Saya"** (`js/dashboard.js`): tombol
   *Ucapan Terima Kasih* dan *Laporan Penggunaan* kini hanya tampil setelah
   pengajuan benar-benar menerima bantuan (status `Sedang Mendapat Bantuan`,
   `Bantuan Terpenuhi`, atau `Selesai`) — sesuai prinsip tidak menampilkan fitur
   penyaluran sebelum ada bukti.
3. **Perbaikan — grafik admin** (`js/admin.js`): label kategori pada diagram batang
   yang saling menimpa kini dipecah dua baris ("Kese-hatan", "Pendi-dikan",
   "Tenaga & Jasa"), dan skala sumbu Y menampilkan desimal (0,5 / 1,5) ketika
   nilai kecil, sehingga tidak lagi ada dua label angka kembar.
4. **Sudah diverifikasi berjalan lancar**: pendaftaran akun baru, pengajuan bantuan
   (kode otomatis SB-2026-XXXX), alur verifikasi admin 8 status, konfirmasi donasi
   yang otomatis mengangkat status pengajuan menjadi *Sedang Mendapat Bantuan*,
   kuitansi digital (KWT-YYYYMMDD-XXXXX) dengan tombol cetak, lonceng notifikasi,
   tab volunteer & komunitas, serta kontrol akses (pengguna non-admin ditolak di
   panel admin).

---

## 7. Catatan Pembaruan (v1.2)

1. **Perbaikan — error "perBulan is not defined"**: menu Statistik & Laporan admin
   gagal dimuat saat terhubung Supabase (`js/store.js`). Sudah diperbaiki; tabel
   Jejak Audit di Laporan kini juga menampilkan nama aktor, aksi, dan entitas
   dengan benar (sebelumnya `undefined`).
2. **Fitur baru — tombol Edit di setiap modul admin** (khusus admin/pengelola):
   - *Manajemen Pengguna*: edit nama, telepon, kota, bio, dan peran (peran akun
     sendiri dikunci untuk mencegah admin terkunci dari panel).
   - *Manajemen Pengajuan*: edit judul, kategori, sub-kategori, penerima, nominal
     kebutuhan, lokasi, kontak, deskripsi, dan tampil/tidaknya di halaman publik.
     Juga tersedia lewat modal Detail → tombol **Edit Data**.
   - *Manajemen Donasi*: edit nama donatur, anonim, jenis, nominal, rincian
     barang, pesan, dan status (di Mode Demo, perubahan nominal donasi finansial
     terkonfirmasi otomatis menyesuaikan dana terkumpul proyek).
   - *Manajemen Konten*: edit judul, kategori, dan isi cerita; edit judul
     pengumuman platform.
   Semua perubahan edit tercatat di jejak audit.
3. **Fitur baru — menu Pengaturan di panel admin**: kelola koneksi Supabase
   langsung dari aplikasi tanpa menyunting `js/config.js` — isi Project URL &
   anon public key, klik **Uji Koneksi** (memanggil `platform_stats()` untuk
   memverifikasi schema), lalu **Simpan & Terhubung** (tersimpan di
   `localStorage "sb_koneksi"`, berlaku di semua halaman). Tombol **Pakai Mode
   Demo** menghapus koneksi tersimpan. Konfigurasi tetap bisa diisi lewat
   `js/config.js` seperti sebelumnya; keduanya digabung otomatis.

---

## 8. Catatan Pembaruan (v1.3)

1. **Fitur baru — menu "Isi Website" (CMS, khusus admin/pengelola)**: admin kini
   dapat mengedit **seluruh teks publik website** tanpa menyentuh kode — 39 field
   dalam 7 grup:
   - *Identitas Aplikasi* (nama, tagline, email, WhatsApp),
   - *Hero Beranda* (lencana, judul, deskripsi, tombol, kartu kecil),
   - *Statistik Beranda* (5 angka + labelnya; data nyata platform ditambahkan
     otomatis di atas angka dasar),
   - *Judul Bagian Beranda* (bantuan terbaru, kategori, cerita),
   - *Ajakan Bergabung/CTA*, *Footer*, dan *Rekening Donasi*.
   Tersimpan di tabel `site_content` (Supabase) atau localStorage (Mode Demo);
   setelah **Simpan Semua Perubahan**, teks baru langsung tampil di semua halaman.
   Tiap grup punya tombol **Kembalikan Default**. Lapisan teknis ada di
   `js/konten.js` (`SB.KONTEN_DEF`, `SB.muatKonten`, `SB.teks`, `SB.terapkanKonten`);
   halaman memakai atribut `data-sb="kunci"` / `data-sb-hitung="kunci"`.
2. **Fitur baru — menu "Realtime" (dashboard website real-time)**: pemantauan
   langsung tanpa memuat ulang halaman — 6 KPI hidup (donasi & pengajuan hari ini,
   pengguna baru, antrean verifikasi/konfirmasi, total dana), feed aktivitas
   terbaru (donasi, pengajuan, aksi admin) dengan penanda **BARU** + animasi,
   grafik donasi 7 hari terakhir, daftar "menunggu tindakan", penghitung event,
   dan jam pembaruan. Di mode Supabase memakai kanal **Supabase Realtime**
   (`postgres_changes`, seluruh schema) sehingga setiap INSERT/UPDATE langsung
   tampil + notifikasi toast "Donasi baru masuk!"; di Mode Demo memakai pemantauan
   berkala tiap 5 detik + sinkronisasi antar-tab via `storage` event. Kanal
   otomatis dilepas saat pindah menu.
3. **Role baru "pengelola"**: setara admin untuk mengelola panel (ditambahkan ke
   enum `app_role`, dropdown peran, dan guard akses `admin.html`). Keamanan data
   ditegakkan RLS melalui fungsi `is_pengelola()`.
4. **Database — untuk database lama jalankan `sql/update_cms_realtime.sql`**
   (Supabase → SQL Editor → Run): menambah tabel `site_content` + RLS, value enum
   `pengelola`, fungsi `is_pengelola()`, dan mendaftarkan tabel utama ke
   publication `supabase_realtime`. Database baru cukup menjalankan
   `sql/supabase_schema.sql` (bagian 19 sudah termasuk).

---

## 9. Modul ZISWAF (v1.4)

Saling Bantu kini juga menjadi **sistem pengelolaan ZISWAF yayasan/sekolah Islam
terpadu** — Zakat, Infaq, Sedekah, dan Wakaf — dari keluarga besar sekolah
(**siswa**, **guru & tenaga kependidikan**, **orang tua santri**) serta
**masyarakat umum**, beserta penyalurannya kepada penerima manfaat.

### Halaman publik `ziswaf.html`
- Penjelasan 4 jenis dana (Zakat, Infaq, Sedekah, Wakaf) + rekap transparansi:
  terkumpul, tersalur, saldo per jenis, dan progres penyaluran.
- **Papan Kebaikan**: penerimaan terverifikasi terbaru (pemberi anonim tampil
  sebagai "Hamba Allah").
- **Penyaluran terbaru**: mustahik/golongan penerima, bentuk, dan nominal.
- **Form salurkan ZISWAF**: jenis, program (saran otomatis per jenis), kelompok
  pemberi (siswa + kelas / guru & tendik / orang tua santri / umum), bentuk
  uang/barang, metode (transfer/tunai/QRIS), anonim — lalu kuitansi kode `ZW-…`.
- Rekening resmi yayasan diambil dari CMS (menu *Isi Website* → grup
  *Rekening Donasi*); teks-teks halaman ZISWAF juga bisa diedit lewat CMS
  (grup *Modul ZISWAF*).

### Panel admin — menu "Modul ZISWAF"
- KPI: dana terverifikasi, tersalurkan, saldo, jumlah menunggu verifikasi —
  plus chip saldo per jenis dana.
- **Penerimaan**: tabel lengkap dengan filter jenis/kelompok/status, tombol
  *Verifikasi* / *Tolak* (dengan alasan), tombol **Edit**, dan tombol
  **Catat ZISWAF (Tunai/Offline)** untuk setoran kotak amal yang langsung
  diterima pengelola. Ekspor **CSV** tersedia.
- **Penyaluran**: form pencatatan penyaluran (jenis dana, mustahik dari 8 asnaf
  + beasiswa/operasional/pembangunan/kemanusiaan, penerima golongan, jumlah
  orang, bentuk, nominal, bukti) dengan validasi **saldo** — penyaluran tidak
  boleh melebihi dana terverifikasi per jenis. Tiap baris punya tombol *Edit*.
- **Rekap**: tabel per jenis dana dan per kelompok pemberi.

### Dashboard pengguna — menu "ZISWAF Saya"
Riwayat ZISWAF pribadi (kode, jenis & program, nominal/rincian, metode, status)
beserta total yang telah terverifikasi.

### Keamanan & audit
- Kode otomatis: penerimaan `ZW-YYYY-####`, penyaluran `ZS-YYYY-####`.
- Tabel `ziswaf_transactions` & `ziswaf_distributions` dengan RLS: pemberi hanya
  melihat catatannya sendiri, verifikasi/edit/penyaluran hanya untuk
  admin/pengelola (`is_pengelola()`); publik membaca lewat view tersanitasi
  `v_ziswaf_publik` & `v_ziswaf_salur_publik`.
- Statistik publik aman lewat fungsi `ziswaf_stats()` (security definer).
- Semua pembuatan/perubahan status tercatat di `audit_logs` + notifikasi ke
  admin dan pemberi (trigger database).
- Kedua tabel terdaftar di publication `supabase_realtime` (muncul di dashboard
  Realtime admin).

### Database
- Database baru: cukup `sql/supabase_schema.sql` (**BAGIAN 20** sudah termasuk).
- Database lama: jalankan **`sql/update_ziswaf.sql`** (Supabase → SQL Editor →
  Run). File ini idempotent dan juga memastikan role `pengelola` +
  `is_pengelola()` tersedia.


---

## 10. Masalah Umum & Solusinya (v1.5)

### "Email atau kata sandi salah" padahal akun terdaftar di Supabase

Gejala: di halaman Masuk muncul kotak biru **"Akun Demo (Mode Demo)"** dan login
dengan akun Supabase selalu gagal.

**Penyebab:** aplikasi sedang berjalan dalam **Mode Demo** — kredensial Supabase
tidak terbaca, sehingga akun yang terdaftar di Supabase memang tidak dikenali
(data demo hanya tersimpan di browser). Ini terjadi bila:

1. `js/config.js` masih kosong (`SUPABASE_URL` / `SUPABASE_ANON_KEY` = `""`),
   misalnya setelah mengekstrak ulang paket zip (file config kembali ke bawaan), **atau**
2. koneksi Supabase belum pernah disimpan lewat form Pengaturan di browser ini.

**Solusi (pilih salah satu):**

- **Cara cepat, tanpa login:** di halaman Masuk akan muncul peringatan
  *"Mode Demo aktif … atur koneksi Supabase"*. Klik tautan
  **atur koneksi Supabase**, isi **Project URL** + **anon public key**, klik
  *Simpan & Muat Ulang*. Kredensial tersimpan di `localStorage` browser
  (`sb_koneksi`) dan langsung dipakai di semua halaman — tidak ikut hilang
  saat zip diekstrak ulang.
- **Cara file config:** edit `js/config.js`, isi `SUPABASE_URL` dan
  `SUPABASE_ANON_KEY`, simpan, muat ulang halaman.

> Catatan: karena kredensial versi *localStorage* menempel pada browser, aktifkan
> juga lewat browser lain (atau isi `js/config.js`) bila situs dipakai banyak orang.

### "Invalid login credentials" dalam Bahasa Inggris / pesan error lain

- *Invalid login credentials* → memang salah email/sandi di Supabase.
- *Email not confirmed* → buka email konfirmasi dari Supabase (cek folder spam).
- "Autentikasi berhasil, tetapi profil tidak dapat dibuat/dibaca" → jalankan
  `sql/supabase_schema.sql` (atau minimal `sql/update_fix_login.sql`) agar tabel
  `profiles`, trigger pembuat profil, dan kebijakan RLS-nya lengkap.

### Jumlah file di dalam zip

Paket `saling-bantu.zip` berisi **39 file + 4 folder** = **43 entri** (folder:
`saling-bantu/`, `css/`, `js/`, `sql/`). Penampil zip menghitung entri folder
sebagai "file", sedangkan file manager (Windows Explorer) hanya menampilkan
39 file — keduanya normal, tidak ada file yang hilang.

### Akun dibuat langsung dari Dashboard Supabase tidak bisa masuk

Sejak v1.5, saat login aplikasi otomatis membuat baris `profiles` dari metadata
akun (nama dari metadata, peran bawaan `donatur`). Pastikan kebijakan
`p_profiles_insert` ada — cukup jalankan `sql/update_fix_login.sql` sekali.

### Daftar berhasil, tetapi email konfirmasi tidak pernah datang

Gejalanya: form pendaftaran menampilkan "Pendaftaran berhasil. Silakan cek
email untuk konfirmasi", tetapi email tidak pernah masuk (juga di folder
spam), sehingga akun belum bisa login. Ini **bukan bug aplikasi** — penyebabnya
di sisi Supabase: layanan email **bawaan** Supabase (yang aktif selama SMTP
kustom belum dipasang) sangat dibatasi:

- hanya mengirim **maksimal ±2 email per jam**, dan
- sejak 2024 hanya mengirim ke **anggota tim proyek** (email yang dipakai
  mendaftar akun supabase.com) — keamanan anti-spam.

Pendaftar dengan email lain (mis. konsultansharika@gmail.com) → akun berhasil
dibuat di Authentication → Users, tetapi email konfirmasinya **dibuang tanpa
pemberitahuan**.

**Solusi 1 — tercepat, agar akun yang sudah terlanjur daftar bisa masuk:**
Dashboard Supabase → **Authentication → Users** → cari email pendaftar →
klik menu **titik tiga (⋯)** di baris tersebut → **Confirm email**. Setelah
itu akun bisa langsung login normal tanpa email.

**Solusi 2 — matikan kewajiban konfirmasi email** (praktis untuk tahap awal):
Dashboard → **Authentication → Sign In / Providers → Email** → nonaktifkan
**Confirm email** → Save. Pendaftar baru langsung mendapat sesi aktif tanpa
email, dan akun lama yang belum terkonfirmasi pun bisa langsung masuk.

**Solusi 3 — pasang SMTP kustom** (solusi sebenarnya untuk produksi, email
benar-benar terkirim ke siapa pun): Dashboard → **Authentication → Emails →
SMTP Settings** → Enable Custom SMTP. Contoh gratis:

| Penyedia | Host | Port | Catatan |
|---|---|---|---|
| Brevo (300 email/hari) | `smtp-relay.brevo.com` | 587 | daftar brevo.com, verifikasi domain pengirim |
| Resend (3.000/bulan) | `smtp.resend.com` | 587 | perlu domain sendiri |
| Gmail App Password | `smtp.gmail.com` | 587 | aktifkan 2FA lalu buat App Password 16 karakter |

Isi Sender email/name, Host, Port, Username, Password → Save. Mulai saat itu
email konfirmasi, reset kata sandi, dan magic link terkirim sungguhan.

> Tips: pastikan juga email yang diketik saat daftar lengkap —
> `nama@gmail.com`, bukan `nama@gmail` (tanpa akhiran). Form aplikasi sudah
> menolak format tanpa akhiran domain.

### Muncul "column reference \"title\" is ambiguous" saat kirim donasi

Gejala: donatur mengisi form *Ingin Membantu* lalu menekan **Kirim Niat Baik**
dan muncul error merah `column reference "title" is ambiguous`. Ini bug pada
fungsi trigger versi schema lama: nama variabel PL/pgSQL (`title` di
`fn_donation_created`, `code` di `fn_distribution_created`) sama dengan nama
colom tabel, sehingga PostgreSQL menolak setiap donasi yang terhubung ke
pengajuan.

**Solusi:** Dashboard Supabase → SQL Editor → New query → tempel seluruh isi
`sql/update_fix_trigger.sql` → **Run**. File itu sekaligus memperbaiki:

1. trigger donasi & penyaluran (konflik nama variabel–kolom),
2. `ziswaf_transactions.donor_id` kini boleh kosong (donatur tunai tanpa
   akun — siswa/umum),
3. pengelola/admin boleh mencatat ZISWAF atas nama pemberi tanpa akun,
4. kolom `updated_at` pada tabel `donations` (sebelumnya membuat tombol
   Konfirmasi donasi gagal: `record "new" has no field "updated_at"`).

Aman dijalankan berulang dan tidak mengubah data yang sudah ada.

### Alur notifikasi donasi — masuk ke mana?

Semua notifikasi Saling Bantu berupa **notifikasi dalam aplikasi** (lonceng di
kanan atas), bukan email. Untuk setiap konfirmasi donasi dari website
(finansial, barang, tenaga, keahlian, jaringan):

1. **Donasi tercatat** dengan status *menunggu konfirmasi* + nomor kuitansi
   digital (KWT-...) — otomatis, tanpa perlu admin memproses lebih dulu.
2. **Pemilik pengajuan** (penerima bantuan) mendapat lonceng
   *"Ada niat baik untuk pengajuanmu"* → tautan ke `dashboard.html#pengajuan`.
3. **Semua admin aktif** mendapat lonceng *"Donasi baru menunggu konfirmasi"*
   → tautan langsung ke `admin.html#donasi`.
4. **Admin memproses** di panel admin → menu **Donasi** (baris berstatus
   *Menunggu Konfirmasi*) → tombol Konfirmasi/Tolak.
5. Setelah dikonfirmasi: dana terkumpul bertambah otomatis, donor menerima
   lonceng *"Donasi terkonfirmasi"* (kuitansi di Riwayat Donasi), dan bila
   target tercapai seluruh admin menerima *"Target tercapai"* pengingat
   penyaluran. Semua kejadian tercatat di **Jejak Audit** (menu Laporan).

> Database yang sudah berjalan perlu menjalankan ulang
> `sql/update_admin_program.sql` agar notifikasi poin 3 aktif — trigger
> `fn_donation_created()` kini juga mengabari semua admin aktif.

### Apakah dana terkumpul program naik otomatis setelah donasi diverifikasi?

**Ya, otomatis.** Progres di kartu program (Cari Bantuan, Beranda, dashboard,
laporan admin) dihitung dari kolom `funds_collected` pada tabel program, dan
kolom itu diubah **langsung oleh trigger database** saat admin menekan
**Konfirmasi** di menu Donasi — tanpa input manual apa pun:

1. Donatur memberi bantuan → donasi tercatat berstatus *menunggu konfirmasi*
   (belum dihitung; kartu program masih menampilkan angka lama).
2. Admin konfirmasi → `funds_collected` **naik sebesar nominal** → progres
   kartu berubah seketika saat halaman dimuat ulang.
3. Target tercapai → program otomatis menjadi *Bantuan Terpenuhi* + notifikasi
   ke pemilik pengajuan dan semua admin.
4. Donasi yang sudah terkonfirmasi **dibatalkan/ditolak** → dana **turun
   kembali**; admin **mengubah nominal** donasi terkonfirmasi → dana ikut
   menyesuaikan (selisih). Verifikasi ulang tidak pernah menghitung dobel.
5. Donasi barang/tenaga dihitung sebagai **nilai setara uang** yang diisi admin.

> Database yang sudah berjalan: jalankan **`sql/update_program_progress.sql`**
> (SQL Editor → Run) supaya poin 4–5 aktif. Aman dijalankan berulang.
> Database baru sudah lengkap di `supabase_schema.sql`.

### Muncul "Could not find the 'beneficiary_name' column of 'assistance_requests' in the schema cache"

Error ini muncul saat **Tambah Program** (atau form *Ajukan Bantuan*) ketika
database Supabase Anda dibuat dari schema lama yang belum memiliki kolom
`beneficiary_name` (penyimpan nama penerima/golongan pada program).
**Solusi:** buka **Dashboard Supabase → SQL Editor → New query**, tempel
seluruh isi `sql/update_admin_program.sql`, lalu klik **Run**. File itu akan:

1. menambah kolom `beneficiary_name` pada tabel `assistance_requests`
   (`alter table ... add column if not exists`),
2. menyegarkan cache skema (`notify pgrst, 'reload schema'`),
3. memperbarui kebijakan RLS agar peran *pengelola* juga boleh mengelola
   pengajuan.

Setelah selesai, muat ulang halaman aplikasi dan coba lagi — aman dijalankan
berulang, tidak mengubah data yang sudah ada.

### Muncul "duplicate key value violates unique constraint 'ziswaf_transactions_kode_key'" saat kirim ZISWAF

Error ini muncul di halaman ZISWAF (`ziswaf.html`) ketika donatur mengirim
*Infaq/Zakat/Sedekah/Wakaf* lewat tombol **"Kirim Niat Kebaikan"**.
**Penyebab:** pada versi SQL sebelumnya, data contoh memakai kode transaksi
`ZW-2026-0001` s.d. `ZW-2026-0008` secara langsung **tanpa menggeser counter**
(`ziswaf_tx_seq`), sehingga transaksi nyata **yang pertama** mendapat nomor 1
lagi → kode menabrak milik data contoh → ditolak database.

**Solusi:** buka **Dashboard Supabase → SQL Editor → New query**, tempel
seluruh isi `sql/update_ziswaf.sql` (versi terbaru), lalu klik **Run**.
File versi baru melakukan 3 hal:

1. **Trigger kode anti-bentrok** — nomor baru selalu dibandingkan dengan
   nomor terbesar yang sudah terpakai di tabel; bila masih bertabrakan,
   nomor dinaikkan sampai menemukan kode yang bebas (`while exists`).
2. **Counter diselaraskan otomatis** (`setval`) dengan kode yang sudah ada,
   sehingga transaksi berikutnya langsung mendapat `ZW-2026-0009` dst.
3. Berlaku juga untuk kode penyaluran (`ZS-...`, tabel
   `ziswaf_distributions`).

Sebagai lapisan tambahan, aplikasi kini otomatis **mengulang pengiriman
maksimal 3 kali** bila kena *duplicate key*, dan pesan galatnya sudah
diterjemahkan ke Bahasa Indonesia dengan arahan file yang harus dijalankan.
Aman dijalankan berulang, tidak mengubah data yang sudah ada.

### Tambah Program dari Panel Admin (fitur baru)

Menu **Pengajuan** kini memiliki tombol **"+ Tambah Program / Pengajuan"** —
admin/pengelola dapat langsung membuat program donasi/pengajuan tanpa harus
menunggu form dari penerima. Status awal bisa dipilih: *Dipublikasikan*
(langsung tampil di Cari Bantuan dan bisa diberi donasi), *Menunggu Verifikasi*,
atau *Terverifikasi*. Semua pembuatan program tercatat di jejak audit.

- Pencatatan dana ZISWAF (zakat/infaq/sedekah/wakaf) tetap lewat menu
  **Modul ZISWAF → Catat ZISWAF (Tunai/Offline)**.
- Database yang **sudah berjalan**: jalankan `sql/update_admin_program.sql`
  — selain memberi hak *pengelola* (RLS `p_requests_admin` kini memakai
  `is_pengelola()`), file itu juga menambahkan kolom `beneficiary_name`
  yang wajib ada untuk fitur ini. Database baru sudah lengkap di
  `supabase_schema.sql`.

## 11. Tombol Hapus di Semua Menu + Data Realtime (v1.6)

### Hapus data (admin & pengelola)

Setiap menu Panel Admin kini memiliki tombol **Hapus** dengan dialog
konfirmasi sebelum eksekusi:

| Menu | Yang bisa dihapus | Dampak otomatis |
| --- | --- | --- |
| Manajemen Pengguna | Akun (khusus **admin**, bukan akun sendiri) | Donasi, pengajuan, notifikasi akun terkait ikut terhapus (kaskade) |
| Manajemen Pengajuan | Program/pengajuan | Donasi tidak terhapus (kuitansi tetap di riwayat donatur), penyaluran & progres terhapus |
| Manajemen Donasi | Donasi **dan catatan penyaluran** | Donasi terkonfirmasi dihapus → **dana terkumpul berkurang**; penyaluran dihapus → **dana tersalur berkurang** |
| Modul ZISWAF | Penerimaan & penyaluran | Rekap dana & saldo jenis dana langsung menyesuaikan |
| Manajemen Konten | Cerita + pengumuman | Cerita hilang dari halaman publik |
| Isi Website | (Kembalikan Default per grup) | Teks kembali ke bawaan |
| Halaman Ingin Membantu | Kegiatan & komunitas (admin/pengelola, atau pembuatnya) | Pendaftaran/keanggotaan terkait ikut terhapus |

Setiap penghapusan **tercatat di jejak audit** (menu Laporan). Menu
Statistik/Realtime/Laporan bersifat baca-only (log integritas tidak boleh
dihapus dari UI).

**Database lama wajib menjalankan `sql/update_delete_realtime.sql`** —
file itu: (1) menyelaraskan kebijakan RLS agar admin **dan pengelola**
dapat edit/hapus pada donasi, penyaluran, cerita, kegiatan, dan komunitas
(penghapusan akun tetap khusus admin); (2) memasang trigger penghapus yang
menjaga angka akurat — donasi terkonfirmasi dihapus → dana terkumpul
berkurang, penyaluran dihapus → dana tersalur berkurang. Aman dijalankan
berulang. Database baru (`supabase_schema.sql`) sudah memuat semuanya.

Catatan: menghapus akun di Supabase hanya menghapus **profil** beserta datanya;
akun autentikasinya tetap ada. Untuk menghapus total (termasuk email), admin
buka Dashboard Supabase → Authentication → Users → pilih akun → hapus.

### Data realtime — Supabase vs Mode Demo

- **Terhubung Supabase**: semua halaman (beranda, cari, ZISWAF, transparansi,
  cerita, dashboard pengguna, panel admin) berlangganan **Supabase Realtime**
  (`postgres_changes`, satu kanal bersama). Begitu ada perubahan — donasi baru
  masuk, admin memverifikasi/menghapus, ZISWAF terverifikasi — daftar, kartu,
  angka, dan rekap **memuat ulang otomatis dalam <1 detik** tanpa tombol
  segarkan. Muat ulang otomatis dijeda bila ada modal terbuka agar tidak
  mengganggu pengisian form.
- **Mode Demo**: yang tampil adalah **data bawaan** (seed) yang tersimpan di
  localStorage browser; perubahan data langsung tercermin di seluruh halaman
  yang terbuka (termasuk lintas tab via event `storage`), tanpa Supabase.
- Pengumuman platform kini tersimpan **global di tabel `site_content`** saat
  terhubung Supabase (ikut realtime ke semua perangkat); di Mode Demo tetap
  di localStorage browser ini.
- Prasyarat realtime di database lama: jalankan
  `sql/update_delete_realtime.sql` (mendaftarkan 17 tabel utama ke
  publication `supabase_realtime`). Database baru sudah lengkap.

### Muncul "relation ... does not exist" / tombol Hapus ditolak

- **Tabel belum ada**: pesan "Tabel 'xxx' belum ada di database Supabase proyek
  ini…" berarti schema belum pernah dijalankan di proyek tersebut — jalankan
  `sql/supabase_schema.sql` (instalasi baru) atau file pembaruan terkait.
- **Tombol Hapus terasa "berhasil" tetapi data tetap ada**: itu kebijakan RLS
  menolak (database lama belum menjalankan `sql/update_delete_realtime.sql`).
  Aplikasi mendeteksinya dan menampilkan pesan yang mengarah ke file tersebut.
- **Realtime tidak jalan**: pastikan `supabase_realtime` publication memuat
  tabelnya (jalankan `sql/update_delete_realtime.sql`), dan cek tanggal/jam
  perangkat — WebSocket bisa gagal bila jam sistem meleset jauh.

## 12. Laporan PDF Bulanan, Ekspor Excel & Identitas Yayasan (v1.7)

Tiga fitur baru di Panel Admin, semuanya bekerja **tanpa CDN dan tanpa
pustaka luar** (murni JavaScript — tetap jalan offline):

### Laporan PDF Bulanan (menu Laporan)

- Pilih **Periode Laporan (Bulan)** → klik **Unduh Laporan PDF Bulanan**.
- File `laporan-bulanan-YYYY-MM.pdf` (A4, multi-halaman) berisi:
  1. **Kop surat berlogo** — logo kustom, nama aplikasi, nama yayasan,
     tagline, dan judul periode (warna mengikuti tema yang dipilih).
  2. **Ringkasan** 6 kotak KPI — donasi terkonfirmasi, jumlah transaksi,
     ZISWAF masuk, ZISWAF disalurkan, bantuan program disalurkan,
     pengajuan baru — plus catatan jumlah yang masih menunggu/ditolak.
  3. **Rekap Donasi per Jenis Bantuan** dan **Rekap ZISWAF per Jenis**
     (zakat/infaq/sedekah/wakaf, masuk vs disalurkan) dengan baris TOTAL.
  4. **Rincian Donasi Terkonfirmasi** (tanggal, kuitansi, donatur, jenis,
     status, nominal) dan **Rincian ZISWAF Masuk**.
  5. **Penyaluran Bulan Ini** (bantuan program + ZISWAF gabungan, dengan
     kode proyek/mustahik) dan **Pengajuan Bantuan Baru** periode tersebut.
  6. **Footer setiap halaman** — identitas yayasan, alamat, kontak, website,
     dan nomor halaman "Halaman X dari Y".
- Angka hanya menghitung data **terverifikasi** (donasi terkonfirmasi,
  ZISWAF terverifikasi); yang menunggu/ditolak dilaporkan sebagai catatan.
- Terhubung Supabase → angka dari data **realtime**; Mode Demo → data seed.

### Ekspor Excel donasi & ZISWAF

- **Menu Manajemen Donasi** → tombol **Ekspor Excel** (semua data).
- **Menu Laporan** → **Excel Donasi** / **Excel ZISWAF** untuk bulan terpilih.
- File **.xlsx asli** (bukan CSV yang diganti nama): paket Office Open XML
  dengan kepala kolom hijau, baris judul, angka nominal berformat `#,##0`
  (bisa langsung di-SUM), baris TOTAL tebal, dan panel kepala dibekukan
  (freeze pane). Excel ZISWAF berisi 2 lembar: *Penerimaan* dan *Penyaluran*.
- Nama file otomatis: `donasi-saling-bantu.xlsx`,
  `donasi-saling-bantu-2026-11.xlsx`, `ziswaf-saling-bantu-2026-11.xlsx`.
- Tetap ada juga ekspor CSV lama (ZISWAF & pengajuan) untuk kompatibilitas.

### Ganti logo & identitas lainnya (menu Isi Website → Identitas)

Field baru pada grup **Identitas Aplikasi**:

| Field | Efek |
| --- | --- |
| **Logo Aplikasi** (unggah gambar) | Header & footer semua halaman, favicon tab browser, dan kop laporan PDF. PNG/JPG/SVG otomatis dikecilkan & dikompres. |
| **Nama Yayasan / Organisasi** | Kop laporan PDF, footer identitas. |
| **Alamat Yayasan** | Footer "Hubungi Kami" + footer laporan PDF. |
| **Website** | Footer (tautan) + footer laporan PDF. |
| **Warna Tema Utama** | Seluruh aksen hijau platform (header, tombol, badge, grafik, tabel admin) berganti warna secara live. |

- Nama aplikasi, tagline, email, dan WhatsApp tetap ada di grup yang sama.
- **Terhubung Supabase** → tersimpan di tabel `site_content`, berlaku
  **global untuk semua perangkat** (ikut realtime); **Mode Demo** →
  localStorage browser ini.
- Tidak perlu SQL baru — tabel `site_content` sudah mendukung logo.
- Tombol **Hapus Logo** mengembalikan ikon hati bawaan; **Kembalikan
  Default Grup Ini** mereset seluruh grup identitas.

### Masalah umum fitur laporan & identitas

- **Logo tidak muncul di header**: pastikan sudah klik **Simpan Semua
  Perubahan** di Isi Website (unggah saja baru disiapkan, belum ditetapkan).
- **Logo terlalu besar gagal menyimpan**: gambar diunggah otomatis dikecilkan
  ke sisi terpanjang 320px — hasilnya umumnya <100KB. Bila tetap gagal
  (koneksi lambat), gunakan PNG/JPG berukuran lebih kecil.
- **PDF tidak terunduh**: browser memblokir unduhan otomatis? Izinkan
  unduhan untuk situs ini. PDF dibuat sepenuhnya di perangkat (offline OK).
- **PDF ada halaman kosong/putus tabel**: itu perilaku pindah halaman
  normal — kepala tabel diulang otomatis di halaman lanjutan.
- **Excel tidak bisa dibuka / peringatan**: file diuji dengan Excel standar
  (Office Open XML). Bila Office meminta "file masih dalam Protected View",
  klik **Enable Editing**. Nominal tersimpan sebagai angka murni —
  gunakan SUM/pivot langsung.
- **Warna tema tidak berubah**: warna diterapkan saat halaman dimuat ulang
  setelah simpan; bila tab lain masih terbuka, segarkan manual sekali.
  Warna yang tidak valid (bukan `#rrggbb`) otomatis kembali ke hijau bawaan.

## 12. Jalur Cepat Berdonasi — tanpa akun (v1.7)

Donasi kini bisa dilakukan **tanpa mendaftar akun** lewat halaman
`donasi-cepat.html` — cukup **nama + nomor WhatsApp**.

### Alur 5 langkah

1. Tamu membuka **Donasi Cepat** (tombol `DONASI CEPAT — TANPA DAFTAR` di
   beranda, atau tautan pada pita "masuk dulu" di halaman Ingin Membantu).
2. Mengisi **nama**, **nomor WhatsApp**, memilih **program donasi** yang
   sedang menerima donasi (dengan ringkasan progres terkumpul), memilih
   **nominal** (chip cepat 25rb–500rb atau ketik sendiri), pesan/doa
   opsional, dan opsi **Hamba Allah** (anonim).
3. Klik **Catat Donasi Saya** → **nomor kuitansi KWT terbit langsung**,
   donasi berstatus `menunggu_konfirmasi` dan **langsung terlihat di panel
   admin** (menu Donasi + feed Realtime, lengkap dengan nomor WA tamu).
4. Tamu **transfer** ke rekening yayasan (tampil di panel samping form dan
   di halaman sukses), lalu menekan tombol **"Kirim Bukti Transfer via
   WhatsApp"** — WhatsApp admin terbuka dengan pesan otomatis berisi kuitansi,
   nama, program, dan nominal (tombol **Salin Pesan** tersedia sebagai
   cadangan).
5. Admin menerima bukti di WhatsApp, lalu menekan **Konfirmasi** di menu
   Donasi — dana terkumpul program naik otomatis, donasi **masuk rekapan
   laporan PDF/Excel otomatis**.

### Pengaturan nomor WhatsApp admin

Nomor tujuan tombol WhatsApp diambil dari CMS **Isi Website → Identitas →
"Nomor WhatsApp / Telepon"** (`wa_kontak`) — admin cukup mengisinya sekali
(format bebas: `0812-...`, `+62...`, spasi/strip diterima; dinormalisasi
otomatis ke `wa.me`). Bila masih default `+62 812-0000-0000`, segera ganti
dengan nomor resmi yayasan.

### Mode Supabase — wajib jalankan `sql/update_donasi_cepat.sql`

Database lama perlu satu pembaruan (aman dijalankan berulang):

```sql
-- ringkasan isi file sql/update_donasi_cepat.sql
alter table public.donations alter column donor_id drop not null;
alter table public.donations add column if not exists donor_wa text;
-- + 2 kebijakan RLS tamu (insert & read terbatas) + trigger notifikasi baru
```

- `donor_id` menjadi **boleh NULL** (donatur tamu tanpa akun).
- Kolom `donor_wa` menyimpan nomor WhatsApp pemberi.
- RLS: peran **anon** hanya boleh memasukkan donasi `donor_id IS NULL and
  status = 'menunggu_konfirmasi'`, dan hanya boleh melihat baris itu
  **selama masih menunggu** — setelah diverifikasi/ditolak, publik tak
  melihatnya lagi (hanya admin/pengelola).
- Notifikasi admin kini menyebut nomor WA tamu + tanda "via Jalur Cepat".

Instalasi baru tidak perlu apa-apa — `sql/supabase_schema.sql` sudah
memuat semuanya. **Mode Demo langsung jalan tanpa setup.**

### Masalah umum Jalur Cepat

- **"Donasi tamu (Jalur Cepat) belum diizinkan database ini"**: database
  Supabase masih versi lama — jalankan seluruh isi
  `sql/update_donasi_cepat.sql` di SQL Editor, lalu muat ulang halaman.
- **Tombol WhatsApp dinonaktifkan / tertulis "Nomor WhatsApp admin belum
  diatur"**: isi nomor resmi di Isi Website → Identitas → Nomor WhatsApp /
  Telepon, klik Simpan Semua Perubahan, muat ulang halaman sukses.
- **Nomor tamu salah format**: hanya nomor Indonesia yang diterima
  (`08xx`, `+62xx`, `62xx`, 9–14 digit setelah kode negara).
- **Kuitansi tamu tidak muncul di admin?** Cek menu **Donasi** — baris tamu
  diberi tanda `Jalur Cepat (bukti via WA)` di kolom Donatur beserta nomor
  WA; feed Dashboard Realtime juga menampilkannya seketika.
- **Excel donasi**: kolom **No. WA** kini ikut terekspor (donatur akun yang
  tidak mengisi WA tampil kosong, tamu selalu terisi).

## 13. Galeri Foto Program & Kegiatan (v1.8)

Modul dokumentasi visual: admin/pengelola mengunggah foto kegiatan dan
penyaluran program, publik melihatnya di halaman **Galeri** yang baru.

### Halaman publik `galeri.html`

- Grid foto rapi dengan **judul, keterangan, kategori** (Kegiatan /
  Program / Fasilitas), kaitan program bantuan, dan tanggal.
- **Filter**: per kategori dan per program bantuan (dropdown diambil
  dari daftar pengajuan publik).
- **Lightbox**: klik/Enter pada foto untuk menampilkan gambar besar
  beserta keterangan, nomor urut, pengunggah, dan tombol
  **Sebelumnya / Selanjutnya** untuk menelusuri galeri.
- **Realtime**: foto baru dari panel admin tampil seketika tanpa muat
  ulang (Supabase maupun Mode Demo).

### Panel admin — menu "Galeri Kegiatan"

- **Tambah Foto**: unggah dari perangkat (otomatis dikompres ke sisi
  terpanjang 1280 px lewat canvas — hemat penyimpanan) **atau** tempel
  tautan gambar `https://…`. Pratinjau langsung sebelum simpan.
- Kolom: judul (wajib), keterangan, kategori, **kaitkan ke program**
  bantuan (opsional), dan status **Tayang / Arsip**.
- **Arsipkan** menyembunyikan foto dari publik tanpa menghapusnya;
  **Tayangkan** mengembalikannya. Edit dan Hapus tersedia di setiap
  kartu, dengan konfirmasi sebelum hapus.
- Semua aksi tercatat di **jejak audit** (create/update/delete,
  entitas `gallery_photos`).

### Mode Supabase — wajib jalankan `sql/update_galeri.sql`

Database lama perlu satu pembaruan (aman dijalankan berulang):

```sql
-- ringkasan isi file sql/update_galeri.sql
create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  title text not null, caption text default '',
  photo_url text not null,
  category text default 'kegiatan',
  request_id uuid references public.assistance_requests(id) on delete set null,
  is_active boolean default true,
  created_by uuid references public.profiles(id),
  created_by_name text default 'Tim Saling Bantu',
  created_at timestamptz default now()
);
-- + RLS: publik boleh baca, hanya is_pengelola() boleh kelola
-- + ikut publication supabase_realtime + notify pgrst
```

Instalasi baru tidak perlu apa-apa — `sql/supabase_schema.sql` sudah
memuat **BAGIAN 21** yang sama. **Mode Demo** langsung jalan dengan 8
foto contoh (digambar sebagai SVG kecil, tanpa file gambar eksternal).

### Masalah umum Galeri

- **"Modul Galeri belum tersedia di database ini"** / daftar galeri
  kosong di Mode Supabase padahal ada fotonya: database masih versi
  lama — jalankan seluruh isi `sql/update_galeri.sql` di SQL Editor
  Supabase, klik Run, lalu muat ulang halaman.
- **Foto arsip tidak muncul di galeri publik?** Memang begitu —
  status Arsip disembunyikan dari publik; tekan **Tayangkan** di panel
  admin untuk menampilkannya kembali.
- **Unggahan gagal / "Gambar tidak dapat dibaca"**: gunakan JPG/PNG;
  bila memakai foto lama hasil rotasi EXIF, buka dulu di galeri HP
  lalu simpan ulang. Batas 12 MB per unggahan.
- **Foto besar membuat galeri lambat**: unggahan otomatis dikompres ke
  1280 px, namun tautan eksternal tidak — gunakan CDN/penyimpanan
  gambar yang cepat bila menempel tautan.
