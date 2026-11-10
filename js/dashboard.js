/* ============================================================
   SALING BANTU — dashboard.js
   8 menu: Ringkasan, Pengajuan Saya, Bantuan yang Diberikan,
   Riwayat Donasi, Kegiatan Volunteer, Notifikasi, Profil,
   Keamanan Akun
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const mainEl = () => document.getElementById("dash-main");

  const MENU = [
    { id: "ringkasan", label: "Ringkasan Aktivitas", icon: "chart" },
    { id: "pengajuan", label: "Pengajuan Saya", icon: "file" },
    { id: "beri", label: "Bantuan yang Saya Berikan", icon: "gift" },
    { id: "donasi", label: "Riwayat Donasi", icon: "credit" },
    { id: "ziswaf", label: "ZISWAF Saya", icon: "heartHand" },
    { id: "volunteer", label: "Kegiatan Volunteer", icon: "users" },
    { id: "notifikasi", label: "Notifikasi", icon: "bell" },
    { id: "profil", label: "Pengaturan Profil", icon: "sliders" },
    { id: "keamanan", label: "Keamanan Akun", icon: "shield" }
  ];

  let user = null;

  function head(judul, sub, tombolHtml) {
    return '<div class="dash-head"><div><h2>' + judul + "</h2><p>" + sub + "</p></div>" + (tombolHtml || "") + "</div>";
  }

  /* ================= RINGKASAN ================= */
  async function vRingkasan() {
    const [reqs, dons, dists, notifs, regs] = await Promise.all([
      S.store.listRequests({ userId: user.id }).catch(() => []),
      S.store.listDonations({ donorId: user.id }).catch(() => []),
      S.store.listDistributions().catch(() => []),
      S.store.myNotifications().catch(() => []),
      S.store.myRegistrations().catch(() => [])
    ]);
    const mine = reqs.length;
    const terkumpul = reqs.reduce((a, b) => a + (b.terkumpul || 0), 0);
    const donasiKu = dons.length;
    const nilaiDonasi = dons.reduce((a, b) => a + (b.jumlah || 0), 0);
    const html =
      head("Ringkasan Aktivitas", "Halo " + S.esc(user.nama.split(" ")[0]) + ", ini perkembangan kebaikanmu.") +
      '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">' +
      kpi("file", "var(--hijau)", mine, "Pengajuan bantuan") +
      kpi("credit", "var(--biru)", donasiKu, "Kali memberi bantuan") +
      kpi("trending", "var(--oranye)", S.rupiah(terkumpul), "Dana terkumpul pengajuanmu") +
      kpi("users", "var(--teal)", regs.length, "Kegiatan diikuti") +
      "</div>" +
      '<div class="grid grid-2">' +
      '<div class="panel"><h3>Pengajuan Terbaru</h3>' +
      (reqs.length ? reqs.slice(0, 3).map((r) =>
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;flex-wrap:wrap">' +
        "<div><b style='font-size:13.5px'>" + S.esc(r.judul.slice(0, 46)) + "</b><br><small style='color:var(--abu)'>" + S.esc(r.code) + "</small></div>" +
        S.badgeStatus(r.status) + "</div>").join("") : '<p style="font-size:13px;color:var(--abu)">Belum ada pengajuan. <a href="ajukan-bantuan.html">Buat sekarang</a>.</p>') +
      "</div>" +
      '<div class="panel"><h3>Notifikasi Terbaru</h3>' +
      (notifs.length ? notifs.slice(0, 4).map((n) => {
        const m = S.JENIS_NOTIF[n.jenis] || { icon: "bell" };
        return '<div class="notif-row ' + (n.baca ? "" : "unread") + '"><span class="notif-ic">' + S.icon(m.icon, 15) + "</span>" +
          "<div><b>" + S.esc(n.judul) + "</b><p>" + S.esc(n.pesan.slice(0, 90)) + "</p><time style='font-size:11px;color:var(--abu-muda)'>" + S.waktuLalu(n.tanggal) + "</time></div></div>";
      }).join("") : '<p style="font-size:13px;color:var(--abu)">Belum ada notifikasi.</p>') +
      "</div></div>";
    mainEl().innerHTML = html;

    function kpi(ic, warna, nilai, label) {
      return '<div class="kpi"><span class="kpi-ic" style="background:' + warna + ';display:grid">' + S.icon(ic, 18) + "</span><b>" + nilai + "</b><span>" + label + "</span></div>";
    }
  }

  /* ================= PENGAJUAN SAYA ================= */
  async function vPengajuan() {
    const reqs = await S.store.listRequests({ userId: user.id });
    let html = head("Pengajuan Saya", reqs.length + " pengajuan tercatat",
      '<a class="btn btn-primary btn-sm" href="ajukan-bantuan.html">' + S.icon("plus", 14) + " Pengajuan Baru</a>");
    if (!reqs.length) {
      html += '<div class="panel">' + S.kosong("Belum ada pengajuan bantuan.", "file") + "</div>";
      mainEl().innerHTML = html; return;
    }
    html += reqs.map((r) => {
      return (
        '<div class="panel">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
        '<div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">' + S.badgeStatus(r.status) + S.badgeKategori(r.kategori) +
        "<b style='font-size:15.5px'>" + S.esc(r.judul) + "</b></div>" +
        '<span style="font-size:12.5px;color:var(--abu)">' + S.esc(r.code) + " · " + S.tanggal(r.tanggal) + "</span></div>" +
        '<div class="req-prog" style="margin-bottom:5px"><span>Terkumpul <b>' + S.rupiah(r.terkumpul) + "</b></span><span>Tersalurkan " + S.rupiah(r.tersalur) + " · Target " + S.rupiah(r.kebutuhan) + "</span></div>" +
        S.progress(r.terkumpul, r.kebutuhan) +
        '<div style="margin-top:16px">' + S.timeline(r.status) + "</div>" +
        (r.status === "ditolak" && r.alasanTolak ? '<div class="alert alert-danger" style="margin-top:12px">' + S.icon("x", 15) + "<span><b>Alasan penolakan:</b> " + S.esc(r.alasanTolak) + "</span></div>" : "") +
        '<div style="display:flex;gap:9px;margin-top:14px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost btn-sm" data-riwayat="' + r.id + '">' + S.icon("clock", 13) + " Riwayat Verifikasi</button>" +
        (["sedang_dibantu", "bantuan_terpenuhi", "selesai"].includes(r.status)
          ? '<button class="btn btn-ghost btn-sm" data-terima="' + r.id + '">' + S.icon("message", 13) + " Ucapan Terima Kasih</button>" +
            '<button class="btn btn-ghost btn-sm" data-lapor-pakai="' + r.id + '">' + S.icon("clipboard", 13) + " Laporan Penggunaan</button>"
          : "") +
        "</div></div>"
      );
    }).join("");
    mainEl().innerHTML = html;

    mainEl().querySelectorAll("[data-riwayat]").forEach((b) =>
      b.addEventListener("click", async () => {
        const logs = await S.store.listLogs();
        const milik = logs.filter((l) => l.requestId === b.dataset.riwayat || l.request_id === b.dataset.riwayat);
        S.modal({
          judul: "Riwayat Verifikasi",
          isi: milik.length ? milik.map((l) =>
            '<div class="notif-row"><span class="notif-ic">' + S.icon("shield", 14) + "</span><div>" +
            "<b>" + S.esc(S.STATUS[l.ke || l.to_status] ? S.STATUS[l.ke || l.to_status].label : (l.ke || l.to_status)) + "</b>" +
            "<p>" + S.esc(l.oleh || "Admin") + " — " + S.esc(l.catatan || l.note || "-") + "</p>" +
            "<time>" + S.tanggalWaktu(l.tanggal || l.created_at) + "</time></div></div>").join("")
            : '<p style="color:var(--abu);font-size:13.5px">Riwayat detail tersedia di server produksi.</p>'
        });
      }));

    mainEl().querySelectorAll("[data-terima]").forEach((b) =>
      b.addEventListener("click", () => {
        S.modal({
          judul: "Ucapan Terima Kasih",
          isi:
            '<p style="font-size:13.5px;color:var(--abu);margin-bottom:12px">Ucapanmu bisa menjadi cerita kebaikan (disamarkan) setelah direview admin.</p>' +
            '<div class="field"><label>Pesan Terima Kasih</label><textarea id="tk-isi" placeholder="Tulis rasa terima kasihmu kepada para sahabat bantu..."></textarea></div>',
          footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="tk-kirim">Kirim</button>'
        });
        document.getElementById("tk-kirim").addEventListener("click", async () => {
          const isi = document.getElementById("tk-isi").value.trim();
          if (isi.length < 20) { S.toast("Tulis minimal 20 karakter.", "gagal"); return; }
          await S.store.createStory({ judul: "Terima kasih dari seorang penerima bantuan", isi, kategori: "" });
          S.modalClose();
          S.toast("Terima kasih terkirim untuk direview admin.", "sukses");
        });
      }));

    mainEl().querySelectorAll("[data-lapor-pakai]").forEach((b) =>
      b.addEventListener("click", () => {
        S.modal({
          judul: "Laporan Penggunaan Bantuan",
          isi:
            '<div class="alert alert-info">' + S.icon("clipboard", 16) + "<span>Isi laporan penggunaan agar donatur tahu amanahnya tersalurkan. Lampiran bisa dikirim via kontak admin.</span></div>" +
            '<div class="field"><label>Bagaimana bantuan digunakan?</label><textarea id="lp-pakai" placeholder="Contoh: Dana digunakan untuk obat bulan ini sebesar Rp 1.500.000, sisanya tabungan pengobatan..."></textarea></div>',
          footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Batal</button><button class="btn btn-primary" id="lp-kirim">Kirim Laporan</button>'
        });
        document.getElementById("lp-kirim").addEventListener("click", () => {
          const isi = document.getElementById("lp-pakai").value.trim();
          if (isi.length < 20) { S.toast("Isi minimal 20 karakter.", "gagal"); return; }
          S.modalClose();
          S.toast("Laporan penggunaan terkirim ke admin.", "sukses");
        });
      }));
  }

  /* ================= BANTUAN YANG DIBERIKAN ================= */
  async function vBeri() {
    const [dons] = await Promise.all([S.store.listDonations({ donorId: user.id })]);
    const html = head("Bantuan yang Saya Berikan", "Semua kebaikan yang pernah kamu berikan lewat platform ini.") +
      '<div class="grid grid-2">' + dons.map((d) => {
        const jn = S.JENIS_BANTUAN[d.jenis] || { label: d.jenis, icon: "gift" };
        return '<div class="card card-pad">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">' +
          '<span class="badge badge-kategori"><span class="k-ic k-hijau" style="width:20px;height:20px">' + S.icon(jn.icon, 12) + "</span>" + jn.label + "</span>" +
          '<span class="badge ' + (d.status === "terkonfirmasi" ? "st-hijau" : d.status === "ditolak" ? "st-merah" : "st-abu") + '">' + S.esc(d.status.replace("_", " ")) + "</span></div>" +
          (d.requestId ? "<b style='font-size:14.5px'>" + S.esc(d.requestJudul || "Pengajuan #" + d.requestId.slice(0, 8)) + "</b>" : "") +
          (d.jenis === "finansial" ? '<p style="font-size:20px;font-family:var(--font-judul);color:var(--hijau-tua);margin:6px 0"><b>' + S.rupiah(d.jumlah) + "</b></p>" : '<p style="font-size:13.5px;margin:6px 0">' + S.esc(d.barang) + "</p>") +
          (d.pesan ? '<p style="font-size:12.5px;color:var(--abu);font-style:italic">“' + S.esc(d.pesan) + '”</p>' : "") +
          '<small style="color:var(--abu-muda)">' + S.tanggal(d.tanggal) + " · " + S.esc(d.kuitansi) + "</small>" +
          "</div>";
      }).join("") + "</div>" +
      (dons.length ? "" : '<div class="panel">' + S.kosong("Belum pernah memberi bantuan. Mulai dari halaman Ingin Membantu — kecil pun berarti.", "gift") + "</div>");
    mainEl().innerHTML = html;
  }

  /* ================= RIWAYAT DONASI ================= */
  async function vDonasi() {
    const dons = await S.store.listDonations({ donorId: user.id });
    const total = dons.filter((d) => d.status === "terkonfirmasi").reduce((a, b) => a + (b.jumlah || 0), 0);
    let html = head("Riwayat Donasi", "Total terkonfirmasi: <b>" + S.rupiah(total) + "</b> — setiap rupiah tercatat rapi.");
    html += '<div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Kuitansi</th><th>Tanggal</th><th>Jenis</th><th>Nominal / Rincian</th><th>Status</th><th></th>" +
      "</tr></thead><tbody>" +
      (dons.length ? dons.map((d) => {
        const jn = S.JENIS_BANTUAN[d.jenis] || { label: d.jenis };
        return "<tr><td><b>" + S.esc(d.kuitansi) + "</b></td><td>" + S.tanggal(d.tanggal) + "</td><td>" + jn.label + "</td>" +
          "<td>" + (d.jenis === "finansial" ? S.rupiah(d.jumlah) : S.esc(d.barang || "-")) + "</td>" +
          "<td>" + (d.status === "terkonfirmasi" ? '<span class="badge st-hijau">Terkonfirmasi</span>' : d.status === "ditolak" ? '<span class="badge st-merah">Ditolak</span>' : '<span class="badge st-abu">Menunggu Konfirmasi</span>') + "</td>" +
          '<td><button class="btn btn-ghost btn-sm" data-kwt="' + d.id + '">' + S.icon("printer", 12) + " Kuitansi</button></td></tr>";
      }).join("") : '<tr><td colspan="6" style="color:var(--abu)">Belum ada donasi.</td></tr>') +
      "</tbody></table></div>";
    mainEl().innerHTML = html;

    mainEl().querySelectorAll("[data-kwt]").forEach((b) =>
      b.addEventListener("click", async () => {
        const d = dons.find((x) => x.id === b.dataset.kwt);
        if (!d) return;
        let req = null;
        try { req = await S.store.getRequest(d.requestId); } catch (e) { /* abaikan */ }
        S.modal({
          judul: "Kuitansi Digital — " + d.kuitansi,
          lebar: 520,
          isi:
            '<div class="receipt print-area">' +
            '<div class="receipt-head"><div><b style="font-family:var(--font-judul)">' + S.esc(window.SB_CONFIG.APP_NAME) + "</b><br><small>Kuitansi Niat Baik</small></div>" +
            '<div style="text-align:right"><small>Status: <b>' + (d.status === "terkonfirmasi" ? "TERKONFIRMASI" : d.status.toUpperCase()) + "</b></small><br><small>" + S.tanggalWaktu(d.tanggal) + "</small></div></div>" +
            '<dl class="kv">' +
            "<dt>No. Kuitansi</dt><dd><b>" + S.esc(d.kuitansi) + "</b></dd>" +
            "<dt>Pemberi</dt><dd>" + S.esc(d.donorNama) + (d.anonim ? " (disamarkan publik)" : "") + "</dd>" +
            "<dt>Jenis</dt><dd>" + S.esc((S.JENIS_BANTUAN[d.jenis] || {}).label || d.jenis) + "</dd>" +
            (d.jenis === "finansial" ? "<dt>Nominal</dt><dd><b>" + S.rupiah(d.jumlah) + "</b></dd>" : "<dt>Bentuk</dt><dd>" + S.esc(d.barang || "-") + "</dd>") +
            (req ? "<dt>Untuk Pengajuan</dt><dd>" + S.esc(req.code + " — " + req.judul) + "</dd>" : "") +
            "</dl>" +
            '<p style="font-size:11.5px;color:var(--abu);margin-top:14px">Bukti niat baik resmi dari platform ' + S.esc(window.SB_CONFIG.APP_NAME) + ". Nominal final setelah verifikasi mutasi oleh admin.</p>" +
            "</div>",
          footer: '<button class="btn btn-ghost" onclick="SB.modalClose()">Tutup</button><button class="btn btn-primary" onclick="window.print()">' + S.icon("printer", 15) + " Cetak</button>"
        });
      }));
  }

  /* ================= ZISWAF SAYA ================= */
  async function vZiswafUser() {
    const rows = await S.store.listZiswaf({ donorId: user.id }).catch(() => []);
    const total = rows.filter((z) => z.status === "terverifikasi").reduce((a, b) => a + (b.jumlah || 0), 0);
    let html = head("ZISWAF Saya", "Riwayat zakat, infaq, sedekah & wakaf yang kamu catat. Total terverifikasi: <b>" + S.rupiah(total) + "</b>",
      '<a class="btn btn-primary" href="ziswaf.html">' + S.icon("plus", 15) + " Tambah ZISWAF</a>");
    html += '<div class="table-wrap"><table class="sb"><thead><tr>' +
      "<th>Kode</th><th>Tanggal</th><th>Jenis & Program</th><th>Nominal / Rincian</th><th>Metode</th><th>Status</th>" +
      "</tr></thead><tbody>" +
      (rows.length ? rows.map((z) => {
        const m = S.ZISWAF_STATUS[z.status] || { label: z.status, warna: "abu" };
        return "<tr><td><b>" + S.esc(z.kode) + "</b></td><td>" + S.tanggal(z.tanggal) + "</td>" +
          "<td>" + S.esc((S.ZISWAF_JENIS[z.jenis] || {}).label || z.jenis) + (z.program ? ' <small style="color:var(--abu)">· ' + S.esc(z.program) + "</small>" : "") + "</td>" +
          "<td>" + (z.bentuk === "uang" ? "<b>" + S.rupiah(z.jumlah) + "</b>" : S.esc(z.barangDetail || "-")) + "</td>" +
          "<td>" + S.esc((S.ZISWAF_METODE[z.metode] || {}).label || z.metode || "-") + "</td>" +
          '<td><span class="badge st-' + m.warna + '">' + S.esc(m.label) + "</span></td></tr>";
      }).join("") : '<tr><td colspan="6" style="color:var(--abu)">Belum ada catatan ZISWAF. <a href="ziswaf.html">Salurkan kebaikan pertamamu →</a></td></tr>') +
      "</tbody></table></div>" +
      '<div class="alert alert-info" style="margin-top:14px">' + S.icon("bell", 16) +
      "<span>Jazakumullahu khairan. Setiap dana yang terverifikasi akan disalurkan kepada mustahik yang berhak — pantau penyalurannya di halaman <a href='ziswaf.html'>ZISWAF</a>.</span></div>";
    mainEl().innerHTML = html;
  }

  /* ================= VOLUNTEER ================= */
  async function vVolunteer() {
    const regs = await S.store.myRegistrations();
    const vol = await S.store.getVolunteer(user.id).catch(() => null);
    let html = head("Kegiatan Volunteer", "Kegiatan yang kamu ikuti dan sertifikat partisipasi.");
    if (vol) html += '<div class="alert alert-sukses">' + S.icon("award", 16) + "<span>Profil volunteer aktif — keahlian: <b>" + S.esc((vol.keahlian || vol.skills || []).join(", ") || "-") + "</b>. Sertifikat digital diterbitkan setelah kegiatan selesai &amp; kehadiran dikonfirmasi.</span></div>";
    html += '<div class="panel"><h3>Kegiatan yang Diikuti (' + regs.length + ")</h3>" +
      (regs.length ? regs.map((e) =>
        '<div class="notif-row"><span class="notif-ic">' + S.icon("calendar", 15) + "</span><div>" +
        "<b>" + S.esc(e.judul) + "</b><p>" + S.icon("pin", 12) + " " + S.esc(e.lokasi || "-") + " · " + S.tanggal(e.tanggal) + "</p>" +
        '<button class="btn-link" data-sertifikat="' + S.esc(e.judul) + '" style="border:none;background:none;color:var(--biru);font-weight:700;font-size:12.5px;cursor:pointer">Lihat Sertifikat</button>' +
        "</div></div>").join("") : S.kosong("Belum mengikuti kegiatan. Cari di halaman Ingin Membantu.", "calendar")) +
      "</div>" +
      '<div class="more-link"><a class="btn btn-primary" href="ingin-membantu.html#volunteer">' + S.icon("plus", 15) + " Ikut Kegiatan Lain</a></div>";
    mainEl().innerHTML = html;

    mainEl().querySelectorAll("[data-sertifikat]").forEach((b) =>
      b.addEventListener("click", () => {
        S.modal({
          judul: "Sertifikat Partisipasi",
          isi:
            '<div class="receipt" style="text-align:center;padding:34px 22px">' +
            '<div style="width:58px;height:58px;border-radius:50%;background:var(--hijau-muda);color:var(--hijau-tua);display:grid;place-items:center;margin:0 auto 12px">' + S.icon("award", 28) + "</div>" +
            "<h3 style='font-family:var(--font-judul);margin-bottom:4px'>SERTIFIKAT PARTISIPASI</h3>" +
            "<p style='font-size:13px;color:var(--abu)'>Diberikan dengan tulus kepada</p>" +
            "<h2 style='color:var(--hijau-tua);margin:8px 0'>" + S.esc(user.nama) + "</h2>" +
            "<p style='font-size:13.5px'>atas partisipasinya sebagai volunteer pada kegiatan<br><b>" + S.esc(b.dataset.sertifikat) + "</b></p>" +
            "<p style='font-size:12px;color:var(--abu);margin-top:14px'>Disetujui oleh koordinator kegiatan · " + S.tanggal(new Date().toISOString()) + "</p>" +
            "</div>",
          footer: '<button class="btn btn-primary" onclick="window.print()">' + S.icon("printer", 15) + " Cetak Sertifikat</button>"
        });
      }));
  }

  /* ================= NOTIFIKASI ================= */
  async function vNotifikasi() {
    const list = await S.store.myNotifications();
    let html = head("Notifikasi", list.length + " notifikasi", '<button class="btn btn-ghost btn-sm" id="btn-tandai">Tandai Semua Dibaca</button>');
    html += '<div class="panel">' + (list.length ? list.map((n) => {
      const m = S.JENIS_NOTIF[n.jenis] || { icon: "bell", label: n.jenis };
      return '<div class="notif-row ' + (n.baca ? "" : "unread") + '">' +
        '<span class="notif-ic">' + S.icon(m.icon, 16) + "</span>" +
        "<div style='flex:1'><b>" + S.esc(n.judul) + ' <span class="badge st-abu" style="margin-left:6px">' + S.esc(m.label) + "</span></b>" +
        "<p>" + S.esc(n.pesan) + "</p>" +
        "<time style='font-size:11px;color:var(--abu-muda)'>" + S.tanggalWaktu(n.tanggal) + "</time>" +
        (n.link ? ' <button class="btn-link" data-link="' + S.esc(n.link) + '" style="border:none;background:none;color:var(--biru);font-weight:700;font-size:12.5px;cursor:pointer;margin-left:8px">Buka →</button>' : "") +
        "</div></div>";
    }).join("") : S.kosong("Tidak ada notifikasi.", "bell")) + "</div>";
    mainEl().innerHTML = html;

    document.getElementById("btn-tandai").addEventListener("click", async () => {
      await S.store.markAllRead();
      S.toast("Semua notifikasi ditandai dibaca.", "sukses");
      vNotifikasi(); SB.refreshNotif && SB.refreshNotif();
    });
    mainEl().querySelectorAll("[data-link]").forEach((b) =>
      b.addEventListener("click", () => { location.href = b.dataset.link; }));
  }

  /* ================= PROFIL ================= */
  async function vProfil() {
    let html = head("Pengaturan Profil", "Perbarui data agar admin mudah menghubungimu saat verifikasi.");
    html += '<div class="panel" style="max-width:620px">' +
      '<div style="display:flex;gap:14px;align-items:center;margin-bottom:18px">' + S.avatar(user.nama, 56) +
      "<div><b style='font-size:16px'>" + S.esc(user.nama) + "</b><br><small style='color:var(--abu)'>" + S.esc(user.email) + "</small></div></div>" +
      '<form id="form-profil">' +
      '<div class="form-row"><div class="field"><label>Nama Lengkap</label><input type="text" id="p-nama" value="' + S.esc(user.nama) + '"/></div>' +
      '<div class="field"><label>No. WhatsApp</label><input type="tel" id="p-telp" value="' + S.esc(user.telepon || "") + '"/></div></div>' +
      '<div class="form-row"><div class="field"><label>Kota</label><input type="text" id="p-kota" value="' + S.esc(user.kota || "") + '"/></div>' +
      '<div class="field"><label>Peran</label><input type="text" value="' + S.esc(user.peran) + '" disabled style="background:var(--latar)"/></div></div>' +
      '<div class="field"><label>Bio Singkat</label><textarea id="p-bio" style="min-height:80px">' + S.esc(user.bio || "") + "</textarea></div>" +
      '<button class="btn btn-primary" type="submit">Simpan Perubahan</button></form></div>';
    mainEl().innerHTML = html;
    document.getElementById("form-profil").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await S.store.updateProfile({
          nama: document.getElementById("p-nama").value.trim(),
          telepon: document.getElementById("p-telp").value.trim(),
          kota: document.getElementById("p-kota").value.trim(),
          bio: document.getElementById("p-bio").value.trim()
        });
        S.toast("Profil tersimpan.", "sukses");
        setTimeout(() => location.reload(), 900);
      } catch (err) { S.toast(err.message, "gagal"); }
    });
  }

  /* ================= KEAMANAN ================= */
  async function vKeamanan() {
    const html = head("Keamanan Akun", "Ganti kata sandi secara berkala dan jaga akunmu tetap aman.") +
      '<div class="grid grid-2">' +
      '<div class="panel"><h3>Ganti Kata Sandi</h3>' +
      '<form id="form-sandi">' +
      '<div class="field"><label>Kata Sandi Lama</label><input type="password" id="s-lama" autocomplete="current-password"/><p class="err">Wajib diisi.</p></div>' +
      '<div class="field"><label>Kata Sandi Baru</label><input type="password" id="s-baru" autocomplete="new-password"/><p class="err">Minimal 8 karakter.</p></div>' +
      '<div class="field"><label>Ulangi Kata Sandi Baru</label><input type="password" id="s-baru2" autocomplete="new-password"/><p class="err">Tidak sama.</p></div>' +
      '<button class="btn btn-primary" type="submit">Perbarui Kata Sandi</button></form></div>' +
      '<div class="panel"><h3>Status Akun</h3>' +
      '<dl class="kv"><dt>Email</dt><dd>' + S.esc(user.email) + "</dd>" +
      "<dt>Peran</dt><dd>" + S.esc(user.peran) + "</dd>" +
      "<dt>Status</dt><dd>" + (user.aktif === false ? '<span class="badge st-merah">Dinonaktifkan</span>' : '<span class="badge st-hijau">Aktif</span>') + "</dd>" +
      "<dt>Verifikasi</dt><dd>" + (user.terverifikasi ? '<span class="badge st-hijau">Terverifikasi</span>' : '<span class="badge st-abu">Belum terverifikasi</span>') + "</dd></dl>" +
      '<div class="alert alert-warn" style="margin-top:14px">' + S.icon("shield", 16) + "<span>Nomor rekening &amp; identitas <b>tidak pernah</b> diminta melalui chat. Admin menghubungi melalui kanal resmi.</span></div>" +
      (SB.MODE === "demo" ? '<button class="btn btn-danger btn-sm" id="btn-reset-demo" style="margin-top:8px">Reset Data Demo</button>' : "") +
      "</div></div>";
    mainEl().innerHTML = html;

    document.getElementById("form-sandi").addEventListener("submit", async (e) => {
      e.preventDefault();
      const lama = document.getElementById("s-lama").value;
      const baru = document.getElementById("s-baru").value;
      const baru2 = document.getElementById("s-baru2").value;
      if (baru.length < 8) { S.toast("Kata sandi baru minimal 8 karakter.", "gagal"); return; }
      if (baru !== baru2) { S.toast("Ulangi sandi tidak sama.", "gagal"); return; }
      try {
        await S.store.gantiSandi(lama, baru);
        S.toast("Kata sandi berhasil diperbarui.", "sukses");
        e.target.reset();
      } catch (err) { S.toast(err.message, "gagal"); }
    });

    const rd = document.getElementById("btn-reset-demo");
    if (rd) rd.addEventListener("click", async () => {
      if (await S.konfirmasi("Semua data demo akan dikembalikan ke awal. Lanjutkan?", "Ya, reset")) {
        await S.store.resetDemo();
        location.reload();
      }
    });
  }

  /* ================= NAVIGASI ================= */
  function renderNav() {
    document.getElementById("dash-user").innerHTML =
      S.avatar(user.nama, 40) + "<div><b>" + S.esc(user.nama) + "</b><small>" + S.esc(user.peran) + "</small></div>";
    const aktif = (location.hash || "#ringkasan").slice(1);
    document.getElementById("dash-nav").innerHTML = MENU.map((m) =>
      '<a class="side-item' + (aktif === m.id ? " on" : "") + '" href="#' + m.id + '" data-menu="' + m.id + '">' +
      S.icon(m.icon, 16) + " " + m.label + "</a>").join("");
  }

  async function renderSection() {
    const id = (location.hash || "#ringkasan").slice(1);
    renderNav();
    const el = mainEl();
    el.innerHTML = '<div class="empty" style="padding:70px 10px">Memuat...</div>';
    try {
      if (id === "pengajuan") await vPengajuan();
      else if (id === "beri") await vBeri();
      else if (id === "donasi") await vDonasi();
      else if (id === "ziswaf") await vZiswafUser();
      else if (id === "volunteer") await vVolunteer();
      else if (id === "notifikasi") await vNotifikasi();
      else if (id === "profil") await vProfil();
      else if (id === "keamanan") await vKeamanan();
      else await vRingkasan();
    } catch (e) {
      el.innerHTML = '<div class="panel"><div class="alert alert-danger">' + S.icon("x", 16) + "<span>Gagal memuat: " + S.esc(e.message) + "</span></div></div>";
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    user = await S.store.currentUser();
    if (!user) {
      S.toast("Silakan masuk untuk membuka dashboard.", "info");
      setTimeout(() => { location.href = "masuk.html?next=dashboard.html"; }, 800);
      return;
    }
    if (user.peran === "admin" && !location.hash) { location.href = "admin.html"; return; }
    renderNav();
    renderSection();
    window.addEventListener("hashchange", renderSection);

    /* Realtime: dashboard memuat ulang bagian aktif otomatis saat data berubah
       (donasi terkonfirmasi, pengajuan berstatus, ZISWAF terverifikasi, dsb). */
    if (SB.watchData) {
      let jadwal = null;
      SB.watchData(() => {
        clearTimeout(jadwal);
        jadwal = setTimeout(() => {
          if (document.getElementById("mbk")) return; /* modal terbuka — jangan ganggu */
          renderSection();
        }, 800);
      });
    }
  });
})();
