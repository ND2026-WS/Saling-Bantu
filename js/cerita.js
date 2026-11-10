/* ============================================================
   SALING BANTU — cerita.js (daftar cerita + kirim cerita)
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const $ = (s) => document.querySelector(s);

  function kartuCerita(s) {
    const kat = S.KATEGORI[s.kategori];
    return (
      '<article class="story-card">' +
      '<div class="story-cover k-' + (kat ? kat.warna : "hijau") + '"></div>' +
      '<div class="story-body">' +
      (kat ? S.badgeKategori(s.kategori) : '<span class="badge badge-kategori">Umum</span>') +
      '<h3 style="font-size:16.5px">' + S.esc(s.judul) + "</h3>" +
      '<p class="story-quote">“' + S.esc(s.isi) + '”</p>' +
      '<div class="story-foot">' + S.avatar(s.penulisNama, 34) +
      "<div><b>" + S.esc(s.penulisNama) + "</b><small>" + S.tanggal(s.tanggal) + "</small></div></div>" +
      "</div></article>"
    );
  }

  async function muat(f) {
    const grid = $("#story-grid");
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Memuat cerita...</div>';
    try {
      const list = await S.store.listStories(Object.assign({ publikOnly: true }, f || {}));
      grid.innerHTML = list.length ? list.map(kartuCerita).join("")
        : S.kosong("Belum ada cerita untuk filter ini.", "message");
    } catch (e) {
      grid.innerHTML = S.kosong("Gagal memuat cerita: " + e.message, "message");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const sel = $("#s-kategori");
    Object.entries(S.KATEGORI).forEach(([k, m]) => {
      const o = document.createElement("option");
      o.value = k; o.textContent = m.label;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => muat({ kategori: sel.value }));
    muat();

    /* Realtime: daftar cerita ikut segar otomatis saat admin menyetujui,
       mengedit, atau menghapus cerita di tempat lain. */
    if (SB.watchData) {
      let jadwal = null;
      SB.watchData((info) => {
        if (info && info.tabel && info.tabel !== "stories" && info.tabel !== "profiles") return;
        clearTimeout(jadwal);
        jadwal = setTimeout(() => {
          if (document.getElementById("mbk")) return;
          muat({ kategori: sel.value });
        }, 800);
      });
    }

    $("#btn-tulis").addEventListener("click", async () => {
      const user = await S.store.currentUser();
      if (!user) { S.toast("Masuk dulu untuk menulis cerita.", "info"); setTimeout(() => location.href = "masuk.html?next=cerita-kebaikan.html", 800); return; }
      const p = $("#panel-cerita");
      p.style.display = p.style.display === "none" ? "block" : "none";
      p.scrollIntoView({ behavior: "smooth" });
    });

    $("#btn-kirim-cerita").addEventListener("click", async () => {
      const judul = $("#c-judul").value.trim();
      const isi = $("#c-isi").value.trim();
      let ok = true;
      const f1 = $("#c-judul").closest(".field");
      f1.classList.toggle("has-err", judul.length < 10); if (judul.length < 10) ok = false;
      const f2 = $("#c-isi").closest(".field");
      f2.classList.toggle("has-err", isi.length < 60); if (isi.length < 60) ok = false;
      if (!ok) return;
      try {
        await S.store.createStory({ judul, isi, kategori: $("#c-kategori").value });
        S.toast("Cerita terkirim! Akan tayang setelah review admin.", "sukses");
        $("#c-judul").value = ""; $("#c-isi").value = "";
        $("#panel-cerita").style.display = "none";
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  });
})();
