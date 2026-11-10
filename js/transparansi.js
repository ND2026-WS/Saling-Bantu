/* ============================================================
   SALING BANTU — transparansi.js (laporan dana publik, privasi,
   form lapor penyalahgunaan)
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const $ = (s) => document.querySelector(s);

  let reqsTerkini = []; /* daftar proyek terakhir — dipakai listener klik yang
                           dipasang sekali agar realtime muat ulang tidak menumpuk */

  async function muat() {
    try {
      const stats = await S.store.platformStats();
      $("#d-terkumpul").textContent = S.rupiah(stats.total_dana_terkumpul || 0);
      $("#d-tersalur").textContent = S.rupiah(stats.total_dana_tersalur || 0);
      $("#d-pengajuan").textContent = (stats.total_tersalur || 0) + " proyek";
    } catch (e) { /* diam */ }

    /* Proyek */
    try {
      const reqs = await S.store.listRequests({ publikOnly: true });
      reqsTerkini = reqs;
      const tb = $("#tabel-proyek tbody");
      if (!reqs.length) { tb.innerHTML = '<tr><td colspan="8" style="color:var(--abu)">Belum ada proyek publik.</td></tr>'; }
      else {
        tb.innerHTML = reqs.map((r) => {
          const pct = r.kebutuhan > 0 ? Math.min(100, Math.round((r.terkumpul / r.kebutuhan) * 100)) : 0;
          return "<tr>" +
            "<td><b>" + S.esc(r.code) + "</b></td>" +
            "<td style='max-width:230px'>" + S.esc(r.judul) + "<br><small style='color:var(--abu)'>" + S.esc((S.KATEGORI[r.kategori] || {}).label || "") + "</small></td>" +
            "<td>" + S.esc(r.kota) + "</td>" +
            "<td>" + S.rupiah(r.kebutuhan) + "</td>" +
            "<td style='color:var(--hijau-tua)'><b>" + S.rupiah(r.terkumpul) + "</b></td>" +
            "<td style='color:var(--oranye-tua)'><b>" + S.rupiah(r.tersalur) + "</b></td>" +
            "<td style='min-width:110px'>" + pct + "%" + S.progress(r.terkumpul, r.kebutuhan) + "</td>" +
            "<td>" + S.badgeStatus(r.status) + "</td>" +
            "</tr>";
        }).join("");
      }
      tb.querySelectorAll("tr").forEach((tr) => {
        const kode = tr.querySelector("td b");
        if (kode) tr.style.cursor = "pointer";
      });
      $("#d-selesai").textContent = reqs.filter((r) => r.status === "selesai").length + " proyek";
    } catch (e) {
      $("#tabel-proyek tbody").innerHTML = '<tr><td colspan="8" style="color:var(--abu)">Gagal memuat: ' + S.esc(e.message) + "</td></tr>";
    }

    /* Penyaluran */
    try {
      const dists = await S.store.listDistributions();
      const tb2 = $("#tabel-penyaluran tbody");
      if (!dists.length) tb2.innerHTML = '<tr><td colspan="5" style="color:var(--abu)">Belum ada penyaluran tercatat.</td></tr>';
      else tb2.innerHTML = dists.map((d) => {
        const jenis = (S.JENIS_BANTUAN[d.jenis || d.type] || {}).label || d.jenis || d.type;
        const jumlah = Number(d.jumlah || d.amount || 0);
        return "<tr>" +
          "<td>" + S.tanggal(d.tanggal || d.distributed_at) + "</td>" +
          "<td><b>" + S.esc(d.kode || d.code || "-") + "</b></td>" +
          "<td>" + S.esc(jenis) + "</td>" +
          "<td>" + (jumlah > 0 ? S.rupiah(jumlah) : S.esc(d.barang || d.item_description || "-")) + "</td>" +
          "<td style='max-width:260px;font-size:12.5px;color:var(--abu)'>" + S.esc(d.catatan || d.note || "") + "</td>" +
          "</tr>";
      }).join("");
    } catch (e) { /* diam */ }
  }

  document.addEventListener("DOMContentLoaded", () => {
    /* ikon kpi */
    const ikons = ["credit", "tool", "package", "checkCircle"];
    document.querySelectorAll("#dana-kpi .kpi-ic").forEach((el, i) => { el.innerHTML = S.icon(ikons[i], 18); });
    document.querySelectorAll("#dana-kpi .kpi-ic").forEach((el, i) => {
      el.style.background = ["var(--hijau)", "var(--oranye)", "var(--biru)", "var(--teal)"][i];
    });

    muat();

    /* detail proyek saat baris tabel diklik — dipasang SEKALI, data mengikuti
       muat() terakhir (aman untuk muat ulang realtime) */
    $("#tabel-proyek").addEventListener("click", (e) => {
      const b = e.target.closest("td b");
      if (!b) return;
      const r = reqsTerkini.find((x) => x.code === b.textContent);
      if (r) S.modalDetailPengajuan(r.id, { tanpaBantu: true });
    });

    /* Realtime: angka dana publik, daftar proyek, dan penyaluran ikut segar
       otomatis saat ada verifikasi/hapus/donasi baru di tempat lain. */
    if (SB.watchData) {
      let jadwal = null;
      SB.watchData(() => {
        clearTimeout(jadwal);
        jadwal = setTimeout(() => {
          if (document.getElementById("mbk")) return;
          muat();
        }, 800);
      });
    }

    $("#btn-lapor").addEventListener("click", async () => {
      const isi = $("#lp-isi").value.trim();
      const f = $("#lp-isi").closest(".field");
      if (isi.length < 20) { f.classList.add("has-err"); return; }
      f.classList.remove("has-err");
      try {
        await S.store.laporPenyalahgunaan({
          pelapor: (await S.store.currentUser()) ? (await S.store.currentUser()).nama : "Anonim",
          kode: $("#lp-kode").value.trim(), isi
        });
        S.toast("Laporan terkirim. Terima kasih menjaga amanah!", "sukses");
        $("#lp-isi").value = ""; $("#lp-kode").value = "";
      } catch (e) { S.toast(e.message, "gagal"); }
    });
  });
})();
