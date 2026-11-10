/* ============================================================
   SALING BANTU — cari.js (pencarian & filter pengajuan publik)
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const $ = (s) => document.querySelector(s);

  function isiOpsiKategori() {
    const sel = $("#f-kategori");
    Object.entries(S.KATEGORI).forEach(([k, m]) => {
      const o = document.createElement("option");
      o.value = k; o.textContent = m.label;
      sel.appendChild(o);
    });
  }

  async function muat() {
    const f = {
      publikOnly: true,
      q: $("#f-q").value.trim(),
      kategori: $("#f-kategori").value,
      lokasi: $("#f-lokasi").value.trim()
    };
    const grid = $("#hasil-grid");
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Memuat pengajuan...</div>';
    try {
      let hasil = await S.store.listRequests(f);
      if (f.kategori && !hasil.length) {
        // fallback: pastikan kategori terbaca walau kosong hasil
        hasil = [];
      }
      $("#info-jumlah").textContent = "Menampilkan " + hasil.length + " pengajuan yang telah diverifikasi.";
      if (!hasil.length) {
        grid.innerHTML = S.kosong("Tidak ada pengajuan yang cocok dengan filter. Coba ubah kata kunci atau kategori.", "search");
        return;
      }
      grid.innerHTML = hasil.map(S.kartuPengajuan).join("");
      grid.querySelectorAll("[data-detail]").forEach((b) =>
        b.addEventListener("click", () => S.modalDetailPengajuan(b.dataset.detail)));
    } catch (e) {
      grid.innerHTML = S.kosong("Gagal memuat: " + e.message, "search");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    isiOpsiKategori();
    const katParam = S.param("kategori");
    const lokParam = S.param("lokasi");
    if (katParam && S.KATEGORI[katParam]) $("#f-kategori").value = katParam;
    if (lokParam) $("#f-lokasi").value = lokParam;

    $("#btn-cari").addEventListener("click", muat);
    $("#btn-reset").addEventListener("click", () => {
      $("#f-q").value = ""; $("#f-kategori").value = ""; $("#f-lokasi").value = "";
      muat();
    });
    $("#f-q").addEventListener("keydown", (e) => { if (e.key === "Enter") muat(); });
    $("#f-kategori").addEventListener("change", muat);
    muat();

    /* Realtime: hasil pencarian ikut segar otomatis saat ada pengajuan baru
       dipublikasikan / dihapus / berstatus (filter form tetap dipertahankan). */
    if (SB.watchData) {
      let jadwal = null;
      SB.watchData((info) => {
        if (info && info.tabel && info.tabel !== "assistance_requests") return;
        clearTimeout(jadwal);
        jadwal = setTimeout(() => {
          if (document.getElementById("mbk")) return;
          muat();
        }, 800);
      });
    }
  });
})();
