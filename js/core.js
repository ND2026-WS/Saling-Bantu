/* ============================================================
   SALING BANTU — core.js
   Utilitas umum, ikon SVG inline, metadata domain
   (6 kategori, 8 status, 5 jenis bantuan, jenis notifikasi)
   ============================================================ */
window.SB = window.SB || {};
(function () {
  "use strict";

  /* ---------- Utilitas ---------- */
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
  const angkaPendek = (n) => {
    n = Number(n || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(".", ",") + " M";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " jt";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + " rb";
    return String(n);
  };
  const tanggal = (iso) =>
    iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
  const tanggalWaktu = (iso) =>
    iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  const waktuLalu = (iso) => {
    if (!iso) return "-";
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 60000);
    if (m < 1) return "baru saja";
    if (m < 60) return m + " menit lalu";
    const j = Math.floor(m / 60);
    if (j < 24) return j + " jam lalu";
    const h = Math.floor(j / 24);
    if (h < 30) return h + " hari lalu";
    return tanggal(iso);
  };
  const param = (k) => new URLSearchParams(location.search).get(k);
  const uid = () => "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const sekarang = () => new Date().toISOString();
  const inisial = (nama) =>
    String(nama || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  /* ---------- Ikon SVG (gaya feather, stroke currentColor) ---------- */
  const P = {
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    credit: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    megaphone: '<path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    heartHand: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><line x1="7" y1="12" x2="17" y2="12"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  };
  function icon(n, s) {
    s = s || 18;
    if (!P[n]) return "";
    return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[n] + "</svg>";
  }

  /* ---------- Metadata domain ---------- */
  const KATEGORI = {
    sosial: {
      label: "Bantuan Sosial", icon: "users", warna: "hijau",
      sub: ["Keluarga Prasejahtera", "Kebutuhan Hidup Sehari-hari", "Biaya Pendidikan Anak", "Kebutuhan Sekolah Anak", "Korban Bencana Alam", "Anak Yatim & Dhuafa"],
      desc: "Bantu keluarga prasejahtera, korban bencana, anak yatim & dhuafa.",
    },
    kesehatan: {
      label: "Bantuan Kesehatan", icon: "heart", warna: "merah",
      sub: ["Biaya Pengobatan", "Kebutuhan Medis", "Transportasi Pasien", "Informasi Donor Darah", "Pendampingan Pasien"],
      desc: "Biaya pengobatan, alat medis, donor darah, hingga pendampingan pasien.",
    },
    pendidikan: {
      label: "Bantuan Pendidikan", icon: "book", warna: "biru",
      sub: ["Beasiswa Pendidikan", "Buku Pelajaran", "Alat Tulis Sekolah", "Guru Volunteer", "Bimbingan Belajar Gratis"],
      desc: "Beasiswa, buku, alat sekolah, guru volunteer, dan bimbingan gratis.",
    },
    tenaga_jasa: {
      label: "Bantuan Tenaga & Jasa", icon: "tool", warna: "oranye",
      sub: ["Aksi Volunteer", "Perbaikan Rumah", "Tenaga Bantu Harian", "Konsultasi Gratis", "Keahlian Profesional"],
      desc: "Tenaga volunteer, perbaikan rumah, konsultasi, dan keahlian profesional.",
    },
    barang: {
      label: "Bantuan Barang", icon: "package", warna: "ungu",
      sub: ["Pakaian Layak", "Makanan & Sembako", "Peralatan Rumah Tangga", "Alat Belajar", "Kebutuhan Bayi"],
      desc: "Pakaian, sembako, peralatan rumah, alat belajar, dan kebutuhan bayi.",
    },
    usaha: {
      label: "Bantuan Usaha", icon: "briefcase", warna: "teal",
      sub: ["Dukungan Modal UMKM", "Pelatihan Keterampilan", "Bantuan Pemasaran", "Mentoring Bisnis", "Kemitraan Usaha"],
      desc: "Dukungan UMKM, pelatihan, pemasaran, mentoring, dan kemitraan.",
    },
  };

  const STATUS = {
    menunggu_verifikasi: { label: "Menunggu Verifikasi", urut: 1, warna: "abu" },
    dalam_verifikasi:    { label: "Dalam Proses Verifikasi", urut: 2, warna: "biru" },
    terverifikasi:       { label: "Terverifikasi", urut: 3, warna: "teal" },
    dipublikasikan:      { label: "Dipublikasikan", urut: 4, warna: "hijau" },
    sedang_dibantu:      { label: "Sedang Mendapat Bantuan", urut: 5, warna: "oranye" },
    bantuan_terpenuhi:   { label: "Bantuan Terpenuhi", urut: 6, warna: "hijaumuda" },
    selesai:             { label: "Selesai", urut: 7, warna: "hijau" },
    ditolak:             { label: "Ditolak", urut: 0, warna: "merah" },
  };
  const URUTAN_STATUS = ["menunggu_verifikasi", "dalam_verifikasi", "terverifikasi", "dipublikasikan", "sedang_dibantu", "bantuan_terpenuhi", "selesai"];

  const JENIS_BANTUAN = {
    finansial: { label: "Finansial", icon: "credit" },
    barang:    { label: "Barang", icon: "package" },
    tenaga:    { label: "Tenaga", icon: "tool" },
    keahlian:  { label: "Keahlian", icon: "award" },
    jaringan:  { label: "Jaringan / Koneksi", icon: "users" },
  };

  /* ---------- Modul ZISWAF (Zakat, Infaq, Sedekah, Wakaf) ----------
     Modul pengelolaan dana ZISWAF yayasan/sekolah Islam terpadu:
     pemberi dari siswa, guru & tendik, orang tua santri, dan umum;
     penyaluran kepada mustahik (8 asnaf + program yayasan). */
  const ZISWAF_JENIS = {
    zakat:  { label: "Zakat",  icon: "heartHand", warna: "hijau",
      ket: "Zakat maal & penghasilan — disalurkan kepada 8 asnaf sesuai syariat." },
    infaq:  { label: "Infaq",  icon: "gift", warna: "biru",
      ket: "Infaq untuk operasional masjid & sekolah serta kegiatan kebaikan." },
    sedekah:{ label: "Sedekah", icon: "heart", warna: "oranye",
      ket: "Sedekah sukarela: beasiswa yatim, santunan dhuafa, dan kepedulian sosial." },
    wakaf:  { label: "Wakaf",  icon: "book", warna: "ungu",
      ket: "Wakaf untuk fasilitas pendidikan & ibadah — manfaatnya terus mengalir." },
  };
  const ZISWAF_KELOMPOK = {
    siswa:      { label: "Siswa", icon: "book" },
    guru:       { label: "Guru & Tendik", icon: "award" },
    ortu_santri:{ label: "Orang Tua Santri", icon: "users" },
    umum:       { label: "Masyarakat Umum", icon: "heartHand" },
  };
  const ZISWAF_MUSTAHIK = {
    fakir:       { label: "Fakir", asnaf: true },
    miskin:      { label: "Miskin", asnaf: true },
    amil:        { label: "Amil / Pengelola ZISWAF", asnaf: true },
    muallaf:     { label: "Muallaf", asnaf: true },
    riqab:       { label: "Riqab (Memerdekakan)", asnaf: true },
    gharim:      { label: "Gharim (Terjerat Utang)", asnaf: true },
    fisabilillah:{ label: "Fisabilillah", asnaf: true },
    ibnu_sabil:  { label: "Ibnu Sabil (Perantau)", asnaf: true },
    beasiswa:    { label: "Beasiswa Siswa Yatim & Dhuafa", asnaf: false },
    operasional: { label: "Operasional Masjid & Sekolah", asnaf: false },
    pembangunan: { label: "Pembangunan Fasilitas", asnaf: false },
    kemanusiaan: { label: "Aksi Kemanusiaan & Sosial", asnaf: false },
  };
  const ZISWAF_PROGRAM = {
    zakat:   ["Zakat Penghasilan", "Zakat Maal", "Zakat Fitrah (Uang)", "Fidiyah"],
    infaq:   ["Infaq Jumat", "Kotak Amal", "Infaq Masjid Sekolah", "Infaq Kegiatan Siswa", "Infaq Bebas"],
    sedekah: ["Sedekah Subuh", "Beasiswa Yatim", "Santunan Dhuafa", "Sedekah Buku", "Sedekah Jumat"],
    wakaf:   ["Wakaf Pembangunan", "Wakaf Tanah", "Wakaf Buku & Alat", "Cash Waqf (Wakaf Uang)"],
  };
  const ZISWAF_STATUS = {
    menunggu:      { label: "Menunggu Verifikasi", warna: "abu" },
    terverifikasi: { label: "Terverifikasi", warna: "hijau" },
    ditolak:       { label: "Ditolak", warna: "merah" },
  };
  const ZISWAF_METODE = {
    transfer_bank: "Transfer Bank",
    tunai:         "Tunai / Kotak Amal",
    qris:          "QRIS",
  };

  /* Kategori foto galeri (dipakai galeri.html & panel admin) */
  const GALERI_KATEGORI = {
    kegiatan:  { label: "Kegiatan",  warna: "hijau" },
    program:   { label: "Program",   warna: "biru" },
    fasilitas: { label: "Fasilitas", warna: "oranye" },
  };

  const JENIS_NOTIF = {
    pengajuan_diterima:      { label: "Pengajuan diterima", icon: "file" },
    verifikasi_dimulai:      { label: "Sedang diverifikasi", icon: "shield" },
    pengajuan_disetujui:     { label: "Pengajuan disetujui", icon: "checkCircle" },
    bantuan_diterima:        { label: "Bantuan diterima", icon: "gift" },
    donasi_tercatat:         { label: "Donasi tercatat", icon: "credit" },
    target_tercapai:         { label: "Target tercapai", icon: "trending" },
    kabar_volunteer:         { label: "Kabar kegiatan volunteer", icon: "calendar" },
    laporan_dipublikasikan:  { label: "Laporan dipublikasikan", icon: "clipboard" },
    pengajuan_ditolak:       { label: "Pengajuan ditolak", icon: "x" },
  };

  /* ---------- UI helpers ---------- */
  function toast(msg, tipe) {
    tipe = tipe || "sukses";
    let wrap = document.getElementById("toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "toast-wrap"; document.body.appendChild(wrap); }
    const el = document.createElement("div");
    el.className = "toast toast-" + tipe;
    el.innerHTML = '<span class="toast-ic">' + icon(tipe === "gagal" ? "x" : tipe === "info" ? "bell" : "checkCircle", 16) + "</span><span>" + esc(msg) + "</span>";
    wrap.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3800);
  }

  function modal(opt) {
    opt = opt || {};
    let root = document.getElementById("modal-root");
    if (!root) { root = document.createElement("div"); root.id = "modal-root"; document.body.appendChild(root); }
    root.innerHTML =
      '<div class="modal-backdrop" id="mbk"><div class="modal" style="max-width:' + (opt.lebar || 560) + 'px">' +
      '<div class="modal-head"><h3>' + esc(opt.judul || "") + '</h3><button class="modal-x" id="mcl">' + icon("x", 18) + "</button></div>" +
      '<div class="modal-body">' + (opt.isi || "") + "</div>" +
      (opt.footer ? '<div class="modal-foot">' + opt.footer + "</div>" : "") +
      "</div></div>";
    const close = () => { root.innerHTML = ""; };
    root.querySelector("#mbk").addEventListener("click", (e) => { if (e.target.id === "mbk") close(); });
    root.querySelector("#mcl").addEventListener("click", close);
    return close;
  }
  function modalClose() { const r = document.getElementById("modal-root"); if (r) r.innerHTML = ""; }

  function konfirmasi(pesan, tombolOk) {
    return new Promise((resolve) => {
      modal({
        judul: "Konfirmasi",
        isi: "<p>" + esc(pesan) + "</p>",
        footer:
          '<button class="btn btn-ghost" id="k-no">Batal</button>' +
          '<button class="btn btn-primary" id="k-yes">' + esc(tombolOk || "Ya, lanjutkan") + "</button>",
      });
      document.getElementById("k-no").onclick = () => { modalClose(); resolve(false); };
      document.getElementById("k-yes").onclick = () => { modalClose(); resolve(true); };
    });
  }

  function badgeStatus(st) {
    const m = STATUS[st] || { label: st, warna: "abu" };
    return '<span class="badge st-' + m.warna + '">' + esc(m.label) + "</span>";
  }
  function badgeKategori(k) {
    const m = KATEGORI[k];
    if (!m) return "";
    return '<span class="badge badge-kategori"><span class="k-ic k-' + m.warna + '">' + icon(m.icon, 12) + "</span>" + esc(m.label) + "</span>";
  }
  function progress(terkumpul, target) {
    const pct = target > 0 ? Math.min(100, Math.round((terkumpul / target) * 100)) : 0;
    return '<div class="progress" title="' + pct + '%"><div class="progress-bar" style="width:' + pct + '%"></div></div>';
  }
  function avatar(nama, size) {
    size = size || 34;
    return '<span class="avatar" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.4) + 'px">' + esc(inisial(nama)) + "</span>";
  }
  function kosong(msg, ikon) {
    return '<div class="empty">' + icon(ikon || "package", 34) + "<p>" + esc(msg) + "</p></div>";
  }
  function timeline(statusSekarang) {
    const cur = STATUS[statusSekarang] ? STATUS[statusSekarang].urut : 1;
    const ditolak = statusSekarang === "ditolak";
    let h = '<div class="timeline">';
    URUTAN_STATUS.forEach((st) => {
      const m = STATUS[st];
      const cls = ditolak ? "" : m.urut < cur ? "done" : m.urut === cur ? "active" : "";
      h += '<div class="tl-step ' + cls + '"><span class="tl-dot">' + (m.urut < cur && !ditolak ? icon("check", 10) : m.urut) + "</span><span class='tl-lbl'>" + esc(m.label) + "</span></div>";
    });
    if (ditolak) h += '<div class="tl-step rejected active"><span class="tl-dot">' + icon("x", 10) + "</span><span class='tl-lbl'>Ditolak</span></div>";
    return h + "</div>";
  }

  /* ---------- Nomor WhatsApp ----------
     Normalisasi input nomor WA ke bentuk internasional +62... sekaligus
     membuat link wa.me (dipakai Jalur Cepat Berdonasi & kontak admin).
     Menerima: 08xx, 8xx, +62xx, 62xx — toleran spasi/strip/kurung. */
  function normWa(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (!d) return { valid: false, pesan: "Nomor WhatsApp wajib diisi.", nomor: "", link: "" };
    let n = d;
    if (n.startsWith("0")) n = "62" + n.slice(1);
    else if (n.startsWith("8")) n = "62" + n;
    else if (!n.startsWith("62"))
      return { valid: false, pesan: "Format nomor tidak dikenal. Gunakan 08xx, +62xx, atau 62xx.", nomor: "", link: "" };
    if (n.length < 9 || n.length > 14)
      return { valid: false, pesan: "Nomor WhatsApp tampak salah (9–14 digit dengan kode negara 62). Contoh benar: 0812-3456-7890.", nomor: "", link: "" };
    return { valid: true, pesan: "", nomor: "+" + n, link: "https://wa.me/" + n };
  }

  // Ekspor flat
  SB.esc = esc; SB.rupiah = rupiah; SB.angkaPendek = angkaPendek;
  SB.normWa = normWa;
  SB.tanggal = tanggal; SB.tanggalWaktu = tanggalWaktu; SB.waktuLalu = waktuLalu;
  SB.param = param; SB.uid = uid; SB.sekarang = sekarang; SB.inisial = inisial;
  SB.icon = icon; SB.KATEGORI = KATEGORI; SB.STATUS = STATUS; SB.URUTAN_STATUS = URUTAN_STATUS;
  SB.JENIS_BANTUAN = JENIS_BANTUAN; SB.JENIS_NOTIF = JENIS_NOTIF;
  SB.ZISWAF_JENIS = ZISWAF_JENIS; SB.ZISWAF_KELOMPOK = ZISWAF_KELOMPOK;
  SB.ZISWAF_MUSTAHIK = ZISWAF_MUSTAHIK; SB.ZISWAF_PROGRAM = ZISWAF_PROGRAM;
  SB.ZISWAF_STATUS = ZISWAF_STATUS; SB.ZISWAF_METODE = ZISWAF_METODE;
  SB.GALERI_KATEGORI = GALERI_KATEGORI;
  SB.toast = toast; SB.modal = modal; SB.modalClose = modalClose; SB.konfirmasi = konfirmasi;
  SB.badgeStatus = badgeStatus; SB.badgeKategori = badgeKategori; SB.progress = progress;
  SB.avatar = avatar; SB.kosong = kosong; SB.timeline = timeline;
})();
