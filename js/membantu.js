/* ============================================================
   SALING BANTU — membantu.js
   Tab: Beri bantuan (5 jenis), Volunteer, Komunitas
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const $ = (s) => document.querySelector(s);

  let user = null;
  let jenisDipilih = "finansial";
  let pengajuanTerpilih = null;
  let cacheEvents = [];
  let cacheComs = [];

  /* Hapus kegiatan/komunitas: tombol muncul untuk admin/pengelola,
     atau pembuat datanya sendiri (sama dengan kebijakan RLS Supabase). */
  function bolehHapus(pembuat) {
    if (!user) return false;
    return ["admin", "pengelola"].includes(user.peran) || (pembuat && pembuat === user.id);
  }

  /* ---------- Tabs ---------- */
  function initTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
        t.classList.add("on");
        ["donasi", "volunteer", "komunitas"].forEach((id) => {
          document.getElementById("tab-" + id).style.display = t.dataset.tab === id ? "block" : "none";
        });
        const hash = { donasi: "Beri%20Bantuan", volunteer: "Jadi%20Volunteer", komunitas: "Komunitas" };
        history.replaceState(null, "", "#" + t.dataset.tab);
      });
    });
    const h = (location.hash || "#donasi").slice(1);
    const tab = document.querySelector('.tab[data-tab="' + h + '"]');
    if (tab) tab.click();
  }

  /* ---------- Ringkasan pengajuan terpilih ---------- */
  function renderRingkasan(r) {
    const box = $("#ringkas-isi");
    if (!r) { box.innerHTML = '<p style="font-size:13px;color:var(--abu)">Pilih pengajuan dari daftar.</p>'; return; }
    const pct = r.kebutuhan > 0 ? Math.min(100, Math.round((r.terkumpul / r.kebutuhan) * 100)) : 0;
    box.innerHTML =
      S.badgeKategori(r.kategori) +
      "<h3 style='font-size:15px;margin:10px 0 6px'>" + S.esc(r.judul) + "</h3>" +
      '<p style="font-size:12.5px;color:var(--abu);margin-bottom:8px">' + S.icon("pin", 12) + " " + S.esc(r.kota) + " · " + S.esc(r.sub) + "</p>" +
      '<div class="req-prog"><span>Terkumpul <b>' + S.rupiah(r.terkumpul) + "</b></span><span>" + pct + "%</span></div>" +
      S.progress(r.terkumpul, r.kebutuhan) +
      '<p style="font-size:12.5px;color:var(--abu);margin-top:9px">' + S.esc(r.deskripsi.slice(0, 130)) + "...</p>";
  }

  async function muatPengajuan() {
    const sel = $("#t-pengajuan");
    const reqs = await S.store.listRequests({ publikOnly: true });
    sel.innerHTML = '<option value="">Pilih pengajuan...</option>' + reqs.map((r) =>
      '<option value="' + r.id + '">' + S.esc(r.code + " — " + r.judul.slice(0, 60)) + "</option>").join("");
    sel.addEventListener("change", async () => {
      if (!sel.value) { pengajuanTerpilih = null; renderRingkasan(null); return; }
      pengajuanTerpilih = reqs.find((r) => r.id === sel.value) || null;
      renderRingkasan(pengajuanTerpilih);
    });
    const param = S.param("request");
    if (param && reqs.some((r) => r.id === param)) { sel.value = param; sel.dispatchEvent(new Event("change")); }
    else renderRingkasan(null);
  }

  /* ---------- Jenis bantuan ---------- */
  function initJenis() {
    const g = $("#jenis-group");
    g.innerHTML = Object.entries(S.JENIS_BANTUAN).map(([k, m]) =>
      '<button type="button" class="pill' + (k === "finansial" ? " on" : "") + '" data-jenis="' + k + '">' +
      S.icon(m.icon, 14) + " " + m.label + "</button>").join("");
    g.querySelectorAll(".pill").forEach((p) => {
      p.addEventListener("click", () => {
        g.querySelectorAll(".pill").forEach((x) => x.classList.remove("on"));
        p.classList.add("on");
        jenisDipilih = p.dataset.jenis;
        const finansial = jenisDipilih === "finansial";
        $("#field-jumlah").style.display = finansial ? "block" : "none";
        $("#field-barang").style.display = finansial ? "none" : "block";
      });
    });
  }

  /* ---------- Kuitansi ---------- */
  function tampilKuitansi(d, r) {
    S.modal({
      judul: "Kuitansi Digital — " + d.kuitansi,
      lebar: 520,
      isi:
        '<div class="receipt print-area">' +
        '<div class="receipt-head"><div><b style="font-family:var(--font-judul)">' + S.esc(window.SB_CONFIG.APP_NAME) + "</b><br><small>Kuitansi Niat Baik</small></div>" +
        '<div style="text-align:right"><small>Status: <b>' + (d.status === "terkonfirmasi" ? "TERKONFIRMASI" : "MENUNGGU KONFIRMASI") + "</b></small><br><small>" + S.tanggalWaktu(d.tanggal) + "</small></div></div>" +
        '<dl class="kv">' +
        "<dt>No. Kuitansi</dt><dd><b>" + S.esc(d.kuitansi) + "</b></dd>" +
        "<dt>Pemberi</dt><dd>" + S.esc(d.donorNama) + (d.anonim ? " (disamarkan)" : "") + "</dd>" +
        "<dt>Jenis Bantuan</dt><dd>" + S.esc((S.JENIS_BANTUAN[d.jenis] || {}).label || d.jenis) + "</dd>" +
        (d.jenis === "finansial" ? "<dt>Nominal</dt><dd><b>" + S.rupiah(d.jumlah) + "</b></dd>" : "<dt>Bentuk Bantuan</dt><dd>" + S.esc(d.barang || "-") + "</dd>") +
        (r ? "<dt>Untuk Pengajuan</dt><dd>" + S.esc(r.code + " — " + r.judul) + "</dd>" : "") +
        (d.pesan ? "<dt>Pesan</dt><dd>“" + S.esc(d.pesan) + "”</dd>" : "") +
        "</dl>" +
        '<p style="font-size:11.5px;color:var(--abu);margin-top:14px">Dokumen ini sah sebagai bukti niat baik dan akan terkonfirmasi setelah verifikasi admin. Cetak/simpan sebagai pengingat.</p>' +
        "</div>",
      footer: '<button class="btn btn-ghost" id="kt-tutup">Tutup</button><button class="btn btn-primary" id="kt-cetak">' + S.icon("printer", 15) + " Cetak</button>"
    });
    $("#kt-tutup").addEventListener("click", S.modalClose);
    $("#kt-cetak").addEventListener("click", () => window.print());
  }

  /* ---------- Volunleer & Komunitas ---------- */
  function kartuKegiatan(e) {
    const kat = S.KATEGORI[e.kategori];
    return (
      '<div class="card" style="padding:16px 18px;margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<span class="badge st-biru">' + S.icon("calendar", 12) + " " + S.tanggal(e.tanggal) + "</span>" +
      (kat ? S.badgeKategori(e.kategori) : "") +
      '<span class="badge st-abu">' + S.esc(e.jenis) + "</span>" +
      "</div>" +
      '<span style="font-size:12.5px;color:var(--abu)">' + (e.terdaftar ? e.terdaftar.length : 0) + "/" + (e.kuota || "∞") + " terdaftar</span>" +
      "</div>" +
      "<b style='font-size:15.5px;display:block;margin:9px 0 4px'>" + S.esc(e.judul) + "</b>" +
      '<p style="font-size:13px;color:var(--abu)">' + S.esc(e.deskripsi) + "</p>" +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:11px">' +
      '<span style="font-size:12.5px;color:var(--abu)">' + S.icon("pin", 13) + " " + S.esc(e.lokasi || "-") + "</span>" +
      '<div style="display:flex;gap:8px;align-items:center">' +
      (bolehHapus(e.pembuat) ? '<button class="btn btn-danger btn-sm" data-hapus-ev="' + e.id + '">' + S.icon("trash", 13) + " Hapus</button>" : "") +
      '<button class="btn btn-primary btn-sm" data-ikuti="' + e.id + '">' + S.icon("check", 13) + " Daftar Ikut</button>" +
      "</div></div></div>"
    );
  }

  function kartuKomunitas(c) {
    const jumlah = c.jumlahAnggota != null ? c.jumlahAnggota : (c.anggota ? c.anggota.length : 0);
    return (
      '<div class="card" style="padding:16px 18px;margin-bottom:12px;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap">' +
      "<div><b style='font-size:15.5px'>" + S.esc(c.nama) + "</b>" +
      '<p style="font-size:13px;color:var(--abu);margin-top:3px">' + S.icon("pin", 12) + " " + S.esc(c.kota || "-") + " — " + S.esc(c.deskripsi) + "</p>" +
      '<small style="color:var(--abu-muda)">' + jumlah + " anggota</small></div>" +
      '<div style="display:flex;gap:8px;align-items:center">' +
      (bolehHapus(c.pembuat) ? '<button class="btn btn-danger btn-sm" data-hapus-com="' + c.id + '">' + S.icon("trash", 13) + " Hapus</button>" : "") +
      '<button class="btn btn-outline btn-sm" data-join="' + c.id + '">' + S.icon("plus", 13) + " Gabung</button>" +
      "</div></div>"
    );
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initTabs();
    initJenis();
    if (SB.muatKonten) await SB.muatKonten(); /* teks rekening ikut CMS "Isi Website" */
    $("#bank-nama").textContent = SB.teks ? SB.teks("bank_nama") : window.SB_CONFIG.BANK.nama;
    $("#bank-rek").textContent = SB.teks ? SB.teks("bank_rekening") : window.SB_CONFIG.BANK.rekening;
    $("#bank-an").textContent = SB.teks ? SB.teks("bank_atas_nama") : window.SB_CONFIG.BANK.atas_nama;

    user = await S.store.currentUser();
    if (!user) {
      const al = $("#login-info");
      al.style.display = "flex";
      al.innerHTML = S.icon("bell", 16) + "<span>Untuk memberi bantuan atau mendaftar volunteer, kamu perlu <a href='masuk.html?next=ingin-membantu.html'><b>masuk</b></a> terlebih dahulu. Tidak ingin membuat akun? Gunakan <a href='donasi-cepat.html'><b>Donasi Cepat</b></a> — cukup nama &amp; nomor WhatsApp. Tetap bisa melihat-lihat daftar di bawah.</span>";
    } else if (user.peran === "volunteer" || user.peran === "donatur" || user.peran === "penerima") {
      $("#panel-profil-volunteer").style.display = "block";
    }

    await muatPengajuan();

    /* Kegiatan — dimuat ulang otomatis setelah hapus/ubah (realtime juga memicunya) */
    const evBox = $("#daftar-kegiatan");
    async function muatKegiatan() {
      try {
        cacheEvents = await S.store.listEvents();
        evBox.innerHTML = cacheEvents.length ? cacheEvents.map(kartuKegiatan).join("") : S.kosong("Belum ada kegiatan terjadwal.", "calendar");
        evBox.querySelectorAll("[data-ikuti]").forEach((b) => {
          b.addEventListener("click", async () => {
            if (!user) { S.toast("Masuk dulu untuk mendaftar kegiatan.", "info"); setTimeout(() => location.href = "masuk.html?next=ingin-membantu.html", 800); return; }
            try {
              await S.store.registerEvent(b.dataset.ikuti);
              S.toast("Berhasil mendaftar! Cek notifikasi untuk detail.", "sukses");
              SB.refreshNotif && SB.refreshNotif();
            } catch (e2) { S.toast(e2.message, "gagal"); }
          });
        });
        evBox.querySelectorAll("[data-hapus-ev]").forEach((b) => {
          b.addEventListener("click", async () => {
            const ev = cacheEvents.find((x) => x.id === b.dataset.hapusEv);
            if (!ev) return;
            if (!(await S.konfirmasi("Hapus kegiatan \"" + ev.judul.slice(0, 60) + "\"? Seluruh pendaftaran peserta ikut terhapus.", "Ya, hapus kegiatan"))) return;
            try {
              await S.store.deleteEvent(ev.id);
              S.toast("Kegiatan telah dihapus.", "sukses");
              muatKegiatan();
            } catch (e2) { S.toast(e2.message, "gagal"); }
          });
        });
      } catch (e) { evBox.innerHTML = S.kosong("Gagal memuat kegiatan: " + e.message, "calendar"); }
    }
    await muatKegiatan();

    /* Profil volunteer */
    if (user) {
      try {
        const v = await S.store.getVolunteer(user.id);
        if (v) $("#isi-profil-volunteer").innerHTML =
          '<div class="alert alert-sukses">' + S.icon("checkCircle", 16) + "<span>Kamu sudah terdaftar sebagai volunteer" + (v.kota ? " di " + S.esc(v.kota) : "") + ". Keahlian: <b>" + S.esc((v.keahlian || []).join(", ") || "-") + "</b></span></div>";
      } catch (e) { /* diam */ }
    }

    /* Komunitas — dimuat ulang otomatis setelah gabung/buat/hapus */
    const comBox = $("#daftar-komunitas");
    async function muatKomunitas() {
      try {
        cacheComs = await S.store.listCommunities();
        comBox.innerHTML = cacheComs.length ? cacheComs.map(kartuKomunitas).join("") : S.kosong("Belum ada komunitas. Jadilah yang pertama!", "users");
        comBox.querySelectorAll("[data-join]").forEach((b) => {
          b.addEventListener("click", async () => {
            if (!user) { S.toast("Masuk dulu untuk bergabung.", "info"); return; }
            try { await S.store.joinCommunity(b.dataset.join); S.toast("Berhasil bergabung dengan komunitas!", "sukses"); muatKomunitas(); }
            catch (e2) { S.toast(e2.message, "gagal"); }
          });
        });
        comBox.querySelectorAll("[data-hapus-com]").forEach((b) => {
          b.addEventListener("click", async () => {
            const c = cacheComs.find((x) => x.id === b.dataset.hapusCom);
            if (!c) return;
            if (!(await S.konfirmasi("Hapus komunitas \"" + c.nama.slice(0, 60) + "\"? Keanggotaan dan data komunitas ikut terhapus.", "Ya, hapus komunitas"))) return;
            try {
              await S.store.deleteCommunity(c.id);
              S.toast("Komunitas telah dihapus.", "sukses");
              muatKomunitas();
            } catch (e2) { S.toast(e2.message, "gagal"); }
          });
        });
      } catch (e) { comBox.innerHTML = S.kosong("Gagal memuat komunitas.", "users"); }
    }
    await muatKomunitas();

    /* Submit volunteer */
    $("#btn-volunteer").addEventListener("click", async () => {
      if (!user) { S.toast("Masuk dulu untuk mendaftar volunteer.", "info"); setTimeout(() => location.href = "masuk.html?next=ingin-membantu.html", 800); return; }
      const keahlian = $("#v-keahlian").value.split(",").map((x) => x.trim()).filter(Boolean);
      const okK = tandai($("#v-keahlian"), keahlian.length > 0);
      const okKota = tandai($("#v-kota"), $("#v-kota").value.trim().length >= 3);
      if (!okK || !okKota) return;
      try {
        await S.store.upsertVolunteer({ keahlian, kota: $("#v-kota").value.trim(), ketersediaan: $("#v-waktu").value });
        S.toast("Kamu resmi jadi volunteer. Terima kasih!", "sukses");
        $("#panel-profil-volunteer").style.display = "block";
        $("#isi-profil-volunteer").innerHTML = '<div class="alert alert-sukses">' + S.icon("checkCircle", 16) + "<span>Profil volunteer tersimpan. Keahlian: <b>" + S.esc(keahlian.join(", ")) + "</b></span></div>";
      } catch (e2) { S.toast(e2.message, "gagal"); }
    });

    /* Submit komunitas */
    $("#btn-komunitas").addEventListener("click", async () => {
      if (!user) { S.toast("Masuk dulu untuk membuat komunitas.", "info"); return; }
      const nama = $("#c-nama").value.trim();
      if (!tandai($("#c-nama"), nama.length >= 5)) return;
      try {
        await S.store.createCommunity({ nama, kota: $("#c-kota").value.trim(), deskripsi: $("#c-desk").value.trim() });
        S.toast("Komunitas berhasil dibuat!", "sukses");
        muatKomunitas();
      } catch (e2) { S.toast(e2.message, "gagal"); }
    });

    /* Submit donasi */
    $("#btn-donasi").addEventListener("click", async () => {
      if (!user) { S.toast("Masuk dulu untuk memberi bantuan.", "info"); setTimeout(() => location.href = "masuk.html?next=ingin-membantu.html", 800); return; }
      if (!pengajuanTerpilih) { S.toast("Pilih pengajuan terlebih dahulu.", "gagal"); return; }
      let ok = true;
      let jumlah = 0, barang = "";
      if (jenisDipilih === "finansial") {
        jumlah = Number($("#t-jumlah").value) || 0;
        ok = tandai($("#t-jumlah"), jumlah >= 10000) && ok;
      } else {
        barang = $("#t-barang").value.trim();
        ok = tandai($("#t-barang"), barang.length >= 10) && ok;
        if (jenisDipilih === "barang") jumlah = 0;
      }
      if (!ok) { S.toast("Periksa kembali isianmu.", "gagal"); return; }
      if (jenisDipilih !== "finansial" && jumlah === 0) jumlah = 0;

      const btn = $("#btn-donasi");
      btn.disabled = true; btn.textContent = "Mengirim...";
      try {
        const d = await S.store.createDonation({
          requestId: pengajuanTerpilih.id, jenis: jenisDipilih,
          jumlah: jumlah, barang: barang,
          pesan: $("#t-pesan").value.trim(), anonim: $("#t-anonim").checked
        });
        S.toast("Niat baikmu tercatat! Menunggu konfirmasi admin.", "sukses");
        tampilKuitansi(d, pengajuanTerpilih);
        $("#t-jumlah").value = ""; $("#t-barang").value = ""; $("#t-pesan").value = "";
        SB.refreshNotif && SB.refreshNotif();
      } catch (e2) {
        S.toast(e2.message || "Gagal mengirim donasi.", "gagal");
      } finally {
        btn.disabled = false; btn.textContent = "Kirim Niat Baik Saya";
      }
    });
  });

  function tandai(el, ok) {
    const f = el.closest(".field");
    if (f) f.classList.toggle("has-err", !ok);
    return ok;
  }
})();
