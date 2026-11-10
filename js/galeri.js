/* ============================================================
   SALING BANTU — galeri.js (halaman publik Galeri Foto)
   - Memuat foto aktif (publikOnly) dari store
   - Filter kategori & program
   - Lightbox: klik foto -> tampil besar + keterangan + navigasi
   - Realtime: galeri memuat ulang otomatis saat admin menambah/
     mengubah/menghapus foto (Supabase maupun Mode Demo)
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const $ = (s) => document.querySelector(s);

  let daftar = [];
  let petaProyek = {};
  let idxBuka = -1;

  function namaKategori(k) {
    const m = (S.GALERI_KATEGORI || {})[k];
    return m ? '<span class="badge st-' + m.warna + '">' + S.esc(m.label) + "</span>" : "";
  }
  function pendek(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }
  function badgeProyek(g, maks) {
    if (!g.requestId || !petaProyek[g.requestId]) return "";
    return '<span class="badge badge-kategori">' + S.icon("file", 12) + " " + S.esc(pendek(petaProyek[g.requestId], maks)) + "</span>";
  }

  function kartu(g, i) {
    return (
      '<article class="gal-card" data-idx="' + i + '" role="button" tabindex="0" aria-label="Perbesar foto ' + S.esc(g.judul) + '">' +
      '<div class="gal-img"><img src="' + S.esc(g.foto) + '" alt="' + S.esc(g.judul) + '" loading="lazy"/></div>' +
      '<div class="gal-body">' +
      '<div class="gal-badges">' + namaKategori(g.kategori) + badgeProyek(g, 30) + "</div>" +
      "<h3>" + S.esc(g.judul) + "</h3>" +
      (g.keterangan ? '<p class="gal-ket">' + S.esc(g.keterangan) + "</p>" : "") +
      '<small class="gal-tgl">' + S.icon("calendar", 12) + " " + S.tanggal(g.tanggal) + "</small>" +
      "</div></article>"
    );
  }

  async function muat() {
    const grid = $("#galeri-grid");
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Memuat galeri...</div>';
    try {
      daftar = await S.store.listGaleri({
        publikOnly: true,
        kategori: $("#s-kategori").value,
        requestId: $("#s-program").value
      });
      grid.innerHTML = daftar.length
        ? daftar.map(kartu).join("")
        : S.kosong("Belum ada foto pada filter ini. Foto kegiatan akan ditambahkan oleh admin.", "image");
      grid.querySelectorAll(".gal-card").forEach((el) => {
        el.addEventListener("click", () => buka(Number(el.dataset.idx)));
        el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); buka(Number(el.dataset.idx)); } });
      });
    } catch (e) {
      grid.innerHTML = S.kosong("Gagal memuat galeri: " + e.message, "image");
    }
  }

  function buka(i) {
    if (!daftar.length) return;
    idxBuka = (i + daftar.length) % daftar.length;
    const g = daftar[idxBuka];
    S.modal({
      judul: g.judul,
      lebar: 800,
      isi:
        '<div class="lb-wrap"><img class="lb-img" src="' + S.esc(g.foto) + '" alt="' + S.esc(g.judul) + '"/></div>' +
        '<div class="lb-info">' + namaKategori(g.kategori) + badgeProyek(g, 60) +
        (g.keterangan ? '<p style="margin:10px 0 6px">' + S.esc(g.keterangan) + "</p>" : "") +
        '<small style="color:var(--abu)">Foto ke-' + (idxBuka + 1) + " dari " + daftar.length + " • " + S.esc(g.oleh) + " • " + S.tanggal(g.tanggal) + "</small></div>",
      footer:
        '<button class="btn btn-ghost" id="lb-prev">‹ Sebelumnya</button>' +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" id="lb-next">Selanjutnya ›</button>'
    });
    document.getElementById("lb-prev").addEventListener("click", () => buka(idxBuka - 1));
    document.getElementById("lb-next").addEventListener("click", () => buka(idxBuka + 1));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    /* Filter kategori galeri */
    const sel = $("#s-kategori");
    Object.entries(S.GALERI_KATEGORI || {}).forEach(([k, m]) => {
      const o = document.createElement("option");
      o.value = k; o.textContent = m.label;
      sel.appendChild(o);
    });
    sel.addEventListener("change", muat);

    /* Filter program: daftar pengajuan publik sebagai "program bantuan" */
    const selP = $("#s-program");
    try {
      const reqs = await S.store.listRequests({ publikOnly: true });
      (reqs || []).forEach((r) => { petaProyek[r.id] = r.judul; });
      Object.keys(petaProyek).sort((a, b) => petaProyek[a].localeCompare(petaProyek[b])).forEach((id) => {
        const o = document.createElement("option");
        o.value = id; o.textContent = pendek(petaProyek[id], 52);
        selP.appendChild(o);
      });
    } catch (e) { /* filter program tetap kosong — bukan galat fatal */ }
    selP.addEventListener("change", muat);

    muat();

    /* Realtime: daftar galeri ikut segar otomatis saat admin menambah,
       mengubah, atau menghapus foto di tempat lain. */
    if (SB.watchData) {
      let jadwal = null;
      SB.watchData((info) => {
        if (info && info.tabel && info.tabel !== "gallery_photos" && info.tabel !== "profiles") return;
        clearTimeout(jadwal);
        jadwal = setTimeout(() => {
          if (document.getElementById("mbk")) return;
          muat();
        }, 800);
      });
    }
  });
})();
