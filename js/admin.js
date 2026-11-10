/* ============================================================
   SALING BANTU — admin.js
   6 modul: Statistik (grafik), Pengguna, Pengajuan (alur 8
   status), Donasi (verifikasi & penyaluran), Konten, Laporan
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const mainEl = () => document.getElementById("dash-main");

  const MENU = [
    { id: "statistik", label: "Statistik", icon: "chart" },
    { id: "realtime", label: "Realtime", icon: "trending" },
    { id: "pengguna", label: "Manajemen Pengguna", icon: "users" },
    { id: "pengajuan", label: "Manajemen Pengajuan", icon: "file" },
    { id: "donasi", label: "Manajemen Donasi", icon: "credit" },
    { id: "ziswaf", label: "Modul ZISWAF", icon: "gift" },
    { id: "konten", label: "Manajemen Konten", icon: "megaphone" },
    { id: "isi", label: "Isi Website", icon: "book" },
    { id: "laporan", label: "Laporan", icon: "clipboard" },
    { id: "pengaturan", label: "Pengaturan", icon: "settings" }
  ];

  const BOLEH_KELOLA = ["admin", "pengelola"];

  let user = null;
  let cache = { users: [], requests: [], donations: [], stories: [], ziswaf: [], ziswafSalur: [] };
  let bulanLaporan = null; /* bulan terpilih pada panel Laporan (bertahan saat re-render) */

  function head(judul, sub, tombolHtml) {
    return '<div class="dash-head"><div><h2>' + judul + "</h2><p>" + sub + "</p></div>" + (tombolHtml || "") + "</div>";
  }

  function kpi(ic, warna, nilai, label) {
    return '<div class="kpi"><span class="kpi-ic" style="background:' + warna + ';display:grid">' + S.icon(ic, 18) + "</span><b>" + nilai + "</b><span>" + label + "</span></div>";
  }

  /* ================= EKSPOR EXCEL & LAPORAN PDF BULANAN =================
     Memakai js/laporan.js (pembuat PDF & .xlsx murni JS, tanpa CDN). */
  function petaProyek(reqs) {
    const m = {};
    (reqs || []).forEach((r) => { m[r.id] = r; });
    return m;
  }

  function identitasLaporan() {
    return {
      nama: SB.teks("app_nama"), yayasan: SB.teks("app_yayasan"),
      tagline: SB.teks("app_tagline"), alamat: SB.teks("app_alamat"),
      email: SB.teks("email_kontak"), wa: SB.teks("wa_kontak"),
      website: SB.teks("app_website"), warna: SB.teks("app_warna"),
      oleh: user ? user.nama : "-", stempel: SB.laporan ? SB.laporan.stempelWaktu() : "",
      sumber: S.MODE === "supabase" ? "database Supabase (data realtime)" : "Mode Demo (data contoh di browser)"
    };
  }

  function eksporDonasiExcel(dons, reqMap, bulan) {
    const dalam = (d) => !bulan || String(d.tanggal || "").slice(0, 7) === bulan;
    const dipilih = (dons || []).filter(dalam);
    const baris = dipilih.map((d) => {
      const r = d.requestId ? reqMap[d.requestId] : null;
      return [
        String(d.tanggal || "").slice(0, 10),
        d.kuitansi || "-",
        d.donorNama || "-",
        d.donorWa || (d.tamu ? "-" : ""),
        ((S.JENIS_BANTUAN[d.jenis] || {}).label) || d.jenis,
        r ? (r.code + " — " + r.judul) : (d.requestId ? "-" : "Donasi Umum"),
        d.jenis === "finansial" ? (Number(d.jumlah) || 0) : 0,
        d.barang || (d.pesan || ""),
        d.status
      ];
    });
    const total = dipilih.reduce((a, d) => a + (d.jenis === "finansial" ? (Number(d.jumlah) || 0) : 0), 0);
    const sheets = [{
      nama: "Donasi",
      judul: "Ekspor Donasi Saling Bantu" + (bulan ? " — Periode " + SB.laporan.labelBulan(bulan) : " — Semua Data"),
      kolom: [{ l: "Tanggal", w: 12 }, { l: "Kuitansi", w: 24 }, { l: "Donatur", w: 24 }, { l: "No. WA", w: 18 }, { l: "Jenis", w: 12 }, { l: "Program / Pengajuan", w: 46 }, { l: "Nominal (Rp)", w: 14, num: true }, { l: "Rincian / Pesan", w: 34 }, { l: "Status", w: 20 }],
      baris, barisTotal: ["TOTAL", "", "", "", "", "", total, "", ""]
    }];
    const namaFile = "donasi-saling-bantu" + (bulan ? "-" + bulan : "") + ".xlsx";
    SB.eksporExcel(sheets, namaFile);
    S.toast("Excel donasi (" + dipilih.length + " baris) diunduh: " + namaFile, "sukses");
  }

  function eksporZiswafExcel(zis, salur, bulan) {
    const dalam = (z) => !bulan || String(z.tanggal || "").slice(0, 7) === bulan;
    const dipilih = (zis || []).filter(dalam);
    const baris = dipilih.map((z) => [
      String(z.tanggal || "").slice(0, 10), z.kode || "-", z.donorNama || "-",
      ((S.ZISWAF_KELOMPOK[z.kelompok] || {}).label) || z.kelompok || "-",
      z.kelas || "-",
      ((S.ZISWAF_JENIS[z.jenis] || {}).label) || z.jenis,
      z.program || "-",
      z.bentuk === "barang" ? ("Barang: " + (z.barangDetail || "-")) : "Uang",
      Number(z.jumlah) || 0,
      S.ZISWAF_METODE[z.metode] || z.metode || "-",
      ((S.ZISWAF_STATUS[z.status] || {}).label) || z.status
    ]);
    const total = dipilih.reduce((a, z) => a + (Number(z.jumlah) || 0), 0);
    const salurDalam = (x) => !bulan || String(x.tanggal || x.distributed_at || x.created_at || "").slice(0, 7) === bulan;
    const salurDipilih = (salur || []).filter(salurDalam);
    const salurBaris = salurDipilih.map((x) => [
      String(x.tanggal || x.distributed_at || x.created_at || "").slice(0, 10), x.kode || "-",
      ((S.ZISWAF_MUSTAHIK[x.mustahik] || {}).label) || x.mustahik || "-",
      x.penerima || "-",
      Number(x.jumlahPenerima) || 0,
      x.bentuk || "Uang",
      Number(x.nominal) || 0,
      x.catatan || ""
    ]);
    const totalSalur = salurDipilih.reduce((a, x) => a + (Number(x.nominal) || 0), 0);
    const periode = bulan ? " — Periode " + SB.laporan.labelBulan(bulan) : " — Semua Data";
    const sheets = [
      {
        nama: "Penerimaan ZISWAF", judul: "Penerimaan ZISWAF Saling Bantu" + periode,
        kolom: [{ l: "Tanggal", w: 12 }, { l: "Kode", w: 14 }, { l: "Pemberi", w: 24 }, { l: "Kelompok", w: 16 }, { l: "Kelas", w: 10 }, { l: "Jenis", w: 10 }, { l: "Program", w: 22 }, { l: "Bentuk", w: 16 }, { l: "Nominal (Rp)", w: 14, num: true }, { l: "Metode", w: 16 }, { l: "Status", w: 20 }],
        baris, barisTotal: ["TOTAL", "", "", "", "", "", "", "", total, "", ""]
      },
      {
        nama: "Penyaluran ZISWAF", judul: "Penyaluran ZISWAF Saling Bantu" + periode,
        kolom: [{ l: "Tanggal", w: 12 }, { l: "Kode", w: 14 }, { l: "Mustahik / Program", w: 28 }, { l: "Penerima", w: 26 }, { l: "Jumlah Penerima", w: 14 }, { l: "Bentuk", w: 12 }, { l: "Nominal (Rp)", w: 14, num: true }, { l: "Catatan / Bukti", w: 42 }],
        baris: salurBaris, barisTotal: ["TOTAL", "", "", "", "", "", totalSalur, ""]
      }
    ];
    const namaFile = "ziswaf-saling-bantu" + (bulan ? "-" + bulan : "") + ".xlsx";
    SB.eksporExcel(sheets, namaFile);
    S.toast("Excel ZISWAF (" + dipilih.length + " penerimaan, " + salurDipilih.length + " penyaluran) diunduh.", "sukses");
  }

  async function muatDataBulanan() {
    const [dons, zis, zsal, dists, reqs] = await Promise.all([
      S.store.listDonations({ publikOnly: false }).catch(() => []),
      S.store.listZiswaf({}).catch(() => []),
      S.store.listZiswafSalur().catch(() => []),
      S.store.listDistributions().catch(() => []),
      cache.requests.length ? Promise.resolve(cache.requests) : S.store.listRequests({}).catch(() => [])
    ]);
    cache.requests = reqs;
    return { dons, zis, zsal, dists, reqs, reqMap: petaProyek(reqs) };
  }

  async function unduhPdfBulanan(data, bulan) {
    const ag = SB.laporan.agregasi(data, bulan, data.reqMap);
    S.toast("Menyusun laporan PDF " + SB.laporan.labelBulan(bulan) + "...", "info");
    const logo = await SB.laporan.logoJpeg(SB.teks("app_logo"));
    const pdf = SB.laporan.buatPdf(ag, identitasLaporan(), logo);
    SB.laporan.unduh(pdf.bytes, "laporan-bulanan-" + bulan + ".pdf", "application/pdf");
    S.toast("Laporan PDF " + SB.laporan.labelBulan(bulan) + " (" + pdf.halaman + " halaman) diunduh.", "sukses");
  }

  /* ---------- Grafik canvas sederhana ---------- */
  function tickLabel(v) {
    return v < 4 && v > 0 && v % 1 !== 0 ? (Math.round(v * 10) / 10).toLocaleString("id-ID") : Math.round(v).toLocaleString("id-ID");
  }
  function drawBar(cv, labels, values, warna) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 600, H = 240;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const pad = { l: 44, r: 10, t: 14, b: 44 };
    const max = Math.max.apply(null, values.concat([1]));
    g.strokeStyle = "#e2e8f0"; g.fillStyle = "#94a3b8"; g.font = "10px Inter, sans-serif";
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
      g.fillText(tickLabel(max * (1 - i / 4)), 4, y + 3);
    }
    const bw = (W - pad.l - pad.r) / values.length;
    values.forEach((v, i) => {
      const h = (H - pad.t - pad.b) * (v / max);
      const x = pad.l + bw * i + bw * 0.18, y = H - pad.b - h;
      g.fillStyle = warna;
      g.beginPath();
      const r = Math.min(6, bw * 0.3);
      g.moveTo(x, H - pad.b);
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
      g.lineTo(x + bw * 0.64 - r, y); g.quadraticCurveTo(x + bw * 0.64, y, x + bw * 0.64, y + r);
      g.lineTo(x + bw * 0.64, H - pad.b); g.closePath(); g.fill();
      g.fillStyle = "#64748b"; g.font = "10.5px Inter, sans-serif"; g.textAlign = "center";
      const cx = x + bw * 0.32, maxW = bw * 0.92;
      const lab = labels[i];
      if (Array.isArray(lab)) {
        g.fillText(lab[0], cx, H - pad.b + 15);
        g.fillText(lab[1], cx, H - pad.b + 27);
      } else if (g.measureText(lab).width <= maxW) {
        g.fillText(lab, cx, H - pad.b + 16);
      } else {
        const mid = Math.ceil(lab.length / 2);
        g.fillText(lab.slice(0, mid) + "-", cx, H - pad.b + 15);
        g.fillText(lab.slice(mid), cx, H - pad.b + 27);
      }
      g.textAlign = "left";
    });
  }

  function drawLine(cv, labels, values) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 600, H = 240;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const pad = { l: 52, r: 12, t: 16, b: 30 };
    const max = Math.max.apply(null, values.concat([1]));
    const px = (i) => pad.l + (W - pad.l - pad.r) * (values.length === 1 ? 0.5 : i / (values.length - 1));
    const py = (v) => H - pad.b - (H - pad.t - pad.b) * (v / max);
    g.strokeStyle = "#e2e8f0"; g.fillStyle = "#94a3b8"; g.font = "10px Inter, sans-serif";
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
      g.fillText(tickLabel(max * (1 - i / 4)), 6, y + 3);
    }
    g.strokeStyle = "#16a34a"; g.lineWidth = 2.5; g.beginPath();
    values.forEach((v, i) => { i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v)); });
    g.stroke();
    g.fillStyle = "#16a34a";
    values.forEach((v, i) => {
      g.beginPath(); g.arc(px(i), py(v), 4, 0, 7); g.fill();
      g.fillStyle = "#64748b"; g.textAlign = "center";
      g.fillText(labels[i], px(i), H - pad.b + 16); g.textAlign = "left"; g.fillStyle = "#16a34a";
    });
  }

  /* ================= STATISTIK ================= */
  async function vStatistik() {
    const st = await S.store.adminStats();
    let html = head("Statistik Platform", "Gambaran umum aktivitas gotong royong hari ini.");
    html += '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">' +
      kpi("users", "var(--hijau)", st.totalPengguna, "Total pengguna") +
      kpi("file", "var(--biru)", st.totalPengajuan, "Total pengajuan") +
      kpi("gift", "var(--oranye)", st.totalTersalur, "Bantuan tersalur") +
      kpi("users", "var(--teal)", st.totalVolunteer, "Volunteer aktif") + "</div>";
    html += '<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">' +
      kpi("credit", "var(--hijau)", S.rupiah(st.totalDanaTerkumpul), "Dana terkumpul") +
      kpi("tool", "var(--biru)", S.rupiah(st.totalDanaTersalur), "Dana tersalurkan") +
      kpi("users", "var(--ungu)", st.totalKomunitas, "Komunitas") + "</div>";
    html += '<div class="grid grid-2">' +
      '<div class="panel"><h3>Pengajuan per Kategori</h3><div class="chart-box"><canvas class="sb-chart" id="ch-kategori"></canvas></div></div>' +
      '<div class="panel"><h3>Donasi 6 Bulan Terakhir</h3><div class="chart-box"><canvas class="sb-chart" id="ch-bulan"></canvas></div></div>' +
      "</div>";
    mainEl().innerHTML = html;
    const labelsK = Object.keys(st.perKategori).map((k) => {
      const petaSingkat = { sosial: "Sosial", kesehatan: ["Kese-", "hatan"], pendidikan: ["Pendi-", "dikan"], tenaga_jasa: ["Tenaga &", "Jasa"], barang: "Barang", usaha: "Usaha" };
      return petaSingkat[k] || (S.KATEGORI[k] || {}).label || k;
    });
    const valsK = Object.values(st.perKategori);
    drawBar(document.getElementById("ch-kategori"), labelsK, valsK, "#2563eb");
    drawLine(document.getElementById("ch-bulan"), st.perBulan.map((b) => b.label), st.perBulan.map((b) => b.donasi));

    function kpi(ic, warna, nilai, label) {
      return '<div class="kpi"><span class="kpi-ic" style="background:' + warna + ';display:grid">' + S.icon(ic, 18) + "</span><b>" + nilai + "</b><span>" + label + "</span></div>";
    }
  }

  /* ================= REALTIME (live dashboard) ================= */
  let rtStop = null;      /* pembersih langganan realtime aktif */
  let rtJumlah = 0;       /* jumlah event realtime diterima */
  let rtTerakhir = null;  /* info event terakhir */

  function hentikanRealtime() {
    if (typeof rtStop === "function") { try { rtStop(); } catch (e) { /* abaikan */ } }
    rtStop = null;
  }

  async function vRealtime() {
    const html =
      head("Dashboard Realtime", "Pantau aktivitas platform secara langsung: donasi masuk, pengajuan baru, dan aksi pengelola — tanpa perlu memuat ulang halaman.",
        '<button class="btn btn-ghost" id="rt-refresh">' + S.icon("clock", 15) + " Segarkan Sekarang</button>") +
      '<div class="panel" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
      '<span class="live-dot" id="rt-dot"></span>' +
      '<div style="flex:1;min-width:220px"><b style="font-size:14.5px">Pemantauan Langsung</b><br>' +
      '<small style="color:var(--abu)" id="rt-status">Menyiapkan koneksi realtime...</small></div>' +
      '<div style="text-align:right"><small style="color:var(--abu)">Diperbarui</small><br><b id="rt-waktu" style="font-size:13.5px">—</b></div>' +
      '<div style="text-align:right"><small style="color:var(--abu)">Event diterima</small><br><b id="rt-evt" style="font-size:13.5px">0</b></div>' +
      "</div>" +
      '<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)" id="rt-kpi1"></div>' +
      '<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)" id="rt-kpi2"></div>' +
      '<div class="grid grid-2">' +
      '<div class="panel"><h3>Aktivitas Terbaru <span class="badge st-hijau" style="margin-left:6px">LIVE</span></h3><div id="rt-feed" style="max-height:420px;overflow:auto"></div></div>' +
      '<div class="panel"><h3>Donasi 7 Hari Terakhir</h3><div class="chart-box"><canvas class="sb-chart" id="rt-chart"></canvas></div>' +
      '<div id="rt-tunggu" style="margin-top:12px"></div></div>' +
      "</div>";
    mainEl().innerHTML = html;
    document.getElementById("rt-refresh").addEventListener("click", () => segarkanLive(true));

    await segarkanLive(true);
    pasangRealtime();
  }

  function rtKpi(ic, warna, nilai, label) {
    return '<div class="kpi"><span class="kpi-ic" style="background:' + warna + ';display:grid">' + S.icon(ic, 18) + "</span><b>" + nilai + "</b><span>" + label + "</span></div>";
  }

  async function segarkanLive(manual) {
    if (!document.getElementById("rt-kpi1")) return; /* sudah pindah menu */
    try {
      const [st, dons, reqs, users, audit] = await Promise.all([
        S.store.adminStats(),
        S.store.listDonations({ publikOnly: false }).catch(() => []),
        S.store.listRequests({ publikOnly: false }).catch(() => []),
        S.store.listUsers().catch(() => []),
        S.store.listAudit().catch(() => [])
      ]);
      if (!document.getElementById("rt-kpi1")) return;

      const awalHari = new Date(); awalHari.setHours(0, 0, 0, 0);
      const dari = (iso) => iso && new Date(iso).getTime() >= awalHari.getTime();
      const donHariIni = dons.filter((d) => dari(d.tanggal));
      const sumHariIni = donHariIni.reduce((a, b) => a + (Number(b.jumlah) || 0), 0);
      const reqHariIni = reqs.filter((r) => dari(r.tanggal));
      const usrHariIni = users.filter((u) => dari(u.dibuat || u.tanggal));

      document.getElementById("rt-kpi1").innerHTML =
        rtKpi("credit", "var(--hijau)", S.rupiah(sumHariIni), "Donasi masuk hari ini (" + donHariIni.length + " transaksi)") +
        rtKpi("file", "var(--biru)", reqHariIni.length, "Pengajuan baru hari ini") +
        rtKpi("users", "var(--teal)", usrHariIni.length, "Pengguna baru hari ini");
      document.getElementById("rt-kpi2").innerHTML =
        rtKpi("clock", "var(--oranye)", st.donasiMenunggu, "Donasi menunggu konfirmasi") +
        rtKpi("shield", "var(--ungu)", st.pengajuanMenunggu, "Pengajuan menunggu verifikasi") +
        rtKpi("heart", "var(--merah)", S.rupiah(st.totalDanaTerkumpul), "Total dana terkumpul");

      /* --- feed aktivitas terbaru --- */
      const ambilWaktu = (x) => x.tanggal || x.dibuat || x.created_at || null;
      const feed = []
        .concat(dons.slice(0, 10).map((d) => ({
          t: ambilWaktu(d), ic: "credit", k: "k-hijau",
          judul: (d.anonim ? "Donasi anonim" : S.esc(d.donorNama || "Donatur")) + " · " + S.rupiah(d.jumlah) + (d.donorWa ? " · WA " + S.esc(d.donorWa) : ""),
          sub: S.esc(d.kuitansi) + " — " + (d.status === "terkonfirmasi" ? "terkonfirmasi" : d.status === "ditolak" ? "ditolak" : "menunggu konfirmasi")
        })))
        .concat(reqs.slice(0, 8).map((r) => ({
          t: ambilWaktu(r), ic: "file", k: "k-biru",
          judul: S.esc(r.code) + " — " + S.esc((r.judul || "").slice(0, 46)),
          sub: S.esc(r.namaPenerima || "") + " · " + S.esc((S.KATEGORI[r.kategori] || {}).label || r.kategori)
        })))
        .concat((audit || []).slice(0, 8).map((a) => ({
          t: ambilWaktu(a), ic: "shield", k: "k-abu",
          judul: S.esc(a.aksi) + " · " + S.esc(a.entitas || ""),
          sub: "oleh " + S.esc(a.aktor || "-")
        })))
        .filter((x) => x.t)
        .sort((a, b) => new Date(b.t) - new Date(a.t))
        .slice(0, 16);
      const batasBaru = Date.now() - 120000; /* 2 menit terakhir = "baru" */
      document.getElementById("rt-feed").innerHTML = feed.length
        ? feed.map((x) =>
          '<div class="feed-item' + (new Date(x.t).getTime() >= batasBaru ? " baru" : "") + '">' +
          '<span class="notif-ic"><span class="k-ic ' + x.k + '">' + S.icon(x.ic, 13) + "</span></span>" +
          "<div style='flex:1'><b>" + x.judul + "</b><p>" + x.sub + "</p></div>" +
          "<time>" + S.waktuLalu(x.t) + "</time></div>").join("")
        : '<p style="font-size:13px;color:var(--abu)">Belum ada aktivitas.</p>';

      /* --- grafik 7 hari + daftar tunggu --- */
      const hari = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        hari.push({ awal: d.getTime(), label: d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" }) });
      }
      const nilaiHari = hari.map((h) =>
        dons.filter((d) => { const t = new Date(d.tanggal).getTime(); return t >= h.awal && t < h.awal + 86400000; })
          .reduce((a, b) => a + (Number(b.jumlah) || 0), 0));
      drawBar(document.getElementById("rt-chart"), hari.map((h) => h.label), nilaiHari, "#16a34a");

      const tungguDon = dons.filter((d) => d.status === "menunggu_konfirmasi").slice(0, 4);
      const tungguReq = reqs.filter((r) => r.status === "menunggu_verifikasi").slice(0, 4);
      document.getElementById("rt-tunggu").innerHTML =
        '<b style="font-size:13.5px">Menunggu tindakan Anda</b>' +
        (tungguDon.length || tungguReq.length
          ? '<div style="margin-top:8px">' +
            tungguDon.map((d) => '<div class="feed-item"><span class="notif-ic"><span class="k-ic k-oranye">' + S.icon("credit", 13) + "</span></span><div style='flex:1'><b>Verifikasi " + S.esc(d.kuitansi) + "</b><p>" + S.rupiah(d.jumlah) + "</p></div></div>").join("") +
            tungguReq.map((r) => '<div class="feed-item"><span class="notif-ic"><span class="k-ic k-ungu">' + S.icon("file", 13) + "</span></span><div style='flex:1'><b>Verifikasi " + S.esc(r.code) + "</b><p>" + S.esc((r.judul || "").slice(0, 40)) + "</p></div></div>").join("") +
            "</div>"
          : '<p style="font-size:12.5px;color:var(--abu);margin-top:6px">Tidak ada antrean. Semua sudah diproses.</p>');

      document.getElementById("rt-waktu").textContent = new Date().toLocaleTimeString("id-ID");
      document.getElementById("rt-evt").textContent = rtJumlah;
      if (rtTerakhir) {
        const st2 = document.getElementById("rt-status");
        if (st2 && S.MODE === "supabase") st2.textContent = "Terhubung — perubahan terakhir: " + rtTerakhir.tabel + " (" + rtTerakhir.aksi + ")";
      }
    } catch (e) {
      const st2 = document.getElementById("rt-status");
      if (st2) st2.textContent = "Gagal memuat data: " + e.message;
    }
  }

  let rtTimer = null;
  function pasangRealtime() {
    hentikanRealtime();
    let modeLabel = "";
    if (S.MODE === "supabase" && S.store.client && S.store.client.channel) {
      try {
        const ch = S.store.client
          .channel("sb-admin-rt-" + Date.now())
          .on("postgres_changes", { event: "*", schema: "public" }, (pay) => {
            rtJumlah++;
            rtTerakhir = { tabel: (pay && pay.table) || "?", aksi: (pay && pay.eventType || pay && pay.type) || "?" };
            if (rtTerakhir.tabel === "donations" && rtTerakhir.aksi === "INSERT") {
              S.toast("Donasi baru masuk! Cek menu Donasi untuk konfirmasi.", "sukses");
              SB.refreshNotif && SB.refreshNotif();
            }
            if (rtTerakhir.tabel === "assistance_requests" && rtTerakhir.aksi === "INSERT") {
              S.toast("Pengajuan baru masuk! Cek menu Pengajuan.", "info");
            }
            jadwalkanLive();
          })
          .subscribe((status) => {
            const el = document.getElementById("rt-status");
            if (!el) return;
            if (status === "SUBSCRIBED") el.textContent = "Realtime Supabase aktif — semua perubahan tabel langsung tampil di sini.";
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") el.textContent = "Kanal realtime terputus (" + status + "). Dicoba ulang otomatis... Fallback pemantauan berkala aktif.";
            else el.textContent = "Menyambungkan kanal realtime (" + status + ")...";
          });
        rtStop = () => { try { S.store.client.removeChannel(ch); } catch (e) { /* abaikan */ } };
        modeLabel = "supabase";
      } catch (e) { /* jatuh ke fallback */ }
    }
    if (!rtStop) {
      rtTimer = setInterval(() => segarkanLive(false), 5000);
      const onStorage = (e) => { if (!e.key || e.key === "saling_bantu_demo_v1") jadwalkanLive(); };
      window.addEventListener("storage", onStorage);
      rtStop = () => { clearInterval(rtTimer); window.removeEventListener("storage", onStorage); };
      modeLabel = "demo";
      const el = document.getElementById("rt-status");
      if (el) el.textContent = "Mode Demo — pemantauan berkala tiap 5 detik (jika realtime Supabase aktif, pembaruan instan otomatis digunakan).";
    }
    return modeLabel;
  }

  let rtJadwal = null;
  function jadwalkanLive() {
    clearTimeout(rtJadwal);
    rtJadwal = setTimeout(() => segarkanLive(false), 700);
  }

  /* ================= ISI WEBSITE (CMS) ================= */
  async function vIsiWebsite() {
    if (!SB.KONTEN_DEF) { mainEl().innerHTML = head("Isi Website", "") + '<div class="alert alert-danger">File js/konten.js tidak termuat.</div>'; return; }
    await SB.muatKonten(true);
    const simpanGlobal = S.MODE === "supabase";
    let html = head("Isi Website", "Edit seluruh teks publik website: identitas, beranda, statistik, ajakan, footer, kontak, dan rekening donasi.",
      '<button class="btn btn-primary" id="kw-simpan">' + S.icon("check", 15) + " Simpan Semua Perubahan</button>");
    html += '<div class="alert alert-info">' + S.icon("bell", 16) +
      "<span>Perubahan disimpan " + (simpanGlobal ? "<b>global di Supabase</b> (tabel <code>site_content</code>) dan langsung berlaku di semua perangkat" : "di browser ini (Mode Demo)") +
      ". Setelah disimpan, teks baru langsung tampil di beranda, header, footer, dan halaman lain tanpa perlu mengedit kode.</span></div>";

    SB.KONTEN_DEF.forEach((g) => {
      html += '<div class="panel" style="margin-bottom:16px"><h3>' + S.icon(g.ikon, 16) + " " + g.judul + "</h3>" +
        '<p style="font-size:12.5px;color:var(--abu);margin:-4px 0 12px">' + g.desk + "</p>" +
        '<div class="form-row">' +
        g.field.map((f) => {
          const nilai = SB.teks(f.key);
          if (f.tipe === "gambar") {
            return '<div class="field" style="grid-column:1/-1"><label>' + S.esc(f.label) + "</label>" +
              '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
              '<img id="kw-' + f.key + '-prev" alt="Pratinjau logo" style="width:64px;height:64px;object-fit:contain;border:1px solid var(--garis);border-radius:10px;background:#fff;padding:4px"' +
              (SB.konten[f.key] ? ' src="' + S.esc(SB.konten[f.key]) + '"' : "") + "/>" +
              '<input type="file" accept="image/*" id="kw-' + f.key + '" style="max-width:320px"/>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-hapus-logo="' + f.key + '">' + S.icon("x", 13) + " Hapus Logo</button>" +
              "</div>" +
              '<p class="hint" style="margin:6px 0 0">PNG/JPG/SVG, otomatis dikecilkan. Tampil di header, footer, favicon, dan kop laporan PDF.</p></div>';
          }
          if (f.tipe === "warna") {
            return '<div class="field"><label>' + S.esc(f.label) + "</label>" +
              '<div style="display:flex;gap:8px;align-items:center">' +
              '<input type="color" id="kw-' + f.key + '-c" value="' + S.esc(/^#[0-9a-fA-F]{6}$/.test(nilai) ? nilai : "#16a34a") + '" style="width:46px;height:38px;padding:2px"/>' +
              '<input type="text" id="kw-' + f.key + '" value="' + S.esc(nilai) + '" style="max-width:130px"/></div>' +
              '<p class="hint" style="margin:6px 0 0">Mengubah warna utama header, tombol, dan aksen seluruh halaman.</p></div>';
          }
          const inp = f.tipe === "textarea"
            ? '<textarea id="kw-' + f.key + '" rows="2">' + S.esc(nilai) + "</textarea>"
            : '<input type="' + (f.tipe === "angka" ? "number" : "text") + '" id="kw-' + f.key + '" value="' + S.esc(nilai) + '"/>';
          return '<div class="field" style="' + (f.tipe === "textarea" ? "grid-column:1/-1" : "") + '"><label>' + S.esc(f.label) + '</label>' + inp + "</div>";
        }).join("") +
        "</div>" +
        '<div style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-kw-reset="' + g.id + '">' + S.icon("x", 13) + " Kembalikan Default Grup Ini</button></div>" +
        "</div>";
    });

    mainEl().innerHTML = html;

    /* handler unggah / hapus logo + sinkronisasi pemilih warna */
    mainEl().querySelectorAll("[data-hapus-logo]").forEach((b) =>
      b.addEventListener("click", () => {
        const k = b.dataset.hapusLogo;
        SB.konten[k] = "";
        const prev = document.getElementById("kw-" + k + "-prev");
        if (prev) prev.removeAttribute("src");
        const fi = document.getElementById("kw-" + k);
        if (fi) fi.value = "";
        S.toast("Logo dihapus — klik Simpan Semua Perubahan untuk menetapkan.", "info");
      }));
    SB.KONTEN_DEF.forEach((g) => g.field.forEach((f) => {
      if (f.tipe !== "gambar") return;
      const fi = document.getElementById("kw-" + f.key);
      const prev = document.getElementById("kw-" + f.key + "-prev");
      if (!fi || !prev) return;
      fi.addEventListener("change", async () => {
        const berkas = fi.files && fi.files[0];
        if (!berkas) return;
        try {
          const dataUrl = await SB.laporan.kompresGambar(berkas, 320);
          SB.konten[f.key] = dataUrl;
          prev.src = dataUrl;
          S.toast("Logo siap — klik Simpan Semua Perubahan untuk menetapkan.", "sukses");
        } catch (e) { S.toast(e.message || "Gagal memproses gambar.", "gagal"); fi.value = ""; }
      });
    }));
    SB.KONTEN_DEF.forEach((g) => g.field.forEach((f) => {
      if (f.tipe !== "warna") return;
      const cw = document.getElementById("kw-" + f.key + "-c");
      const tx = document.getElementById("kw-" + f.key);
      if (cw && tx) {
        cw.addEventListener("input", () => { tx.value = cw.value; });
        tx.addEventListener("change", () => { if (/^#[0-9a-fA-F]{6}$/.test(tx.value.trim())) cw.value = tx.value.trim(); });
      }
    }));

    document.getElementById("kw-simpan").addEventListener("click", async () => {
      const patch = {};
      let namaKosong = false;
      SB.KONTEN_DEF.forEach((g) => g.field.forEach((f) => {
        if (f.tipe === "gambar") { patch[f.key] = String(SB.konten[f.key] || "").trim(); return; }
        const el = document.getElementById("kw-" + f.key);
        if (!el) return;
        let v = el.value;
        if (f.tipe === "angka") v = String(Number(v) || 0);
        if (f.tipe === "warna") { v = v.trim(); if (!/^#[0-9a-fA-F]{6}$/.test(v)) v = f.def || "#16a34a"; }
        patch[f.key] = v.trim();
        if (f.key === "app_nama" && !patch[f.key]) namaKosong = true;
      }));
      if (namaKosong) { S.toast("Nama aplikasi tidak boleh kosong.", "gagal"); return; }
      try {
        await S.store.setContent(patch);
        await SB.muatKonten(true);
        SB.terapkanKonten();
        if (SB.renderKerangka) SB.renderKerangka();
        S.toast("Isi website tersimpan dan langsung tampil di seluruh halaman.", "sukses");
      } catch (e) { S.toast("Gagal menyimpan: " + e.message, "gagal"); }
    });

    mainEl().querySelectorAll("[data-kw-reset]").forEach((b) =>
      b.addEventListener("click", async () => {
        const g = SB.KONTEN_DEF.find((x) => x.id === b.dataset.kwReset);
        if (!g) return;
        if (!(await S.konfirmasi("Kembalikan semua teks pada grup \"" + g.judul + "\" ke nilai bawaan?", "Ya, kembalikan"))) return;
        try {
          await S.store.resetKonten(g.field.map((f) => f.key));
          await SB.muatKonten(true);
          S.toast("Grup \"" + g.judul + "\" dikembalikan ke default.", "sukses");
          vIsiWebsite();
        } catch (e) { S.toast("Gagal: " + e.message, "gagal"); }
      }));
  }

  /* ================= PENGGUNA ================= */
  async function vPengguna() {
    cache.users = await S.store.listUsers();
    let html = head("Manajemen Pengguna", cache.users.length + " akun terdaftar");
    html += '<div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Pengguna</th><th>Peran</th><th>Kota</th><th>Status</th><th>Aksi</th></tr></thead><tbody>" +
      cache.users.map((u) =>
        "<tr><td><div style='display:flex;gap:9px;align-items:center'>" + S.avatar(u.nama, 30) +
        "<div><b>" + S.esc(u.nama) + "</b><br><small style='color:var(--abu)'>" + S.esc(u.email) + "</small></div></div></td>" +
        '<td><select data-role="' + u.id + '" style="width:auto;padding:6px 10px;font-size:12.5px">' +
        ["admin", "pengelola", "penerima", "donatur", "volunteer"].map((r) => '<option value="' + r + '"' + (u.peran === r ? " selected" : "") + ">" + r + "</option>").join("") +
        "</select></td>" +
        "<td>" + S.esc(u.kota || "-") + "</td>" +
        "<td>" + (u.terverifikasi ? '<span class="badge st-hijau">Terverifikasi</span>' : '<span class="badge st-abu">Belum</span>') + " " +
        (u.aktif === false ? '<span class="badge st-merah">Nonaktif</span>' : "") + "</td>" +
        '<td><div class="td-actions">' +
        '<button class="btn btn-ghost" data-edit-user="' + u.id + '">Edit</button>' +
        '<button class="btn btn-ghost" data-verif="' + u.id + '">' + (u.terverifikasi ? "Batal Verif." : "Verifikasi") + "</button>" +
        '<button class="btn btn-ghost" data-aktif="' + u.id + '">' + (u.aktif === false ? "Aktifkan" : "Nonaktifkan") + "</button>" +
        (user && user.peran === "admin" && u.id !== user.id ? '<button class="btn btn-danger" data-hapus-user="' + u.id + '">Hapus</button>' : "") +
        "</div></td></tr>").join("") +
      "</tbody></table></div>";
    mainEl().innerHTML = html;

    mainEl().querySelectorAll("[data-role]").forEach((sel) =>
      sel.addEventListener("change", async () => {
        try { await S.store.setRole(sel.dataset.role, sel.value); S.toast("Peran diperbarui.", "sukses"); }
        catch (e) { S.toast(e.message, "gagal"); }
      }));
    mainEl().querySelectorAll("[data-verif]").forEach((b) =>
      b.addEventListener("click", async () => {
        const u = cache.users.find((x) => x.id === b.dataset.verif);
        try { await S.store.verifyUser(u.id, !u.terverifikasi); S.toast("Status verifikasi diperbarui.", "sukses"); vPengguna(); }
        catch (e) { S.toast(e.message, "gagal"); }
      }));
    mainEl().querySelectorAll("[data-aktif]").forEach((b) =>
      b.addEventListener("click", async () => {
        const u = cache.users.find((x) => x.id === b.dataset.aktif);
        if (!(await S.konfirmasi((u.aktif === false ? "Aktifkan" : "Nonaktifkan") + " akun " + u.nama + "?", "Ya"))) return;
        try { await S.store.setUserAktif(u.id, u.aktif === false); S.toast("Status akun diperbarui.", "sukses"); vPengguna(); }
        catch (e) { S.toast(e.message, "gagal"); }
      }));
    mainEl().querySelectorAll("[data-hapus-user]").forEach((b) =>
      b.addEventListener("click", async () => {
        const u = cache.users.find((x) => x.id === b.dataset.hapusUser);
        if (!u) return;
        if (!(await S.konfirmasi("Hapus akun " + u.nama + (u.email && u.email !== "-" ? " (" + u.email + ")" : "") + "? Seluruh data terkait akun ini (donasi, pengajuan, notifikasi) ikut terhapus dan tidak bisa dikembalikan.", "Ya, hapus akun"))) return;
        try {
          await S.store.deleteUser(u.id);
          S.toast("Akun " + u.nama + " telah dihapus.", "sukses");
          vPengguna();
        } catch (e) { S.toast(e.message, "gagal"); }
      }));
    mainEl().querySelectorAll("[data-edit-user]").forEach((b) =>
      b.addEventListener("click", () => modalEditUser(b.dataset.editUser)));
  }

  function modalEditUser(id) {
    const u = cache.users.find((x) => x.id === id);
    if (!u) return;
    const sendiri = user && u.id === user.id;
    const peranOpts = ["admin", "pengelola", "penerima", "donatur", "volunteer"].map((r) =>
      '<option value="' + r + '"' + (u.peran === r ? " selected" : "") + ">" + r + "</option>").join("");
    S.modal({
      judul: "Edit Pengguna — " + u.nama,
      lebar: 560,
      isi:
        '<div class="form-row">' +
        '<div class="field"><label>Nama Lengkap</label><input type="text" id="eu-nama" value="' + S.esc(u.nama) + '" required/></div>' +
        '<div class="field"><label>Telepon</label><input type="text" id="eu-telp" value="' + S.esc(u.telepon || "") + '"/></div>' +
        '<div class="field"><label>Kota</label><input type="text" id="eu-kota" value="' + S.esc(u.kota || "") + '"/></div>' +
        '<div class="field"><label>Peran</label><select id="eu-peran"' + (sendiri ? " disabled" : "") + ">" + peranOpts + "</select>" +
        (sendiri ? '<small style="color:var(--abu);font-size:12px">Peran akun sendiri tidak dapat diubah dari sini.</small>' : "") + "</div>" +
        '<div class="field" style="grid-column:1/-1"><label>Bio</label><textarea id="eu-bio" rows="3">' + S.esc(u.bio || "") + "</textarea></div>" +
        "</div>",
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="eu-simpan">Simpan Perubahan</button>'
    });
    document.getElementById("eu-simpan").addEventListener("click", async () => {
      const patch = {
        nama: document.getElementById("eu-nama").value.trim(),
        telepon: document.getElementById("eu-telp").value.trim(),
        kota: document.getElementById("eu-kota").value.trim(),
        bio: document.getElementById("eu-bio").value.trim()
      };
      if (!patch.nama) { S.toast("Nama tidak boleh kosong.", "gagal"); return; }
      if (!sendiri) patch.peran = document.getElementById("eu-peran").value;
      try {
        await S.store.updateUserAdmin(u.id, patch);
        S.modalClose(); S.toast("Perubahan pengguna tersimpan.", "sukses"); vPengguna();
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  }

  /* ================= PENGAJUAN ================= */
  const ALUR = {
    menunggu_verifikasi: [["dalam_verifikasi", "Mulai Verifikasi", "biru"], ["ditolak", "Tolak", "merah"]],
    dalam_verifikasi: [["terverifikasi", "Setujui (Terverifikasi)", "hijau"], ["ditolak", "Tolak", "merah"]],
    terverifikasi: [["dipublikasikan", "Publikasikan", "hijau"], ["ditolak", "Tolak", "merah"]],
    dipublikasikan: [["sedang_dibantu", "Tandai Sedang Dibantu", "oranye"]],
    sedang_dibantu: [["bantuan_terpenuhi", "Bantuan Terpenuhi", "hijau"]],
    bantuan_terpenuhi: [["selesai", "Tandai Selesai", "hijau"]],
    selesai: [], ditolak: []
  };

  async function vPengajuan() {
    cache.requests = await S.store.listRequests({ publikOnly: false });
    let html = head("Manajemen Pengajuan", "Verifikasi, setujui, publikasikan, dan pantau pengajuan. Buat program donasi baru langsung dari sini lewat tombol Tambah Program.");
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      '<span style="font-size:13px;color:var(--abu)">' + cache.requests.length + ' pengajuan tercatat.</span>' +
      '<button class="btn btn-primary" id="req-tambah">' + S.icon("plus", 15) + " Tambah Program / Pengajuan</button></div>";
    const badgeM = (st) => '<span class="badge st-abu">' + st + "</span>";
    html += '<div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Kode</th><th>Pengajuan</th><th>Kategori</th><th>Status</th><th>Dana</th><th>Aksi</th></tr></thead><tbody>" +
      cache.requests.map((r) => {
        const tombol = (ALUR[r.status] || []).map(([st, label, warna]) =>
          '<button class="btn btn-' + (warna === "merah" ? "danger" : warna === "hijau" ? "primary" : "blue") + '" data-status="' + r.id + "|" + st + '">' + label + "</button>").join("");
        return "<tr><td><b>" + S.esc(r.code) + "</b></td>" +
          "<td style='max-width:230px'><b>" + S.esc(r.judul.slice(0, 52)) + "</b><br><small style='color:var(--abu)'>" + S.esc(r.namaPenerima) + " · " + S.tanggal(r.tanggal) + "</small></td>" +
          "<td>" + S.esc((S.KATEGORI[r.kategori] || {}).label || r.kategori) + "</td>" +
          "<td>" + S.badgeStatus(r.status) + "</td>" +
          "<td>" + S.rupiah(r.terkumpul) + "<br><small style='color:var(--abu)'>/" + S.rupiah(r.kebutuhan) + "</small></td>" +
          '<td><div class="td-actions"><button class="btn btn-ghost" data-detail="' + r.id + '">Detail</button>' +
          '<button class="btn btn-ghost" data-edit-req="' + r.id + '">Edit</button>' +
          '<button class="btn btn-danger" data-del-req="' + r.id + '">Hapus</button>' + (tombol || '<span style="font-size:12px;color:var(--abu)">Selesai</span>') + "</div></td></tr>";
      }).join("") +
      "</tbody></table></div>";
    mainEl().innerHTML = html;

    mainEl().querySelectorAll("[data-detail]").forEach((b) =>
      b.addEventListener("click", () => modalAdminPengajuan(b.dataset.detail)));
    mainEl().querySelectorAll("[data-status]").forEach((b) =>
      b.addEventListener("click", () => {
        const [id, st] = b.dataset.status.split("|");
        ubahStatus(id, st);
      }));
    mainEl().querySelectorAll("[data-edit-req]").forEach((b) =>
      b.addEventListener("click", () => modalEditPengajuan(b.dataset.editReq)));
    mainEl().querySelectorAll("[data-del-req]").forEach((b) =>
      b.addEventListener("click", async () => {
        const r = cache.requests.find((x) => x.id === b.dataset.delReq);
        if (!r) return;
        if (!(await S.konfirmasi("Hapus pengajuan " + r.code + " \u2014 \"" + r.judul.slice(0, 60) + "\"? Donasi yang sudah tercatat tetap ada di riwayat donatur, namun penyaluran, progres dana, dan kartu program ini ikut terhapus.", "Ya, hapus pengajuan"))) return;
        try {
          await S.store.deleteRequest(r.id);
          S.toast("Pengajuan " + r.code + " telah dihapus.", "sukses");
          vPengajuan();
        } catch (e) { S.toast(e.message, "gagal"); }
      }));
    document.getElementById("req-tambah").addEventListener("click", () => modalTambahProgram());
  }

  /* ---------- Tambah Program / Pengajuan (oleh admin/pengelola) ---------- */
  function modalTambahProgram() {
    const katOpts = Object.entries(S.KATEGORI).map(([k, m]) =>
      '<option value="' + k + '">' + m.label + "</option>").join("");
    S.modal({
      judul: "Tambah Program / Pengajuan Baru",
      lebar: 640,
      isi:
        '<div class="form-row">' +
        '<div class="field" style="grid-column:1/-1"><label>Judul Program *</label><input type="text" id="nr-judul" placeholder="cth: Beasiswa Santri Yatim Semester Genap" required/></div>' +
        '<div class="field"><label>Kategori *</label><select id="nr-kategori">' + katOpts + "</select></div>" +
        '<div class="field"><label>Sub-kategori</label><select id="nr-sub"></select></div>' +
        '<div class="field"><label>Nama Penerima / Golongan</label><input type="text" id="nr-penerima" placeholder="cth: 15 santri yatim TPQ Al-Ikhlas"/></div>' +
        '<div class="field"><label>Kebutuhan (Rp)</label><input type="number" id="nr-kebutuhan" min="0" step="10000" placeholder="5000000"/></div>' +
        '<div class="field"><label>Kota</label><input type="text" id="nr-kota"/></div>' +
        '<div class="field"><label>Provinsi</label><input type="text" id="nr-provinsi"/></div>' +
        '<div class="field"><label>Kontak (rahasia dari publik)</label><input type="text" id="nr-kontak"/></div>' +
        '<div class="field"><label>Status Awal</label><select id="nr-status">' +
        '<option value="dipublikasikan" selected>Dipublikasikan — langsung tampil &amp; bisa diberi donasi</option>' +
        '<option value="menunggu_verifikasi">Menunggu Verifikasi</option>' +
        '<option value="terverifikasi">Terverifikasi — belum tampil publik</option>' +
        "</select></div>" +
        '<div class="field" style="grid-column:1/-1"><label>Deskripsi / Cerita Program</label><textarea id="nr-deskripsi" rows="4" placeholder="Jelaskan latar belakang, penerima manfaat, dan rencana penyaluran..."></textarea></div>' +
        "</div>" +
        '<p style="font-size:12.5px;color:var(--abu);margin-top:8px">Program langsung tercatat di jejak audit. Pencatatan dana ZISWAF (zakat/infaq/sedekah/wakaf) tetap lewat menu <b>Modul ZISWAF</b> → Catat ZISWAF (Tunai/Offline).</p>',
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="nr-simpan">' + S.icon("check", 15) + " Buat Program</button>"
    });
    const isiSub = () => {
      const subs = (S.KATEGORI[document.getElementById("nr-kategori").value] || {}).sub || [];
      document.getElementById("nr-sub").innerHTML = subs.map((s) => '<option value="' + s + '">' + s + "</option>").join("");
    };
    isiSub();
    document.getElementById("nr-kategori").addEventListener("change", isiSub);
    document.getElementById("nr-simpan").addEventListener("click", async () => {
      const judul = document.getElementById("nr-judul").value.trim();
      if (!judul) { S.toast("Judul program wajib diisi.", "gagal"); return; }
      const btn = document.getElementById("nr-simpan");
      btn.disabled = true;
      try {
        const r = await S.store.addRequestAdmin({
          judul,
          kategori: document.getElementById("nr-kategori").value,
          sub: document.getElementById("nr-sub").value,
          namaPenerima: document.getElementById("nr-penerima").value.trim(),
          kebutuhan: Number(document.getElementById("nr-kebutuhan").value) || 0,
          kota: document.getElementById("nr-kota").value.trim(),
          provinsi: document.getElementById("nr-provinsi").value.trim(),
          kontak: document.getElementById("nr-kontak").value.trim(),
          deskripsi: document.getElementById("nr-deskripsi").value.trim(),
          status: document.getElementById("nr-status").value,
          publik: true
        });
        S.modalClose();
        S.toast("Program " + r.code + " berhasil dibuat.", "sukses");
        SB.refreshNotif && SB.refreshNotif();
        vPengajuan();
      } catch (e) {
        S.toast(e.message, "gagal");
        btn.disabled = false;
      }
    });
  }

  function modalAdminPengajuan(id) {
    const r = cache.requests.find((x) => x.id === id);
    if (!r) return;
    S.modal({
      judul: r.code + " — " + r.judul,
      lebar: 640,
      isi:
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + S.badgeStatus(r.status) + S.badgeKategori(r.kategori) + "</div>" +
        '<dl class="kv">' +
        "<dt>Pengaju</dt><dd>" + S.esc(r.namaPenerima) + "</dd>" +
        "<dt>Sub-kategori</dt><dd>" + S.esc(r.sub) + "</dd>" +
        "<dt>Lokasi</dt><dd>" + S.esc(r.kota) + ", " + S.esc(r.provinsi) + "</dd>" +
        "<dt>Kontak</dt><dd>" + S.esc(r.kontak || "-") + " <small style='color:var(--abu)'>(rahasia dari publik)</small></dd>" +
        "<dt>Kebutuhan</dt><dd>" + S.rupiah(r.kebutuhan) + "</dd>" +
        "<dt>Lampiran</dt><dd>" + (r.foto || r.dokumen ? "Ada (foto/dokumen)" : "Tidak ada") + "</dd></dl>" +
        "<p style='font-size:13.5px;margin-top:12px;color:#334155'>" + S.esc(r.deskripsi) + "</p>" +
        '<div style="margin-top:14px">' + S.timeline(r.status) + "</div>",
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Tutup</button><button class="btn btn-blue" id="mp-edit">Edit Data</button>'
    });
    document.getElementById("mp-edit").addEventListener("click", () => {
      S.modalClose();
      modalEditPengajuan(id);
    });
  }

  async function ubahStatus(id, statusBaru) {
    const r = cache.requests.find((x) => x.id === id);
    if (!r) return;
    let catatan = "";
    if (statusBaru === "ditolak") {
      catatan = prompt("Tulis alasan penolakan untuk " + r.code + ":") || "";
      if (!catatan) { S.toast("Alasan penolakan wajib diisi.", "gagal"); return; }
    } else {
      if (!(await S.konfirmasi("Ubah status " + r.code + " menjadi \"" + S.STATUS[statusBaru].label + "\"?", "Ya, ubah status"))) return;
    }
    try {
      await S.store.updateRequestStatus(id, statusBaru, catatan);
      S.toast("Status " + r.code + " diubah menjadi " + S.STATUS[statusBaru].label + ".", "sukses");
      SB.refreshNotif && SB.refreshNotif();
      vPengajuan();
    } catch (e) { S.toast(e.message, "gagal"); }
  }

  function modalEditPengajuan(id) {
    const r = cache.requests.find((x) => x.id === id);
    if (!r) return;
    const katOpts = Object.entries(S.KATEGORI).map(([k, m]) =>
      '<option value="' + k + '"' + (r.kategori === k ? " selected" : "") + ">" + m.label + "</option>").join("");
    const subOpts = (S.KATEGORI[r.kategori] || {}).sub || [];
    S.modal({
      judul: "Edit Pengajuan — " + r.code,
      lebar: 620,
      isi:
        '<div class="form-row">' +
        '<div class="field" style="grid-column:1/-1"><label>Judul Pengajuan</label><input type="text" id="er-judul" value="' + S.esc(r.judul) + '" required/></div>' +
        '<div class="field"><label>Kategori</label><select id="er-kategori">' + katOpts + "</select></div>" +
        '<div class="field"><label>Sub-kategori</label><select id="er-sub">' + subOpts.map((s) => '<option value="' + s + '"' + (r.sub === s ? " selected" : "") + ">" + s + "</option>").join("") + "</select></div>" +
        '<div class="field"><label>Nama Penerima</label><input type="text" id="er-penerima" value="' + S.esc(r.namaPenerima || "") + '"/></div>' +
        '<div class="field"><label>Kebutuhan (Rp)</label><input type="number" id="er-kebutuhan" min="0" step="10000" value="' + Number(r.kebutuhan || 0) + '"/></div>' +
        '<div class="field"><label>Kota</label><input type="text" id="er-kota" value="' + S.esc(r.kota || "") + '"/></div>' +
        '<div class="field"><label>Provinsi</label><input type="text" id="er-provinsi" value="' + S.esc(r.provinsi || "") + '"/></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Kontak (rahasia dari publik)</label><input type="text" id="er-kontak" value="' + S.esc(r.kontak || "") + '"/></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Deskripsi</label><textarea id="er-deskripsi" rows="4">' + S.esc(r.deskripsi || "") + "</textarea></div>" +
        '<div class="field" style="grid-column:1/-1"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="er-publik"' + (r.publik === false ? "" : " checked") + ' style="width:auto"/> Tampilkan di halaman publik (Cari Bantuan)</label></div>' +
        "</div>" +
        '<p style="font-size:12.5px;color:var(--abu);margin-top:8px">Perubahan data tidak mengubah status verifikasi, tetapi tercatat di jejak audit.</p>',
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="er-simpan">Simpan Perubahan</button>'
    });
    document.getElementById("er-kategori").addEventListener("change", (e) => {
      const subs = (S.KATEGORI[e.target.value] || {}).sub || [];
      document.getElementById("er-sub").innerHTML = subs.map((s) => '<option value="' + s + '">' + s + "</option>").join("");
    });
    document.getElementById("er-simpan").addEventListener("click", async () => {
      const judul = document.getElementById("er-judul").value.trim();
      if (!judul) { S.toast("Judul wajib diisi.", "gagal"); return; }
      const patch = {
        judul,
        kategori: document.getElementById("er-kategori").value,
        sub: document.getElementById("er-sub").value,
        namaPenerima: document.getElementById("er-penerima").value.trim(),
        kebutuhan: Number(document.getElementById("er-kebutuhan").value) || 0,
        kota: document.getElementById("er-kota").value.trim(),
        provinsi: document.getElementById("er-provinsi").value.trim(),
        kontak: document.getElementById("er-kontak").value.trim(),
        deskripsi: document.getElementById("er-deskripsi").value.trim(),
        publik: document.getElementById("er-publik").checked
      };
      try {
        await S.store.updateRequestAdmin(r.id, patch);
        S.modalClose(); S.toast("Data pengajuan diperbarui.", "sukses"); vPengajuan();
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  }

  /* ================= DONASI ================= */
  async function vDonasi() {
    const [dons, dists, reqs] = await Promise.all([
      S.store.listDonations({ publikOnly: false }),
      S.store.listDistributions().catch(() => []),
      cache.requests.length ? Promise.resolve(cache.requests) : S.store.listRequests({}).catch(() => [])
    ]);
    cache.requests = reqs;
    cache.donations = dons;
    cache.distributions = dists;
    const menunggu = dons.filter((d) => d.status === "menunggu_konfirmasi");
    let html = head("Manajemen Donasi", "Konfirmasi pembayaran (sesuai mutasi rekening) dan catat penyaluran dengan bukti.",
      '<button class="btn btn-primary" id="don-xls">' + S.icon("download", 15) + " Ekspor Excel</button>");
    html += '<div class="alert ' + (menunggu.length ? "alert-warn" : "alert-info") + '">' + S.icon("clock", 16) +
      "<span><b>" + menunggu.length + "</b> donasi menunggu konfirmasi. Konfirmasi hanya setelah transfer terbaca di rekening bersama.</span></div>";

    html += '<div class="panel"><h3>Daftar Donasi</h3><div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Kuitansi</th><th>Donatur</th><th>Jenis</th><th>Nominal/Rincian</th><th>Status</th><th>Aksi</th></tr></thead><tbody>" +
      (dons.length ? dons.map((d) => {
        const jn = S.JENIS_BANTUAN[d.jenis] || { label: d.jenis };
        return "<tr><td><b>" + S.esc(d.kuitansi) + "</b><br><small style='color:var(--abu)'>" + S.tanggal(d.tanggal) + "</small></td>" +
          "<td>" + S.esc(d.donorNama) + (d.anonim ? " <small style='color:var(--abu)'>(anonim)</small>" : "") +
          (d.donorWa ? "<br><small style='color:var(--abu)'>" + S.icon("message", 11) + " " + S.esc(d.donorWa) + (d.tamu ? " · Jalur Cepat (bukti via WA)" : "") + "</small>" : (d.tamu ? "<br><small style='color:var(--abu)'>Jalur Cepat (bukti via WA)</small>" : "")) + "</td>" +
          "<td>" + jn.label + "</td>" +
          "<td>" + (d.jenis === "finansial" ? "<b>" + S.rupiah(d.jumlah) + "</b>" : S.esc(d.barang || "-")) + "</td>" +
          "<td>" + (d.status === "terkonfirmasi" ? '<span class="badge st-hijau">Terkonfirmasi</span>' : d.status === "ditolak" ? '<span class="badge st-merah">Ditolak</span>' : '<span class="badge st-abu">Menunggu</span>') + "</td>" +
          '<td><div class="td-actions">' +
          (d.status === "menunggu_konfirmasi"
            ? '<button class="btn btn-primary" data-verdon="' + d.id + '|1">Konfirmasi</button><button class="btn btn-danger" data-verdon="' + d.id + '|0">Tolak</button>'
            : "") +
          '<button class="btn btn-ghost" data-edit-don="' + d.id + '">Edit</button>' +
          '<button class="btn btn-danger" data-del-don="' + d.id + '">Hapus</button>' +
          "</div></td></tr>";
      }).join("") : '<tr><td colspan="6" style="color:var(--abu)">Belum ada donasi.</td></tr>') +
      "</tbody></table></div></div>";

    html += '<div class="panel"><h3>Catat Penyaluran Bantuan</h3>' +
      '<p style="font-size:13px;color:var(--abu);margin-bottom:12px">Penyaluran menambah angka "dana tersalurkan" pada proyek terkait dan otomatis memberi notifikasi ke penerima.</p>' +
      '<form id="form-dist" class="form-row" style="align-items:end">' +
      '<div class="field"><label>Proyek</label><select id="dist-req" required>' +
      cache.requests.filter((r) => ["dipublikasikan", "sedang_dibantu", "bantuan_terpenuhi"].includes(r.status))
        .map((r) => '<option value="' + r.id + '">' + S.esc(r.code + " — " + r.judul.slice(0, 42)) + "</option>").join("") +
      "</select></div>" +
      '<div class="field"><label>Jenis</label><select id="dist-jenis">' +
      Object.entries(S.JENIS_BANTUAN).map(([k, m]) => '<option value="' + k + '">' + m.label + "</option>").join("") +
      "</select></div>" +
      '<div class="field"><label>Nominal (Rp)</label><input type="number" id="dist-jumlah" min="0" step="10000" placeholder="0"/></div>' +
      '<div class="field" style="grid-column:1/-1"><label>Catatan / Bukti Penyaluran <span class="req-star">*</span></label><input type="text" id="dist-catatan" placeholder="Contoh: Penyaluran tahap 1 via transfer ke RS, kwitansi tersimpan"/></div>' +
      '<div class="field"><button class="btn btn-primary" type="submit">Catat Penyaluran</button></div>' +
      "</form>" +
      '<div class="table-wrap" style="margin-top:14px"><table class="sb"><thead><tr><th>Tanggal</th><th>Proyek</th><th>Jenis</th><th>Nominal</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>' +
      (dists.length ? dists.map((d) =>
        "<tr><td>" + S.tanggal(d.tanggal || d.distributed_at) + "</td><td><b>" + S.esc(d.kode || d.code || "-") + "</b></td>" +
        "<td>" + S.esc((S.JENIS_BANTUAN[d.jenis || d.type] || {}).label || "-") + "</td>" +
        "<td>" + S.rupiah(d.jumlah || d.amount || 0) + "</td>" +
        "<td style='max-width:240px;font-size:12.5px;color:var(--abu)'>" + S.esc(d.catatan || d.note || "") + "</td>" +
        '<td><button class="btn btn-danger" data-del-dist="' + d.id + '">Hapus</button></td></tr>').join("")
        : '<tr><td colspan="6" style="color:var(--abu)">Belum ada penyaluran.</td></tr>') +
      "</tbody></table></div></div>";
    mainEl().innerHTML = html;

    mainEl().querySelectorAll("[data-verdon]").forEach((b) =>
      b.addEventListener("click", async () => {
        const [id, ok] = b.dataset.verdon.split("|");
        const d = cache.donations.find((x) => x.id === id);
        if (ok === "1") {
          if (!(await S.konfirmasi("Konfirmasi donasi " + d.kuitansi + " (" + S.rupiah(d.jumlah) + ")? Pastikan mutasi sudah terbaca.", "Ya, konfirmasi"))) return;
          await S.store.verifyDonation(id, true);
          S.toast("Donasi dikonfirmasi. Dana masuk ke proyek.", "sukses");
        } else {
          await S.store.verifyDonation(id, false);
          S.toast("Donasi ditolak.", "info");
        }
        SB.refreshNotif && SB.refreshNotif();
        vDonasi();
      }));

    mainEl().querySelectorAll("[data-edit-don]").forEach((b) =>
      b.addEventListener("click", () => modalEditDonasi(b.dataset.editDon)));

    document.getElementById("don-xls").addEventListener("click", () =>
      eksporDonasiExcel(cache.donations, petaProyek(cache.requests), null));

    mainEl().querySelectorAll("[data-del-don]").forEach((b) =>
      b.addEventListener("click", async () => {
        const d = cache.donations.find((x) => x.id === b.dataset.delDon);
        if (!d) return;
        if (!(await S.konfirmasi("Hapus donasi " + d.kuitansi + " dari " + d.donorNama + " (" + (d.jenis === "finansial" ? S.rupiah(d.jumlah) : "barang") + ")? Bila donasi ini sedang terkonfirmasi, dana terkumpul program terkait otomatis berkurang.", "Ya, hapus donasi"))) return;
        try {
          await S.store.deleteDonation(d.id);
          S.toast("Donasi " + d.kuitansi + " telah dihapus.", "sukses");
          vDonasi();
        } catch (e) { S.toast(e.message, "gagal"); }
      }));

    mainEl().querySelectorAll("[data-del-dist]").forEach((b) =>
      b.addEventListener("click", async () => {
        const d = (cache.distributions || []).find((x) => x.id === b.dataset.delDist);
        if (!d) return;
        const label = d.kode || d.code || "penyaluran";
        if (!(await S.konfirmasi("Hapus penyaluran untuk proyek " + label + " (" + S.rupiah(d.jumlah || d.amount || 0) + ")? Angka dana tersalurkan pada proyek terkait otomatis berkurang.", "Ya, hapus penyaluran"))) return;
        try {
          await S.store.deleteDistribution(d.id);
          S.toast("Penyaluran telah dihapus.", "sukses");
          vDonasi();
        } catch (e) { S.toast(e.message, "gagal"); }
      }));

    document.getElementById("form-dist").addEventListener("submit", async (e) => {
      e.preventDefault();
      const requestId = document.getElementById("dist-req").value;
      if (!requestId) { S.toast("Belum ada proyek aktif untuk disalurkan.", "gagal"); return; }
      try {
        await S.store.createDistribution({
          requestId, jenis: document.getElementById("dist-jenis").value,
          jumlah: Number(document.getElementById("dist-jumlah").value) || 0,
          catatan: document.getElementById("dist-catatan").value.trim()
        });
        S.toast("Penyaluran tercatat.", "sukses");
        vDonasi();
      } catch (e2) { S.toast(e2.message, "gagal"); }
    });
  }

  function modalEditDonasi(id) {
    const d = cache.donations.find((x) => x.id === id);
    if (!d) return;
    const jenisOpts = Object.entries(S.JENIS_BANTUAN).map(([k, m]) =>
      '<option value="' + k + '"' + (d.jenis === k ? " selected" : "") + ">" + m.label + "</option>").join("");
    const statusOpts = [["menunggu_konfirmasi", "Menunggu Konfirmasi"], ["terkonfirmasi", "Terkonfirmasi"], ["ditolak", "Ditolak"]].map(([k, l]) =>
      '<option value="' + k + '"' + (d.status === k ? " selected" : "") + ">" + l + "</option>").join("");
    S.modal({
      judul: "Edit Donasi — " + d.kuitansi,
      lebar: 560,
      isi:
        '<div class="form-row">' +
        '<div class="field"><label>Nama Donatur</label><input type="text" id="ed-nama" value="' + S.esc(d.donorNama || "") + '"/></div>' +
        '<div class="field"><label>Anonim</label><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="ed-anonim"' + (d.anonim ? " checked" : "") + ' style="width:auto"/> Sembunyikan nama</label></div>' +
        '<div class="field"><label>Jenis Bantuan</label><select id="ed-jenis">' + jenisOpts + "</select></div>" +
        '<div class="field"><label>Nominal (Rp)</label><input type="number" id="ed-jumlah" min="0" step="10000" value="' + Number(d.jumlah || 0) + '"/></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Rincian Barang (untuk jenis barang)</label><input type="text" id="ed-barang" value="' + S.esc(d.barang || "") + '"/></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Pesan Donatur</label><textarea id="ed-pesan" rows="2">' + S.esc(d.pesan || "") + "</textarea></div>" +
        '<div class="field"><label>Status Donasi</label><select id="ed-status">' + statusOpts + "</select></div>" +
        "</div>" +
        '<p style="font-size:12.5px;color:var(--abu);margin-top:8px">Mengubah nominal donasi finansial yang sudah terkonfirmasi akan ikut menyesuaikan dana terkumpul proyek (mode Demo). Di Supabase, total mengikuti trigger database.</p>',
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="ed-simpan">Simpan Perubahan</button>'
    });
    document.getElementById("ed-simpan").addEventListener("click", async () => {
      const patch = {
        donorNama: document.getElementById("ed-nama").value.trim() || "Hamba Allah",
        anonim: document.getElementById("ed-anonim").checked,
        jenis: document.getElementById("ed-jenis").value,
        jumlah: Number(document.getElementById("ed-jumlah").value) || 0,
        barang: document.getElementById("ed-barang").value.trim(),
        pesan: document.getElementById("ed-pesan").value.trim(),
        status: document.getElementById("ed-status").value
      };
      try {
        await S.store.updateDonationAdmin(d.id, patch);
        S.modalClose(); S.toast("Data donasi diperbarui.", "sukses"); vDonasi();
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  }

  /* ================= MODUL ZISWAF ================= */
  function ziswafBadge(status) {
    const m = S.ZISWAF_STATUS[status] || { label: status, warna: "abu" };
    return '<span class="badge st-' + m.warna + '">' + S.esc(m.label) + "</span>";
  }

  async function vZiswaf() {
    const [dons, salurs, stats] = await Promise.all([
      S.store.listZiswaf({}),
      S.store.listZiswafSalur().catch(() => []),
      S.store.ziswafStats().catch(() => null)
    ]);
    cache.ziswaf = dons;
    cache.ziswafSalur = salurs;
    const st = stats || { perJenis: {}, perKelompok: {}, totalTerkumpul: 0, totalTersalur: 0, jumlahMenunggu: 0 };
    const saldoTotal = st.totalTerkumpul - st.totalTersalur;

    let html = head("Modul ZISWAF", "Pengelolaan Zakat, Infaq, Sedekah & Wakaf dari siswa, guru & tendik, orang tua santri, dan umum — beserta penyalurannya.",
      '<button class="btn btn-blue" id="zw-tambah">' + S.icon("plus", 15) + " Catat ZISWAF (Tunai/Offline)</button> " +
      '<button class="btn btn-ghost" id="zw-csv">' + S.icon("download", 15) + " Ekspor CSV</button>");

    html += '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">' +
      kpi("credit", "var(--hijau)", S.rupiah(st.totalTerkumpul), "Dana terverifikasi") +
      kpi("tool", "var(--oranye)", S.rupiah(st.totalTersalur), "Telah tersalurkan") +
      kpi("trending", "var(--biru)", S.rupiah(saldoTotal), "Saldo menunggu penyaluran") +
      kpi("clock", "var(--ungu)", st.jumlahMenunggu, "Menunggu verifikasi") + "</div>";

    /* chip saldo per jenis */
    html += '<div class="pill-group" style="margin:4px 0 16px">' + Object.entries(S.ZISWAF_JENIS).map(([k, m]) => {
      const x = st.perJenis[k] || { terkumpul: 0, tersalur: 0, saldo: 0 };
      return '<span class="pill">' + S.icon(m.icon, 13) + " " + m.label + ": <b>" + S.rupiah(x.terkumpul) +
        '</b> <small style="color:var(--abu)">(saldo ' + S.rupiah(x.saldo) + ")</small></span>";
    }).join("") + "</div>";

    /* ---- Penerimaan ---- */
    html += '<div class="panel"><h3>Penerimaan ZISWAF (' + dons.length + ')</h3>' +
      '<div class="filter-bar" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      '<select id="zf-f-jenis" style="width:auto"><option value="">Semua Jenis</option>' +
      Object.entries(S.ZISWAF_JENIS).map(([k, m]) => '<option value="' + k + '">' + m.label + "</option>").join("") + "</select>" +
      '<select id="zf-f-kelompok" style="width:auto"><option value="">Semua Kelompok</option>' +
      Object.entries(S.ZISWAF_KELOMPOK).map(([k, m]) => '<option value="' + k + '">' + m.label + "</option>").join("") + "</select>" +
      '<select id="zf-f-status" style="width:auto"><option value="">Semua Status</option>' +
      Object.entries(S.ZISWAF_STATUS).map(([k, m]) => '<option value="' + k + '">' + m.label + "</option>").join("") + "</select>" +
      "</div>" +
      '<div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Kode</th><th>Pemberi</th><th>Jenis & Program</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead><tbody id=\"zw-tbody\"></tbody></table></div></div>";

    /* ---- Penyaluran ---- */
    html += '<div class="panel"><h3>Penyaluran ZISWAF (Ke Mustahik & Masyarakat)</h3>' +
      '<p style="font-size:13px;color:var(--abu);margin-bottom:12px">Penyaluran tidak boleh melebihi saldo dana per jenis. Zakat hanya untuk 8 asnaf; kode penyaluran otomatis (ZS-…).</p>' +
      '<form id="form-zw-salur" class="form-row" style="align-items:end">' +
      '<div class="field"><label>Jenis Dana</label><select id="zs-jenis">' +
      Object.entries(S.ZISWAF_JENIS).map(([k, m]) => '<option value="' + k + '">' + m.label + "</option>").join("") + "</select></div>" +
      '<div class="field"><label>Mustahik / Golongan Penerima</label><select id="zs-mustahik">' +
      Object.entries(S.ZISWAF_MUSTAHIK).map(([k, m]) => '<option value="' + k + '">' + S.esc(m.label) + (m.asnaf ? " (asnaf)" : "") + "</option>").join("") + "</select></div>" +
      '<div class="field"><label>Penerima (golongan/instansi)</label><input type="text" id="zs-penerima" placeholder="Contoh: 20 KK warga sekitar sekolah"/></div>' +
      '<div class="field"><label>Jumlah Orang</label><input type="number" id="zs-jumlah" min="0" placeholder="0"/></div>' +
      '<div class="field"><label>Bentuk</label><input type="text" id="zs-bentuk" placeholder="Sembako, alat tulis, uang..."/></div>' +
      '<div class="field"><label>Nominal (Rp)</label><input type="number" id="zs-nominal" min="0" step="10000" placeholder="0"/></div>' +
      '<div class="field" style="grid-column:1/-1"><label>Catatan / Bukti Penyaluran <span class="req-star">*</span></label><input type="text" id="zs-catatan" placeholder="Contoh: Disalurkan bersama OSIS, foto & daftar penerima tersimpan"/></div>' +
      '<div class="field"><button class="btn btn-primary" type="submit">Catat Penyaluran</button></div>' +
      "</form>" +
      '<div class="table-wrap" style="margin-top:14px"><table class="sb"><thead><tr>' +
      "<th>Kode</th><th>Jenis</th><th>Mustahik</th><th>Bentuk</th><th>Nominal</th><th>Penerima</th><th>Aksi</th></tr></thead><tbody id=\"zs-tbody\"></tbody></table></div></div>";

    /* ---- Rekap ---- */
    html += '<div class="grid grid-2">' +
      '<div class="panel"><h3>Rekap per Jenis Dana</h3><div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Jenis</th><th>Terkumpul</th><th>Tersalur</th><th>Saldo</th></tr></thead><tbody>" +
      Object.entries(S.ZISWAF_JENIS).map(([k, m]) => {
        const x = st.perJenis[k] || { terkumpul: 0, tersalur: 0, saldo: 0 };
        return "<tr><td><b>" + S.esc(m.label) + "</b></td><td>" + S.rupiah(x.terkumpul) + "</td><td>" + S.rupiah(x.tersalur) + "</td><td><b style='color:var(--hijau-tua)'>" + S.rupiah(x.saldo) + "</b></td></tr>";
      }).join("") + "</tbody></table></div></div>" +
      '<div class="panel"><h3>Rekap per Kelompok Pemberi</h3><div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Kelompok</th><th>Terkumpul</th><th>Transaksi</th></tr></thead><tbody>" +
      Object.entries(S.ZISWAF_KELOMPOK).map(([k, m]) => {
        const x = st.perKelompok[k] || { terkumpul: 0, jumlah: 0 };
        return "<tr><td><b>" + S.esc(m.label) + "</b></td><td>" + S.rupiah(x.terkumpul) + "</td><td>" + x.jumlah + "</td></tr>";
      }).join("") + "</tbody></table></div></div></div>";

    mainEl().innerHTML = html;

    function renderTabelPenerimaan() {
      const fj = document.getElementById("zf-f-jenis").value;
      const fk = document.getElementById("zf-f-kelompok").value;
      const fs = document.getElementById("zf-f-status").value;
      const rows = cache.ziswaf.filter((z) => (!fj || z.jenis === fj) && (!fk || z.kelompok === fk) && (!fs || z.status === fs));
      document.getElementById("zw-tbody").innerHTML = rows.length ? rows.map((z) =>
        "<tr><td><b>" + S.esc(z.kode) + "</b><br><small style='color:var(--abu)'>" + S.tanggal(z.tanggal) + "</small></td>" +
        "<td><b>" + S.esc(z.donorNama) + "</b>" + (z.anonim ? " <small style='color:var(--abu)'>(anonim)</small>" : "") +
        "<br><small style='color:var(--abu)'>" + S.esc((S.ZISWAF_KELOMPOK[z.kelompok] || {}).label || z.kelompok) + (z.kelas ? " · " + S.esc(z.kelas) : "") + "</small></td>" +
        "<td>" + S.esc((S.ZISWAF_JENIS[z.jenis] || {}).label || z.jenis) + (z.program ? '<br><small style=\'color:var(--abu)\'>' + S.esc(z.program) + "</small>" : "") + "</td>" +
        "<td>" + (z.bentuk === "uang" ? "<b>" + S.rupiah(z.jumlah) + "</b>" : "<b>" + S.esc(z.barangDetail || "Barang") + "</b><br><small style='color:var(--abu)'>" + S.esc((S.ZISWAF_METODE[z.metode] || {}).label || z.metode) + "</small>") + "</td>" +
        "<td>" + ziswafBadge(z.status) + "</td>" +
        '<td><div class="td-actions">' +
        (z.status === "menunggu" ? '<button class="btn btn-primary" data-verzw="' + z.id + '|1">Verifikasi</button><button class="btn btn-danger" data-verzw="' + z.id + '|0">Tolak</button>' : "") +
        '<button class="btn btn-ghost" data-edit-zw="' + z.id + '">Edit</button>' +
        '<button class="btn btn-danger" data-del-zw="' + z.id + '">Hapus</button>' +
        "</div></td></tr>").join("") : '<tr><td colspan="6" style="color:var(--abu)">Tidak ada data untuk filter ini.</td></tr>';
      mainEl().querySelectorAll("[data-verzw]").forEach((b) =>
        b.addEventListener("click", async () => {
          const [id, ok] = b.dataset.verzw.split("|");
          const z = cache.ziswaf.find((x) => x.id === id);
          if (ok === "1") {
            if (!(await S.konfirmasi("Verifikasi " + z.kode + " (" + (z.bentuk === "uang" ? S.rupiah(z.jumlah) : "barang") + ")? Pastikan dana/barang benar-benar diterima.", "Ya, verifikasi"))) return;
            await S.store.verifyZiswaf(id, true);
            S.toast("ZISWAF terverifikasi — saldo dana bertambah.", "sukses");
          } else {
            const alasan = prompt("Alasan penolakan " + z.kode + ":") || "";
            if (!alasan) { S.toast("Alasan penolakan wajib diisi.", "gagal"); return; }
            await S.store.verifyZiswaf(id, false, alasan);
            S.toast("ZISWAF ditolak.", "info");
          }
          SB.refreshNotif && SB.refreshNotif();
          vZiswaf();
        }));
      mainEl().querySelectorAll("[data-del-zw]").forEach((b) =>
        b.addEventListener("click", async () => {
          const z = cache.ziswaf.find((x) => x.id === b.dataset.delZw);
          if (!z) return;
          if (!(await S.konfirmasi("Hapus penerimaan ZISWAF " + z.kode + " dari " + z.donorNama + "? Rekap dana dan papan kebaikan langsung menyesuaikan.", "Ya, hapus"))) return;
          try {
            await S.store.deleteZiswaf(z.id);
            S.toast("Penerimaan " + z.kode + " telah dihapus.", "sukses");
            vZiswaf();
          } catch (e) { S.toast(e.message, "gagal"); }
        }));
      mainEl().querySelectorAll("[data-edit-zw]").forEach((b) =>
        b.addEventListener("click", () => modalEditZiswaf(b.dataset.editZw)));
    }

    function renderTabelSalur() {
      document.getElementById("zs-tbody").innerHTML = cache.ziswafSalur.length ? cache.ziswafSalur.map((x) =>
        "<tr><td><b>" + S.esc(x.kode) + "</b><br><small style='color:var(--abu)'>" + S.tanggal(x.tanggal) + "</small></td>" +
        "<td>" + S.esc((S.ZISWAF_JENIS[x.jenis] || {}).label || x.jenis) + "</td>" +
        "<td>" + S.esc((S.ZISWAF_MUSTAHIK[x.mustahik] || {}).label || x.mustahik) + "</td>" +
        "<td style='max-width:180px'>" + S.esc(x.bentuk || "-") + "</td>" +
        "<td><b>" + S.rupiah(x.nominal) + "</b></td>" +
        "<td style='max-width:200px;font-size:12.5px;color:var(--abu)'>" + S.esc(x.penerima || "-") + (x.jumlahPenerima ? " (" + x.jumlahPenerima + " org)" : "") + "</td>" +
        '<td><div class="td-actions">' +
        '<button class="btn btn-ghost" data-edit-zs="' + x.id + '">Edit</button>' +
        '<button class="btn btn-danger" data-del-zs="' + x.id + '">Hapus</button>' +
        "</div></td></tr>").join("")
        : '<tr><td colspan="7" style="color:var(--abu)">Belum ada penyaluran.</td></tr>';
      mainEl().querySelectorAll("[data-edit-zs]").forEach((b) =>
        b.addEventListener("click", () => modalEditSalur(b.dataset.editZs)));
      mainEl().querySelectorAll("[data-del-zs]").forEach((b) =>
        b.addEventListener("click", async () => {
          const x = cache.ziswafSalur.find((q) => q.id === b.dataset.delZs);
          if (!x) return;
          if (!(await S.konfirmasi("Hapus penyaluran " + x.kode + " (" + S.rupiah(x.nominal) + ")? Saldo dana " + S.ZISWAF_JENIS[x.jenis].label + " akan kembali naik sebesar nominal ini.", "Ya, hapus"))) return;
          try {
            await S.store.deleteZiswafSalur(x.id);
            S.toast("Penyaluran " + x.kode + " telah dihapus.", "sukses");
            vZiswaf();
          } catch (e) { S.toast(e.message, "gagal"); }
        }));
    }

    renderTabelPenerimaan();
    renderTabelSalur();

    ["zf-f-jenis", "zf-f-kelompok", "zf-f-status"].forEach((id) =>
      document.getElementById(id).addEventListener("change", renderTabelPenerimaan));

    document.getElementById("zw-csv").addEventListener("click", () => {
      const rows = [["Kode", "Tanggal", "Pemberi", "Kelompok", "Kelas", "Jenis", "Program", "Bentuk", "Nominal", "Metode", "Status"]];
      cache.ziswaf.forEach((z) => rows.push([z.kode, z.tanggal, z.donorNama, z.kelompok, z.kelas, z.jenis, z.program, z.bentuk, z.jumlah, z.metode, z.status]));
      const csv = rows.map((row) => row.map((c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(";")).join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "laporan-ziswaf-saling-bantu.csv";
      a.click();
      S.toast("CSV ZISWAF diunduh.", "sukses");
    });

    document.getElementById("zw-tambah").addEventListener("click", () => modalCatatZiswaf());

    document.getElementById("form-zw-salur").addEventListener("submit", async (e) => {
      e.preventDefault();
      const jenis = document.getElementById("zs-jenis").value;
      const nominal = Number(document.getElementById("zs-nominal").value) || 0;
      const catatan = document.getElementById("zs-catatan").value.trim();
      if (!catatan) { S.toast("Catatan/bukti penyaluran wajib diisi.", "gagal"); return; }
      if (nominal <= 0) { S.toast("Nominal penyaluran harus lebih dari 0.", "gagal"); return; }
      try {
        await S.store.createZiswafSalur({
          jenis, mustahik: document.getElementById("zs-mustahik").value,
          penerima: document.getElementById("zs-penerima").value.trim(),
          jumlahPenerima: Number(document.getElementById("zs-jumlah").value) || 0,
          bentuk: document.getElementById("zs-bentuk").value.trim() || "Uang",
          nominal, catatan
        });
        S.toast("Penyaluran ZISWAF tercatat.", "sukses");
        vZiswaf();
      } catch (e2) { S.toast(e2.message, "gagal"); }
    });

    function kpi(ic, warna, nilai, label) {
      return '<div class="kpi"><span class="kpi-ic" style="background:' + warna + ';display:grid">' + S.icon(ic, 18) + "</span><b>" + nilai + "</b><span>" + label + "</span></div>";
    }
  }

  function modalCatatZiswaf() {
    S.modal({
      judul: "Catat ZISWAF (Tunai / Offline)",
      lebar: 620,
      isi:
        '<div class="form-row">' +
        '<div class="field"><label>Jenis ZISWAF</label><select id="zt-jenis">' +
        Object.entries(S.ZISWAF_JENIS).map(([k, m]) => '<option value="' + k + '">' + m.label + "</option>").join("") + "</select></div>" +
        '<div class="field"><label>Program / Tujuan</label><input type="text" id="zt-program" list="zt-list"/><datalist id="zt-list">' +
        (S.ZISWAF_PROGRAM.zakat || []).map((p) => '<option value="' + S.esc(p) + '"></option>').join("") + "</datalist></div>" +
        '<div class="field"><label>Kelompok Pemberi</label><select id="zt-kelompok">' +
        Object.entries(S.ZISWAF_KELOMPOK).map(([k, m]) => '<option value="' + k + '">' + m.label + "</option>").join("") + "</select></div>" +
        '<div class="field"><label>Kelas (khusus siswa)</label><input type="text" id="zt-kelas"/></div>' +
        '<div class="field"><label>Nama Pemberi</label><input type="text" id="zt-nama" required/></div>' +
        '<div class="field"><label>Bentuk</label><select id="zt-bentuk"><option value="uang">Uang</option><option value="barang">Barang</option></select></div>' +
        '<div class="field"><label>Nominal (Rp)</label><input type="number" id="zt-jumlah" min="0" step="1000" value="0"/></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Rincian Barang (bila barang)</label><input type="text" id="zt-barang"/></div>' +
        '<div class="field"><label>Metode</label><select id="zt-metode">' +
        Object.entries(S.ZISWAF_METODE).map(([k, l]) => '<option value="' + k + '">' + l + "</option>").join("") + "</select></div>" +
        '<div class="field"><label>Status</label><select id="zt-status"><option value="terverifikasi">Terverifikasi (langsung)</option><option value="menunggu">Menunggu Verifikasi</option></select></div>' +
        '<div class="field" style="grid-column:1/-1"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="zt-anonim" style="width:auto"/> Tampilkan sebagai "Hamba Allah" (anonim)</label></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Catatan</label><textarea id="zt-catatan" rows="2"></textarea></div>' +
        "</div>" +
        '<p style="font-size:12.5px;color:var(--abu);margin-top:8px">Gunakan form ini untuk setoran tunai / kotak amal yang langsung diterima pengelola. Pilih "Terverifikasi" agar saldo dana langsung bertambah.</p>',
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="zt-simpan">Catat ZISWAF</button>'
    });
    const perbaruiProgram = (jenis) => {
      document.getElementById("zt-list").innerHTML = (S.ZISWAF_PROGRAM[jenis] || []).map((p) => '<option value="' + S.esc(p) + '"></option>').join("");
    };
    perbaruiProgram("zakat");
    document.getElementById("zt-jenis").addEventListener("change", (e) => perbaruiProgram(e.target.value));
    document.getElementById("zt-simpan").addEventListener("click", async () => {
      const bentuk = document.getElementById("zt-bentuk").value;
      const data = {
        jenis: document.getElementById("zt-jenis").value,
        program: document.getElementById("zt-program").value.trim(),
        kelompok: document.getElementById("zt-kelompok").value,
        kelas: document.getElementById("zt-kelas").value.trim(),
        donorNama: document.getElementById("zt-nama").value.trim(),
        anonim: document.getElementById("zt-anonim").checked,
        bentuk, jumlah: Number(document.getElementById("zt-jumlah").value) || 0,
        barangDetail: document.getElementById("zt-barang").value.trim(),
        metode: document.getElementById("zt-metode").value,
        catatan: document.getElementById("zt-catatan").value.trim()
      };
      if (!data.donorNama) { S.toast("Nama pemberi wajib diisi.", "gagal"); return; }
      if (bentuk === "uang" && data.jumlah <= 0) { S.toast("Nominal harus lebih dari 0.", "gagal"); return; }
      if (bentuk === "barang" && data.barangDetail.length < 5) { S.toast("Tuliskan rincian barang.", "gagal"); return; }
      try {
        const z = await S.store.createZiswaf(data);
        const statusBaru = document.getElementById("zt-status").value;
        if (statusBaru && statusBaru !== "menunggu") await S.store.updateZiswafAdmin(z.id, { status: statusBaru });
        S.modalClose();
        S.toast("ZISWAF tercatat (" + z.kode + ").", "sukses");
        vZiswaf();
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  }

  function modalEditZiswaf(id) {
    const z = cache.ziswaf.find((x) => x.id === id);
    if (!z) return;
    const jenisOpts = Object.entries(S.ZISWAF_JENIS).map(([k, m]) => '<option value="' + k + '"' + (z.jenis === k ? " selected" : "") + ">" + m.label + "</option>").join("");
    const kelOpts = Object.entries(S.ZISWAF_KELOMPOK).map(([k, m]) => '<option value="' + k + '"' + (z.kelompok === k ? " selected" : "") + ">" + m.label + "</option>").join("");
    const metodeOpts = Object.entries(S.ZISWAF_METODE).map(([k, l]) => '<option value="' + k + '"' + (z.metode === k ? " selected" : "") + ">" + l + "</option>").join("");
    const statusOpts = Object.entries(S.ZISWAF_STATUS).map(([k, m]) => '<option value="' + k + '"' + (z.status === k ? " selected" : "") + ">" + m.label + "</option>").join("");
    const progOpts = (S.ZISWAF_PROGRAM[z.jenis] || []);
    S.modal({
      judul: "Edit ZISWAF — " + z.kode,
      lebar: 620,
      isi:
        '<div class="form-row">' +
        '<div class="field"><label>Jenis ZISWAF</label><select id="ed-zw-jenis">' + jenisOpts + "</select></div>" +
        '<div class="field"><label>Program / Tujuan</label><input type="text" id="ed-zw-program" value="' + S.esc(z.program) + '" list="ed-zw-list"/><datalist id="ed-zw-list">' +
        progOpts.map((p) => '<option value="' + S.esc(p) + '"></option>').join("") + "</datalist></div>" +
        '<div class="field"><label>Kelompok Pemberi</label><select id="ed-zw-kelompok">' + kelOpts + "</select></div>" +
        '<div class="field"><label>Kelas (khusus siswa)</label><input type="text" id="ed-zw-kelas" value="' + S.esc(z.kelas || "") + '"/></div>' +
        '<div class="field"><label>Nama Pemberi</label><input type="text" id="ed-zw-nama" value="' + S.esc(z.donorNama) + '" required/></div>' +
        '<div class="field" style="grid-column:1/-1"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="ed-zw-anonim"' + (z.anonim ? " checked" : "") + ' style="width:auto"/> Tampilkan sebagai "Hamba Allah" (anonim)</label></div>' +
        '<div class="field"><label>Bentuk</label><select id="ed-zw-bentuk"><option value="uang"' + (z.bentuk === "uang" ? " selected" : "") + '>Uang</option><option value="barang"' + (z.bentuk === "barang" ? " selected" : "") + '>Barang</option></select></div>' +
        '<div class="field"><label>Nominal (Rp)</label><input type="number" id="ed-zw-jumlah" min="0" step="1000" value="' + Number(z.jumlah || 0) + '"/></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Rincian Barang</label><input type="text" id="ed-zw-barang" value="' + S.esc(z.barangDetail || "") + '"/></div>' +
        '<div class="field"><label>Metode</label><select id="ed-zw-metode">' + metodeOpts + "</select></div>" +
        '<div class="field"><label>Status</label><select id="ed-zw-status">' + statusOpts + "</select></div>" +
        '<div class="field" style="grid-column:1/-1"><label>Catatan</label><textarea id="ed-zw-catatan" rows="2">' + S.esc(z.catatan || "") + "</textarea></div>" +
        "</div>" +
        '<p style="font-size:12.5px;color:var(--abu);margin-top:8px">Perubahan status ikut mengubah saldo dana ZISWAF dan tercatat di jejak audit.</p>',
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="ed-zw-simpan">Simpan Perubahan</button>'
    });
    document.getElementById("ed-zw-jenis").addEventListener("change", (e) => {
      document.getElementById("ed-zw-list").innerHTML = (S.ZISWAF_PROGRAM[e.target.value] || []).map((p) => '<option value="' + S.esc(p) + '"></option>').join("");
    });
    document.getElementById("ed-zw-simpan").addEventListener("click", async () => {
      const patch = {
        jenis: document.getElementById("ed-zw-jenis").value,
        program: document.getElementById("ed-zw-program").value.trim(),
        kelompok: document.getElementById("ed-zw-kelompok").value,
        kelas: document.getElementById("ed-zw-kelas").value.trim(),
        donorNama: document.getElementById("ed-zw-nama").value.trim() || "Hamba Allah",
        anonim: document.getElementById("ed-zw-anonim").checked,
        bentuk: document.getElementById("ed-zw-bentuk").value,
        jumlah: Number(document.getElementById("ed-zw-jumlah").value) || 0,
        barangDetail: document.getElementById("ed-zw-barang").value.trim(),
        metode: document.getElementById("ed-zw-metode").value,
        status: document.getElementById("ed-zw-status").value,
        catatan: document.getElementById("ed-zw-catatan").value.trim()
      };
      if (!patch.donorNama) { S.toast("Nama pemberi wajib diisi.", "gagal"); return; }
      try {
        await S.store.updateZiswafAdmin(z.id, patch);
        S.modalClose(); S.toast("Data ZISWAF diperbarui.", "sukses"); vZiswaf();
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  }

  function modalEditSalur(id) {
    const x = cache.ziswafSalur.find((q) => q.id === id);
    if (!x) return;
    const jenisOpts = Object.entries(S.ZISWAF_JENIS).map(([k, m]) => '<option value="' + k + '"' + (x.jenis === k ? " selected" : "") + ">" + m.label + "</option>").join("");
    const musOpts = Object.entries(S.ZISWAF_MUSTAHIK).map(([k, m]) => '<option value="' + k + '"' + (x.mustahik === k ? " selected" : "") + ">" + S.esc(m.label) + "</option>").join("");
    S.modal({
      judul: "Edit Penyaluran — " + x.kode,
      lebar: 600,
      isi:
        '<div class="form-row">' +
        '<div class="field"><label>Jenis Dana</label><select id="es-z-jenis">' + jenisOpts + "</select></div>" +
        '<div class="field"><label>Mustahik / Golongan</label><select id="es-z-mustahik">' + musOpts + "</select></div>" +
        '<div class="field" style="grid-column:1/-1"><label>Penerima (golongan/instansi)</label><input type="text" id="es-z-penerima" value="' + S.esc(x.penerima || "") + '"/></div>' +
        '<div class="field"><label>Jumlah Orang</label><input type="number" id="es-z-jumlah" min="0" value="' + Number(x.jumlahPenerima || 0) + '"/></div>' +
        '<div class="field"><label>Nominal (Rp)</label><input type="number" id="es-z-nominal" min="0" step="10000" value="' + Number(x.nominal || 0) + '"/></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Bentuk Penyaluran</label><input type="text" id="es-z-bentuk" value="' + S.esc(x.bentuk || "") + '"/></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Catatan / Bukti</label><textarea id="es-z-catatan" rows="2">' + S.esc(x.catatan || "") + "</textarea></div>" +
        "</div>" +
        '<p style="font-size:12.5px;color:var(--abu);margin-top:8px">Pastikan nominal tidak melebihi saldo dana jenis terkait. Perubahan tercatat di jejak audit.</p>',
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="es-z-simpan">Simpan Perubahan</button>'
    });
    document.getElementById("es-z-simpan").addEventListener("click", async () => {
      try {
        await S.store.updateZiswafSalurAdmin(x.id, {
          jenis: document.getElementById("es-z-jenis").value,
          mustahik: document.getElementById("es-z-mustahik").value,
          penerima: document.getElementById("es-z-penerima").value.trim(),
          jumlahPenerima: Number(document.getElementById("es-z-jumlah").value) || 0,
          nominal: Number(document.getElementById("es-z-nominal").value) || 0,
          bentuk: document.getElementById("es-z-bentuk").value.trim(),
          catatan: document.getElementById("es-z-catatan").value.trim()
        });
        S.modalClose(); S.toast("Penyaluran diperbarui.", "sukses"); vZiswaf();
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  }

  /* ================= KONTEN ================= */
  async function vKonten() {
    const stories = await S.store.listStories({ publikOnly: false });
    cache.stories = stories;
    let html = head("Manajemen Konten", "Moderasi cerita, kelola pengumuman, dan pantau banner kecil.");
    html += '<div class="panel"><h3>Moderasi Cerita (' + stories.length + ")</h3>" +
      '<div class="table-wrap"><table class="sb"><thead><tr><th>Judul</th><th>Penulis</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
      stories.map((s) =>
        "<tr><td style='max-width:280px'><b>" + S.esc(s.judul) + "</b><br><small style='color:var(--abu)'>" + S.esc(s.isi.slice(0, 80)) + "...</small></td>" +
        "<td>" + S.esc(s.penulisNama) + "</td>" +
        "<td>" + (s.status === "disetujui" ? '<span class="badge st-hijau">Disetujui</span>' : s.status === "ditolak" ? '<span class="badge st-merah">Ditolak</span>' : '<span class="badge st-oranye">Menunggu Review</span>') + "</td>" +
        '<td><div class="td-actions">' +
        '<button class="btn btn-ghost" data-edit-story="' + s.id + '">Edit</button>' +
        (s.status !== "disetujui" ? '<button class="btn btn-primary" data-mod="' + s.id + '|1">Setujui</button>' : "") +
        (s.status !== "ditolak" ? '<button class="btn btn-danger" data-mod="' + s.id + '|0">Tolak</button>' : "") +
        '<button class="btn btn-danger" data-del-story="' + s.id + '">Hapus</button>' +
        "</div></td></tr>").join("") +
      "</tbody></table></div></div>";

    html += '<div class="panel"><h3>Pengumuman Platform</h3>' +
      '<div id="daftar-pengumuman"></div>' +
      '<form id="form-pengumuman" class="form-row" style="align-items:end;margin-top:12px">' +
      '<div class="field"><label>Judul Pengumuman</label><input type="text" id="an-judul" placeholder="Contoh: Jadwal maintenance minggu ini"/></div>' +
      '<div class="field"><button class="btn btn-blue" type="submit">Terbitkan Pengumuman</button></div>' +
      "</form></div>";

    mainEl().innerHTML = html;
    renderPengumuman();

    mainEl().querySelectorAll("[data-mod]").forEach((b) =>
      b.addEventListener("click", async () => {
        const [id, ok] = b.dataset.mod.split("|");
        try { await S.store.moderateStory(id, ok === "1"); S.toast("Status cerita diperbarui.", "sukses"); vKonten(); }
        catch (e) { S.toast(e.message, "gagal"); }
      }));

    mainEl().querySelectorAll("[data-edit-story]").forEach((b) =>
      b.addEventListener("click", () => modalEditCerita(b.dataset.editStory)));

    mainEl().querySelectorAll("[data-del-story]").forEach((b) =>
      b.addEventListener("click", async () => {
        const s = cache.stories.find((x) => x.id === b.dataset.delStory);
        if (!s) return;
        if (!(await S.konfirmasi("Hapus cerita \"" + s.judul.slice(0, 60) + "\" dari " + s.penulisNama + "? Cerita hilang permanen dari halaman Cerita Kebaikan.", "Ya, hapus cerita"))) return;
        try {
          await S.store.deleteStory(s.id);
          S.toast("Cerita telah dihapus.", "sukses");
          vKonten();
        } catch (e) { S.toast(e.message, "gagal"); }
      }));

    document.getElementById("form-pengumuman").addEventListener("submit", async (e) => {
      e.preventDefault();
      const judul = document.getElementById("an-judul").value.trim();
      if (judul.length < 5) { S.toast("Judul pengumuman terlalu pendek.", "gagal"); return; }
      const arr = bacaPengumuman();
      arr.unshift({ judul, tanggal: new Date().toISOString() });
      try {
        await simpanPengumuman(arr);
        S.toast("Pengumuman diterbitkan.", "sukses");
        document.getElementById("an-judul").value = "";
        renderPengumuman();
      } catch (err) { S.toast(err.message, "gagal"); }
    });

    function renderPengumuman() {
      const arr = bacaPengumuman();
      document.getElementById("daftar-pengumuman").innerHTML = arr.length
        ? arr.map((a, i) =>
          '<div class="notif-row"><span class="notif-ic">' + S.icon("megaphone", 15) + "</span>" +
          "<div style='flex:1'><b>" + S.esc(a.judul) + "</b><p>" + S.tanggalWaktu(a.tanggal) + "</p></div>" +
          '<button class="btn btn-ghost btn-sm" data-edit-an="' + i + '">' + S.icon("tool", 12) + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-hapus-an="' + i + '">' + S.icon("x", 12) + "</button></div>").join("")
        : '<p style="font-size:13px;color:var(--abu)">Belum ada pengumuman.</p>';
      document.querySelectorAll("[data-hapus-an]").forEach((b) =>
        b.addEventListener("click", async () => {
          const arr = bacaPengumuman();
          arr.splice(Number(b.dataset.hapusAn), 1);
          try { await simpanPengumuman(arr); renderPengumuman(); }
          catch (err) { S.toast(err.message, "gagal"); }
        }));
      document.querySelectorAll("[data-edit-an]").forEach((b) =>
        b.addEventListener("click", () => {
          const arr = bacaPengumuman();
          const i = Number(b.dataset.editAn);
          if (!arr[i]) return;
          S.modal({
            judul: "Edit Pengumuman",
            isi: '<div class="field"><label>Judul Pengumuman</label><input type="text" id="an-edit-judul" value="' + S.esc(arr[i].judul) + '"/></div>',
            footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="an-edit-simpan">Simpan</button>'
          });
          document.getElementById("an-edit-simpan").addEventListener("click", async () => {
            const v = document.getElementById("an-edit-judul").value.trim();
            if (v.length < 5) { S.toast("Judul pengumuman terlalu pendek.", "gagal"); return; }
            arr[i].judul = v;
            try {
              await simpanPengumuman(arr);
              S.modalClose(); S.toast("Pengumuman diperbarui.", "sukses"); renderPengumuman();
            } catch (err) { S.toast(err.message, "gagal"); }
          });
        }));
    }
    function bacaPengumuman() {
      /* Supabase: pengumuman tersimpan global di tabel site_content (kunci
         pengumuman_json) sehingga tampil di semua perangkat & ikut realtime.
         Mode Demo: tersimpan di localStorage browser ini (data bawaan). */
      try {
        if (S.MODE !== "supabase") {
          const legacy = localStorage.getItem("sb_pengumuman");
          if (legacy) return JSON.parse(legacy);
        }
        const raw = (SB.konten || {}).pengumuman_json || "[]";
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }
    async function simpanPengumuman(arr) {
      if (S.MODE === "supabase") {
        await S.store.setContent({ pengumuman_json: JSON.stringify(arr) });
        SB.konten = SB.konten || {};
        SB.konten.pengumuman_json = JSON.stringify(arr);
        return;
      }
      localStorage.setItem("sb_pengumuman", JSON.stringify(arr));
    }
  }

  function modalEditCerita(id) {
    const s = cache.stories.find((x) => x.id === id);
    if (!s) return;
    const katOpts = '<option value="">Tanpa kategori</option>' + Object.entries(S.KATEGORI).map(([k, m]) =>
      '<option value="' + k + '"' + (s.kategori === k ? " selected" : "") + ">" + m.label + "</option>").join("");
    S.modal({
      judul: "Edit Cerita",
      lebar: 600,
      isi:
        '<div class="field"><label>Judul</label><input type="text" id="es-judul" value="' + S.esc(s.judul) + '" required/></div>' +
        '<div class="field"><label>Kategori (opsional)</label><select id="es-kategori">' + katOpts + "</select></div>" +
        '<div class="field"><label>Isi Cerita</label><textarea id="es-isi" rows="6">' + S.esc(s.isi) + "</textarea></div>" +
        '<p style="font-size:12.5px;color:var(--abu);margin-top:8px">Identitas penulis tidak diubah. Perubahan tercatat di jejak audit.</p>',
      footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="es-simpan">Simpan Perubahan</button>'
    });
    document.getElementById("es-simpan").addEventListener("click", async () => {
      const judul = document.getElementById("es-judul").value.trim();
      const isi = document.getElementById("es-isi").value.trim();
      if (!judul || !isi) { S.toast("Judul dan isi cerita wajib diisi.", "gagal"); return; }
      try {
        await S.store.updateStoryAdmin(s.id, { judul, isi, kategori: document.getElementById("es-kategori").value });
        S.modalClose(); S.toast("Cerita diperbarui.", "sukses"); vKonten();
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  }

  /* ================= PENGATURAN ================= */
  async function vPengaturan() {
    const cfg = window.SB_CONFIG || {};
    const mode = S.MODE === "supabase" ? "supabase" : "demo";
    let html = head("Pengaturan", "Kelola koneksi database Supabase dan preferensi aplikasi — khusus admin/pengelola.");
    html += '<div class="alert alert-warn">' + S.icon("shield", 16) +
      "<span><b>Keamanan:</b> gunakan HANYA <i>anon public key</i>. Service role key dilarang keras ditulis di file frontend. Keamanan data tetap dijaga RLS (Row Level Security) di sisi Supabase.</span></div>";
    html += '<div class="grid grid-2">' +
      '<div class="panel"><h3>Koneksi Supabase</h3>' +
      '<div style="margin-bottom:12px">' + (mode === "supabase"
        ? '<span class="badge st-hijau">Terhubung ke Supabase</span><br><small style="color:var(--abu)">' + S.esc(cfg.SUPABASE_URL || "") + "</small>"
        : '<span class="badge st-abu">Mode Demo</span><br><small style="color:var(--abu)">Data tersimpan di localStorage browser ini, tanpa server.</small>') + "</div>" +
      '<div class="field"><label>Supabase Project URL</label><input type="url" id="st-url" placeholder="https://abcdefgh.supabase.co" value="' + S.esc(cfg.SUPABASE_URL || "") + '"/></div>' +
      '<p class="hint" style="margin:-4px 0 10px">Format: <b>https://xxxxx.supabase.co</b> — salin dari Dashboard Supabase → Project Settings → API. <b>Bukan</b> email atau kata sandi akun Anda.</p>' +
      '<div class="field"><label>Anon Public Key</label><div style="display:flex;gap:8px"><input type="password" id="st-key" style="flex:1" placeholder="eyJhbGciOi..." value="' + S.esc(cfg.SUPABASE_ANON_KEY || "") + '"/><button type="button" class="btn btn-ghost" id="st-toggle">Lihat</button></div></div>' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:6px">' +
      '<button class="btn btn-primary" id="st-simpan">' + S.icon("check", 15) + " Simpan & Terhubung</button>" +
      '<button class="btn btn-blue" id="st-uji">' + S.icon("search", 15) + " Uji Koneksi</button>" +
      '<button class="btn btn-ghost" id="st-demo">Pakai Mode Demo</button>' +
      "</div>" +
      '<p style="font-size:12.5px;color:var(--abu);margin-top:10px">Simpan akan memuat ulang aplikasi agar mode backend aktif langsung berubah — berlaku di semua halaman (beranda, dashboard, admin).</p>' +
      "</div>" +
      '<div class="panel"><h3>Cara Menghubungkan</h3>' +
      '<ol style="font-size:13.5px;line-height:1.9;padding-left:18px;margin:0">' +
      "<li>Masuk ke <b>supabase.com/dashboard</b> memakai email & kata sandi akun Supabase, lalu pilih proyek Anda. <i>(Email ini hanya untuk login dashboard — tidak pernah dipakai di aplikasi ini.)</i></li>" +
      "<li>Buka <b>SQL Editor</b>, jalankan <code>sql/supabase_schema.sql</code> dari paket aplikasi.</li>" +
      "<li>Buka <b>Project Settings → API</b> (atau <i>API Keys</i>), salin <b>Project URL</b> — berformat <code>https://xxxxx.supabase.co</code> — serta <b>anon public key</b> (baris panjang <code>eyJ…</code> atau <code>sb_publishable_…</code>).</li>" +
      "<li>Tempel di form di samping, klik <b>Uji Koneksi</b>, lalu <b>Simpan & Terhubung</b>.</li>" +
      "</ol>" +
      '<div class="alert alert-info" style="margin-top:12px">' + S.icon("bell", 15) + "<span>Jika uji koneksi gagal dengan pesan <i>relation ... does not exist</i> atau <i>function platform_stats ...</i>, berarti schema SQL belum dijalankan di proyek Supabase Anda.</span></div>" +
      "</div></div>";

    html += '<div class="panel"><h3>Informasi Aplikasi</h3><dl class="kv">' +
      "<dt>Nama Aplikasi</dt><dd>" + S.esc(SB.teks ? SB.teks("app_nama") : (cfg.APP_NAME || "Saling Bantu")) + "</dd>" +
      "<dt>Tagline</dt><dd>" + S.esc(SB.teks ? SB.teks("app_tagline") : (cfg.APP_TAGLINE || "")) + "</dd>" +
      "<dt>Kontak Email</dt><dd>" + S.esc(SB.teks ? SB.teks("email_kontak") : (cfg.EMAIL_KONTAK || "-")) + "</dd>" +
      "<dt>Rekening Donasi</dt><dd>" + S.esc(SB.teks ? SB.teks("bank_nama") : "-") + " — " + S.esc(SB.teks ? SB.teks("bank_rekening") : "-") + " a.n. " + S.esc(SB.teks ? SB.teks("bank_atas_nama") : "-") + "</dd>" +
      "</dl><p style=\"font-size:12.5px;color:var(--abu);margin:8px 0 0\">Teks-teks ini dapat diubah dari menu <a href='#isi'><b>Isi Website</b></a> tanpa menyentuh kode.</p></div>";
    mainEl().innerHTML = html;

    const inpKey = document.getElementById("st-key");
    document.getElementById("st-toggle").addEventListener("click", () => {
      inpKey.type = inpKey.type === "password" ? "text" : "password";
      document.getElementById("st-toggle").textContent = inpKey.type === "password" ? "Lihat" : "Sembunyi";
    });
    document.getElementById("st-demo").addEventListener("click", async () => {
      if (!(await S.konfirmasi("Hapus konfigurasi tersimpan dan kembali ke Mode Demo (data lokal browser)?", "Ya, mode demo"))) return;
      localStorage.removeItem("sb_koneksi");
      location.reload();
    });
    document.getElementById("st-uji").addEventListener("click", async () => {
      const url = document.getElementById("st-url").value.trim();
      const key = inpKey.value.trim();
      if (!url || !key) { S.toast("Isi URL dan anon key terlebih dahulu.", "gagal"); return; }
      if (!window.supabase) { S.toast("Pustaka supabase-js belum termuat.", "gagal"); return; }
      S.toast("Menguji koneksi...", "info");
      try {
        const c = window.supabase.createClient(url, key);
        const { data, error } = await c.rpc("platform_stats");
        if (error) throw new Error(error.message);
        S.toast("Koneksi OK — schema terbaca. Total pengguna: " + ((data || {}).total_pengguna || 0) + ".", "sukses");
      } catch (e) { S.toast("Gagal: " + e.message, "gagal"); }
    });
    document.getElementById("st-simpan").addEventListener("click", () => {
      const url = document.getElementById("st-url").value.trim();
      const key = inpKey.value.trim();
      if (/@/.test(url) && !/^https:\/\//.test(url)) {
        S.toast("Kolom Project URL diisi https://xxxxx.supabase.co — BUKAN alamat email. Salin dari Dashboard Supabase → Project Settings → API.", "gagal");
        return;
      }
      if (url && !/^https:\/\/.+/.test(url)) { S.toast("URL harus dimulai dengan https://", "gagal"); return; }
      if ((url && !key) || (!url && key)) { S.toast("URL dan anon key harus diisi berpasangan.", "gagal"); return; }
      try { localStorage.setItem("sb_koneksi", JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key })); }
      catch (e) { S.toast("Gagal menyimpan: " + e.message, "gagal"); return; }
      S.toast("Tersimpan. Memuat ulang aplikasi...", "sukses");
      setTimeout(() => location.reload(), 600);
    });
  }

  /* ================= LAPORAN ================= */
  async function vLaporan() {
    const st = await S.store.adminStats();
    const audit = await S.store.listAudit().catch(() => []);
    const data = await muatDataBulanan();
    const bulanDefault = new Date().toISOString().slice(0, 7);
    const bulanPilih = (document.getElementById("lp-bulan") && document.getElementById("lp-bulan").value) || bulanLaporan || bulanDefault;
    const ag = SB.laporan ? SB.laporan.agregasi(data, bulanPilih, data.reqMap) : null;

    let html = head("Laporan", "Laporan bulanan (PDF & Excel), ringkasan periode berjalan + jejak audit aktivitas admin.");

    /* ---- panel laporan bulanan (PDF + Excel) ---- */
    if (ag) {
      html += '<div class="panel"><h3>Laporan Bulanan (PDF &amp; Excel)</h3>' +
        '<p style="font-size:12.5px;color:var(--abu);margin:-6px 0 12px">Pilih bulan, lalu unduh laporan PDF resmi berkop yayasan (ringkasan, rekap per jenis, rincian donasi &amp; ZISWAF, penyaluran, pengajuan baru) atau ekspor Excel-nya. Logo, nama yayasan, alamat, dan warna diambil dari menu Isi Website → Identitas.</p>' +
        '<div class="form-row" style="align-items:end;max-width:940px">' +
        '<div class="field"><label>Periode Laporan (Bulan)</label><input type="month" id="lp-bulan" value="' + ag.bulan + '" max="' + bulanDefault + '"/></div>' +
        '<div class="field"><button class="btn btn-primary" id="lp-pdf">' + S.icon("file", 15) + " Unduh Laporan PDF Bulanan</button></div>" +
        '<div class="field"><button class="btn btn-ghost" id="lp-xls-donasi">' + S.icon("download", 15) + " Excel Donasi</button></div>" +
        '<div class="field"><button class="btn btn-ghost" id="lp-xls-ziswaf">' + S.icon("download", 15) + " Excel ZISWAF</button></div>" +
        "</div>" +
        '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-top:10px">' +
        kpi("credit", "var(--hijau)", SB.laporan.rupiah(ag.donasiNominal), "Donasi terkonfirmasi (" + ag.donasi.length + " tx)") +
        kpi("gift", "var(--oranye)", SB.laporan.rupiah(ag.ziswafNominal), "ZISWAF masuk (" + ag.ziswaf.length + " tx)") +
        kpi("tool", "var(--biru)", SB.laporan.rupiah(ag.salurZiswafNominal + ag.penyaluranNominal), "Total penyaluran bulan ini") +
        kpi("file", "var(--ungu)", String(ag.pengajuan.length), "Pengajuan baru") +
        "</div></div>";
    }
    html += '<div class="panel"><h3>Ringkasan per Kategori</h3><div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Kategori</th><th>Jumlah Pengajuan</th><th>Porsi</th></tr></thead><tbody>" +
      Object.entries(st.perKategori).map(([k, v]) => {
        const total = Object.values(st.perKategori).reduce((a, b) => a + b, 0) || 1;
        return "<tr><td><b>" + S.esc((S.KATEGORI[k] || {}).label || k) + "</b></td><td>" + v + "</td>" +
          "<td style='min-width:180px'>" + Math.round((v / total) * 100) + "%" + S.progress(v, total) + "</td></tr>";
      }).join("") +
      "</tbody></table></div>" +
      '<div class="more-link" style="text-align:left;margin-top:14px">' +
      '<button class="btn btn-primary" id="btn-csv">' + S.icon("download", 15) + " Ekspor Data Pengajuan (CSV)</button></div></div>";

    html += '<div class="panel"><h3>Jejak Audit (100 terakhir)</h3><div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead><tbody>" +
      (audit.length ? audit.map((a) =>
        "<tr><td>" + S.tanggalWaktu(a.tanggal || a.created_at) + "</td>" +
        "<td>" + S.esc(a.aktor || "-") + "</td>" +
        "<td>" + S.esc(a.aksi) + "</td>" +
        "<td>" + S.esc(a.entitas) + "</td>" +
        "<td style='max-width:240px;font-size:12px;color:var(--abu)'>" + S.esc(JSON.stringify(a.detail || {})).slice(0, 80) + "</td></tr>").join("")
        : '<tr><td colspan="5" style="color:var(--abu)">Belum ada aktivitas tercatat.</td></tr>') +
      "</tbody></table></div></div>";
    mainEl().innerHTML = html;

    /* ---- listener panel laporan bulanan ---- */
    if (ag) {
      document.getElementById("lp-bulan").addEventListener("change", (e) => {
        bulanLaporan = e.target.value || null;
        renderSection();
      });
      document.getElementById("lp-pdf").addEventListener("click", async () => {
        const b = document.getElementById("lp-bulan").value || bulanDefault;
        try { await unduhPdfBulanan(data, b); } catch (e) { S.toast("Gagal membuat PDF: " + e.message, "gagal"); }
      });
      document.getElementById("lp-xls-donasi").addEventListener("click", () => {
        const b = document.getElementById("lp-bulan").value || bulanDefault;
        eksporDonasiExcel(data.dons, data.reqMap, b);
      });
      document.getElementById("lp-xls-ziswaf").addEventListener("click", () => {
        const b = document.getElementById("lp-bulan").value || bulanDefault;
        eksporZiswafExcel(data.zis, data.zsal, b);
      });
    }

    document.getElementById("btn-csv").addEventListener("click", async () => {
      if (!cache.requests.length) { try { cache.requests = await S.store.listRequests({}); } catch (e) { /* pakai cache yang ada */ } }
      const rows = [["Kode", "Judul", "Kategori", "Sub", "Kota", "Status", "Kebutuhan", "Terkumpul", "Tersalur", "Tanggal"]];
      cache.requests.forEach((r) => rows.push([r.code, r.judul, r.kategori, r.sub, r.kota, r.status, r.kebutuhan, r.terkumpul, r.tersalur, r.tanggal]));
      const csv = rows.map((row) => row.map((c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(";")).join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "laporan-pengajuan-saling-bantu.csv";
      a.click();
      S.toast("CSV diunduh.", "sukses");
    });
  }

  /* ================= NAVIGASI ================= */
  function renderNav() {
    document.getElementById("dash-user").innerHTML =
      S.avatar(user.nama, 40) + "<div><b>" + S.esc(user.nama) + "</b><small>Panel Admin</small></div>";
    const aktif = (location.hash || "#statistik").slice(1);
    document.getElementById("dash-nav").innerHTML = MENU.map((m) =>
      '<a class="side-item' + (aktif === m.id ? " on" : "") + '" href="#' + m.id + '">' + S.icon(m.icon, 16) + " " + m.label + "</a>").join("");
  }

  let berhentiWatch = null;   /* pelanggan perubahan data untuk menu aktif */
  let jadwalWatch = null;     /* debounce muat ulang realtime */
  function hentikanWatch() {
    if (typeof berhentiWatch === "function") { try { berhentiWatch(); } catch (e) { /* abaikan */ } }
    berhentiWatch = null;
    clearTimeout(jadwalWatch);
  }

  async function renderSection() {
    const id = (location.hash || "#statistik").slice(1);
    hentikanRealtime(); /* hentikan langganan realtime menu sebelumnya */
    hentikanWatch();
    renderNav();
    const el = mainEl();
    el.innerHTML = '<div class="empty" style="padding:70px 10px">Memuat modul...</div>';
    try {
      if (id === "realtime") await vRealtime();
      else if (id === "pengguna") await vPengguna();
      else if (id === "pengajuan") await vPengajuan();
      else if (id === "donasi") await vDonasi();
      else if (id === "ziswaf") await vZiswaf();
      else if (id === "konten") await vKonten();
      else if (id === "isi") await vIsiWebsite();
      else if (id === "laporan") await vLaporan();
      else if (id === "pengaturan") await vPengaturan();
      else await vStatistik();
    } catch (e) {
      el.innerHTML = '<div class="panel"><div class="alert alert-danger">' + S.icon("x", 16) + "<span>Gagal memuat modul: " + S.esc(e.message) + "</span></div></div>";
    }
    /* Realtime: menu data memuat ulang otomatis saat ada perubahan di Supabase
       (terhubung) atau di browser ini/tab lain (Mode Demo). Menu berbasis form
       panjang (Isi Website, Pengaturan) dan panel Realtime sendiri dikecualikan. */
    if (id !== "isi" && id !== "pengaturan" && id !== "realtime") {
      berhentiWatch = SB.watchData(() => {
        clearTimeout(jadwalWatch);
        jadwalWatch = setTimeout(() => {
          if (document.getElementById("mbk")) { jadwalkanWatchUlang(); return; }
          renderSection();
        }, 800);
      });
    }
  }

  function jadwalkanWatchUlang() {
    clearTimeout(jadwalWatch);
    jadwalWatch = setTimeout(() => { if (!document.getElementById("mbk")) renderSection(); }, 1200);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    user = await S.store.currentUser();
    if (!user) {
      S.toast("Silakan masuk sebagai admin.", "info");
      setTimeout(() => { location.href = "masuk.html?next=admin.html"; }, 800);
      return;
    }
    if (!BOLEH_KELOLA.includes(user.peran)) {
      mainEl().innerHTML = '<div class="panel"><div class="alert alert-danger">' + S.icon("shield", 16) +
        "<span><b>Akses ditolak.</b> Halaman ini hanya untuk admin/pengelola. <a href='dashboard.html'>Kembali ke dashboard</a>.</span></div></div>";
      return;
    }
    renderNav();
    renderSection();
    window.addEventListener("hashchange", renderSection);
  });
})();
