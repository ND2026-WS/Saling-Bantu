/* ============================================================
   SALING BANTU — beranda.js (data beranda: statistik, kartu,
   kategori, cerita + animasi angka)
   ============================================================ */
(function () {
  "use strict";
  const S = SB;

  function kartuPengajuan(r) {
    const kat = S.KATEGORI[r.kategori] || {};
    const pct = r.kebutuhan > 0 ? Math.min(100, Math.round((r.terkumpul / r.kebutuhan) * 100)) : 0;
    return (
      '<article class="card req-card">' +
      '<div class="req-top">' + S.badgeKategori(r.kategori) + S.badgeStatus(r.status) + "</div>" +
      "<h3>" + S.esc(r.judul) + "</h3>" +
      '<p class="req-desc">' + S.esc(r.deskripsi) + "</p>" +
      '<span class="req-loc">' + S.icon("pin", 13) + S.esc(r.kota + ", " + r.provinsi) + " · " + S.esc(r.sub) + "</span>" +
      '<div class="req-prog"><span>Terkumpul <b>' + S.rupiah(r.terkumpul) + "</b></span><span>" + pct + "% dari " + S.rupiah(r.kebutuhan) + "</span></div>" +
      S.progress(r.terkumpul, r.kebutuhan) +
      '<div class="req-actions">' +
      '<button class="btn btn-ghost btn-sm" data-detail="' + r.id + '">' + S.icon("eye", 13) + " LIHAT DETAIL</button>" +
      '<a class="btn btn-primary btn-sm" href="ingin-membantu.html?request=' + r.id + '">' + S.icon("heart", 13) + " BANTU SEKARANG</a>" +
      "</div></article>"
    );
  }

  function kartuCerita(s) {
    const kat = S.KATEGORI[s.kategori];
    return (
      '<article class="story-card">' +
      '<div class="story-cover k-' + (kat ? kat.warna : "hijau") + '"></div>' +
      '<div class="story-body">' +
      (kat ? S.badgeKategori(s.kategori) : "") +
      '<h3 style="font-size:16px">' + S.esc(s.judul) + "</h3>" +
      '<p class="story-quote">“' + S.esc(s.isi.slice(0, 150)) + '…”</p>' +
      '<div class="story-foot">' + S.avatar(s.penulisNama, 34) +
      "<div><b>" + S.esc(s.penulisNama) + "</b><small>" + S.tanggal(s.tanggal) + "</small></div></div>" +
      "</div></article>"
    );
  }

  function modalDetail(id) {
    S.store.getRequest(id).then((r) => {
      const kat = S.KATEGORI[r.kategori] || {};
      const pct = r.kebutuhan > 0 ? Math.min(100, Math.round((r.terkumpul / r.kebutuhan) * 100)) : 0;
      S.modal({
        judul: r.code + " · " + r.judul,
        isi:
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' + S.badgeKategori(r.kategori) + S.badgeStatus(r.status) + "</div>" +
          "<dl class=\"kv\"><dt>Kategori</dt><dd>" + S.esc(kat.label) + " — " + S.esc(r.sub) + "</dd>" +
          "<dt>Lokasi</dt><dd>" + S.esc(r.kota) + ", " + S.esc(r.provinsi) + " (alamat lengkap dijaga kerahasiaannya)</dd>" +
          "<dt>Kebutuhan</dt><dd><b>" + S.rupiah(r.kebutuhan) + "</b></dd>" +
          "<dt>Terkumpul</dt><dd style='color:var(--hijau-tua)'><b>" + S.rupiah(r.terkumpul) + " (" + pct + "%)</b></dd></dl>" +
          '<div style="margin:13px 0">' + S.progress(r.terkumpul, r.kebutuhan) + "</div>" +
          "<p style='font-size:14px;color:#334155'>" + S.esc(r.deskripsi) + "</p>" +
          '<div class="alert alert-info" style="margin-top:14px">' + S.icon("shield", 16) + "<span>Pengajuan ini telah diverifikasi admin. Data pribadi penerima dilindungi sesuai kebijakan privasi platform.</span></div>",
        footer:
          '<a class="btn btn-primary" href="ingin-membantu.html?request=' + r.id + '">' + S.icon("heart", 15) + " Bantu Sekarang</a>"
      });
    });
  }

  function animasiAngka() {
    const els = document.querySelectorAll("[data-hitung]");
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const target = Number(en.target.dataset.hitung);
        const t0 = performance.now(), dur = 1400;
        (function tick(t) {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          en.target.textContent = Math.round(target * eased).toLocaleString("id-ID");
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    /* Muat teks CMS (Panel Admin -> Isi Website) sebelum menggambar angka */
    if (SB.muatKonten) await SB.muatKonten();
    if (SB.terapkanKonten) SB.terapkanKonten();

    /* Kategori — angka "N sub-kategori" adalah rincian jenis bantuan
       (statik, dari daftar KATEGORI), sedangkan jumlah pengajuan aktif
       ditambahkan realtime oleh segarHitungKategori() di bawah. */
    document.getElementById("cat-grid").innerHTML = Object.entries(S.KATEGORI).map(([k, m]) =>
      '<a class="cat-card" data-kat="' + k + '" href="cari-bantuan.html?kategori=' + k + '">' +
      '<span class="cat-ic k-' + m.warna + '">' + S.icon(m.icon, 21) + "</span>" +
      "<div><h3>" + S.esc(m.label) + "</h3><p>" + S.esc(m.desc) + "</p>" +
      '<span class="sub-n">' + m.sub.length + " sub-kategori →</span></div></a>").join("");

    animasiAngka();

    /* Jumlah pengajuan AKTIF per kategori (status dipublikasikan atau
       sedang dibantu — masih menunggu kebaikan tangan pembantu). Angka ini
       YANG realtime: ikut memuat ulang setiap ada perubahan data, misalnya
       admin memverifikasi pengajuan baru. Kartu tanpa pengajuan aktif cukup
       menampilkan jumlah sub-kategorinya saja. */
    function segarHitungKategori(semuaReq) {
      const hitung = {};
      (semuaReq || []).forEach((r) => {
        if (r.status === "dipublikasikan" || r.status === "sedang_dibantu")
          hitung[r.kategori] = (hitung[r.kategori] || 0) + 1;
      });
      document.querySelectorAll("#cat-grid .cat-card").forEach((card) => {
        const m = S.KATEGORI[card.dataset.kat];
        const el = card.querySelector(".sub-n");
        if (!m || !el) return;
        const jml = hitung[card.dataset.kat] || 0;
        el.innerHTML = m.sub.length + " sub-kategori" +
          (jml ? ' · <b style="color:var(--oranye-tua)">' + jml + " pengajuan aktif</b>" : "") + " →";
      });
    }

    /* Semua bagian yang menampilkan data platform — dipanggil saat halaman
       dibuka dan dipanggil ULANG otomatis setiap ada perubahan data
       (realtime Supabase / Mode Demo) sehingga angka & kartu selalu terkini. */
    async function muatDaftar() {
      /* Statistik dari store (data nyata ditambahkan di atas angka dasar CMS) */
      try {
        const stats = await S.store.platformStats().catch(() => null);
        if (stats) {
          const map = [
            ["total_pengguna", "stat_pengguna"], ["total_pengajuan", "stat_pengajuan"], ["total_tersalur", "stat_tersalur"],
            ["total_volunteer", "stat_volunteer"], ["total_komunitas", "stat_komunitas"]
          ];
          map.forEach(([k, kunci], i) => {
            const el = document.querySelectorAll("#stats-grid b")[i];
            const dasar = SB.teks ? Number(SB.teks(kunci)) || 0 : 0;
            if (el && stats[k] > 0) el.dataset.hitung = stats[k] + dasar;
          });
        }
      } catch (e) { /* pakai angka default */ }

      /* Kartu bantuan terbaru + hitungan aktif per kategori */
      try {
        const semuaReq = await S.store.listRequests({ publikOnly: true });
        const reqs = semuaReq.slice(0, 6);
        const grid = document.getElementById("req-grid");
        if (!reqs.length) grid.innerHTML = S.kosong("Belum ada pengajuan yang dipublikasikan.", "package");
        else grid.innerHTML = reqs.map(kartuPengajuan).join("");
        grid.querySelectorAll("[data-detail]").forEach((b) =>
          b.addEventListener("click", () => modalDetail(b.dataset.detail)));
        segarHitungKategori(semuaReq);
      } catch (e) {
        document.getElementById("req-grid").innerHTML = S.kosong("Gagal memuat pengajuan: " + e.message, "package");
      }

      /* Cerita */
      try {
        const stories = (await S.store.listStories({ publikOnly: true })).slice(0, 3);
        document.getElementById("story-grid").innerHTML = stories.length
          ? stories.map(kartuCerita).join("")
          : S.kosong("Belum ada cerita.", "message");
      } catch (e) {
        document.getElementById("story-grid").innerHTML = S.kosong("Gagal memuat cerita.", "message");
      }

      /* ZISWAF: 4 kartu jenis + angka terkumpul nyata */
      const zwGrid = document.getElementById("ziswaf-jenis");
      if (zwGrid) {
        let stats = null;
        try { stats = await S.store.ziswafStats(); } catch (e) { /* tampil tanpa angka */ }
        zwGrid.innerHTML = Object.entries(S.ZISWAF_JENIS).map(([k, m]) => {
          const x = (stats && stats.perJenis[k]) || { terkumpul: 0 };
          return '<a class="cat-card" href="ziswaf.html">' +
            '<span class="cat-ic k-' + m.warna + '">' + S.icon(m.icon, 21) + "</span>" +
            "<div><h3>" + S.esc(m.label) + "</h3><p>" + S.esc(m.ket) + "</p>" +
            '<span class="sub-n">Terkumpul: <b>' + S.rupiah(x.terkumpul) + "</b> →</span></div></a>";
        }).join("");
      }
    }

    await muatDaftar();

    /* Realtime: beranda otomatis memuat ulang kartu & angka saat data berubah —
       misalnya donasi diverifikasi admin di tempat lain, angka terkumpul di
       beranda langsung menyesuaikan tanpa memuat ulang halaman. */
    if (SB.watchData) {
      let jadwal = null;
      SB.watchData(() => {
        clearTimeout(jadwal);
        jadwal = setTimeout(() => {
          if (document.getElementById("mbk")) return; /* modal terbuka — jangan ganggu */
          muatDaftar();
        }, 800);
      });
    }
  });
})();
