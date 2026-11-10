/* ============================================================
   SALING BANTU — KONFIGURASI APLIKASI
   ------------------------------------------------------------
   CARA MENGHUBUNGKAN KE SUPABASE:
   1. Buat proyek di https://supabase.com  ->  New project
   2. Jalankan sql/supabase_schema.sql di SQL Editor
   3. Project Settings -> API -> salin URL & anon public key
   4. Tempel di file ini ATAU lewat Panel Admin -> Pengaturan
      (tersimpan di localStorage "sb_koneksi", berlaku otomatis
      di semua halaman). Jika kosong, aplikasi berjalan dalam
      MODE DEMO (data di localStorage, tanpa server).

   PERINGATAN KEAMANAN:
   Gunakan HANYA "anon public key". Service_role key TIDAK BOLEH
   pernah ditulis di file frontend mana pun.
   ============================================================ */

const SB_DEFAULTS = {
  SUPABASE_URL: "",          // contoh: "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "",     // anon public key (BUKAN service_role!)

  APP_NAME: "Saling Bantu",
  APP_TAGLINE: "Ringankan Beban, Tebarkan Kebaikan",
  EMAIL_KONTAK: "halo@salingbantu.id",
  WA_KONTAK: "+62 812-0000-0000",

  // Metode donasi finansial (informasi di form & kuitansi)
  BANK: {
    nama: "Bank BNI Syariah",
    rekening: "8801 8899 0011",
    atas_nama: "Yayasan Saling Bantu Nusantara",
  },
};

/* Override dari Panel Admin -> Pengaturan (disimpan di browser) */
let SB_TERSIMPAN = null;
try { SB_TERSIMPAN = JSON.parse(localStorage.getItem("sb_koneksi") || "null"); }
catch (e) { SB_TERSIMPAN = null; }

const SB_CONFIG = Object.assign({}, SB_DEFAULTS, SB_TERSIMPAN || {});
window.SB_CONFIG = SB_CONFIG;
