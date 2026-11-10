/* ============================================================
   SALING BANTU — ziswaf.js
   Halaman publik Modul ZISWAF: rekap transparansi, papan
   kebaikan, riwayat penyaluran, dan form penyaluran ZISWAF.
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const $ = (id) => document.getElementById(id);

  function kartuJenis(k, m) {
    return '<div class="cat-card">' +
      '<span class="cat-ic k-' + m.warna + '">' + S.icon(m.icon, 20) + "</span>" +
      "<h4>" + S.esc(m.label) + "</h4>" +
      '<p style="font-size:13px;color:var(--abu)">' + S.esc(m.ket) + "</p>" +
      '<p style="font-size:12.5px;margin-top:8px">Terkumpul: <b style="color:var(--hijau-tua)">' + S.rupiah((window.__zwStats.perJenis[k] || {}).terkumpul || 0) + "</b></p>" +
      '<a href="ziswaf.html#form-ziswaf" class="btn btn-ghost btn-sm" style="margin-top:8px">Berikan ' + S.esc(m.label) + " →</a></div>";
  }

  function isiRekap(stats) {
    $("zw-terkumpul").textContent = S.rupiah(stats.totalTerkumpul);
    $("zw-tersalur").textContent = S.rupiah(stats.totalTersalur);
    $("zw-saldo").textContent = S.rupiah(stats.totalTerkumpul - stats.totalTersalur);
    $("zw-trans").textContent = S.angkaPendek(stats.jumlahTransaksi) + " transaksi";
    $("zw-rekap").innerHTML = Object.entries(S.ZISWAF_JENIS).map(([k, m]) => {
      const x = stats.perJenis[k] || { terkumpul: 0, tersalur: 0, saldo: 0 };
      const pct = x.terkumpul > 0 ? Math.min(100, Math.round((x.tersalur / x.terkumpul) * 100)) : 0;
      return "<tr><td><b>" + S.esc(m.label) + "</b></td><td>" + S.rupiah(x.terkumpul) + "</td><td>" + S.rupiah(x.tersalur) + "</td>" +
        '<td><b style="color:var(--hijau-tua)">' + S.rupiah(x.saldo) + "</b></td>" +
        '<td style="min-width:160px">' + pct + "%" + S.progress(x.tersalur, x.terkumpul || 1) + "</td></tr>";
    }).join("");
  }

  function isiPenerimaan(rows) {
    $("zw-penerimaan").innerHTML = rows.length
      ? rows.slice(0, 12).map((z) =>
        "<tr><td><b>" + S.esc(z.kode) + "</b></td>" +
        "<td>" + S.esc(z.donorNama) + (z.kelas ? ' <span class="badge st-abu">' + S.esc(z.kelas) + "</span>" : "") + "</td>" +
        "<td>" + S.esc((S.ZISWAF_KELOMPOK[z.kelompok] || {}).label || z.kelompok) + "</td>" +
        "<td>" + S.esc((S.ZISWAF_JENIS[z.jenis] || {}).label || z.jenis) + (z.program ? ' <small style="color:var(--abu)">· ' + S.esc(z.program) + "</small>" : "") + "</td>" +
        "<td><b>" + (z.bentuk === "uang" ? S.rupiah(z.jumlah) : S.esc(z.barangDetail || "Barang")) + "</b></td>" +
        "<td>" + S.tanggal(z.tanggal) + "</td></tr>").join("")
      : '<tr><td colspan="6" style="color:var(--abu)">Belum ada penerimaan terverifikasi.</td></tr>';
  }

  function isiSalur(rows) {
    $("zw-salur").innerHTML = rows.length
      ? rows.slice(0, 12).map((x) =>
        "<tr><td><b>" + S.esc(x.kode) + "</b><br><small style='color:var(--abu)'>" + S.tanggal(x.tanggal) + "</small></td>" +
        "<td>" + S.esc((S.ZISWAF_JENIS[x.jenis] || {}).label || x.jenis) + "</td>" +
        "<td>" + S.esc((S.ZISWAF_MUSTAHIK[x.mustahik] || {}).label || x.mustahik) + "</td>" +
        "<td>" + S.esc(x.bentuk || "-") + "</td>" +
        "<td><b>" + S.rupiah(x.nominal) + "</b></td>" +
        "<td>" + S.esc(x.penerima || "-") + (x.jumlahPenerima ? ' <small style="color:var(--abu)">(' + x.jumlahPenerima + " org)</small>" : "") + "</td></tr>").join("")
      : '<tr><td colspan="6" style="color:var(--abu)">Belum ada penyaluran tercatat.</td></tr>';
  }

  function perbaruiDatalist(jenis) {
    $("zf-list-program").innerHTML = (S.ZISWAF_PROGRAM[jenis] || []).map((p) => '<option value="' + S.esc(p) + '"></option>').join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (SB.muatKonten) { await SB.muatKonten(); SB.terapkanKonten && SB.terapkanKonten(); }

    /* rekening dari CMS */
    $("zf-bank-nama").textContent = SB.teks ? SB.teks("bank_nama") : window.SB_CONFIG.BANK.nama;
    $("zf-bank-rek").innerHTML = "<b>" + S.esc(SB.teks ? SB.teks("bank_rekening") : window.SB_CONFIG.BANK.rekening) + "</b>";
    $("zf-bank-an").textContent = SB.teks ? SB.teks("bank_atas_nama") : window.SB_CONFIG.BANK.atas_nama;

    perbaruiDatalist($("zf-jenis").value);

    const user = await S.store.currentUser().catch(() => null);
    if (user) $("zf-nama").value = user.nama;
    else {
      const al = $("zw-login-info");
      al.style.display = "flex";
      al.innerHTML = S.icon("bell", 16) + "<span>Untuk mencatat ZISWAF, kamu perlu <a href='masuk.html?next=ziswaf.html'><b>masuk</b></a> dulu (bisa <a href='daftar.html'>daftar gratis</a>). Sementara itu, rekap & papan kebaikan tetap bisa dilihat di bawah.</span>";
    }

    /* data — dibungkus muatData() agar bisa dipanggil ulang realtime */
    async function muatData() {
      try {
        const stats = await S.store.ziswafStats();
        window.__zwStats = stats;
        isiRekap(stats);
        $("zw-jenis").innerHTML = Object.entries(S.ZISWAF_JENIS).map(([k, m]) => kartuJenis(k, m)).join("");
      } catch (e) { $("zw-rekap").innerHTML = '<tr><td colspan="5" style="color:var(--abu)">Gagal memuat rekap: ' + S.esc(e.message) + "</td></tr>"; }
      try { isiPenerimaan(await S.store.listZiswaf({ publikOnly: true })); }
      catch (e) { $("zw-penerimaan").innerHTML = '<tr><td colspan="6" style="color:var(--abu)">Gagal memuat: ' + S.esc(e.message) + "</td></tr>"; }
      try { isiSalur(await S.store.listZiswafSalur({ publikOnly: true })); }
      catch (e) { $("zw-salur").innerHTML = '<tr><td colspan="6" style="color:var(--abu)">Gagal memuat: ' + S.esc(e.message) + "</td></tr>"; }
    }

    await muatData();

    /* Realtime: rekap, papan kebaikan, dan daftar penyaluran ikut segar otomatis
       saat pengelola memverifikasi/menghapus ZISWAF di tempat lain. */
    if (SB.watchData) {
      let jadwal = null;
      SB.watchData(() => {
        clearTimeout(jadwal);
        jadwal = setTimeout(() => {
          if (document.getElementById("mbk")) return;
          muatData();
        }, 800);
      });
    }

    /* interaksi form */
    $("zf-jenis").addEventListener("change", (e) => perbaruiDatalist(e.target.value));
    $("zf-kelompok").addEventListener("change", (e) => {
      $("zw-kelas-wrap").style.display = e.target.value === "siswa" ? "block" : "none";
    });
    $("zf-bentuk").addEventListener("change", (e) => {
      const barang = e.target.value === "barang";
      $("zw-jumlah-wrap").style.display = barang ? "none" : "block";
      $("zw-barang-wrap").style.display = barang ? "block" : "none";
    });

    $("zf-kirim").addEventListener("click", async () => {
      if (!user) {
        S.toast("Masuk dulu untuk mencatat ZISWAF.", "info");
        setTimeout(() => { location.href = "masuk.html?next=ziswaf.html"; }, 800);
        return;
      }
      const jenis = $("zf-jenis").value;
      const bentuk = $("zf-bentuk").value;
      const nama = $("zf-nama").value.trim();
      const jumlah = Number($("zf-jumlah").value) || 0;
      const barang = $("zf-barang").value.trim();
      const kelompok = $("zf-kelompok").value;
      if (!nama) { S.toast("Isi nama pemberi.", "gagal"); return; }
      if (bentuk === "uang" && jumlah < 1000) { S.toast("Nominal minimal Rp 1.000.", "gagal"); return; }
      if (bentuk === "barang" && barang.length < 5) { S.toast("Tuliskan rincian barang dengan jelas.", "gagal"); return; }
      const btn = $("zf-kirim");
      btn.disabled = true; btn.textContent = "Mengirim...";
      try {
        const z = await S.store.createZiswaf({
          jenis, program: $("zf-program").value.trim(), kelompok,
          kelas: kelompok === "siswa" ? $("zf-kelas").value.trim() : "",
          donorNama: nama, anonim: $("zf-anonim").checked,
          bentuk, jumlah, barangDetail: barang,
          metode: $("zf-metode").value, catatan: $("zf-catatan").value.trim()
        });
        S.modal({
          judul: "Niat Kebaikan Terkirim",
          isi:
            '<div class="receipt"><div class="receipt-head"><b>' + S.esc(z.kode) + "</b><span>Tunggu verifikasi pengelola</span></div>" +
            "<dl class=\"kv\">" +
            "<dt>Jenis</dt><dd>" + S.esc((S.ZISWAF_JENIS[z.jenis] || {}).label || z.jenis) + (z.program ? " — " + S.esc(z.program) : "") + "</dd>" +
            "<dt>Pemberi</dt><dd>" + S.esc(z.donorNama) + (z.kelas ? " (" + S.esc(z.kelas) + ")" : "") + "</dd>" +
            "<dt>Nominal</dt><dd><b>" + (z.bentuk === "uang" ? S.rupiah(z.jumlah) : S.esc(z.barangDetail)) + "</b></dd>" +
            "<dt>Metode</dt><dd>" + S.esc((S.ZISWAF_METODE[z.metode] || {}).label || z.metode || "-") + "</dd></dl></div>" +
            '<p style="font-size:13px;color:var(--abu);margin-top:10px">Simpan kode ini. Jika memilih transfer, kirim ke rekening resmi yayasan di samping; status akan menjadi <b>terverifikasi</b> setelah mutasi terbaca.</p>',
          footer: '<button class="btn btn-primary" onclick="SB.modalClose()">Tutup</button>'
        });
        S.toast("Jazakumullahu khairan! ZISWAF tercatat.", "sukses");
        $("zf-jumlah").value = ""; $("zf-barang").value = ""; $("zf-catatan").value = ""; $("zf-program").value = "";
        const stats2 = await S.store.ziswafStats();
        window.__zwStats = stats2;
        isiRekap(stats2);
        $("zw-jenis").innerHTML = Object.entries(S.ZISWAF_JENIS).map(([k, m]) => kartuJenis(k, m)).join("");
        isiPenerimaan(await S.store.listZiswaf({ publikOnly: true }).catch(() => []));
      } catch (e2) {
        S.toast(e2.message || "Gagal mengirim ZISWAF.", "gagal");
      } finally {
        btn.disabled = false; btn.textContent = "Kirim Niat Kebaikan";
      }
    });
  });
})();
