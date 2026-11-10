/* ============================================================
   SALING BANTU — laporan.js
   Laporan & ekspor data, murni JavaScript TANPA CDN/layanan
   luar sehingga tetap jalan offline:
   - SB.laporan.agregasi()    : filter data per bulan + rekap total
   - SB.laporan.buatPdf()     : penulis PDF sendiri (A4, multi
       halaman, kop surat + logo, tabel, footer identitas)
   - SB.laporan.xlsxBytes()   : pembuat Excel .xlsx ASLI
       (paket ZIP + XML Office Open XML, tanpa pustaka luar)
   - SB.eksporExcel()         : unduh .xlsx ke perangkat
   - SB.laporan.kompresGambar(): kecilkan logo saat diunggah
   - SB.laporan.logoJpeg()    : ubah logo (png/jpg/svg) jadi JPEG
       siap ditanam ke PDF lewat canvas browser
   ============================================================ */
window.SB = window.SB || {};
(function () {
  "use strict";
  const SB = window.SB;

  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  /* ---------- util teks & angka ---------- */
  const PETA_KARAKTER = { "—": "-", "–": "-", "‘": "'", "’": "'", "“": '"', "”": '"', "…": "...", "·": "-", "•": "-", "×": "x", "‑": "-" };

  function sani(s) {
    s = String(s == null ? "" : s);
    s = s.replace(/[—–‘’“”…·•×‑]/g, (c) => PETA_KARAKTER[c] || "");
    return s.replace(/[^\x20-\x7E]/g, "");
  }
  function grupAngka(n) {
    n = Math.round(Number(n) || 0);
    const negatif = n < 0; n = Math.abs(n);
    return (negatif ? "-" : "") + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function rupiah(n) { return "Rp " + grupAngka(n); }
  function labelBulan(ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
    if (!m) return String(ym || "-");
    return (BULAN[Number(m[2]) - 1] || m[2]) + " " + m[1];
  }
  function fmtTanggal(iso) {
    const s = String(iso || "");
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return sani(s.slice(0, 10) || "-");
    return m[3] + " " + (BULAN_SINGKAT[Number(m[2]) - 1] || m[2]) + " " + m[1];
  }
  function stempelWaktu() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear() +
      " pukul " + p(d.getHours()) + "." + p(d.getMinutes()) + " WIB";
  }
  function warnaRg(hex, fallback) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    const h = m ? m[1] : (fallback || "16a34a");
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    return Math.round(r * 1000) / 1000 + " " + Math.round(g * 1000) / 1000 + " " + Math.round(b * 1000) / 1000;
  }
  /* gelapkan warna heks (p = 0..1 menuju hitam) untuk teks judul di atas warna dasar */
  function gelapkan(hex, p, fallback) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return warnaRg("", fallback);
    const h = m[1];
    const c = [0, 2, 4].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) * (1 - p)) / 255 * 1000) / 1000);
    return c.join(" ");
  }

  /* ---------- AGREGASI BULANAN ----------
     data = { donasi, ziswaf, salurZiswaf, penyaluran, pengajuan, reqMap? } */
  SB.laporan = {};

  SB.laporan.agregasi = function (data, bulan, reqMap) {
    bulan = String(bulan || "").slice(0, 7);
    const dalam = (t) => t && String(t.tanggal || t.distributed_at || t.created_at || "").slice(0, 7) === bulan;
    reqMap = reqMap || data.reqMap || {};
    const jn = (d) => ((SB.JENIS_BANTUAN || {})[d.jenis] || {}).label || d.jenis;

    const donasiSemua = (data.donasi || []).filter(dalam);
    const donasi = donasiSemua.filter((d) => d.status === "terkonfirmasi");
    const donasiMenunggu = donasiSemua.filter((d) => d.status === "menunggu_konfirmasi").length;
    const donasiDitolak = donasiSemua.filter((d) => d.status === "ditolak").length;
    const donasiNominal = donasi.reduce((a, d) => a + (Number(d.jumlah) || 0), 0);

    const zisSemua = (data.ziswaf || []).filter(dalam);
    const ziswaf = zisSemua.filter((z) => z.status === "terverifikasi");
    const ziswafMenunggu = zisSemua.filter((z) => z.status === "menunggu").length;
    const ziswafDitolak = zisSemua.filter((z) => z.status === "ditolak").length;
    const ziswafNominal = ziswaf.reduce((a, z) => a + (Number(z.jumlah) || 0), 0);

    const salurZiswaf = (data.salurZiswaf || []).filter(dalam);
    const salurZiswafNominal = salurZiswaf.reduce((a, x) => a + (Number(x.nominal) || 0), 0);

    const penyaluran = (data.penyaluran || []).filter(dalam);
    const penyaluranNominal = penyaluran.reduce((a, x) => a + (Number(x.jumlah || x.amount) || 0), 0);

    const pengajuan = (data.pengajuan || []).filter(dalam);

    /* rekap donasi per jenis */
    const perJenisDonasi = Object.keys(SB.JENIS_BANTUAN || {}).map((k) => {
      const baris = donasi.filter((d) => d.jenis === k);
      return { key: k, label: (SB.JENIS_BANTUAN[k] || {}).label || k, transaksi: baris.length,
        nominal: baris.reduce((a, d) => a + (Number(d.jumlah) || 0), 0) };
    }).filter((r) => r.transaksi > 0).sort((a, b) => b.nominal - a.nominal);

    /* rekap ziswaf per jenis (+ penyalurannya) */
    const perJenisZiswaf = Object.keys(SB.ZISWAF_JENIS || {}).map((k) => {
      const masuk = ziswaf.filter((z) => z.jenis === k);
      const salur = salurZiswaf.filter((x) => x.jenis === k);
      return { key: k, label: (SB.ZISWAF_JENIS[k] || {}).label || k,
        transaksi: masuk.length, nominal: masuk.reduce((a, z) => a + (Number(z.jumlah) || 0), 0),
        nominalSalur: salur.reduce((a, x) => a + (Number(x.nominal) || 0), 0) };
    }).filter((r) => r.transaksi > 0 || r.nominalSalur > 0);

    /* baris penyaluran gabungan (bantuan program + ziswaf) untuk PDF/Excel */
    const barisPenyaluran = penyaluran.map((x) => {
      const req = reqMap[x.requestId];
      const kode = x.kode || x.code || (req ? req.code : "-");
      const judulReq = req ? req.judul : (x.judul || "");
      return {
        tanggal: x.tanggal || x.distributed_at || "",
        label: sani(kode) + (judulReq ? " - " + sani(judulReq).slice(0, 38) : ""),
        tujuan: sani(x.penerima || x.mustahik || "-"),
        bentuk: ((SB.JENIS_BANTUAN || {})[x.jenis || x.type] || {}).label || x.jenis || x.type || "-",
        catatan: sani(x.catatan || x.note || ""),
        nominal: Number(x.jumlah || x.amount) || 0
      };
    }).concat(salurZiswaf.map((x) => {
      const zj = (SB.ZISWAF_JENIS || {})[x.jenis] || {};
      const mu = (SB.ZISWAF_MUSTAHIK || {})[x.mustahik] || {};
      return {
        tanggal: x.tanggal || x.distributed_at || x.created_at || "",
        label: sani("ZISWAF " + (x.kode || "") + " - " + (zj.label || x.jenis || "")).trim(),
        tujuan: sani((mu.label || x.mustahik || "-") + (x.penerima ? " - " + x.penerima : "") +
          (x.jumlahPenerima ? " (" + x.jumlahPenerima + " org)" : "")),
        bentuk: sani(x.bentuk || "Uang"),
        catatan: sani(x.catatan || ""),
        nominal: Number(x.nominal) || 0
      };
    })).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));

    const barisDonasi = donasi.slice().sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).map((d) => ({
      tanggal: d.tanggal || "", kuitansi: d.kuitansi || "-", donatur: sani(d.donorNama || "-"),
      jenis: jn(d), status: d.status === "terkonfirmasi" ? "Terkonfirmasi" : d.status,
      nominal: Number(d.jumlah) || 0
    }));
    const barisZiswaf = ziswaf.slice().sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).map((z) => ({
      tanggal: z.tanggal || "", kode: z.kode || "-", pemberi: sani(z.donorNama || "-"),
      jenis: ((SB.ZISWAF_JENIS || {})[z.jenis] || {}).label || z.jenis,
      program: sani(z.program || "-"), nominal: Number(z.jumlah) || 0
    }));
    const barisPengajuan = pengajuan.slice().sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).map((r) => ({
      tanggal: r.tanggal || "", code: r.code || "-", judul: sani(r.judul || ""),
      kategori: ((SB.KATEGORI || {})[r.kategori] || {}).label || r.kategori || "-",
      kota: sani(r.kota || "-"),
      status: ((SB.STATUS || {})[r.status] || {}).label || r.status || "-"
    }));

    return {
      bulan, bulanLabel: labelBulan(bulan),
      donasiSemua, donasi, donasiMenunggu, donasiDitolak, donasiNominal,
      ziswaf, ziswafMenunggu, ziswafDitolak, ziswafNominal,
      salurZiswaf, salurZiswafNominal, penyaluran, penyaluranNominal, pengajuan,
      perJenisDonasi, perJenisZiswaf,
      barisDonasi, barisZiswaf, barisPenyaluran, barisPengajuan
    };
  };

  /* ============================================================
     PEMBUAT PDF (penulis sendiri, tanpa pustaka luar)
     ============================================================ */
  const W = 595.28, H = 841.89, M = 40;
  const KOP_TINGGI = 96, KOP_SELIMUT = 34;
  const F_REG = 1, F_BOLD = 2, F_MIRING = 3;

  /* lebar karakter Helvetica (1/1000 em), kode 32..126 */
  const LEBAR_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const LEBAR_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,469,333,556,584];

  function lebarTeks(str, size, font) {
    const t = sani(str), tbl = font === F_BOLD ? LEBAR_BOLD : LEBAR_REG;
    let l = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t.charCodeAt(i);
      l += (c >= 32 && c <= 126) ? tbl[c - 32] : 556;
    }
    return l * size / 1000;
  }
  function escPdf(s) { return sani(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
  function f2(n) { return (Math.round(n * 100) / 100).toString(); }

  function potong(str, maxW, size, font) {
    let t = sani(str);
    if (lebarTeks(t, size, font) <= maxW) return t;
    while (t.length > 1 && lebarTeks(t + "...", size, font) > maxW) t = t.slice(0, -1);
    return t + "...";
  }

  function buatPdf(ag, ident, logo) {
    const tema = warnaRg(ident && ident.warna, "16a34a");
    const temaTua = (ident && ident.warna && /^#?[0-9a-f]{6}$/i.test(ident.warna))
      ? gelapkan(ident.warna, 0.38, "14532d") : warnaRg("", "14532d");
    const HITAM = "0.13 0.16 0.20", ABU = "0.42 0.46 0.51", GARIS = "0.89 0.91 0.94";
    const ZEBRA = "0.945 0.973 0.957";
    const T = W - M * 2; /* lebar konten 515.28 */

    const halaman = [];
    let ops = [], y = 0, adaKopSelimut = false;

    function halamanBaru() {
      if (ops.length) halaman.push(ops);
      ops = [];
      if (halaman.length === 0) {
        /* ---- kop surat besar (halaman 1) ---- */
        ops.push("q " + tema + " rg 0 " + f2(H - KOP_TINGGI) + " " + f2(W) + " " + KOP_TINGGI + " re f Q\n");
        let tx = M;
        if (logo) {
          ops.push("q 52 0 0 52 " + f2(M) + " " + f2(H - KOP_TINGGI + 22) + " cm /Im1 Do Q\n");
          tx = M + 64;
        }
        ops.push(teks((ident && ident.nama) || "Saling Bantu", tx, H - 40, 16, F_BOLD, "1 1 1"));
        ops.push(teks((ident && ident.yayasan) || "", tx, H - 53, 8.5, F_REG, "0.92 0.98 0.93"));
        ops.push(teks((ident && ident.tagline) || "", tx, H - 65, 8.5, F_MIRING, "0.90 0.96 0.91"));
        ops.push(teks("LAPORAN BULANAN", W - M, H - 40, 13, F_BOLD, "1 1 1", "kanan"));
        ops.push(teks("Periode: " + ag.bulanLabel, W - M, H - 54, 10, F_REG, "0.92 0.98 0.93", "kanan"));
        ops.push(teks("Dokumen dikeluarkan otomatis oleh sistem", W - M, H - 67, 7.5, F_MIRING, "0.90 0.96 0.91", "kanan"));
        y = H - KOP_TINGGI - 16;
        ops.push(teks("Dibuat oleh: " + ((ident && ident.oleh) || "-") + "   |   Dicetak: " + ((ident && ident.stempel) || stempelWaktu()), M, y, 8, F_REG, ABU, "kiri", T));
        y -= 20;
        adaKopSelimut = false;
      } else {
        /* ---- kop selimut (halaman lanjutan) ---- */
        ops.push("q " + tema + " rg 0 " + f2(H - KOP_SELIMUT) + " " + f2(W) + " " + KOP_SELIMUT + " re f Q\n");
        ops.push(teks(((ident && ident.nama) || "Saling Bantu") + " - Laporan Bulanan " + ag.bulanLabel, M, H - 22, 9, F_BOLD, "1 1 1"));
        ops.push(teks((ident && ident.yayasan) || "", W - M, H - 22, 8, F_REG, "0.92 0.98 0.93", "kanan"));
        y = H - KOP_SELIMUT - 20;
        adaKopSelimut = true;
      }
    }

    function teks(str, x, yy, size, font, warna, align, maxW) {
      let t = sani(str);
      if (maxW) t = potong(t, maxW, size, font);
      let tx = x;
      const lw = lebarTeks(t, size, font);
      if (align === "kanan") tx = x - lw;
      else if (align === "tengah") tx = x - lw / 2;
      return "BT /F" + font + " " + size + " Tf " + warna + " rg " + f2(tx) + " " + f2(yy) + " Td (" + escPdf(t) + ") Tj ET\n";
    }
    function isiKotak(x, yy, w, h, warna) {
      return "q " + warna + " rg " + f2(x) + " " + f2(yy) + " " + f2(w) + " " + f2(h) + " re f Q\n";
    }
    function bingkai(x, yy, w, h, warna) {
      return "q " + warna + " RG 0.7 w " + f2(x) + " " + f2(yy) + " " + f2(w) + " " + f2(h) + " re S Q\n";
    }
    function garisDatar(x, yy, w, warna) {
      return "q " + warna + " RG 0.7 w " + f2(x) + " " + f2(yy) + " m " + f2(x + w) + " " + f2(yy) + " l S Q\n";
    }

    function judulBagian(jdl, sub) {
      if (y < M + 120) halamanBaru();
      ops.push(teks(sani(jdl), M, y - 11, 11.5, F_BOLD, temaTua));
      if (sub) ops.push(teks(sani(sub), M, y - 21, 7.8, F_REG, ABU, "kiri", T));
      y -= sub ? 30 : 22;
    }

    function tabel(cols, rows, total) {
      const lebarT = cols.reduce((a, c) => a + c.w, 0);
      /* ulangi kepala tabel bila pindah halaman */
      function kepala() {
        ops.push(isiKotak(M, y - 15, lebarT, 15, tema));
        let x = M;
        cols.forEach((c) => {
          ops.push(teks(c.l, c.num ? x + c.w - 5 : x + 5, y - 10.5, 8, F_BOLD, "1 1 1", c.num ? "kanan" : "kiri", c.w - 8));
          x += c.w;
        });
        y -= 15;
      }
      if (y < M + 100) halamanBaru();
      kepala();
      rows.forEach((r, ri) => {
        if (y - 15 < M + 46) { halamanBaru(); kepala(); }
        if (ri % 2 === 1) ops.push(isiKotak(M, y - 15, lebarT, 15, ZEBRA));
        let x = M;
        cols.forEach((c, ci) => {
          const v = r[ci];
          ops.push(teks(v == null ? "-" : String(v), c.num ? x + c.w - 5 : x + 5, y - 10.5, 8.5, F_REG, HITAM, c.num ? "kanan" : "kiri", c.w - 8));
          x += c.w;
        });
        ops.push(garisDatar(M, y - 15, lebarT, GARIS));
        y -= 15;
      });
      if (total) {
        if (y - 17 < M + 46) { halamanBaru(); kepala(); }
        ops.push(isiKotak(M, y - 17, lebarT, 17, "0.902 0.949 0.914"));
        let x = M;
        cols.forEach((c, ci) => {
          const v = total[ci];
          ops.push(teks(v == null ? "" : String(v), c.num ? x + c.w - 5 : x + 5, y - 11.8, 8.5, F_BOLD, temaTua, c.num ? "kanan" : "kiri", c.w - 8));
          x += c.w;
        });
        ops.push(bingkai(M, y - 17, lebarT, 17, GARIS));
        y -= 17;
      }
      y -= 14;
    }

    function kotakKpi(x, yy, w, h, nilai, label) {
      ops.push(isiKotak(x, yy, w, h, "0.965 0.980 0.970"));
      ops.push(bingkai(x, yy, w, h, GARIS));
      ops.push(isiKotak(x, yy, 3, h, tema));
      ops.push(teks(potong(nilai, w - 18, 12.5, F_BOLD), x + 9, yy + h - 19, 12.5, F_BOLD, temaTua));
      ops.push(teks(potong(label, w - 18, 7.5, F_REG), x + 9, yy + 8, 7.5, F_REG, ABU));
    }

    /* ================= SUSUN ISI LAPORAN ================= */
    halamanBaru();

    /* --- 1. ringkasan kotak KPI --- */
    judulBagian("Ringkasan Bulan " + ag.bulanLabel, "Seluruh angka dihitung dari data yang telah diverifikasi admin pada periode berjalan.");
    const kw = (T - 24) / 3, kh = 50;
    kotakKpi(M, y - kh, kw, kh, rupiah(ag.donasiNominal), "Donasi terkonfirmasi");
    kotakKpi(M + kw + 12, y - kh, kw, kh, String(ag.donasi.length) + " transaksi", "Donasi diterima (terkonfirmasi)");
    kotakKpi(M + (kw + 12) * 2, y - kh, kw, kh, rupiah(ag.ziswafNominal), "ZISWAF masuk (terverifikasi)");
    y -= kh + 10;
    kotakKpi(M, y - kh, kw, kh, rupiah(ag.salurZiswafNominal), "ZISWAF disalurkan");
    kotakKpi(M + kw + 12, y - kh, kw, kh, rupiah(ag.penyaluranNominal), "Bantuan program disalurkan");
    kotakKpi(M + (kw + 12) * 2, y - kh, kw, kh, String(ag.pengajuan.length) + " pengajuan", "Pengajuan bantuan baru");
    y -= kh + 6;
    ops.push(teks("Catatan: " + ag.donasiMenunggu + " donasi & " + ag.ziswafMenunggu +
      " ZISWAF masih menunggu verifikasi; " + ag.donasiDitolak + " donasi & " + ag.ziswafDitolak +
      " ZISWAF ditolak pada periode ini (tidak dihitung ke dalam nominal).", M, y, 7.8, F_MIRING, ABU, "kiri", T));
    y -= 16;

    /* --- 2. rekap donasi per jenis --- */
    if (ag.perJenisDonasi.length) {
      judulBagian("Rekap Donasi per Jenis Bantuan");
      const cols = [{ l: "Jenis Bantuan", w: 225 }, { l: "Transaksi", w: 90, num: false }, { l: "Nominal (Rp)", w: 200, num: true }];
      tabel(cols, ag.perJenisDonasi.map((r) => [r.label, grupAngka(r.transaksi), grupAngka(r.nominal)]),
        ["TOTAL", grupAngka(ag.donasi.length), grupAngka(ag.donasiNominal)]);
    }

    /* --- 3. rekap ZISWAF per jenis --- */
    if (ag.perJenisZiswaf.length) {
      judulBagian("Rekap ZISWAF per Jenis (Zakat, Infaq, Sedekah, Wakaf)");
      const cols = [{ l: "Jenis ZISWAF", w: 165 }, { l: "Transaksi", w: 80 }, { l: "Masuk (Rp)", w: 130, num: true }, { l: "Disalurkan (Rp)", w: 140, num: true }];
      tabel(cols, ag.perJenisZiswaf.map((r) => [r.label, grupAngka(r.transaksi), grupAngka(r.nominal), grupAngka(r.nominalSalur)]),
        ["TOTAL", grupAngka(ag.ziswaf.length), grupAngka(ag.ziswafNominal), grupAngka(ag.salurZiswafNominal)]);
    }

    /* --- 4. rincian donasi --- */
    if (ag.barisDonasi.length) {
      judulBagian("Rincian Donasi Terkonfirmasi", ag.barisDonasi.length + " transaksi donasi pada periode " + ag.bulanLabel + ".");
      const cols = [
        { l: "Tanggal", w: 60 }, { l: "Kuitansi", w: 100 }, { l: "Donatur", w: 132 },
        { l: "Jenis", w: 70 }, { l: "Status", w: 68 }, { l: "Nominal (Rp)", w: 85, num: true }];
      tabel(cols, ag.barisDonasi.map((d) => [fmtTanggal(d.tanggal), d.kuitansi, d.donatur, d.jenis, d.status, grupAngka(d.nominal)]),
        ["TOTAL", "", "", "", "", grupAngka(ag.donasiNominal)]);
    }

    /* --- 5. rincian ZISWAF masuk --- */
    if (ag.barisZiswaf.length) {
      judulBagian("Rincian ZISWAF Masuk (Terverifikasi)", ag.barisZiswaf.length + " transaksi ZISWAF pada periode " + ag.bulanLabel + ".");
      const cols = [
        { l: "Tanggal", w: 62 }, { l: "Kode", w: 88 }, { l: "Pemberi", w: 140 },
        { l: "Jenis", w: 62 }, { l: "Program", w: 88 }, { l: "Nominal (Rp)", w: 75, num: true }];
      tabel(cols, ag.barisZiswaf.map((z) => [fmtTanggal(z.tanggal), z.kode, z.pemberi, z.jenis, z.program, grupAngka(z.nominal)]),
        ["TOTAL", "", "", "", "", grupAngka(ag.ziswafNominal)]);
    }

    /* --- 6. penyaluran (bantuan + ziswaf) --- */
    if (ag.barisPenyaluran.length) {
      judulBagian("Penyaluran Bulan Ini (Bantuan Program & ZISWAF)", ag.barisPenyaluran.length + " penyaluran tercatat dengan total " + rupiah(ag.salurZiswafNominal + ag.penyaluranNominal) + ".");
      const cols = [
        { l: "Tanggal", w: 58 }, { l: "Kode / Proyek", w: 118 }, { l: "Tujuan / Mustahik", w: 128 },
        { l: "Bentuk", w: 56 }, { l: "Catatan", w: 90 }, { l: "Nominal (Rp)", w: 65, num: true }];
      tabel(cols, ag.barisPenyaluran.map((b) => [fmtTanggal(b.tanggal), b.label, b.tujuan, b.bentuk, b.catatan, grupAngka(b.nominal)]),
        ["TOTAL", "", "", "", "", grupAngka(ag.salurZiswafNominal + ag.penyaluranNominal)]);
    }

    /* --- 7. pengajuan baru --- */
    if (ag.barisPengajuan.length) {
      judulBagian("Pengajuan Bantuan Baru", "Pengajuan yang masuk pada periode " + ag.bulanLabel + " (semua status).");
      const cols = [
        { l: "Tanggal", w: 58 }, { l: "Kode", w: 78 }, { l: "Judul Pengajuan", w: 170 },
        { l: "Kategori", w: 70 }, { l: "Kota", w: 58 }, { l: "Status", w: 81 }];
      tabel(cols, ag.barisPengajuan.map((r) => [fmtTanggal(r.tanggal), r.code, r.judul, r.kategori, r.kota, r.status]));
    }

    halaman.push(ops);

    /* ---- footer setiap halaman ---- */
    const jumlahHal = halaman.length;
    const barisIdent = sani([
      (ident && ident.yayasan) || "", (ident && ident.alamat) || "",
      (ident && ident.email) ? "Email: " + ident.email : "", (ident && ident.wa) ? "WA: " + ident.wa : "",
      (ident && ident.website) || ""
    ].filter(Boolean).join("  |  "));
    halaman.forEach((opsHal, i) => {
      opsHal.push(garisDatar(M, 42, T, GARIS));
      opsHal.push(teks(barisIdent || ((ident && ident.nama) || "Saling Bantu"), M, 32, 7, F_REG, ABU, "kiri", T - 100));
      opsHal.push(teks("Halaman " + (i + 1) + " dari " + jumlahHal, W - M, 32, 7, F_BOLD, ABU, "kanan"));
      opsHal.push(teks("Dokumen dihasilkan otomatis oleh " + ((ident && ident.nama) || "Saling Bantu") +
        " - setiap angka berasal dari data yang tersimpan pada " + ((ident && ident.sumber) || "sistem") + ".", M, 22, 6.5, F_MIRING, ABU, "kiri", T));
    });

    /* ================= RAKIT FILE PDF ================= */
    const strBytes = (s) => {
      const u8 = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i) & 0xff;
      return u8;
    };
    const isiHalaman = halaman.map((opsHal) => opsHal.join(""));
    const objek = [];
    const kids = [];
    let nomor = 6;
    let numLogo = 0;
    if (logo && logo.bytes && logo.bytes.length) numLogo = nomor++;
    const isiPerHal = [];
    isiHalaman.forEach((str) => {
      const p = nomor++, c = nomor++;
      kids.push(p);
      const isiStr = str;
      const res = "<< /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>" +
        (numLogo ? " /XObject << /Im1 " + numLogo + " 0 R >>" : "") + " >>";
      objek.push({ isi: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources " + res + " /Contents " + c + " 0 R >>" });
      objek.push({ isi: "<< /Length " + (isiStr.length + 1) + " >>\nstream\n" + isiStr + "\nendstream" });
    });
    /* objek 1..5 (katalog, halaman, font) + gambar ditambah di depan daftar */
    const depan = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [" + kids.map((k) => k + " 0 R").join(" ") + "] /Count " + kids.length + " >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"
    ];
    const objekFinal = depan.map((isi) => ({ isi: isi }));
    if (numLogo) {
      objekFinal.push({
        isi: "<< /Type /XObject /Subtype /Image /Width " + logo.w + " /Height " + logo.h +
          " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + logo.bytes.length + " >>",
        stream: logo.bytes
      });
    }
    objekFinal.push.apply(objekFinal, objek);

    const potongan = [];
    let offset = 0;
    function tulis(v) {
      const u8 = typeof v === "string" ? strBytes(v) : v;
      potongan.push(u8); offset += u8.length;
    }
    tulis("%PDF-1.4\n");
    const ofsetObj = [];
    objekFinal.forEach((o) => {
      ofsetObj.push(offset);
      tulis((ofsetObj.length) + " 0 obj\n" + o.isi + "\n");
      if (o.stream) { tulis("stream\n"); tulis(o.stream); tulis("\nendstream\n"); }
      tulis("endobj\n");
    });
    const xrefMulai = offset;
    let xref = "xref\n0 " + (objekFinal.length + 1) + "\n0000000000 65535 f \n";
    ofsetObj.forEach((o) => {
      let s = String(o);
      while (s.length < 10) s = "0" + s;
      xref += s + " 00000 n \n";
    });
    tulis(xref);
    tulis("trailer\n<< /Size " + (objekFinal.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefMulai + "\n%%EOF");

    const total = offset;
    const keluar = new Uint8Array(total);
    let pos = 0;
    potongan.forEach((u8) => { keluar.set(u8, pos); pos += u8.length; });
    return { bytes: keluar, halaman: jumlahHal };
  }
  SB.laporan.buatPdf = buatPdf;

  /* ---------- LOGO → JPEG (browser, lewat canvas) ---------- */
  function dataUrlKeBytes(dataUrl) {
    const base = String(dataUrl).slice(String(dataUrl).indexOf(",") + 1);
    const bin = atob(base);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 0xff;
    return u8;
  }

  SB.laporan.logoJpeg = function (dataUrl) {
    if (!dataUrl) return Promise.resolve(null);
    if (typeof Image === "undefined" || typeof document === "undefined") return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const s = 160;
          const cv = document.createElement("canvas");
          cv.width = s; cv.height = s;
          const g = cv.getContext("2d");
          g.fillStyle = "#ffffff"; g.fillRect(0, 0, s, s);
          const skala = Math.min(s / (img.width || s), s / (img.height || s));
          const w = Math.max(1, Math.round((img.width || s) * skala)), h = Math.max(1, Math.round((img.height || s) * skala));
          g.drawImage(img, Math.round((s - w) / 2), Math.round((s - h) / 2), w, h);
          const jpeg = cv.toDataURL("image/jpeg", 0.9);
          resolve({ bytes: dataUrlKeBytes(jpeg), w: s, h: s });
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  };

  /* ---------- kompres logo saat diunggah (browser) ---------- */
  SB.laporan.kompresGambar = function (file, maks) {
    maks = maks || 320;
    if (typeof Image === "undefined" || typeof document === "undefined") {
      return Promise.reject(new Error("Unggah gambar hanya tersedia di browser."));
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const skala = Math.min(1, maks / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round((img.width || maks) * skala)), h = Math.max(1, Math.round((img.height || maks) * skala));
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          const g = cv.getContext("2d");
          const png = /png/i.test(file.type || "");
          if (!png) { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); }
          g.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(cv.toDataURL(png ? "image/png" : "image/jpeg", 0.88));
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak dapat dibaca. Gunakan PNG/JPG.")); };
      img.src = url;
    });
  };

  /* ============================================================
     PEMBUAT EXCEL .xlsx ASLI (ZIP + Office Open XML, tanpa pustaka)
     ============================================================ */
  const CRC_TABEL = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_TABEL[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function utf8(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
    /* fallback latin1 — konten XML aplikasi ini ASCII murni */
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i) & 0xff;
    return u8;
  }
  function zipkan(entries) {
    const potongan = [];
    const pusat = [];
    let offset = 0;
    function u16(v) { return new Uint8Array([v & 0xff, (v >>> 8) & 0xff]); }
    function u32(v) { return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]); }
    const d = new Date();
    const waktu = ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xffff;
    const tanggal = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    entries.forEach((e) => {
      const nama = utf8(e.nama), data = e.data, crc = crc32(data);
      pusat.push({ nama, crc, size: data.length, offset });
      potongan.push(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
      potongan.push(u16(20), u16(0), u16(0), u16(waktu), u16(tanggal), u32(crc), u32(data.length), u32(data.length), u16(nama.length), u16(0));
      potongan.push(nama, data);
      offset += 30 + nama.length + data.length;
    });
    const mulaiPusat = offset;
    let sizePusat = 0;
    pusat.forEach((p) => {
      potongan.push(new Uint8Array([0x50, 0x4b, 0x01, 0x02]));
      potongan.push(u16(20), u16(20), u16(0), u16(0), u16(waktu), u16(tanggal), u32(p.crc), u32(p.size), u32(p.size), u16(p.nama.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(p.offset));
      potongan.push(p.nama);
      sizePusat += 46 + p.nama.length;
    });
    potongan.push(new Uint8Array([0x50, 0x4b, 0x05, 0x06]));
    potongan.push(u16(0), u16(0), u16(pusat.length), u16(pusat.length), u32(sizePusat), u32(mulaiPusat), u16(0));
    const total = potongan.reduce((a, p) => a + p.length, 0);
    const keluar = new Uint8Array(total);
    let pos = 0;
    potongan.forEach((p) => { keluar.set(p, pos); pos += p.length; });
    return keluar;
  }

  function refKolom(i) { /* 0->A, 26->AA */
    let s = "";
    i += 1;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  function xmlEsc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  }

  function sheetXml(sheet) {
    const kolom = sheet.kolom || [];
    const baris = sheet.baris || [];
    const jumKol = Math.max(1, kolom.length);
    const jumBaris = baris.length + (sheet.barisTotal ? 1 : 0) + 2;
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:' + refKolom(jumKol - 1) + jumBaris + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>';
    kolom.forEach((c, i) => {
      x += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (Number(c.w) || 16) + '" customWidth="1"/>';
    });
    x += '</cols><sheetData>';
    /* baris 1: judul; baris 2: kepala kolom; baris 3+: data */
    x += '<row r="1"><c r="A1" s="2" t="inlineStr"><is><t>' + xmlEsc(sheet.judul || sheet.nama || "Laporan") + '</t></is></c></row>';
    x += '<row r="2">';
    kolom.forEach((c, i) => {
      x += '<c r="' + refKolom(i) + '2" s="1" t="inlineStr"><is><t>' + xmlEsc(c.l) + '</t></is></c>';
    });
    x += '</row>';
    baris.forEach((b, bi) => {
      x += '<row r="' + (bi + 3) + '">';
      kolom.forEach((c, ci) => {
        const v = b[ci];
        const ref = refKolom(ci) + (bi + 3);
        if (c.num && typeof v === "number" && isFinite(v)) {
          x += '<c r="' + ref + '" s="3"><v>' + v + '</v></c>';
        } else {
          x += '<c r="' + ref + '" t="inlineStr"><is><t>' + xmlEsc(v == null ? "" : v) + '</t></is></c>';
        }
      });
      x += '</row>';
    });
    if (sheet.barisTotal) {
      const ri = baris.length + 3;
      x += '<row r="' + ri + '">';
      kolom.forEach((c, ci) => {
        const v = sheet.barisTotal[ci];
        const ref = refKolom(ci) + ri;
        if (c.num && typeof v === "number" && isFinite(v)) {
          x += '<c r="' + ref + '" s="5"><v>' + v + '</v></c>';
        } else {
          x += '<c r="' + ref + '" s="4" t="inlineStr"><is><t>' + xmlEsc(v == null ? "" : v) + '</t></is></c>';
        }
      });
      x += '</row>';
    }
    x += '</sheetData></worksheet>';
    return x;
  }

  function buatXlsx(sheets) {
    sheets = (sheets || []).filter((s) => s && s.kolom && s.kolom.length);
    if (!sheets.length) throw new Error("Tidak ada data untuk diekspor.");
    const namaSheet = sheets.map((s, i) => {
      let n = String(s.nama || "Sheet" + (i + 1)).replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 31);
      return n || "Sheet" + (i + 1);
    });
    const kini = new Date().toISOString().slice(0, 19) + "Z";
    let ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
    sheets.forEach((s, i) => {
      ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    });
    ct += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';

    const relsRoot = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';

    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:creator>Saling Bantu</dc:creator><cp:lastModifiedBy>Saling Bantu</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + kini + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + kini + '</dcterms:modified></cp:coreProperties>';

    let wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    namaSheet.forEach((n, i) => { wb += '<sheet name="' + xmlEsc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; });
    wb += '</sheets></workbook>';

    let wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    sheets.forEach((s, i) => {
      wbRels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    });
    wbRels += '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="12"/><color rgb="FF14532D"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF16A34A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="6">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="3" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

    const entries = [
      { nama: "[Content_Types].xml", data: utf8(ct) },
      { nama: "_rels/.rels", data: utf8(relsRoot) },
      { nama: "docProps/core.xml", data: utf8(core) },
      { nama: "xl/workbook.xml", data: utf8(wb) },
      { nama: "xl/_rels/workbook.xml.rels", data: utf8(wbRels) },
      { nama: "xl/styles.xml", data: utf8(styles) }
    ];
    sheets.forEach((s, i) => {
      entries.push({ nama: "xl/worksheets/sheet" + (i + 1) + ".xml", data: utf8(sheetXml(s)) });
    });
    return zipkan(entries);
  }
  SB.laporan.xlsxBytes = buatXlsx;

  /* ---------- unduhan (browser) ---------- */
  SB.laporan.unduh = function (data, nama, mime) {
    if (typeof document === "undefined") throw new Error("Unduhan hanya tersedia di browser.");
    const blob = (typeof Blob !== "undefined" && data instanceof Blob) ? data
      : new Blob([data], { type: mime || "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) { /* abaikan */ } }, 4000);
  };

  SB.laporan.rupiah = rupiah;
  SB.laporan.labelBulan = labelBulan;
  SB.laporan.fmtTanggal = fmtTanggal;
  SB.laporan.stempelWaktu = stempelWaktu;
  SB.laporan.sani = sani;

  /* Ekspor Excel ke perangkat: SB.eksporExcel([{nama, judul, kolom:[{l,w,num}], baris:[[..]], barisTotal:[..]}], "nama-file.xlsx") */
  SB.eksporExcel = function (sheets, namaFile) {
    const bytes = buatXlsx(sheets);
    SB.laporan.unduh(bytes, namaFile || "ekspor-saling-bantu.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return bytes.length;
  };
})();
