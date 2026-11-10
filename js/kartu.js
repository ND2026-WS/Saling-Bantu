/* ============================================================
   SALING BANTU — kartu.js (komponen bersama: kartu pengajuan
   & modal detail, dipakai beberapa halaman)
   ============================================================ */
(function () {
  "use strict";
  const S = SB;

  SB.kartuPengajuan = function (r) {
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
  };

  SB.modalDetailPengajuan = function (id, ops) {
    ops = ops || {};
    S.store.getRequest(id).then((r) => {
      const kat = S.KATEGORI[r.kategori] || {};
      const pct = r.kebutuhan > 0 ? Math.min(100, Math.round((r.terkumpul / r.kebutuhan) * 100)) : 0;
      S.modal({
        judul: r.code + " · " + r.judul,
        lebar: 620,
        isi:
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' + S.badgeKategori(r.kategori) + S.badgeStatus(r.status) + "</div>" +
          '<dl class="kv"><dt>Kategori</dt><dd>' + S.esc(kat.label) + " — " + S.esc(r.sub) + "</dd>" +
          "<dt>Lokasi</dt><dd>" + S.esc(r.kota) + ", " + S.esc(r.provinsi) + " (alamat lengkap dijaga kerahasiaannya)</dd>" +
          "<dt>Kebutuhan</dt><dd><b>" + S.rupiah(r.kebutuhan) + "</b></dd>" +
          "<dt>Terkumpul</dt><dd style='color:var(--hijau-tua)'><b>" + S.rupiah(r.terkumpul) + " (" + pct + "%)</b></dd>" +
          "<dt>Tersalurkan</dt><dd>" + S.rupiah(r.tersalur) + "</dd>" +
          "<dt>Dibuat</dt><dd>" + S.tanggal(r.tanggal) + "</dd></dl>" +
          '<div style="margin:13px 0">' + S.progress(r.terkumpul, r.kebutuhan) + "</div>" +
          "<p style='font-size:14px;color:#334155'>" + S.esc(r.deskripsi) + "</p>" +
          (r.status === "selesai" ? '<div class="alert alert-sukses">' + S.icon("checkCircle", 16) + "<span>Pengajuan ini telah selesai. Laporan penggunaan bantuan tersedia di halaman Transparansi.</span></div>" : "") +
          '<div class="alert alert-info">' + S.icon("shield", 16) + "<span>Pengajuan ini telah diverifikasi admin. Data pribadi penerima dilindungi sesuai kebijakan privasi platform.</span></div>",
        footer:
          '<button class="btn btn-ghost" data-tutup="1">Tutup</button>' +
          (ops.tanpaBantu ? "" : '<a class="btn btn-primary" href="ingin-membantu.html?request=' + r.id + '">' + S.icon("heart", 15) + " Bantu Sekarang</a>")
      });
      const b = document.querySelector("[data-tutup]");
      if (b) b.addEventListener("click", S.modalClose);
    });
  };
})();
