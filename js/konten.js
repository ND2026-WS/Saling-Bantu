/* ============================================================
   SALING BANTU — konten.js
   Lapisan CMS ringan: seluruh teks publik website dapat diedit
   dari Panel Admin -> menu "Isi Website" (khusus admin/pengelola).
   - SB.KONTEN_DEF  : definisi semua field yang bisa diedit
   - SB.muatKonten(): memuat nilai tersimpan dari store (Supabase
     tabel site_content / Mode Demo localStorage)
   - SB.teks(kunci) : ambil nilai final (tersimpan > default)
   - SB.terapkanKonten(): pasang nilai ke elemen [data-sb] dan
     angka statistik [data-sb-hitung] di semua halaman.
   ============================================================ */
window.SB = window.SB || {};
(function () {
  "use strict";
  const cfg = window.SB_CONFIG || {};

  const GRUP = [
    {
      id: "identitas", judul: "Identitas Aplikasi", ikon: "heartHand",
      desk: "Nama, logo, warna, dan kontak resmi platform. Tampil di header, footer, favicon, dan laporan PDF.",
      field: [
        { key: "app_logo", label: "Logo Aplikasi", tipe: "gambar", def: "" },
        { key: "app_nama", label: "Nama Aplikasi", tipe: "text", def: cfg.APP_NAME || "Saling Bantu" },
        { key: "app_tagline", label: "Tagline", tipe: "text", def: cfg.APP_TAGLINE || "Ringankan Beban, Tebarkan Kebaikan" },
        { key: "app_yayasan", label: "Nama Yayasan / Organisasi", tipe: "text", def: (cfg.BANK || {}).atas_nama || "Yayasan Saling Bantu Nusantara" },
        { key: "app_alamat", label: "Alamat Yayasan", tipe: "textarea", def: "Jl. Pendidikan Islami No. 12, Kota Bandung, Jawa Barat 40123" },
        { key: "app_website", label: "Website", tipe: "text", def: "https://salingbantu.id" },
        { key: "app_warna", label: "Warna Tema Utama", tipe: "warna", def: "#16a34a" },
        { key: "email_kontak", label: "Email Kontak", tipe: "text", def: cfg.EMAIL_KONTAK || "halo@salingbantu.id" },
        { key: "wa_kontak", label: "Nomor WhatsApp / Telepon", tipe: "text", def: cfg.WA_KONTAK || "+62 812-0000-0000" }
      ]
    },
    {
      id: "hero", judul: "Hero Beranda (Bagian Atas)", ikon: "home",
      desk: "Teks utama yang pertama dilihat pengunjung di halaman beranda.",
      field: [
        { key: "hero_badge", label: "Lencana Kecil di Atas Judul", tipe: "text", def: "Platform Gotong Royong Digital Indonesia" },
        { key: "hero_judul", label: "Judul Utama", tipe: "text", def: "Karena Kita Tidak Harus Menghadapi Semuanya" },
        { key: "hero_judul_em", label: "Judul Utama — Kata Beraksen (miring)", tipe: "text", def: "Sendirian." },
        { key: "hero_sub", label: "Kalimat Deskripsi", tipe: "textarea", def: "Setiap orang bisa membutuhkan bantuan. Setiap orang juga bisa menjadi alasan seseorang kembali tersenyum." },
        { key: "hero_cta1", label: "Tombol 1 (butuh bantuan)", tipe: "text", def: "SAYA MEMBUTUHKAN BANTUAN" },
        { key: "hero_cta2", label: "Tombol 2 (ingin membantu)", tipe: "text", def: "SAYA INGIN MEMBANTU" },
        { key: "hero_note", label: "Catatan di Bawah Tombol", tipe: "text", def: "Setiap pengajuan diverifikasi admin  ·  Dana tercatat transparan  ·  Gratis untuk semua" },
        { key: "hero_dana", label: "Kartu Kecil — Dana Tersalurkan", tipe: "text", def: "Rp 4,2 M" },
        { key: "hero_bantu", label: "Kartu Kecil — Sedang Dibantu", tipe: "text", def: "128 pengajuan" }
      ]
    },
    {
      id: "statistik", judul: "Statistik Beranda", ikon: "chart",
      desk: "Angka dasar pita statistik. Data nyata platform (jika terhubung Supabase) ditambahkan otomatis di atas angka dasar ini.",
      field: [
        { key: "stat_pengguna", label: "Pengguna Terdaftar (angka)", tipe: "angka", def: "12480" },
        { key: "stat_pengguna_label", label: "Label Pengguna", tipe: "text", def: "Pengguna terdaftar" },
        { key: "stat_pengajuan", label: "Pengajuan Bantuan (angka)", tipe: "angka", def: "3276" },
        { key: "stat_pengajuan_label", label: "Label Pengajuan", tipe: "text", def: "Pengajuan bantuan" },
        { key: "stat_tersalur", label: "Bantuan Tersalurkan (angka)", tipe: "angka", def: "2914" },
        { key: "stat_tersalur_label", label: "Label Tersalur", tipe: "text", def: "Bantuan tersalurkan" },
        { key: "stat_volunteer", label: "Volunteer Aktif (angka)", tipe: "angka", def: "1850" },
        { key: "stat_volunteer_label", label: "Label Volunteer", tipe: "text", def: "Volunteer aktif" },
        { key: "stat_komunitas", label: "Komunitas Bergabung (angka)", tipe: "angka", def: "320" },
        { key: "stat_komunitas_label", label: "Label Komunitas", tipe: "text", def: "Komunitas bergabung" }
      ]
    },
    {
      id: "bagian", judul: "Judul Bagian Beranda", ikon: "book",
      desk: "Judul & deskripsi setiap bagian di beranda: bantuan terbaru, kategori, dan cerita.",
      field: [
        { key: "sec_bantuan_judul", label: "Bagian Bantuan Terbaru — Judul", tipe: "text", def: "Mereka Sedang Menunggu Tangan Baik Anda" },
        { key: "sec_bantuan_sub", label: "Bagian Bantuan Terbaru — Deskripsi", tipe: "textarea", def: "Semua pengajuan di bawah telah melewati proses verifikasi admin. Anda bisa melihat detail lalu memilih cara membantu." },
        { key: "sec_kategori_judul", label: "Bagian Kategori — Judul", tipe: "text", def: "Enam Pintu Kebaikan, Satu Tujuan" },
        { key: "sec_kategori_sub", label: "Bagian Kategori — Deskripsi", tipe: "textarea", def: "Temukan bentuk bantuan yang paling sesuai dengan kemampuan dan kepedulian Anda." },
        { key: "sec_cerita_judul", label: "Bagian Cerita — Judul", tipe: "text", def: "Bukti Bahwa Kebaikan Mengalir Kembali" },
        { key: "sec_cerita_sub", label: "Bagian Cerita — Deskripsi", tipe: "textarea", def: "Kisah nyata dari penerima dan pemberi bantuan yang saling terhubung di platform ini." }
      ]
    },
    {
      id: "ziswaf", judul: "Modul ZISWAF", ikon: "gift",
      desk: "Teks pada halaman ZISWAF dan pita ZISWAF di beranda (zakat, infaq, sedekah, wakaf).",
      field: [
        { key: "ziswaf_judul", label: "Judul Bagian ZISWAF", tipe: "text", def: "ZISWAF — Dana Kebaikan Sekolah & Yayasan" },
        { key: "ziswaf_sub", label: "Deskripsi Singkat", tipe: "textarea", def: "Kelola zakat, infaq, sedekah, dan wakaf dari siswa, guru & tendik, orang tua santri, dan masyarakat umum — tersalurkan kembali kepada yang berhak dengan amanah." },
        { key: "ziswaf_deskripsi", label: "Paragraf Pengantar Halaman ZISWAF", tipe: "textarea", def: "ZISWAF (Zakat, Infaq, Sedekah, Wakaf) adalah program pengelolaan dana kebaikan yayasan. Dana terkumpul dari keluarga besar sekolah — siswa, guru & tenaga kependidikan, orang tua santri — serta masyarakat umum, kemudian disalurkan kepada penerima manfaat: dari 8 asnaf penerima zakat hingga beasiswa siswa yatim & dhuafa, operasional masjid sekolah, dan pembangunan fasilitas. Seluruh penerimaan dan penyaluran tercatat dan dapat dipantau publik di halaman ini." },
        { key: "ziswaf_penyaluran_judul", label: "Judul Bagian Penyaluran", tipe: "text", def: "Ke Mana Dana ZISWAF Mengalir?" },
        { key: "ziswaf_penyaluran_sub", label: "Deskripsi Bagian Penyaluran", tipe: "textarea", def: "Zakat disalurkan kepada 8 asnaf (fakir, miskin, amil, muallaf, riqab, gharim, fisabilillah, ibnu sabil). Infaq, sedekah, dan wakaf dialirkan untuk beasiswa siswa yatim & dhuafa, operasional masjid & sekolah, pembangunan fasilitas, serta aksi kemanusiaan." }
      ]
    },
    {
      id: "cta", judul: "Ajakan Bergabung (CTA)", ikon: "megaphone",
      desk: "Pita ajakan besar di bagian bawah beranda.",
      field: [
        { key: "cta_judul", label: "Judul CTA", tipe: "text", def: "Mulai Berbagi Hari Ini — Kecil Apapun Bentuknya" },
        { key: "cta_sub", label: "Deskripsi CTA", tipe: "textarea", def: "Daftar gratis sebagai penerima, donatur, atau volunteer. Bersama, beban yang berat menjadi ringan." },
        { key: "cta_btn1", label: "Tombol 1", tipe: "text", def: "Gabung Sekarang" },
        { key: "cta_btn2", label: "Tombol 2", tipe: "text", def: "Laporan Transparansi" }
      ]
    },
    {
      id: "footer", judul: "Footer (Semua Halaman)", ikon: "file",
      desk: "Teks footer yang tampil di setiap halaman website.",
      field: [
        { key: "footer_tentang", label: "Paragraf Tentang Platform", tipe: "textarea", def: "Platform gotong royong digital yang menghubungkan mereka yang membutuhkan bantuan dengan hati-hati yang ingin membantu. Setiap rupiah dan setiap tenaga tercatat transparan." },
        { key: "footer_copyright", label: "Teks Hak Cipta", tipe: "text", def: "© 2026 Saling Bantu — Gotong royong untuk Indonesia." },
        { key: "footer_credit", label: "Teks Penutup Kanan", tipe: "text", def: "Dibuat dengan kepedulian di Indonesia" }
      ]
    },
    {
      id: "bank", judul: "Rekening Donasi", ikon: "credit",
      desk: "Rekening bersama yang tampil pada form donasi dan informasi pembayaran.",
      field: [
        { key: "bank_nama", label: "Nama Bank", tipe: "text", def: (cfg.BANK || {}).nama || "Bank BNI Syariah" },
        { key: "bank_rekening", label: "Nomor Rekening", tipe: "text", def: (cfg.BANK || {}).rekening || "8801 8899 0011" },
        { key: "bank_atas_nama", label: "Atas Nama", tipe: "text", def: (cfg.BANK || {}).atas_nama || "Yayasan Saling Bantu Nusantara" }
      ]
    }
  ];

  const DEFAULTS = {};
  GRUP.forEach((g) => g.field.forEach((f) => { DEFAULTS[f.key] = f.def; }));

  SB.KONTEN_DEF = GRUP;
  SB.konten = Object.assign({}, DEFAULTS);

  let janji = null;

  function lakukanMuat() {
    if (!SB.store || !SB.store.getContent) return Promise.resolve(SB.konten);
    return SB.store.getContent()
      .then((tersimpan) => { SB.konten = Object.assign({}, DEFAULTS, tersimpan || {}); return SB.konten; })
      .catch(() => SB.konten);
  }

  /* Muat konten (dimemoize — aman dipanggil berkali-kali). paksa=true untuk ambil ulang. */
  SB.muatKonten = function (paksa) {
    if (paksa || !janji) janji = lakukanMuat();
    return janji;
  };

  /* Nilai final satu teks */
  SB.teks = function (kunci) {
    const v = SB.konten[kunci];
    if (v !== undefined && v !== null && String(v) !== "") return String(v);
    return DEFAULTS[kunci] === undefined ? "" : String(DEFAULTS[kunci]);
  };

  /* Pasang semua teks ke elemen [data-sb] & angka ke [data-sb-hitung] */
  SB.terapkanKonten = function (root) {
    root = root || document;
    try {
      root.querySelectorAll("[data-sb]").forEach((el) => {
        el.textContent = SB.teks(el.getAttribute("data-sb"));
      });
      root.querySelectorAll("[data-sb-hitung]").forEach((el) => {
        const v = Number(SB.teks(el.getAttribute("data-sb-hitung")));
        if (!isNaN(v) && v > 0) el.dataset.hitung = v;
      });
    } catch (e) { /* DOM belum siap — abaikan */ }
    /* Warna tema utama kustom (bila admin mengubahnya) */
    try {
      const warna = SB.teks("app_warna");
      if (/^#[0-9a-fA-F]{6}$/.test(warna)) {
        const gnt = (i, p) => Math.round(parseInt(warna.slice(i, i + 2), 16) * (1 - p)).toString(16).padStart(2, "0");
        const akar = document.documentElement.style;
        akar.setProperty("--hijau", warna);
        akar.setProperty("--hijau-tua", "#" + gnt(1, 0.18) + gnt(3, 0.18) + gnt(5, 0.18));
        akar.setProperty("--hijau-gelap", "#" + gnt(1, 0.38) + gnt(3, 0.38) + gnt(5, 0.38));
      }
    } catch (e2) { /* abaikan */ }
  };
})();
