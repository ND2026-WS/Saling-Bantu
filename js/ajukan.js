/* ============================================================
   SALING BANTU — ajukan.js (formulir pengajuan bantuan
   + daftar pengajuan milik pengguna dengan timeline 8 status)
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const $ = (s) => document.querySelector(s);

  let user = null;
  let fileFoto = null, fileDok = null;

  function isiKategori() {
    const sel = $("#a-kategori");
    Object.entries(S.KATEGORI).forEach(([k, m]) => {
      const o = document.createElement("option");
      o.value = k; o.textContent = m.label;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => {
      const sub = $("#a-sub");
      sub.innerHTML = "";
      const m = S.KATEGORI[sel.value];
      if (!m) { sub.disabled = true; sub.innerHTML = '<option value="">Pilih kategori dulu...</option>'; return; }
      sub.disabled = false;
      sub.innerHTML = '<option value="">Pilih kebutuhan...</option>' +
        m.sub.map((s) => '<option value="' + S.esc(s) + '">' + S.esc(s) + "</option>").join("");
    });
  }

  function pasangFile(dropSel, inputSel, chipSel, setter, label) {
    const drop = $(dropSel), input = $(inputSel), chip = $(chipSel);
    drop.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const f = input.files[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) { S.toast("Ukuran file maksimal 3 MB.", "gagal"); input.value = ""; return; }
      setter({ nama: f.name, ukuran: f.size, file: f });
      chip.innerHTML = '<span class="file-chip">' + S.icon("file", 13) + " " + S.esc(f.name) + " (" + Math.round(f.size / 1024) + " KB)</span>";
    });
  }

  function tandai(el, ok) {
    const f = el.closest(".field");
    if (f) f.classList.toggle("has-err", !ok);
    return ok;
  }

  function modalSukses(r) {
    S.modal({
      judul: "Pengajuan Terkirim",
      isi:
        '<div style="text-align:center;padding:8px 0">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:var(--hijau-muda);display:grid;place-items:center;margin:0 auto 14px;color:var(--hijau-tua)">' + S.icon("checkCircle", 30) + "</div>" +
        "<h3 style='font-size:18px;margin-bottom:6px'>Terima kasih, pengajuanmu sudah masuk!</h3>" +
        "<p style='color:var(--abu);font-size:14px'>Kode pengajuan: <b style='color:var(--tinta)'>" + S.esc(r.code) + "</b></p>" +
        "</div>" +
        '<div style="margin-top:16px">' + S.timeline(r.status) + "</div>" +
        '<div class="alert alert-info" style="margin-top:16px">' + S.icon("bell", 16) + "<span>Kamu akan menerima notifikasi di lonceng setiap ada perkembangan verifikasi. Pantau juga di dashboard.</span></div>",
      footer: '<a class="btn btn-primary" href="dashboard.html#pengajuan">Lihat di Dashboard</a>'
    });
  }

  function renderPengajuanSaya(list) {
    const box = $("#daftar-saya");
    if (!list.length) {
      box.innerHTML = S.kosong("Belum ada pengajuan. Formulir di atas siap kamu isi.", "file");
      return;
    }
    box.innerHTML = list.map((r) => {
      const logs = (r.riwayat || []);
      return (
        '<div class="card" style="padding:16px 18px;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
        '<div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">' +
        "<b style='font-size:14.5px'>" + S.esc(r.code) + "</b>" + S.badgeStatus(r.status) + S.badgeKategori(r.kategori) + "</div>" +
        '<button class="btn btn-ghost btn-sm" data-detail="' + r.id + '">' + S.icon("eye", 13) + " Detail</button>" +
        "</div>" +
        "<b style='font-size:15px;display:block;margin-bottom:4px'>" + S.esc(r.judul) + "</b>" +
        '<span style="font-size:12.5px;color:var(--abu)">' + S.tanggal(r.tanggal) + " · Terkumpul " + S.rupiah(r.terkumpul) + " dari " + S.rupiah(r.kebutuhan) + "</span>" +
        (r.status === "ditolak" && r.alasanTolak ? '<div class="alert alert-danger" style="margin-top:10px">' + S.icon("x", 15) + "<span><b>Alasan penolakan:</b> " + S.esc(r.alasanTolak) + "</span></div>" : "") +
        '<div style="margin-top:14px">' + S.timeline(r.status) + "</div>" +
        "</div>"
      );
    }).join("");
    box.querySelectorAll("[data-detail]").forEach((b) =>
      b.addEventListener("click", () => S.modalDetailPengajuan(b.dataset.detail, { tanpaBantu: true })));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    isiKategori();
    pasangFile("#drop-foto", "#a-foto", "#chip-foto", (f) => { fileFoto = f; }, "foto");
    pasangFile("#drop-dok", "#a-dok", "#chip-dok", (f) => { fileDok = f; }, "dokumen");

    user = await S.store.currentUser();
    if (!user) {
      $("#panel-login-dulu").style.display = "block";
      return;
    }
    $("#panel-ajukan").style.display = "block";
    $("#a-kontak").value = user.telepon || "";
    if (SB.MODE === "demo") {
      const al = $("#notifikasi-demo");
      al.style.display = "flex";
      al.innerHTML = S.icon("bell", 16) + "<span><b>Mode Demo aktif.</b> Data tersimpan di browser ini saja. Hubungkan Supabase lewat <b>js/config.js</b> untuk penyimpanan nyata.</span>";
    }

    try {
      renderPengajuanSaya(await S.store.listRequests({ userId: user.id }));
    } catch (e) { /* diam */ }

    $("#form-ajukan").addEventListener("submit", async (e) => {
      e.preventDefault();
      const kategori = $("#a-kategori").value;
      const sub = $("#a-sub").value;
      const judul = $("#a-judul").value.trim();
      const deskripsi = $("#a-deskripsi").value.trim();
      const kebutuhan = Number($("#a-kebutuhan").value) || 0;
      const kota = $("#a-kota").value.trim();
      const provinsi = $("#a-provinsi").value.trim();
      const kontak = $("#a-kontak").value.trim();
      const setuju = $("#a-setuju").checked;

      let ok = true;
      ok = tandai($("#a-kategori"), !!kategori) && ok;
      ok = tandai($("#a-sub"), !!sub) && ok;
      ok = tandai($("#a-judul"), judul.length >= 10) && ok;
      ok = tandai($("#a-deskripsi"), deskripsi.length >= 30) && ok;
      ok = tandai($("#a-kota"), kota.length >= 3) && ok;
      ok = tandai($("#a-kontak"), kontak.length >= 8) && ok;
      if (!ok) { S.toast("Periksa kembali isian yang ditandai merah.", "gagal"); return; }
      if (!setuju) { S.toast("Centang pernyataan kebenaran data terlebih dahulu.", "gagal"); return; }

      const btn = $("#btn-ajukan");
      btn.disabled = true; btn.textContent = "Mengirim...";
      try {
        const r = await S.store.createRequest({
          kategori, sub, judul, deskripsi, kebutuhan, kota, provinsi, kontak,
          foto: fileFoto, dokumen: fileDok
        });
        S.toast("Pengajuan terkirim dengan kode " + r.code, "sukses");
        modalSukses(r);
        renderPengajuanSaya(await S.store.listRequests({ userId: user.id }));
        $("#form-ajukan").reset();
        $("#chip-foto").innerHTML = ""; $("#chip-dok").innerHTML = "";
        $("#a-sub").disabled = true;
        fileFoto = null; fileDok = null;
        SB.refreshNotif && SB.refreshNotif();
      } catch (err) {
        S.toast(err.message || "Gagal mengirim pengajuan.", "gagal");
      } finally {
        btn.disabled = false; btn.textContent = "Kirim Pengajuan";
      }
    });
  });
})();
