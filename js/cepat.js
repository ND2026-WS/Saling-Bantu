/* ============================================================
   SALING BANTU — cepat.js
   Halaman donasi-cepat.html — Jalur Cepat Berdonasi TANPA akun:
   1. Tamu isi nama + nomor WhatsApp, pilih program & nominal.
   2. Klik "Catat Donasi" -> nomor kuitansi terbit (status
      menunggu_konfirmasi, langsung terlihat di panel admin).
   3. Tombol WhatsApp terbuka ke admin dengan pesan terisi otomatis
      (nomor admin diambil dari CMS Isi Website -> Identitas ->
      "Nomor WhatsApp / Telepon", dinormalisasi lewat SB.normWa).
   4. Admin menerima bukti transfer di WA, memverifikasi di menu
      Donasi — data otomatis masuk rekapan laporan & progres program.
   ============================================================ */
window.SB = window.SB || {};
(function () {
  "use strict";
  const S = SB;
  const $ = (s) => document.querySelector(s);

  let programs = [];
  let terpilih = null;
  let donasiTerakhir = null;
  let pesanWa = "";

  function tandai(el, ok) {
    const f = el.closest(".field");
    if (f) f.classList.toggle("has-err", !ok);
    return ok;
  }

  /* ---------- Ringkasan program terpilih ---------- */
  function renderRingkasan(r) {
    const box = $("#cp-ringkas-isi");
    if (!r) { box.innerHTML = '<p style="font-size:13px;color:var(--abu)">Pilih program dari daftar.</p>'; return; }
    const pct = r.kebutuhan > 0 ? Math.min(100, Math.round((r.terkumpul / r.kebutuhan) * 100)) : 0;
    box.innerHTML =
      S.badgeKategori(r.kategori) +
      "<h3 style='font-size:15px;margin:10px 0 6px'>" + S.esc(r.judul) + "</h3>" +
      '<p style="font-size:12.5px;color:var(--abu);margin-bottom:8px">' + S.icon("pin", 12) + " " + S.esc(r.kota || "-") + " · " + S.esc(r.sub || "") + "</p>" +
      '<div class="req-prog"><span>Terkumpul <b>' + S.rupiah(r.terkumpul) + "</b></span><span>" + pct + "%</span></div>" +
      S.progress(r.terkumpul, r.kebutuhan) +
      '<p style="font-size:12.5px;color:var(--abu);margin-top:9px">' + S.esc(String(r.deskripsi || "").slice(0, 130)) + "...";
  }

  /* ---------- Daftar program ---------- */
  async function muatProgram() {
    const sel = $("#cp-program");
    try {
      programs = await S.store.listRequests({ publikOnly: true });
    } catch (e) { programs = []; }
    sel.innerHTML = '<option value="">Pilih program...</option>' + programs.map((r) =>
      '<option value="' + r.id + '">' + S.esc(r.code + " — " + String(r.judul || "").slice(0, 60)) + "</option>").join("");
    sel.addEventListener("change", () => {
      terpilih = programs.find((r) => r.id === sel.value) || null;
      renderRingkasan(terpilih);
    });
    const param = S.param("program");
    if (param && programs.some((r) => r.id === param)) { sel.value = param; sel.dispatchEvent(new Event("change")); }
  }

  /* ---------- Chip nominal cepat ---------- */
  function initNominal() {
    const g = $("#cp-nominal-group");
    const inp = $("#cp-jumlah");
    g.querySelectorAll(".pill").forEach((p) => {
      p.addEventListener("click", () => {
        g.querySelectorAll(".pill").forEach((x) => x.classList.remove("on"));
        p.classList.add("on");
        inp.value = p.dataset.nominal;
        tandai(inp, true);
      });
    });
    inp.addEventListener("input", () => g.querySelectorAll(".pill").forEach((x) => x.classList.remove("on")));
  }

  /* ---------- Pesan WhatsApp otomatis ---------- */
  function buatPesanWa(d, r) {
    const appNama = SB.teks("app_nama");
    const baris = [
      "Halo Admin " + appNama + ",",
      "",
      "Saya sudah berdonasi lewat Jalur Cepat " + appNama + " dan ingin mengirim bukti transfer:",
      "",
      "• No. Kuitansi: " + d.kuitansi,
      "• Nama: " + (d.anonim ? d.donorNama + " (anonim)" : d.donorNama),
      "• No. WA saya: " + d.donorWa,
      "• Program: " + (r ? r.code + " — " + r.judul : "Donasi Umum"),
      "• Nominal: Rp " + Number(d.jumlah).toLocaleString("id-ID")
    ];
    if (d.pesan) baris.push("• Pesan/Doa: " + d.pesan);
    baris.push("", "Bukti transfer saya kirim pada chat ini. Terima kasih.");
    return baris.join("\n");
  }

  /* ---------- Tampilan sukses ---------- */
  function tampilSukses(d, r) {
    pesanWa = buatPesanWa(d, r);
    $("#cp-form-wrap").style.display = "none";
    const sukses = $("#cp-sukses");
    sukses.style.display = "block";
    sukses.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#cp-receipt").innerHTML =
      "<dt>No. Kuitansi</dt><dd><b>" + S.esc(d.kuitansi) + "</b></dd>" +
      "<dt>Nama</dt><dd>" + S.esc(d.donorNama) + (d.anonim ? " (disamarkan)" : "") + "</dd>" +
      "<dt>No. WhatsApp</dt><dd>" + S.esc(d.donorWa) + "</dd>" +
      "<dt>Program</dt><dd>" + S.esc(r ? r.code + " — " + r.judul : "Donasi Umum") + "</dd>" +
      "<dt>Nominal</dt><dd><b>" + S.rupiah(d.jumlah) + "</b></dd>" +
      (d.pesan ? "<dt>Pesan / Doa</dt><dd>“" + S.esc(d.pesan) + "”</dd>" : "") +
      "<dt>Status</dt><dd><span class='badge st-abu'>Menunggu verifikasi admin</span></dd>";
    $("#cp-info-rek").innerHTML =
      "Transfer <b>" + S.rupiah(d.jumlah) + "</b> ke <b>" + S.esc(SB.teks("bank_nama")) +
      " " + S.esc(SB.teks("bank_rekening")) + "</b> a.n. <b>" + S.esc(SB.teks("bank_atas_nama")) +
      "</b>, lalu kirim buktinya lewat WhatsApp.";
    /* Nomor admin dari CMS (Isi Website -> Identitas -> Nomor WhatsApp) */
    const adminWa = S.normWa(SB.teks("wa_kontak"));
    const btn = $("#cp-wa-btn");
    if (adminWa.valid) {
      btn.classList.remove("btn-outline");
      btn.classList.add("btn-primary");
      btn.removeAttribute("disabled");
      btn.setAttribute("href", adminWa.link + "?text=" + encodeURIComponent(pesanWa));
      btn.innerHTML = S.icon("message", 18) + " Kirim Bukti Transfer via WhatsApp (" + S.esc(adminWa.nomor) + ")";
    } else {
      btn.removeAttribute("href");
      btn.setAttribute("disabled", "disabled");
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline");
      btn.innerHTML = S.icon("message", 18) + " Nomor WhatsApp admin belum diatur";
    }
  }

  /* ---------- Salin pesan (fallback tanpa clipboard API) ---------- */
  function salinPesan() {
    if (!pesanWa) return;
    const selesai = () => S.toast("Pesan WhatsApp tersalin — tempel ke chat admin yayasan.", "sukses");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pesanWa).then(selesai).catch(() => salinManual(selesai));
    } else salinManual(selesai);
  }
  function salinManual(setelah) {
    try {
      const t = document.createElement("textarea");
      t.value = pesanWa;
      t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
      setelah();
    } catch (e) { S.toast("Gagal menyalin — silakan salin manual dari teks kuitansi.", "gagal"); }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (SB.muatKonten) await SB.muatKonten(); /* teks rekening & nomor WA ikut CMS */
    $("#cp-bank-nama").textContent = SB.teks("bank_nama");
    $("#cp-bank-rek").textContent = SB.teks("bank_rekening");
    $("#cp-bank-an").textContent = SB.teks("bank_atas_nama");

    initNominal();
    await muatProgram();
    renderRingkasan(null);

    /* Submit — catat donasi tamu */
    $("#cp-kirim").addEventListener("click", async () => {
      const nama = $("#cp-nama").value.trim();
      const waInput = $("#cp-wa").value.trim();
      const jumlah = Number($("#cp-jumlah").value) || 0;
      let ok = tandai($("#cp-nama"), nama.length >= 3);
      ok = tandai($("#cp-wa"), S.normWa(waInput).valid) && ok;
      if (!terpilih) { S.toast("Pilih program donasi terlebih dahulu.", "gagal"); ok = false; }
      ok = tandai($("#cp-jumlah"), jumlah >= 10000) && ok;
      if (!ok) { if (terpilih) S.toast("Periksa kembali isianmu.", "gagal"); return; }

      const btn = $("#cp-kirim");
      btn.disabled = true; btn.textContent = "Mencatat...";
      try {
        const d = await S.store.createDonasiCepat({
          nama: nama,
          wa: waInput,
          requestId: terpilih.id,
          jumlah: jumlah,
          pesan: $("#cp-pesan").value.trim(),
          anonim: $("#cp-anonim").checked
        });
        donasiTerakhir = d;
        tampilSukses(d, terpilih);
        S.toast("Donasi tercatat! Nomor kuitansi " + d.kuitansi + " terbit.", "sukses");
      } catch (e2) {
        S.toast(e2.message || "Gagal mencatat donasi.", "gagal");
      } finally {
        btn.disabled = false; btn.textContent = "Catat Donasi Saya";
      }
    });

    $("#cp-salin").addEventListener("click", salinPesan);
    $("#cp-ulang").addEventListener("click", () => {
      donasiTerakhir = null; pesanWa = "";
      $("#cp-sukses").style.display = "none";
      $("#cp-form-wrap").style.display = "block";
      ["#cp-nama", "#cp-wa", "#cp-jumlah", "#cp-pesan"].forEach((s) => { $(s).value = ""; });
      $("#cp-anonim").checked = false;
      $("#cp-program").value = "";
      terpilih = null;
      renderRingkasan(null);
      $("#cp-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();
